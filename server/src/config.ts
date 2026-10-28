export type AppConfig = {
  databaseUrl: string
  databaseSsl: boolean
  jwtSecret: string
  host: string
  port: number
  corsOrigins: string[]
  uploadMaxBytes: number
  aiApiKey?: string
  aiBaseUrl: string
  aiModel: string
  aiTimeoutMs: number
  aiMaxOutputTokens: number
  aiMaxOutputChars: number
}

function parseBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true'
}

function positiveInteger(
  name: string,
  raw: string | undefined,
  fallback: number,
  max: number,
): number {
  const value = Number(raw ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`)
  }
  return value
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL?.trim()
  const jwtSecret = env.JWT_SECRET?.trim()

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters')
  }

  const port = Number(env.PORT ?? 3102)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be a valid TCP port')
  }

  const aiApiKey = env.AI_API_KEY?.trim()
  return {
    databaseUrl,
    databaseSsl: parseBoolean(env.DATABASE_SSL),
    jwtSecret,
    host: env.HOST?.trim() || '127.0.0.1',
    port,
    corsOrigins: (
      env.CORS_ORIGIN ||
      'http://localhost:5173,http://127.0.0.1:5173'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    uploadMaxBytes: positiveInteger(
      'UPLOAD_MAX_BYTES',
      env.UPLOAD_MAX_BYTES,
      2 * 1024 * 1024,
      20 * 1024 * 1024,
    ),
    aiBaseUrl: (env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    aiModel: env.AI_MODEL?.trim() || 'gpt-4.1-mini',
    aiTimeoutMs: positiveInteger('AI_TIMEOUT_MS', env.AI_TIMEOUT_MS, 30_000, 120_000),
    aiMaxOutputTokens: positiveInteger(
      'AI_MAX_OUTPUT_TOKENS',
      env.AI_MAX_OUTPUT_TOKENS,
      800,
      32_000,
    ),
    aiMaxOutputChars: positiveInteger(
      'AI_MAX_OUTPUT_CHARS',
      env.AI_MAX_OUTPUT_CHARS,
      16_000,
      100_000,
    ),
    ...(aiApiKey ? { aiApiKey } : {}),
  }
}
