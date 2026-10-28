import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppConfig } from '../config.js'
import type { Database } from '../db.js'
import { withTransaction } from '../db.js'
import {
  chartQuerySchema,
  buildChartOption,
  executeWhitelistedQuery,
  requireDashboardPermission,
  type ChartQuery,
} from '../domain.js'
import { AppError } from '../errors.js'
import {
  authenticate,
  isAdministrator,
  ok,
  parse,
  requireRoles,
  type AuthUser,
} from '../http.js'

const idParams = z.object({ id: z.coerce.number().int().positive() })
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  keyword: z.string().trim().max(160).optional(),
})
const chartPageQuery = pageQuery.extend({
  dashboardId: z.coerce.number().int().positive().optional(),
  chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'table']).optional(),
})

const dashboardInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  layout: z.array(z.record(z.string(), z.unknown())).optional(),
  bgTheme: z.enum(['light', 'dark']).optional(),
}).strict()

const chartInput = z.object({
  dashboardId: z.number().int().positive(),
  datasourceId: z.number().int().positive().nullable(),
  title: z.string().trim().min(1).max(160),
  chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'table']),
  queryConfig: chartQuerySchema,
  chartConfig: z.record(z.string(), z.unknown()),
  position: z.record(z.string(), z.unknown()),
  sortOrder: z.number().int().min(0).max(1_000_000),
}).strict()

type DashboardRow = {
  id: number
  title: string
  description: string | null
  layout: Array<Record<string, unknown>>
  is_public: number
  bg_theme: 'light' | 'dark'
  created_by: number
  created_at: Date | string
  updated_at: Date | string
  creator_id: number
  creator_username: string
  chart_count: string
}

type ChartRow = {
  id: number
  dashboard_id: number
  datasource_id: number | null
  title: string
  chart_type: string
  query_config: ChartQuery
  chart_config: Record<string, unknown>
  position: Record<string, unknown>
  sort_order: number
  created_at: Date | string
  updated_at: Date | string
  dashboard_title?: string
  datasource_name?: string | null
  datasource_type?: string | null
}

function mapDashboard(row: DashboardRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    layout: row.layout,
    isPublic: row.is_public,
    bgTheme: row.bg_theme,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    creator: { id: row.creator_id, username: row.creator_username },
    _count: { charts: Number(row.chart_count) },
  }
}

function mapChart(row: ChartRow) {
  return {
    id: row.id,
    dashboardId: row.dashboard_id,
    datasourceId: row.datasource_id,
    title: row.title,
    chartType: row.chart_type,
    queryConfig: row.query_config,
    chartConfig: row.chart_config,
    position: row.position,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    dashboard: row.dashboard_title
      ? { id: row.dashboard_id, title: row.dashboard_title }
      : undefined,
    datasource: row.datasource_id
      ? {
          id: row.datasource_id,
          name: row.datasource_name,
          type: row.datasource_type,
        }
      : null,
  }
}

const dashboardSelect = `
  SELECT d.*, u.id AS creator_id, u.username AS creator_username,
         (SELECT count(*)::text FROM charts c WHERE c.dashboard_id = d.id) AS chart_count
  FROM dashboards d
  JOIN users u ON u.id = d.created_by
`

function dashboardFilter(user: AuthUser, alias = 'd'): {
  condition: string
  values: unknown[]
} {
  if (isAdministrator(user)) return { condition: 'TRUE', values: [] }
  if (user.role.code === 'analyst') {
    return {
      condition: `(${alias}.created_by = $1 OR ${alias}.is_public = 1)`,
      values: [user.id],
    }
  }
  return { condition: `${alias}.is_public = 1`, values: [] }
}

async function getDashboard(db: Database, id: number): Promise<DashboardRow | null> {
  const result = await db.query<DashboardRow>(
    `${dashboardSelect} WHERE d.id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

async function ensureDatasource(db: Database, id: number | null): Promise<void> {
  if (id === null) return
  const result = await db.query(
    "SELECT id FROM datasources WHERE id = $1 AND status = 1 AND type = 'postgres-seed'",
    [id],
  )
  if (!result.rowCount) throw new AppError(400, '数据源不存在或不可用')
}

async function getChart(db: Database, id: number): Promise<ChartRow | null> {
  const result = await db.query<ChartRow>(
    `SELECT c.*, d.title AS dashboard_title, ds.name AS datasource_name,
            ds.type AS datasource_type
     FROM charts c
     JOIN dashboards d ON d.id = c.dashboard_id
     LEFT JOIN datasources ds ON ds.id = c.datasource_id
     WHERE c.id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

export async function registerDashboardRoutes(
  app: FastifyInstance,
  db: Database,
  config: AppConfig,
): Promise<void> {
  app.get('/api/dashboards', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const query = parse(pageQuery, request.query)
    const filter = dashboardFilter(user)
    const values = [...filter.values]
    let condition = filter.condition
    if (query.keyword) {
      values.push(`%${query.keyword}%`)
      condition += ` AND d.title ILIKE $${values.length}`
    }
    const count = await db.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM dashboards d WHERE ${condition}`,
      values,
    )
    const list = await db.query<DashboardRow>(
      `${dashboardSelect} WHERE ${condition}
       ORDER BY d.updated_at DESC, d.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, query.pageSize, (query.page - 1) * query.pageSize],
    )
    return ok(reply, {
      list: list.rows.map(mapDashboard),
      total: Number(count.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.post('/api/dashboards', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    requireRoles(user, ['super_admin', 'admin', 'analyst'])
    const input = parse(dashboardInput, request.body)
    const result = await db.query<{ id: number }>(
      `INSERT INTO dashboards(title, description, layout, bg_theme, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        input.title,
        input.description || null,
        JSON.stringify(input.layout ?? []),
        input.bgTheme ?? 'light',
        user.id,
      ],
    )
    return ok(reply, mapDashboard((await getDashboard(db, result.rows[0]!.id))!), '创建仪表盘成功')
  })

  app.get('/api/dashboards/:id', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const { id } = parse(idParams, request.params)
    await requireDashboardPermission(db, user, id, 'view')
    const dashboard = await getDashboard(db, id)
    if (!dashboard) throw new AppError(404, '仪表盘不存在')
    const charts = await db.query<ChartRow>(
      `SELECT c.*, ds.name AS datasource_name, ds.type AS datasource_type
       FROM charts c
       LEFT JOIN datasources ds ON ds.id = c.datasource_id
       WHERE c.dashboard_id = $1 ORDER BY c.sort_order, c.id`,
      [id],
    )
    return ok(reply, {
      ...mapDashboard(dashboard),
      charts: charts.rows.map(mapChart),
      mapLayers: [],
    })
  })

  app.post('/api/dashboards/:id/clone', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    requireRoles(user, ['super_admin', 'admin', 'analyst'])
    const { id } = parse(idParams, request.params)
    await requireDashboardPermission(db, user, id, 'edit')

    const clonedId = await withTransaction(db, async (client) => {
      const source = await client.query<{
        title: string
        description: string | null
        layout: Array<Record<string, unknown>>
        bg_theme: 'light' | 'dark'
      }>('SELECT title, description, layout, bg_theme FROM dashboards WHERE id = $1 FOR SHARE', [id])
      const dashboard = source.rows[0]
      if (!dashboard) throw new AppError(404, '仪表盘不存在')

      const created = await client.query<{ id: number }>(
        `INSERT INTO dashboards(title, description, layout, bg_theme, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          `${dashboard.title}（副本）`.slice(0, 160),
          dashboard.description,
          JSON.stringify(dashboard.layout),
          dashboard.bg_theme,
          user.id,
        ],
      )
      const cloneId = created.rows[0]!.id
      await client.query(
        `INSERT INTO charts(
           dashboard_id, datasource_id, title, chart_type, query_config,
           chart_config, position, sort_order
         )
         SELECT $1, datasource_id, title, chart_type, query_config,
                chart_config, position, sort_order
         FROM charts WHERE dashboard_id = $2
         ORDER BY sort_order, id`,
        [cloneId, id],
      )
      return cloneId
    })

    return ok(reply, mapDashboard((await getDashboard(db, clonedId))!), '复制仪表盘成功')
  })

  app.delete('/api/dashboards/:id', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    requireRoles(user, ['super_admin', 'admin', 'analyst'])
    const { id } = parse(idParams, request.params)
    await requireDashboardPermission(db, user, id, 'edit')
    await db.query('DELETE FROM dashboards WHERE id = $1', [id])
    return ok(reply, null, '删除仪表盘成功')
  })

  app.get('/api/charts', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const query = parse(chartPageQuery, request.query)
    const values: unknown[] = []
    const clauses: string[] = []
    if (query.keyword) {
      values.push(`%${query.keyword}%`)
      clauses.push(`c.title ILIKE $${values.length}`)
    }
    if (query.dashboardId) {
      values.push(query.dashboardId)
      clauses.push(`c.dashboard_id = $${values.length}`)
    }
    if (query.chartType) {
      values.push(query.chartType)
      clauses.push(`c.chart_type = $${values.length}`)
    }
    if (!isAdministrator(user) && user.role.code === 'analyst') {
      values.push(user.id)
      const index = values.length
      clauses.push(
        `(d.created_by = $${index} OR d.is_public = 1)`,
      )
    } else if (!isAdministrator(user)) {
      clauses.push('d.is_public = 1')
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const count = await db.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM charts c
       JOIN dashboards d ON d.id = c.dashboard_id ${where}`,
      values,
    )
    const list = await db.query<ChartRow>(
      `SELECT c.*, d.title AS dashboard_title, ds.name AS datasource_name,
              ds.type AS datasource_type
       FROM charts c
       JOIN dashboards d ON d.id = c.dashboard_id
       LEFT JOIN datasources ds ON ds.id = c.datasource_id
       ${where}
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, query.pageSize, (query.page - 1) * query.pageSize],
    )
    return ok(reply, {
      list: list.rows.map(mapChart),
      total: Number(count.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.post('/api/charts', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    requireRoles(user, ['super_admin', 'admin', 'analyst'])
    const input = parse(chartInput, request.body)
    await requireDashboardPermission(db, user, input.dashboardId, 'edit')
    await ensureDatasource(db, input.datasourceId)
    const id = await withTransaction(db, async (client) => {
      const result = await client.query<{ id: number }>(
        `INSERT INTO charts(
           dashboard_id, datasource_id, title, chart_type, query_config,
           chart_config, position, sort_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          input.dashboardId,
          input.datasourceId,
          input.title,
          input.chartType,
          JSON.stringify(input.queryConfig),
          JSON.stringify(input.chartConfig),
          JSON.stringify(input.position),
          input.sortOrder,
        ],
      )
      return result.rows[0]!.id
    })
    return ok(reply, mapChart((await getChart(db, id))!), '创建图表成功')
  })

  app.get('/api/charts/:id', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const { id } = parse(idParams, request.params)
    const chart = await getChart(db, id)
    if (!chart) throw new AppError(404, '图表不存在')
    await requireDashboardPermission(db, user, chart.dashboard_id, 'view')
    return ok(reply, mapChart(chart))
  })

  app.put('/api/charts/:id', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    requireRoles(user, ['super_admin', 'admin', 'analyst'])
    const { id } = parse(idParams, request.params)
    const existing = await getChart(db, id)
    if (!existing) throw new AppError(404, '图表不存在')
    await requireDashboardPermission(db, user, existing.dashboard_id, 'edit')
    const input = parse(chartInput, request.body)
    await requireDashboardPermission(db, user, input.dashboardId, 'edit')
    await ensureDatasource(db, input.datasourceId)
    await withTransaction(db, async (client) => {
      await client.query(
        `UPDATE charts SET
           dashboard_id = $1, datasource_id = $2, title = $3, chart_type = $4,
           query_config = $5, chart_config = $6, position = $7, sort_order = $8
         WHERE id = $9`,
        [
          input.dashboardId,
          input.datasourceId,
          input.title,
          input.chartType,
          JSON.stringify(input.queryConfig),
          JSON.stringify(input.chartConfig),
          JSON.stringify(input.position),
          input.sortOrder,
          id,
        ],
      )
    })
    return ok(reply, mapChart((await getChart(db, id))!), '更新图表成功')
  })

  app.delete('/api/charts/:id', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    requireRoles(user, ['super_admin', 'admin', 'analyst'])
    const { id } = parse(idParams, request.params)
    const chart = await getChart(db, id)
    if (!chart) throw new AppError(404, '图表不存在')
    await requireDashboardPermission(db, user, chart.dashboard_id, 'edit')
    await db.query('DELETE FROM charts WHERE id = $1', [id])
    return ok(reply, null, '删除图表成功')
  })

  app.post('/api/charts/:id/preview', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const { id } = parse(idParams, request.params)
    const chart = await getChart(db, id)
    if (!chart) throw new AppError(404, '图表不存在')
    await requireDashboardPermission(db, user, chart.dashboard_id, 'view')
    const data = await executeWhitelistedQuery(db, chart.query_config)
    return ok(reply, buildChartOption({
      title: chart.title,
      chartType: chart.chart_type,
      queryConfig: chart.query_config,
    }, data))
  })
}
