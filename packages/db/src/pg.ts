import { createRequire } from "node:module";

export interface QueryResult<Row> {
  rows: Row[];
  rowCount: number | null;
}

export interface PgQueryable {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface PgClient extends PgQueryable {
  connect(): Promise<void>;
  end(): Promise<void>;
  release?: () => void;
}

export interface PgPool extends PgQueryable {
  connect(): Promise<PgClient>;
  end(): Promise<void>;
}

interface PgConstructor<T> {
  new (config: { connectionString: string }): T;
}

interface PgModule {
  Client: PgConstructor<PgClient>;
  Pool: PgConstructor<PgPool>;
}

export function loadPg(): PgModule {
  const require = createRequire(import.meta.url);
  return require("pg") as PgModule;
}

export async function withTransaction<T>(
  database: PgPool,
  operation: (client: PgClient) => Promise<T>,
): Promise<T> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    if ("release" in client && typeof client.release === "function") {
      client.release();
    }
  }
}
