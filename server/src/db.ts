import pg, { type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

const { Pool } = pg

export type Database = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>
  pool: InstanceType<typeof Pool>
}

export function createDatabase(
  connectionString: string,
  options: { ssl?: boolean; schema?: string } = {},
): Database {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: options.ssl ? { rejectUnauthorized: false } : false,
    ...(options.schema ? { options: `-c search_path=${options.schema}` } : {}),
  })

  return {
    pool,
    query: (text, values) => pool.query(text, values),
  }
}

export async function withTransaction<T>(
  db: Database,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
