import { loadPg } from "../pg";
import { runMigrations } from "../migrations";

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error("DATABASE_URL is required for forward-only migrations.");
}

const { Client } = loadPg();
const client = new Client({ connectionString });
await client.connect();
try {
  const applied = await runMigrations(client);
  process.stdout.write(
    applied.length === 0
      ? "Database is already up to date.\n"
      : `Applied ${applied.length} migration(s): ${applied.map(({ name }) => name).join(", ")}\n`,
  );
} finally {
  await client.end();
}
