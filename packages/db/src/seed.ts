import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PgClient } from "./pg";

export const DEFAULT_SEED_FILE = fileURLToPath(
  new URL("../seeds/0001_synthetic_westblick.sql", import.meta.url),
);

export async function seedSyntheticDemo(
  database: PgClient,
  seedFile = DEFAULT_SEED_FILE,
): Promise<void> {
  const sql = await readFile(seedFile, "utf8");
  await database.query("BEGIN");
  try {
    await database.query(sql);
    await database.query("COMMIT");
  } catch (error) {
    await database.query("ROLLBACK");
    throw error;
  }
}
