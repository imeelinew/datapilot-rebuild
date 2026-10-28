import { z } from 'zod'
import type { Database } from './db.js'
import { AppError } from './errors.js'
import type { AuthUser } from './http.js'

export const cityFields = {
  id: 'integer',
  name: 'text',
  province: 'text',
  population: 'integer',
  area: 'decimal',
  gdp: 'decimal',
  lng: 'decimal',
  lat: 'decimal',
  congestionIndex: 'decimal',
  aqi: 'decimal',
  pm25: 'decimal',
  temperature: 'decimal',
  avgSpeed: 'decimal',
} as const

export type CityField = keyof typeof cityFields

export const chartQuerySchema = z.object({
  table: z.literal('cities'),
  xField: z.enum(Object.keys(cityFields) as [CityField, ...CityField[]]),
  yField: z.enum(Object.keys(cityFields) as [CityField, ...CityField[]]),
  params: z.record(z.string(), z.unknown()).optional(),
  refreshInterval: z.number().int().min(0).max(86_400).optional(),
}).strict().refine((value) => value.xField !== value.yField, {
  message: 'X 字段和 Y 字段不能相同',
})

export type ChartQuery = z.infer<typeof chartQuerySchema>

const columnSql: Record<CityField, string> = {
  id: 'id',
  name: 'name',
  province: 'province',
  population: 'population',
  area: 'area',
  gdp: 'gdp',
  lng: 'lng',
  lat: 'lat',
  congestionIndex: 'congestion_index',
  aqi: 'aqi',
  pm25: 'pm25',
  temperature: 'temperature',
  avgSpeed: 'avg_speed',
}

export async function executeWhitelistedQuery(
  db: Database,
  input: ChartQuery,
): Promise<{
  columns: Array<{ columnName: string; dataType: string }>
  rows: Array<Record<string, unknown>>
  total: number
  sql: string
}> {
  const xField = input.xField
  const yField = input.yField
  const xColumn = columnSql[xField]
  const yColumn = columnSql[yField]
  const result = await db.query<Record<string, unknown>>(
    `SELECT ${xColumn} AS "${xField}", ${yColumn} AS "${yField}"
     FROM cities ORDER BY id LIMIT 500`,
  )
  const count = await db.query<{ total: string }>('SELECT count(*)::text AS total FROM cities')
  return {
    columns: [
      { columnName: xField, dataType: cityFields[xField] },
      { columnName: yField, dataType: cityFields[yField] },
    ],
    rows: result.rows,
    total: Number(count.rows[0]?.total ?? 0),
    sql: `SELECT ${xField}, ${yField} FROM cities LIMIT 500`,
  }
}

export function buildChartOption(
  chart: {
    title: string
    chartType: string
    queryConfig: { xField: CityField; yField: CityField }
  },
  data: {
    rows: Array<Record<string, unknown>>
  },
): Record<string, unknown> {
  const { xField, yField } = chart.queryConfig
  const rows = [...data.rows].sort(
    (first, second) => Number(second[yField] ?? 0) - Number(first[yField] ?? 0),
  )
  const maxItems = chart.chartType === 'pie' ? 8 : chart.chartType === 'scatter' ? 10 : 12
  const visible = rows.slice(0, maxItems)

  if (chart.chartType === 'bar' || chart.chartType === 'line') {
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: visible.map((row) => String(row[xField] ?? '')),
      },
      yAxis: { type: 'value' },
      series: [{
        name: chart.title,
        type: chart.chartType,
        data: visible.map((row) => Number(row[yField] ?? 0)),
      }],
    }
  }
  if (chart.chartType === 'pie') {
    return {
      tooltip: { trigger: 'item' },
      series: [{
        name: chart.title,
        type: 'pie',
        data: visible.map((row) => ({
          name: String(row[xField] ?? ''),
          value: Number(row[yField] ?? 0),
        })),
      }],
    }
  }
  if (chart.chartType === 'scatter') {
    return {
      tooltip: { trigger: 'item' },
      xAxis: { type: 'value' },
      yAxis: { type: 'value' },
      series: [{
        name: chart.title,
        type: 'scatter',
        data: visible.map((row) => [
          Number(row[xField] ?? 0),
          Number(row[yField] ?? 0),
        ]),
      }],
    }
  }
  throw new AppError(400, '该图表类型暂不支持服务端预览')
}

export async function dashboardAccess(
  db: Database,
  user: AuthUser,
  dashboardId: number,
): Promise<{ id: number; createdBy: number; isPublic: number } | null> {
  const result = await db.query<{
    id: number
    created_by: number
    is_public: number
  }>('SELECT id, created_by, is_public FROM dashboards WHERE id = $1', [dashboardId])
  const row = result.rows[0]
  if (!row) return null
  return { id: row.id, createdBy: row.created_by, isPublic: row.is_public }
}

export async function requireDashboardPermission(
  db: Database,
  user: AuthUser,
  dashboardId: number,
  mode: 'view' | 'edit',
): Promise<void> {
  const dashboard = await dashboardAccess(db, user, dashboardId)
  if (!dashboard) throw new AppError(404, '仪表盘不存在')
  const admin = user.role.code === 'super_admin' || user.role.code === 'admin'
  const allowed = admin ||
    (mode === 'edit'
      ? dashboard.createdBy === user.id
      : dashboard.isPublic === 1 || dashboard.createdBy === user.id)
  if (!allowed) throw new AppError(404, '仪表盘不存在')
}
