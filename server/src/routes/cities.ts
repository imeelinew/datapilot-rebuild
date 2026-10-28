import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppConfig } from '../config.js'
import type { Database } from '../db.js'
import { authenticate, ok, parse } from '../http.js'

const cityIdParams = z.object({ id: z.coerce.number().int().positive() })
const eventPageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(8),
})

function numeric(value: unknown): number {
  return Number(value ?? 0)
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function registerCityRoutes(
  app: FastifyInstance,
  db: Database,
  config: AppConfig,
): Promise<void> {
  app.get('/api/cities', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const result = await db.query(
      `SELECT id, name, province, population, area, gdp, lng, lat, created_at
       FROM cities ORDER BY population DESC`,
    )
    return ok(reply, result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      province: row.province,
      population: row.population,
      area: numeric(row.area),
      gdp: row.gdp === null ? null : numeric(row.gdp),
      lng: numeric(row.lng),
      lat: numeric(row.lat),
      createdAt: new Date(row.created_at as string).toISOString(),
    })))
  })

  app.get('/api/cities/overview', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const cities = await db.query<{
      total_cities: string
      avg_congestion: string | null
      avg_aqi: string | null
      avg_pm25: string | null
      avg_temperature: string | null
      avg_speed: string | null
    }>(
      `SELECT count(*)::text AS total_cities,
              avg(congestion_index) AS avg_congestion,
              avg(aqi) AS avg_aqi,
              avg(pm25) AS avg_pm25,
              avg(temperature) AS avg_temperature,
              avg(avg_speed) AS avg_speed
       FROM cities`,
    )
    const events = await db.query<{
      pending: string
      total: string
      processed: string
    }>(
      `SELECT count(*) FILTER (WHERE status = '待处理')::text AS pending,
              count(*)::text AS total,
              count(*) FILTER (WHERE status = '已处理')::text AS processed
       FROM city_events`,
    )
    const city = cities.rows[0]!
    const event = events.rows[0]!
    const total = Number(event.total)
    return ok(reply, {
      totalCities: Number(city.total_cities),
      avgCongestionIndex: city.avg_congestion === null ? null : numeric(city.avg_congestion),
      avgAqi: city.avg_aqi === null ? null : numeric(city.avg_aqi),
      avgPM25: city.avg_pm25 === null ? null : numeric(city.avg_pm25),
      avgTemperature: city.avg_temperature === null ? null : numeric(city.avg_temperature),
      avgSpeed: city.avg_speed === null ? null : numeric(city.avg_speed),
      pendingEvents: Number(event.pending),
      eventProcessRate: total === 0 ? 0 : Math.round(Number(event.processed) / total * 1000) / 10,
    })
  })

  app.get('/api/cities/facility-stats', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const result = await db.query<{ type: string; count: string }>(
      `SELECT type, sum(count)::text AS count
       FROM facilities GROUP BY type ORDER BY sum(count) DESC, type`,
    )
    return ok(reply, result.rows.map((row) => ({
      type: row.type,
      count: Number(row.count),
    })))
  })

  app.get('/api/cities/traffic-ranking', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const result = await db.query<{ name: string; value: string }>(
      `SELECT name, congestion_index::text AS value
       FROM cities ORDER BY congestion_index DESC LIMIT 10`,
    )
    return ok(reply, result.rows.map((row) => ({
      name: row.name,
      value: numeric(row.value),
    })))
  })

  app.get('/api/cities/traffic-heatmap', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const result = await db.query(
      `SELECT lng, lat, congestion_index, road_name
       FROM traffic_segments ORDER BY congestion_index DESC LIMIT 500`,
    )
    return ok(reply, result.rows.map((row) => ({
      lng: numeric(row.lng),
      lat: numeric(row.lat),
      congestionIndex: numeric(row.congestion_index),
      roadName: row.road_name,
    })))
  })

  app.get('/api/cities/event-stats', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const total = await db.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM city_events',
    )
    const byType = await db.query<{ key: string; count: string }>(
      `SELECT event_type AS key, count(*)::text AS count
       FROM city_events GROUP BY event_type ORDER BY count(*) DESC, event_type`,
    )
    const bySeverity = await db.query<{ key: string; count: string }>(
      `SELECT severity AS key, count(*)::text AS count
       FROM city_events GROUP BY severity ORDER BY count(*) DESC, severity`,
    )
    const byStatus = await db.query<{ key: string; count: string }>(
      `SELECT status AS key, count(*)::text AS count
       FROM city_events GROUP BY status ORDER BY count(*) DESC, status`,
    )
    return ok(reply, {
      total: Number(total.rows[0]?.total ?? 0),
      byType: byType.rows.map((row) => ({ type: row.key, count: Number(row.count) })),
      bySeverity: bySeverity.rows.map((row) => ({
        severity: row.key,
        count: Number(row.count),
      })),
      byStatus: byStatus.rows.map((row) => ({
        status: row.key,
        count: Number(row.count),
      })),
    })
  })

  app.get('/api/cities/events', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const query = parse(eventPageQuery, request.query)
    const total = await db.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM city_events',
    )
    const result = await db.query(
      `SELECT e.id, e.title, e.event_type, e.severity, e.status,
              e.reported_at, c.id AS city_id, c.name AS city_name
       FROM city_events e
       JOIN cities c ON c.id = e.city_id
       ORDER BY e.reported_at DESC, e.id DESC
       LIMIT $1 OFFSET $2`,
      [query.pageSize, (query.page - 1) * query.pageSize],
    )
    return ok(reply, {
      list: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        eventType: row.event_type,
        severity: row.severity,
        status: row.status,
        reportedAt: new Date(row.reported_at as string).toISOString(),
        city: { id: row.city_id, name: row.city_name },
      })),
      total: Number(total.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.get('/api/cities/:id/environment', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const { id } = parse(cityIdParams, request.params)
    const result = await db.query(
      `SELECT DISTINCT ON (district)
              id, city_id, district, aqi, pm25, pm10, temperature,
              humidity, noise, weather, recorded_at
       FROM environment_observations
       WHERE city_id = $1
       ORDER BY district, recorded_at DESC`,
      [id],
    )
    return ok(reply, result.rows.map((row) => ({
      id: row.id,
      cityId: row.city_id,
      district: row.district,
      aqi: numeric(row.aqi),
      pm25: numeric(row.pm25),
      pm10: numeric(row.pm10),
      temperature: numeric(row.temperature),
      humidity: numeric(row.humidity),
      noise: numeric(row.noise),
      weather: row.weather,
      recordedAt: new Date(row.recorded_at as string).toISOString(),
    })))
  })

  app.get('/api/export/cities', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const result = await db.query(
      `SELECT id, name, province, population, area, gdp, congestion_index,
              aqi, pm25, temperature, avg_speed
       FROM cities ORDER BY population DESC`,
    )
    const lines = [
      ['id', 'name', 'province', 'population', 'area', 'gdp', 'congestionIndex', 'aqi', 'pm25', 'temperature', 'avgSpeed'],
      ...result.rows.map((row) => [
        row.id, row.name, row.province, row.population, row.area, row.gdp,
        row.congestion_index, row.aqi, row.pm25, row.temperature, row.avg_speed,
      ]),
    ]
    return reply
      .header('Content-Disposition', 'attachment; filename="cities.csv"')
      .type('text/csv; charset=utf-8')
      .send(`\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}`)
  })

  app.get('/api/export/events', async (request, reply) => {
    await authenticate(request, db, config.jwtSecret)
    const result = await db.query(
      `SELECT e.id, e.title, e.event_type, e.severity, e.status,
              e.reported_at, c.name AS city_name
       FROM city_events e
       JOIN cities c ON c.id = e.city_id
       ORDER BY e.reported_at DESC`,
    )
    const lines = [
      ['id', 'city', 'title', 'eventType', 'severity', 'status', 'reportedAt'],
      ...result.rows.map((row) => [
        row.id, row.city_name, row.title, row.event_type, row.severity,
        row.status, row.reported_at,
      ]),
    ]
    return reply
      .header('Content-Disposition', 'attachment; filename="events.csv"')
      .type('text/csv; charset=utf-8')
      .send(`\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}`)
  })
}
