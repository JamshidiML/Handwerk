import { loadPg } from "../pg";
import { seedSyntheticDemo } from "../seed";

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error("DATABASE_URL is required for the synthetic demo seed.");
}

const { Client } = loadPg();
const client = new Client({ connectionString });
await client.connect();
try {
  await seedSyntheticDemo(client);
  process.stdout.write("Synthetic Westblick demo seed applied.\n");
} finally {
  await client.end();
}
