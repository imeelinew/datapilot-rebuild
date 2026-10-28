import type { PoolClient } from 'pg'
import { loadConfig } from './config.js'
import { createDatabase, type Database, withTransaction } from './db.js'
import { hashPassword } from './security.js'

export type SeedPasswords = {
  admin: string
  analyst: string
  user: string
}

type RoleSeed = {
  code: string
  name: string
  description: string
}

const roles: RoleSeed[] = [
  { code: 'super_admin', name: '超级管理员', description: '全部系统权限' },
  { code: 'admin', name: '管理员', description: '用户、角色与业务数据管理' },
  { code: 'analyst', name: '数据分析员', description: '维护本人仪表盘和图表' },
  { code: 'user', name: '普通用户', description: '查看公开仪表盘与城市数据' },
]

const cities = [
  ['上海', '上海', 24_870_000, 6340.5, 4.72, 121.4737, 31.2304, 7.8, 62, 28, 23.4, 38.2],
  ['北京', '北京', 21_860_000, 16410.5, 4.38, 116.4074, 39.9042, 8.1, 78, 36, 21.1, 35.4],
  ['深圳', '广东', 17_790_000, 1997.5, 3.68, 114.0579, 22.5431, 6.9, 51, 21, 27.8, 41.3],
  ['广州', '广东', 18_830_000, 7434.4, 3.15, 113.2644, 23.1291, 7.3, 58, 25, 28.5, 37.8],
  ['成都', '四川', 21_400_000, 14335, 2.31, 104.0665, 30.5723, 6.2, 66, 31, 20.7, 34.9],
  ['杭州', '浙江', 12_520_000, 16850, 2.18, 120.1551, 30.2741, 5.7, 49, 20, 22.6, 39.1],
] as const

async function seedRoles(client: PoolClient): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  for (const role of roles) {
    const result = await client.query<{ id: number }>(
      `INSERT INTO roles(code, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT(code) DO UPDATE
       SET name = EXCLUDED.name, description = EXCLUDED.description
       RETURNING id`,
      [role.code, role.name, role.description],
    )
    ids.set(role.code, result.rows[0]!.id)
  }
  return ids
}

async function seedPermissions(
  client: PoolClient,
  roleIds: Map<string, number>,
): Promise<void> {
  const root = await client.query<{ id: number }>(
    `INSERT INTO permissions(code, label, type, icon, sort_order)
     VALUES ('dashboard', '城市总览', 'menu', 'DashboardOutlined', 1)
     ON CONFLICT(code) DO UPDATE SET label = EXCLUDED.label
     RETURNING id`,
  )
  const data = await client.query<{ id: number }>(
    `INSERT INTO permissions(code, label, type, parent_id, icon, sort_order)
     VALUES ('data', '数据可视化', 'menu', $1, 'BarChartOutlined', 2)
     ON CONFLICT(code) DO UPDATE SET parent_id = EXCLUDED.parent_id
     RETURNING id`,
    [root.rows[0]!.id],
  )
  const visual = await client.query<{ id: number }>(
    `INSERT INTO permissions(code, label, type, parent_id, icon, sort_order)
     VALUES ('visual', '空间视图', 'menu', $1, 'GlobalOutlined', 3)
     ON CONFLICT(code) DO UPDATE SET parent_id = EXCLUDED.parent_id
     RETURNING id`,
    [root.rows[0]!.id],
  )

  const leafDefinitions = [
    ['dashboards', '仪表盘管理', data.rows[0]!.id, '/data/dashboards', 1],
    ['charts', '图表管理', data.rows[0]!.id, '/data/charts', 2],
    ['map', '城市地图', visual.rows[0]!.id, '/visual/map', 1],
    ['scene', '三维沙盘', visual.rows[0]!.id, '/visual/scene', 2],
    ['ai', 'AI 数据助手', root.rows[0]!.id, '/ai', 4],
    ['users', '用户管理', root.rows[0]!.id, '/settings/users', 5],
    ['roles', '角色权限', root.rows[0]!.id, '/settings/roles', 6],
  ] as const

  const permissionIds: Record<string, number> = {
    dashboard: root.rows[0]!.id,
  }
  for (const [code, label, parentId, path, sortOrder] of leafDefinitions) {
    const result = await client.query<{ id: number }>(
      `INSERT INTO permissions(code, label, type, parent_id, path, sort_order)
       VALUES ($1, $2, 'menu', $3, $4, $5)
       ON CONFLICT(code) DO UPDATE
       SET label = EXCLUDED.label, parent_id = EXCLUDED.parent_id,
           path = EXCLUDED.path, sort_order = EXCLUDED.sort_order
       RETURNING id`,
      [code, label, parentId, path, sortOrder],
    )
    permissionIds[code] = result.rows[0]!.id
  }

  await client.query('DELETE FROM role_permissions')
  const assigned: Record<string, string[]> = {
    super_admin: [...Object.keys(permissionIds), 'data', 'visual'],
    admin: [...Object.keys(permissionIds), 'data', 'visual'],
    analyst: ['dashboard', 'data', 'visual', 'dashboards', 'charts', 'map', 'scene', 'ai'],
    user: ['dashboard', 'map', 'ai'],
  }
  for (const [roleCode, permissionCodes] of Object.entries(assigned)) {
    for (const permissionCode of permissionCodes) {
      await client.query(
        `INSERT INTO role_permissions(role_id, permission_id)
         SELECT $1, id FROM permissions WHERE code = $2
         ON CONFLICT DO NOTHING`,
        [roleIds.get(roleCode), permissionCode],
      )
    }
  }
}

async function seedUsers(
  client: PoolClient,
  roleIds: Map<string, number>,
  passwords: SeedPasswords,
): Promise<number> {
  const definitions = [
    ['admin', 'admin@city.local', 'super_admin', passwords.admin],
    ['analyst', 'analyst@city.local', 'analyst', passwords.analyst],
    ['visitor', 'visitor@city.local', 'user', passwords.user],
  ] as const

  let adminId = 0
  for (const [username, email, roleCode, password] of definitions) {
    if (password.length < 8) {
      throw new Error(`Seed password for ${username} must contain at least 8 characters`)
    }
    const existing = await client.query<{ id: number }>(
      'SELECT id FROM users WHERE username = $1',
      [username],
    )
    if (existing.rows[0]) {
      const updated = await client.query<{ id: number }>(
        `UPDATE users SET role_id = $2, email = $3, password_hash = $4, status = 1
         WHERE id = $1 RETURNING id`,
        [existing.rows[0].id, roleIds.get(roleCode), email, await hashPassword(password)],
      )
      if (username === 'admin') adminId = updated.rows[0]!.id
      continue
    }

    const created = await client.query<{ id: number }>(
      `INSERT INTO users(username, password_hash, email, role_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [username, await hashPassword(password), email, roleIds.get(roleCode)],
    )
    if (username === 'admin') adminId = created.rows[0]!.id
  }
  return adminId
}

async function seedCityData(client: PoolClient, adminId: number): Promise<void> {
  const cityIds = new Map<string, number>()
  for (const city of cities) {
    const result = await client.query<{ id: number }>(
      `INSERT INTO cities(
         name, province, population, area, gdp, lng, lat,
         congestion_index, aqi, pm25, temperature, avg_speed
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT(name) DO UPDATE SET
         province = EXCLUDED.province,
         population = EXCLUDED.population,
         area = EXCLUDED.area,
         gdp = EXCLUDED.gdp,
         lng = EXCLUDED.lng,
         lat = EXCLUDED.lat,
         congestion_index = EXCLUDED.congestion_index,
         aqi = EXCLUDED.aqi,
         pm25 = EXCLUDED.pm25,
         temperature = EXCLUDED.temperature,
         avg_speed = EXCLUDED.avg_speed
       RETURNING id`,
      [...city],
    )
    cityIds.set(city[0], result.rows[0]!.id)
  }

  await client.query('DELETE FROM city_events')
  await client.query('DELETE FROM facilities')
  await client.query('DELETE FROM environment_observations')
  await client.query('DELETE FROM traffic_segments')

  const events = [
    ['上海', '延安高架车辆缓行', '交通拥堵', '高', '处理中'],
    ['北京', '东城区道路积水', '积水', '紧急', '待处理'],
    ['深圳', '南山区公交站点客流预警', '公共交通', '中', '已处理'],
    ['广州', '天河区空气质量预警', '环境', '中', '处理中'],
    ['成都', '高新区大型活动交通管制', '交通管制', '高', '已处理'],
    ['杭州', '西湖景区客流接近阈值', '客流', '高', '待处理'],
    ['上海', '浦东新区供水管网压力异常', '公共设施', '高', '已处理'],
  ] as const
  for (const [city, title, eventType, severity, status] of events) {
    await client.query(
      `INSERT INTO city_events(
         city_id, title, event_type, severity, status, reported_at
       ) VALUES ($1, $2, $3, $4, $5, now() - (random() * interval '12 hours'))`,
      [cityIds.get(city), title, eventType, severity, status],
    )
  }

  const facilityTypes = ['交通', '医疗', '教育', '公共安全', '环境监测'] as const
  for (const [index, cityId] of [...cityIds.values()].entries()) {
    for (const [typeIndex, type] of facilityTypes.entries()) {
      await client.query(
        'INSERT INTO facilities(city_id, type, count) VALUES ($1, $2, $3)',
        [cityId, type, 40 + index * 11 + typeIndex * 9],
      )
    }
  }

  for (const [index, cityId] of [...cityIds.values()].entries()) {
    await client.query(
      `INSERT INTO environment_observations(
        city_id, district, aqi, pm25, pm10, temperature, humidity,
        noise, weather, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
      [
        cityId,
        `${cities[index]![0]}市中心`,
        62 + index * 3,
        28 + index,
        51 + index * 2,
        23.4 - index * 0.3,
        61 + index,
        54 + index,
        index % 2 === 0 ? '多云' : '晴',
      ],
    )
    await client.query(
      `INSERT INTO traffic_segments(
        city_id, road_name, lng, lat, congestion_index
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        cityId,
        `${cities[index]![0]}主干道`,
        Number(cities[index]![5]),
        Number(cities[index]![6]),
        Number(cities[index]![7]),
      ],
    )
  }

  const datasource = await client.query<{ id: number }>(
    "SELECT id FROM datasources WHERE type = 'postgres-seed' LIMIT 1",
  )
  if (datasource.rows[0]) {
    await client.query(
      `UPDATE datasources SET name = $1, description = $2, config = $3,
       status = 1, created_by = $4 WHERE id = $5`,
      [
        '城市运行种子数据',
        '只读白名单数据源，仅开放 cities 表',
        JSON.stringify({ kind: 'seed', dataset: 'cities' }),
        adminId,
        datasource.rows[0].id,
      ],
    )
  } else {
    await client.query(
      `INSERT INTO datasources(name, type, config, description, created_by)
       VALUES ($1, 'postgres-seed', $2, $3, $4)`,
      [
        '城市运行种子数据',
        JSON.stringify({ kind: 'seed', dataset: 'cities' }),
        '只读白名单数据源，仅开放 cities 表',
        adminId,
      ],
    )
  }
}

export async function seedDatabase(
  db: Database,
  passwords: SeedPasswords,
): Promise<void> {
  await withTransaction(db, async (client) => {
    const roleIds = await seedRoles(client)
    await seedPermissions(client, roleIds)
    const adminId = await seedUsers(client, roleIds, passwords)
    await seedCityData(client, adminId)
  })
}

async function main(): Promise<void> {
  const config = loadConfig()
  const passwords = {
    admin: process.env.SEED_ADMIN_PASSWORD || '',
    analyst: process.env.SEED_ANALYST_PASSWORD || '',
    user: process.env.SEED_USER_PASSWORD || '',
  }
  if (!passwords.admin || !passwords.analyst || !passwords.user) {
    throw new Error(
      'SEED_ADMIN_PASSWORD, SEED_ANALYST_PASSWORD and SEED_USER_PASSWORD are required',
    )
  }

  const db = createDatabase(config.databaseUrl, { ssl: config.databaseSsl })
  try {
    await seedDatabase(db, passwords)
    console.log('Database seed completed')
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
