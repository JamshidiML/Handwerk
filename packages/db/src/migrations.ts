import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PgClient } from "./pg";

export const DEFAULT_MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

export interface AppliedMigration {
  name: string;
  checksumSha256: string;
}

function checksum(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

export async function runMigrations(
  database: PgClient,
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
): Promise<AppliedMigration[]> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum_sha256 text NOT NULL CHECK (length(checksum_sha256) = 64),
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )
  `);
  await database.query("SELECT pg_advisory_lock(hashtext($1))", [
    "handwerk-schema-migrations-v1",
  ]);

  try {
    const names = (await readdir(migrationsDirectory))
      .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
      .sort();
    const applied: AppliedMigration[] = [];

    for (const name of names) {
      const contents = await readFile(`${migrationsDirectory}/${name}`, "utf8");
      const checksumSha256 = checksum(contents);
      const existing = await database.query<{ checksum_sha256: string }>(
        "SELECT checksum_sha256 FROM schema_migrations WHERE name = $1",
        [name],
      );
      if (existing.rows[0] !== undefined) {
        if (existing.rows[0].checksum_sha256 !== checksumSha256) {
          throw new Error(`Applied migration ${name} has changed on disk.`);
        }
        continue;
      }

      await database.query("BEGIN");
      try {
        await database.query(contents);
        await database.query(
          "INSERT INTO schema_migrations (name, checksum_sha256) VALUES ($1, $2)",
          [name, checksumSha256],
        );
        await database.query("COMMIT");
      } catch (error) {
        await database.query("ROLLBACK");
        throw error;
      }
      applied.push({ name, checksumSha256 });
    }
    return applied;
  } finally {
    await database.query("SELECT pg_advisory_unlock(hashtext($1))", [
      "handwerk-schema-migrations-v1",
    ]);
  }
}
