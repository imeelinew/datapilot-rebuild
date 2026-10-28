import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { PoolClient } from 'pg'
import { loadConfig } from './config.js'
import { createDatabase, type Database } from './db.js'

export async function applyMigrations(db: Database): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const directory = path.resolve(process.cwd(), 'migrations')
  const files = (await readdir(directory))
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const exists = await db.query<{ version: string }>(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [file],
    )
    if (exists.rowCount) continue

    const sql = await readFile(path.join(directory, file), 'utf8')
    const client = await db.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations(version) VALUES ($1)',
        [file],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig()
  const db = createDatabase(config.databaseUrl, { ssl: config.databaseSsl })
  try {
    await applyMigrations(db)
    console.log('Database migrations applied')
  } finally {
    await db.pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
