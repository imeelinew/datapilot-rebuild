import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ZodType } from 'zod'
import type { Database } from './db.js'
import { AppError } from './errors.js'
import { isSystemRoleCode, type SystemRoleCode } from './rbac.js'
import { verifyToken } from './security.js'

export type AuthUser = {
  id: number
  username: string
  email: string | null
  avatar: string | null
  status: number
  roleId: number
  role: {
    id: number
    name: string
    code: string
    description: string | null
    status: number
  }
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

export function ok<T>( reply: FastifyReply, data: T, message = 'success', statusCode = 200) {
  return reply.code(statusCode).send({
    code: 200,
    message,
    data,
  })
}

export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new AppError(400, '请求参数不合法', result.error.flatten())
  }
  return result.data
}

export type UserRow = {
  id: number
  username: string
  email: string | null
  avatar: string | null
  status: number
  role_id: number
  last_login: Date | string | null
  created_at: Date | string
  updated_at: Date | string
  role_name: string
  role_code: string
  role_description: string | null
  role_status: number
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString()
}

export function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatar: row.avatar,
    status: row.status,
    roleId: row.role_id,
    role: {
      id: row.role_id,
      name: row.role_name,
      code: row.role_code,
      description: row.role_description,
      status: row.role_status,
    },
    lastLogin: iso(row.last_login),
    createdAt: iso(row.created_at) as string,
    updatedAt: iso(row.updated_at) as string,
  }
}

export const userSelectFields = `
  u.id, u.username, u.email, u.avatar, u.status, u.role_id,
  u.last_login, u.created_at, u.updated_at,
  r.name AS role_name, r.code AS role_code,
  r.description AS role_description, r.status AS role_status
`

export const userSelect = `
  SELECT ${userSelectFields}
  FROM users u
  JOIN roles r ON r.id = u.role_id
`

export async function getUserById(
  db: Database,
  id: number,
): Promise<AuthUser | null> {
  const result = await db.query<UserRow>(
    `${userSelect} WHERE u.id = $1`,
    [id],
  )
  const row = result.rows[0]
  return row ? mapUser(row) : null
}

function readBearer(request: FastifyRequest): string {
  const header = request.headers.authorization
  const match = header?.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) throw new AppError(401, '未登录或登录已过期')
  return match[1]
}

export async function authenticate(
  request: FastifyRequest,
  db: Database,
  jwtSecret: string,
): Promise<AuthUser> {
  let payload: ReturnType<typeof verifyToken>
  try {
    payload = verifyToken(readBearer(request), jwtSecret)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(401, '未登录或登录已过期')
  }
  // 数据库故障应作为服务错误返回，不能误判为 Token 失效并使客户端退出登录。
  const user = await getUserById(db, payload.sub)
  if (
    !user ||
    user.status !== 1 ||
    user.role.status !== 1 ||
    !isSystemRoleCode(user.role.code)
  ) {
    throw new AppError(401, '账号或角色已停用')
  }
  return user
}

export function requireRoles(
  user: AuthUser,
  roles: SystemRoleCode[],
): void {
  if (!isSystemRoleCode(user.role.code) || !roles.includes(user.role.code)) {
    throw new AppError(403, '没有执行此操作的权限')
  }
}

export function isAdministrator(user: AuthUser): boolean {
  return user.role.code === 'super_admin' || user.role.code === 'admin'
}
