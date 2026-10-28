import { randomInt, randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppConfig } from '../config.js'
import type { Database } from '../db.js'
import { AppError } from '../errors.js'
import {
  authenticate,
  getUserById,
  mapUser,
  ok,
  parse,
  type UserRow,
  userSelectFields,
} from '../http.js'
import { isSystemRoleCode } from '../rbac.js'
import { hmacHex, signToken, verifyPassword } from '../security.js'

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
  captchaId: z.uuid(),
  captchaCode: z.string().trim().min(4).max(8),
}).strict()

function createCaptchaSvg(code: string): string {
  const noise = Array.from({ length: 7 }, (_, index) => {
    const y1 = randomInt(5, 45)
    const y2 = randomInt(5, 45)
    return `<path d="M0 ${y1} Q ${25 + index * 8} ${15 + index * 2} 120 ${y2}" stroke="#8aa4c8" opacity=".35"/>`
  }).join('')

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44" viewBox="0 0 120 44">',
    '<rect width="120" height="44" rx="6" fill="#edf3fb"/>',
    noise,
    `<text x="60" y="30" text-anchor="middle" font-family="monospace" font-size="24" font-weight="700" letter-spacing="6" fill="#173f73" transform="rotate(-3 60 22)">${code}</text>`,
    '</svg>',
  ].join('')
}

function captchaCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  return Array.from({ length: 5 }, () => alphabet[randomInt(0, alphabet.length)]).join('')
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  db: Database,
  config: AppConfig,
): Promise<void> {
  app.get('/api/auth/captcha', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (_request, reply) => {
    const id = randomUUID()
    const code = captchaCode()
    const codeHash = hmacHex(config.jwtSecret, `${id}:${code}`)
    await db.query(
      `INSERT INTO captcha_challenges(id, code_hash, expires_at)
       VALUES ($1, $2, now() + interval '5 minutes')`,
      [id, codeHash],
    )
    await db.query(
      "DELETE FROM captcha_challenges WHERE expires_at < now() - interval '1 day'",
    )
    return ok(reply, { captchaId: id, svg: createCaptchaSvg(code) })
  })

  app.post('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const input = parse(loginSchema, request.body)
    const challenge = await db.query<{ code_hash: string }>(
      `UPDATE captcha_challenges
       SET consumed = true
       WHERE id = $1 AND consumed = false AND expires_at > now()
       RETURNING code_hash`,
      [input.captchaId],
    )
    const expectedHash = challenge.rows[0]?.code_hash
    const suppliedHash = hmacHex(
      config.jwtSecret,
      `${input.captchaId}:${input.captchaCode.toUpperCase()}`,
    )
    if (!expectedHash || suppliedHash !== expectedHash) {
      throw new AppError(400, '验证码错误或已过期')
    }

    const result = await db.query<UserRow & { password_hash: string }>(
      `SELECT ${userSelectFields}, u.password_hash
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.username = $1`,
      [input.username],
    )
    const row = result.rows[0]
    if (
      !row ||
      row.status !== 1 ||
      row.role_status !== 1 ||
      !isSystemRoleCode(row.role_code)
    ) {
      throw new AppError(401, '用户名或密码错误')
    }
    if (!(await verifyPassword(input.password, row.password_hash))) {
      throw new AppError(401, '用户名或密码错误')
    }

    await db.query('UPDATE users SET last_login = now() WHERE id = $1', [row.id])
    const user = await getUserById(db, row.id)
    if (!user) throw new AppError(401, '用户不存在')

    return ok(reply, {
      token: signToken(
        { sub: user.id, username: user.username },
        config.jwtSecret,
      ),
      user,
    }, '登录成功')
  })

  app.get('/api/auth/me', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    return ok(reply, mapUser({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      role_id: user.roleId,
      last_login: user.lastLogin,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      role_name: user.role.name,
      role_code: user.role.code,
      role_description: user.role.description,
      role_status: user.role.status,
    }))
  })
}
