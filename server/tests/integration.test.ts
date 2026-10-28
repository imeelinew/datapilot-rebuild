import assert from 'node:assert/strict'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { after, before, describe, test } from 'node:test'
import pg from 'pg'
import { buildApp } from '../src/app.js'
import type { AppConfig } from '../src/config.js'
import { createDatabase, type Database } from '../src/db.js'
import { applyMigrations } from '../src/migrate.js'
import { seedDatabase } from '../src/seed.js'
import { signToken } from '../src/security.js'

const { Pool } = pg
const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for integration tests')
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '')
if (databaseName !== 'city_test') {
  throw new Error('Integration tests only run against the city_test database')
}

const passwords = {
  admin: 'AdminTest!2026',
  analyst: 'AnalystTest!2026',
  user: 'VisitorTest!2026',
  analyst2: 'AnalystTwo!2026',
}

type AppContext = {
  app: Awaited<ReturnType<typeof buildApp>>
  db: Database
  adminPool: InstanceType<typeof Pool>
  schema: string
  baseUrl: string
  tokens: Record<string, string>
  datasourceId: number
  dashboardId: number
  chartId: number
  config: AppConfig
}

let context: AppContext

async function call(
  path: string,
  options: {
    method?: string
    token?: string | undefined
    body?: unknown
  } = {},
): Promise<Response> {
  return fetch(`${context.baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
}

async function callAt(
  baseUrl: string,
  path: string,
  options: {
    method?: string
    token?: string | undefined
    body?: unknown
    headers?: Record<string, string>
  } = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
}

async function json(response: Response): Promise<Record<string, any>> {
  return await response.json() as Record<string, any>
}

async function login(username: string, password: string): Promise<string> {
  const captchaResponse = await call('/api/auth/captcha')
  assert.equal(captchaResponse.status, 200)
  const captcha = await json(captchaResponse)
  const match = (captcha.data.svg as string).match(/<text[^>]*>([A-Z0-9]{5})<\/text>/)
  assert.ok(match?.[1], 'captcha code must be present in the SVG')

  const response = await call('/api/auth/login', {
    method: 'POST',
    body: {
      username,
      password,
      captchaId: captcha.data.captchaId,
      captchaCode: match[1],
    },
  })
  const body = await json(response)
  assert.equal(response.status, 200, JSON.stringify(body))
  assert.equal(body.code, 200)
  assert.equal(typeof body.data.token, 'string')
  return body.data.token
}

async function createChart(dashboardId: number, title: string): Promise<number> {
  const response = await call('/api/charts', {
    method: 'POST',
    token: context.tokens.analyst,
    body: {
      dashboardId,
      datasourceId: context.datasourceId,
      title,
      chartType: 'bar',
      queryConfig: {
        table: 'cities',
        xField: 'name',
        yField: 'population',
      },
      chartConfig: {},
      position: { x: 0, y: 0, w: 6, h: 4 },
      sortOrder: 0,
    },
  })
  const body = await json(response)
  assert.equal(response.status, 200, JSON.stringify(body))
  return body.data.id as number
}

before(async () => {
  const schema = `it_${randomUUID().replaceAll('-', '')}`
  const adminPool = new Pool({ connectionString: databaseUrl, max: 2 })
  await adminPool.query(`CREATE SCHEMA "${schema}"`)
  const db = createDatabase(databaseUrl, { schema })
  const config: AppConfig = {
    databaseUrl,
    databaseSsl: false,
    jwtSecret: randomBytes(48).toString('hex'),
    host: '127.0.0.1',
    port: 0,
    corsOrigins: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    uploadMaxBytes: 2 * 1024 * 1024,
    aiBaseUrl: 'https://api.openai.com/v1',
    aiModel: 'test-model',
    aiTimeoutMs: 30_000,
    aiMaxOutputTokens: 800,
    aiMaxOutputChars: 16_000,
  }

  try {
    await applyMigrations(db)
    await seedDatabase(db, {
      admin: passwords.admin,
      analyst: passwords.analyst,
      user: passwords.user,
    })
    const app = await buildApp({ db, config })
    await app.listen({ host: '127.0.0.1', port: 0 })
    const address = app.server.address()
    assert.ok(address && typeof address !== 'string')
    context = {
      app,
      db,
      adminPool,
      schema,
      baseUrl: `http://127.0.0.1:${address.port}`,
      tokens: {},
      datasourceId: 0,
      dashboardId: 0,
      chartId: 0,
      config,
    }
  } catch (error) {
    await db.pool.end()
    await adminPool.end()
    throw error
  }
})

after(async () => {
  if (!context) return
  await context.app.close()
  await context.db.pool.end()
  await context.adminPool.query(`DROP SCHEMA IF EXISTS "${context.schema}" CASCADE`)
  await context.adminPool.end()
})

describe('Datapilot PostgreSQL integration', { concurrency: false }, () => {
  test('health, captcha login, token validation and one-time captcha', async () => {
    const health = await call('/api/health')
    assert.equal(health.status, 200)
    assert.deepEqual((await json(health)).data, { status: 'ok', database: 'ok' })

    const unauthorized = await call('/api/auth/me')
    assert.equal(unauthorized.status, 401)

    context.tokens.admin = await login('admin', passwords.admin)
    const me = await call('/api/auth/me', { token: context.tokens.admin })
    assert.equal(me.status, 200)
    const meBody = await json(me)
    assert.equal(meBody.data.username, 'admin')
    assert.equal(meBody.data.role.code, 'super_admin')

    const captchaResponse = await call('/api/auth/captcha')
    const captcha = await json(captchaResponse)
    const code = (captcha.data.svg as string).match(/<text[^>]*>([A-Z0-9]{5})<\/text>/)![1]
    const first = await call('/api/auth/login', {
      method: 'POST',
      body: {
        username: 'analyst',
        password: passwords.analyst,
        captchaId: captcha.data.captchaId,
        captchaCode: code,
      },
    })
    assert.equal(first.status, 200)
    context.tokens.analyst = (await json(first)).data.token
    const replay = await call('/api/auth/login', {
      method: 'POST',
      body: {
        username: 'analyst',
        password: passwords.analyst,
        captchaId: captcha.data.captchaId,
        captchaCode: code,
      },
    })
    assert.equal(replay.status, 400)
  })

  test('authentication database failures are not reported as invalid tokens', async () => {
    await context.db.query('ALTER TABLE users RENAME TO users_unavailable')
    try {
      const response = await call('/api/auth/me', { token: context.tokens.admin })
      assert.equal(response.status, 500)
      assert.equal((await json(response)).message, '服务暂时不可用')
    } finally {
      await context.db.query('ALTER TABLE users_unavailable RENAME TO users')
    }
    assert.equal((await call('/api/auth/me', { token: context.tokens.admin })).status, 200)
  })

  test('server-side RBAC and user CRUD are real database operations', async () => {
    context.tokens.visitor = await login('visitor', passwords.user)

    const denied = await call('/api/users', { token: context.tokens.analyst })
    assert.equal(denied.status, 403)
    assert.equal((await json(denied)).code, 403)

    const roles = await call('/api/roles', { token: context.tokens.admin })
    assert.equal(roles.status, 200)
    const rolesBody = await json(roles)
    assert.deepEqual(
      rolesBody.data.map((role: { code: string }) => role.code).sort(),
      ['admin', 'analyst', 'super_admin', 'user'],
    )
    const analystRole = rolesBody.data.find(
      (role: { code: string }) => role.code === 'analyst',
    )
    assert.ok(analystRole)

    const permissions = await call('/api/permissions', { token: context.tokens.admin })
    assert.equal(permissions.status, 200)
    assert.ok(Array.isArray((await json(permissions)).data))
    const before = await call(`/api/roles/${analystRole.id}`, {
      token: context.tokens.admin,
    })
    const permissionsBefore = await before.json()
    const rejectedUpdate = await call(`/api/roles/${analystRole.id}/permissions`, {
      method: 'PUT',
      token: context.tokens.admin,
      body: { permissionIds: [] },
    })
    assert.equal(rejectedUpdate.status, 409)
    const after = await call(`/api/roles/${analystRole.id}`, {
      token: context.tokens.admin,
    })
    assert.deepEqual(await after.json(), permissionsBefore)
    const rejectedCreate = await call('/api/roles', {
      method: 'POST',
      token: context.tokens.admin,
      body: { name: '自定义角色', code: 'custom_role' },
    })
    assert.equal(rejectedCreate.status, 409)
    const rejectedDelete = await call(`/api/roles/${analystRole.id}`, {
      method: 'DELETE',
      token: context.tokens.admin,
    })
    assert.equal(rejectedDelete.status, 409)

    const created = await call('/api/users', {
      method: 'POST',
      token: context.tokens.admin,
      body: {
        username: 'analyst2',
        password: passwords.analyst2,
        email: 'analyst2@city.local',
        roleId: analystRole.id,
      },
    })
    assert.equal(created.status, 200, JSON.stringify(await created.clone().json()))
    const userList = await call('/api/users?username=analyst2', {
      token: context.tokens.admin,
    })
    assert.equal((await json(userList)).data.total, 1)
    context.tokens.analyst2 = await login('analyst2', passwords.analyst2)
  })

  test('JWT tampering, expiry and malformed payloads are rejected', async () => {
    const me = context.config.jwtSecret
    const now = Math.floor(Date.now() / 1000)
    assert.ok(context.tokens.admin)
    const [tokenHeader, tokenBody, tokenSignature] = context.tokens.admin.split('.')
    assert.ok(tokenHeader && tokenBody && tokenSignature)
    const tamperedSignature = `${tokenSignature[0] === 'a' ? 'b' : 'a'}${tokenSignature.slice(1)}`
    const tampered = `${tokenHeader}.${tokenBody}.${tamperedSignature}`
    const expired = signToken(
      { sub: 1, username: 'admin' },
      me,
      -1,
    )
    const unsignedHeader = Buffer.from(JSON.stringify({
      alg: 'HS256',
      typ: 'JWT',
    })).toString('base64url')
    const withoutExp = Buffer.from(JSON.stringify({
      sub: 1,
      username: 'admin',
      iat: now,
    })).toString('base64url')
    const signature = createHmac('sha256', me)
      .update(`${unsignedHeader}.${withoutExp}`)
      .digest('base64url')
    const missingExp = `${unsignedHeader}.${withoutExp}.${signature}`
    const invalidSub = signToken(
      { sub: 0, username: 'admin' },
      me,
    )

    const responses = await Promise.all([
      call('/api/auth/me', { token: tampered }),
      call('/api/auth/me', { token: expired }),
      call('/api/auth/me', { token: missingExp }),
      call('/api/auth/me', { token: invalidSub }),
    ])
    assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401])
  })

  test('datasource discovery and whitelist query reject arbitrary SQL', async () => {
    const list = await call('/api/datasources', { token: context.tokens.visitor })
    assert.equal(list.status, 200)
    const sources = await json(list)
    assert.equal(sources.data.total, 1)
    context.datasourceId = sources.data.list[0].id

    const tables = await call(`/api/datasources/${context.datasourceId}/tables`, {
      token: context.tokens.visitor,
    })
    assert.deepEqual((await json(tables)).data, [{ tableName: 'cities' }])

    const fields = await call(
      `/api/datasources/${context.datasourceId}/tables/cities/fields`,
      { token: context.tokens.visitor },
    )
    assert.ok((await json(fields)).data.some(
      (field: { columnName: string }) => field.columnName === 'population',
    ))

    const query = await call(`/api/datasources/${context.datasourceId}/query`, {
      method: 'POST',
      token: context.tokens.visitor,
      body: { table: 'cities', xField: 'name', yField: 'population' },
    })
    const queryBody = await json(query)
    assert.equal(query.status, 200)
    assert.equal(queryBody.data.total, 6)
    assert.equal(queryBody.data.rows[0].name, '上海')

    const injection = await call(`/api/datasources/${context.datasourceId}/query`, {
      method: 'POST',
      token: context.tokens.visitor,
      body: {
        table: 'cities; DROP TABLE users',
        xField: 'name',
        yField: 'population',
      },
    })
    assert.equal(injection.status, 400)
    const usersStillExist = await context.db.query('SELECT count(*)::int AS count FROM users')
    assert.ok(usersStillExist.rows[0]!.count >= 3)
  })

  test('dashboard, chart, object isolation and clone rollback use PostgreSQL', async () => {
    const created = await call('/api/dashboards', {
      method: 'POST',
      token: context.tokens.analyst,
      body: { title: '运营总览', description: '集成测试仪表盘' },
    })
    assert.equal(created.status, 200)
    context.dashboardId = (await json(created)).data.id
    context.chartId = await createChart(context.dashboardId, '城市人口')
    const preview = await call(`/api/charts/${context.chartId}/preview`, {
      method: 'POST',
      token: context.tokens.analyst,
    })
    const previewBody = await json(preview)
    assert.equal(preview.status, 200)
    assert.equal(previewBody.data.series[0].type, 'bar')
    assert.equal(previewBody.data.series[0].data.length, 6)

    const otherAnalyst = await call(`/api/dashboards/${context.dashboardId}`, {
      token: context.tokens.analyst2,
    })
    assert.equal(otherAnalyst.status, 404)

    const clone = await call(`/api/dashboards/${context.dashboardId}/clone`, {
      method: 'POST',
      token: context.tokens.analyst,
    })
    assert.equal(clone.status, 200)
    const cloneId = (await json(clone)).data.id as number
    const cloneDetail = await call(`/api/dashboards/${cloneId}`, {
      token: context.tokens.analyst,
    })
    assert.equal((await json(cloneDetail)).data.charts.length, 1)

    const source = await call('/api/dashboards', {
      method: 'POST',
      token: context.tokens.analyst,
      body: { title: '事务源' },
    })
    const sourceId = (await json(source)).data.id as number
    await createChart(sourceId, '事务图')
    await context.db.query(`
      CREATE FUNCTION reject_clone_chart() RETURNS trigger AS $$
      BEGIN
        IF NEW.title = '事务图' THEN
          RAISE EXCEPTION 'forced clone rollback';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_clone_chart_trigger
      BEFORE INSERT ON charts
      FOR EACH ROW EXECUTE FUNCTION reject_clone_chart();
    `)
    try {
      const failedClone = await call(`/api/dashboards/${sourceId}/clone`, {
        method: 'POST',
        token: context.tokens.analyst,
      })
      assert.equal(failedClone.status, 500)
      const leftovers = await context.db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM dashboards WHERE title = '事务源（副本）'",
      )
      assert.equal(leftovers.rows[0]!.count, 0)
      const sourceCharts = await context.db.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM charts WHERE dashboard_id = $1',
        [sourceId],
      )
      assert.equal(sourceCharts.rows[0]!.count, 1)
    } finally {
      await context.db.query('DROP TRIGGER reject_clone_chart_trigger ON charts')
      await context.db.query('DROP FUNCTION reject_clone_chart()')
    }
  })

  test('city aggregates, AI ownership, atomic chat persistence and SSE fallback', async () => {
    const overview = await call('/api/cities/overview', { token: context.tokens.visitor })
    const overviewBody = await json(overview)
    assert.equal(overview.status, 200)
    assert.equal(overviewBody.data.totalCities, 6)
    assert.equal(typeof overviewBody.data.avgCongestionIndex, 'number')

    const events = await call('/api/cities/events?page=1&pageSize=3', {
      token: context.tokens.visitor,
    })
    assert.equal((await json(events)).data.list.length, 3)

    const conversation = await call('/api/ai/conversations', {
      method: 'POST',
      token: context.tokens.analyst,
      body: { title: '原子聊天测试' },
    })
    const conversationId = (await json(conversation)).data.id as number
    const denied = await call(`/api/ai/conversations/${conversationId}`, {
      token: context.tokens.analyst2,
    })
    assert.equal(denied.status, 404)

    const chat = await call('/api/ai/chat', {
      method: 'POST',
      token: context.tokens.analyst,
      body: { conversationId, content: '上海当前空气质量如何？' },
    })
    const stream = await chat.text()
    assert.equal(chat.status, 200)
    assert.match(stream, /data: \{"type":"fallback","content":"确定性数据分析降级/)
    assert.match(stream, /上海/)
    assert.match(stream, /data: \[DONE\]/)

    const detail = await call(`/api/ai/conversations/${conversationId}`, {
      token: context.tokens.analyst,
    })
    const messages = (await json(detail)).data.messages
    assert.equal(messages.length, 2)
    assert.deepEqual(messages.map((message: { role: string }) => message.role), [
      'user',
      'assistant',
    ])

    const assistantInjection = await call(`/api/ai/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: context.tokens.analyst,
      body: { role: 'assistant', content: '伪造回答' },
    })
    assert.equal(assistantInjection.status, 400)

    const atomicConversation = await call('/api/ai/conversations', {
      method: 'POST',
      token: context.tokens.analyst,
      body: { title: '回滚验证' },
    })
    const atomicId = (await json(atomicConversation)).data.id as number
    await context.db.query(`
      CREATE FUNCTION reject_assistant_message() RETURNS trigger AS $$
      BEGIN
        IF NEW.role = 'assistant' THEN
          RAISE EXCEPTION 'forced assistant insert failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_assistant_message_trigger
      BEFORE INSERT ON ai_messages
      FOR EACH ROW EXECUTE FUNCTION reject_assistant_message();
    `)
    try {
      const failedChat = await call('/api/ai/chat', {
        method: 'POST',
        token: context.tokens.analyst,
        body: { conversationId: atomicId, content: '这条用户消息也必须回滚' },
      })
      assert.equal(failedChat.status, 500)
      const atomicMessages = await context.db.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM ai_messages WHERE conversation_id = $1',
        [atomicId],
      )
      assert.equal(atomicMessages.rows[0]!.count, 0)
    } finally {
      await context.db.query('DROP TRIGGER reject_assistant_message_trigger ON ai_messages')
      await context.db.query('DROP FUNCTION reject_assistant_message()')
    }
  })

  test('concurrent chat generation returns 409 instead of committing stale context', async () => {
    const provider = createServer((request, response) => {
      request.resume()
      setTimeout(() => {
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({
          choices: [{ message: { content: '基于同一版本数据的并发回答' } }],
        }))
      }, 150)
    })
    await new Promise<void>((resolve, reject) => {
      provider.once('error', reject)
      provider.listen(0, '127.0.0.1', resolve)
    })
    const address = provider.address()
    assert.ok(address && typeof address !== 'string')

    const providerApp = await buildApp({
      db: context.db,
      config: {
        ...context.config,
        aiApiKey: 'integration-only-key',
        aiBaseUrl: `http://127.0.0.1:${address.port}/v1`,
      },
    })
    await providerApp.listen({ host: '127.0.0.1', port: 0 })
    const appAddress = providerApp.server.address()
    assert.ok(appAddress && typeof appAddress !== 'string')
    const providerBase = `http://127.0.0.1:${appAddress.port}`

    try {
      const conversation = await call('/api/ai/conversations', {
        method: 'POST',
        token: context.tokens.analyst,
        body: { title: '并发测试' },
      })
      const conversationId = (await json(conversation)).data.id as number
      const [first, second] = await Promise.all([
        callAt(providerBase, '/api/ai/chat', {
          method: 'POST',
          token: context.tokens.analyst,
          body: { conversationId, content: '比较上海和北京' },
        }),
        callAt(providerBase, '/api/ai/chat', {
          method: 'POST',
          token: context.tokens.analyst,
          body: { conversationId, content: '比较深圳和广州' },
        }),
      ])
      assert.deepEqual([first.status, second.status].sort(), [200, 409])
      const messages = await context.db.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM ai_messages WHERE conversation_id = $1',
        [conversationId],
      )
      assert.equal(messages.rows[0]!.count, 2)
    } finally {
      await providerApp.close()
      await new Promise<void>((resolve) => provider.close(() => resolve()))
    }
  })

  test('X-Forwarded-For cannot bypass login rate limiting', async () => {
    const isolatedApp = await buildApp({
      db: context.db,
      config: { ...context.config, port: 0 },
    })
    await isolatedApp.listen({ host: '127.0.0.1', port: 0 })
    const address = isolatedApp.server.address()
    assert.ok(address && typeof address !== 'string')
    const baseUrl = `http://127.0.0.1:${address.port}`
    try {
      const statuses: number[] = []
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const response = await callAt(baseUrl, '/api/auth/login', {
          method: 'POST',
          headers: { 'X-Forwarded-For': `198.51.100.${attempt + 1}` },
          body: {
            username: 'nobody',
            password: 'not-the-password',
            captchaId: randomUUID(),
            captchaCode: 'ABCDE',
          },
        })
        statuses.push(response.status)
      }
      assert.equal(statuses.filter((status) => status === 429).length, 2)
    } finally {
      await isolatedApp.close()
    }
  })

  test('CORS rejects untrusted origins with a controlled 403', async () => {
    const rejected = await fetch(`${context.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:5178',
      },
      body: JSON.stringify({
        username: 'nobody',
        password: 'not-the-password',
        captchaId: randomUUID(),
        captchaCode: 'ABCDE',
      }),
    })
    assert.equal(rejected.status, 403)
    assert.equal((await json(rejected)).code, 403)
  })
})
