import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDatabase } from './db.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const db = createDatabase(config.databaseUrl, { ssl: config.databaseSsl })
  const app = await buildApp({ db, config, logger: true })

  const shutdown = async () => {
    await app.close()
    await db.pool.end()
  }
  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())

  try {
    await app.listen({ host: config.host, port: config.port })
  } catch (error) {
    await shutdown()
    throw error
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
