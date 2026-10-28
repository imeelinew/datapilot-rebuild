import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppConfig } from '../config.js'
import type { Database } from '../db.js'
import {
  chartQuerySchema,
  cityFields,
  executeWhitelistedQuery,
} from '../domain.js'
import { AppError } from '../errors.js'
import { authenticate, ok, parse } from '../http.js'

const idParams = z.object({ id: z.coerce.number().int().positive() })
const tableParams = idParams.extend({ table: z.string().trim().min(1).max(100) })
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
})

async function requireSeedDatasource(db: Database, id: number): Promise<void> {
  const result = await db.query(
    "SELECT id FROM datasources WHERE id = $1 AND status = 1 AND type = 'postgres-seed'",
    [id],
  )
  if (!result.rowCount) throw new AppError(404, '数据源不存在或不可用')
}

export async function registerDatasourceRoutes(
  app: FastifyInstance,
  db: Database,
  config: AppConfig,
): Promise<void> {
  app.get('/api/datasources', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const query = parse(listQuery, request.query)
    const total = await db.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM datasources WHERE status = 1',
    )
    const result = await db.query(
      `SELECT id, name, type, config, status, description, created_by,
              created_at, updated_at
       FROM datasources WHERE status = 1
       ORDER BY id LIMIT $1 OFFSET $2`,
      [query.pageSize, (query.page - 1) * query.pageSize],
    )
    return ok(reply, {
      list: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        config: row.config,
        status: row.status,
        description: row.description,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at as string).toISOString(),
        updatedAt: new Date(row.updated_at as string).toISOString(),
      })),
      total: Number(total.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.get('/api/datasources/:id/tables', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const { id } = parse(idParams, request.params)
    await requireSeedDatasource(db, id)
    return ok(reply, [{ tableName: 'cities' }])
  })

  app.get('/api/datasources/:id/tables/:table/fields', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const { id, table } = parse(tableParams, request.params)
    await requireSeedDatasource(db, id)
    if (table !== 'cities') throw new AppError(404, '数据表不存在')
    return ok(reply, Object.entries(cityFields).map(([columnName, dataType]) => ({
      columnName,
      dataType,
    })))
  })

  app.post('/api/datasources/:id/query', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const { id } = parse(idParams, request.params)
    await requireSeedDatasource(db, id)
    const query = parse(chartQuerySchema, request.body)
    return ok(reply, await executeWhitelistedQuery(db, query))
  })
}
