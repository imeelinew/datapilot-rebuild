import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import type { AppConfig } from './config.js'
import type { Database } from './db.js'
import { AppError } from './errors.js'
import { registerAiRoutes } from './routes/ai.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerCityRoutes } from './routes/cities.js'
import { registerDashboardRoutes } from './routes/dashboards.js'
import { registerDatasourceRoutes } from './routes/datasources.js'
import { registerRoleRoutes, registerUserRoutes } from './routes/users.js'

export async function buildApp(options: {
  db: Database
  config: AppConfig
  logger?: boolean
}): Promise<FastifyInstance> {
  const { db, config } = options
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: false,
  })

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true)
      return callback(new AppError(403, 'Origin not allowed'), false)
    },
    credentials: false,
  })
  await app.register(rateLimit, { global: false })
  await app.register(multipart, {
    limits: {
      fileSize: config.uploadMaxBytes,
      files: 1,
      fields: 5,
    },
  })

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'SAMEORIGIN')
    reply.header('Referrer-Policy', 'same-origin')
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    return payload
  })

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error instanceof AppError
      ? error.statusCode
      : error.statusCode && error.statusCode >= 400 && error.statusCode < 500
        ? error.statusCode
        : 500
    if (statusCode >= 500) request.log.error({ err: error }, 'request failed')
    const message = statusCode >= 500 && !(error instanceof AppError)
      ? '服务暂时不可用'
      : error.message
    return reply.code(statusCode).send({
      code: statusCode,
      message,
      ...(error instanceof AppError && error.details !== undefined
        ? { details: error.details }
        : {}),
      data: null,
    })
  })

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({
    code: 404,
    message: '接口不存在',
    data: null,
  }))

  app.get('/api/health', async (_request, reply) => {
    try {
      await db.query('SELECT 1')
      return reply.send({
        code: 200,
        message: 'ok',
        data: { status: 'ok', database: 'ok' },
      })
    } catch {
      return reply.code(503).send({
        code: 503,
        message: 'database unavailable',
        data: { status: 'degraded', database: 'unavailable' },
      })
    }
  })

  await registerAuthRoutes(app, db, config)
  await registerUserRoutes(app, db, config)
  await registerRoleRoutes(app, db, config)
  await registerDatasourceRoutes(app, db, config)
  await registerDashboardRoutes(app, db, config)
  await registerCityRoutes(app, db, config)
  await registerAiRoutes(app, db, config)
  return app
}
