import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppConfig } from '../config.js'
import type { Database } from '../db.js'
import { AppError, isDatabaseError } from '../errors.js'
import {
  authenticate,
  getUserById,
  isAdministrator,
  mapUser,
  ok,
  parse,
  requireRoles,
  type AuthUser,
  type UserRow,
  userSelect,
} from '../http.js'
import { isSystemRoleCode, SYSTEM_ROLE_CODES } from '../rbac.js'
import { hashPassword, randomPassword } from '../security.js'

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() })
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  username: z.string().trim().max(80).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  roleId: z.coerce.number().int().positive().optional(),
})

const userCreateSchema = z.object({
  username: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(200),
  email: z.email().max(200).optional().or(z.literal('')),
  avatar: z.string().max(1000).optional(),
  roleId: z.number().int().positive(),
}).strict()

const userUpdateSchema = z.object({
  username: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(8).max(200).optional(),
  email: z.email().max(200).optional().or(z.literal('')),
  avatar: z.string().max(1000).nullable().optional(),
  roleId: z.number().int().positive().optional(),
}).strict()

const statusSchema = z.object({ status: z.number().int().min(0).max(1) }).strict()

async function userList(db: Database, query: z.infer<typeof listQuerySchema>) {
  const clauses: string[] = []
  const values: unknown[] = []
  if (query.username) {
    values.push(`%${query.username}%`)
    clauses.push(`u.username ILIKE $${values.length}`)
  }
  if (query.status !== undefined) {
    values.push(query.status)
    clauses.push(`u.status = $${values.length}`)
  }
  if (query.roleId !== undefined) {
    values.push(query.roleId)
    clauses.push(`u.role_id = $${values.length}`)
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
  const count = await db.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM users u${where}`,
    values,
  )
  const limitIndex = values.length + 1
  const offsetIndex = values.length + 2
  const users = await db.query<UserRow>(
    `${userSelect}${where}
     ORDER BY u.id DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    [...values, query.pageSize, (query.page - 1) * query.pageSize],
  )
  return {
    list: users.rows.map(mapUser),
    total: Number(count.rows[0]?.total ?? 0),
    page: query.page,
    pageSize: query.pageSize,
  }
}

async function requireExistingRole(db: Database, roleId: number): Promise<void> {
  const role = await db.query(
    `SELECT id FROM roles
     WHERE id = $1 AND status = 1 AND code = ANY($2::text[])`,
    [roleId, SYSTEM_ROLE_CODES],
  )
  if (!role.rowCount) throw new AppError(400, '角色不存在或已停用')
}

function canManageUser(actor: AuthUser, targetId: number): boolean {
  return isAdministrator(actor) || actor.id === targetId
}

export async function registerUserRoutes(
  app: FastifyInstance,
  db: Database,
  config: AppConfig,
): Promise<void> {
  app.get('/api/users', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const query = parse(listQuerySchema, request.query)
    return ok(reply, await userList(db, query))
  })

  app.post('/api/users', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const input = parse(userCreateSchema, request.body)
    await requireExistingRole(db, input.roleId)
    try {
      const result = await db.query<{ id: number }>(
        `INSERT INTO users(username, password_hash, email, avatar, role_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          input.username,
          await hashPassword(input.password),
          input.email || null,
          input.avatar || null,
          input.roleId,
        ],
      )
      const user = await getUserById(db, result.rows[0]!.id)
      return ok(reply, user, '创建用户成功')
    } catch (error) {
      if (isDatabaseError(error, '23505')) throw new AppError(409, '用户名已存在')
      throw error
    }
  })

  app.put('/api/users/:id', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    const { id } = parse(idParamsSchema, request.params)
    if (!canManageUser(actor, id)) throw new AppError(403, '不能修改其他用户')
    const input = parse(userUpdateSchema, request.body)
    if (input.roleId !== undefined && !isAdministrator(actor)) {
      throw new AppError(403, '普通用户不能修改角色')
    }
    if (input.roleId !== undefined) await requireExistingRole(db, input.roleId)

    const current = await getUserById(db, id)
    if (!current) throw new AppError(404, '用户不存在')

    const updates: string[] = []
    const values: unknown[] = []
    const add = (column: string, value: unknown) => {
      values.push(value)
      updates.push(`${column} = $${values.length}`)
    }
    if (input.username !== undefined) add('username', input.username)
    if (input.email !== undefined) add('email', input.email || null)
    if (input.avatar !== undefined) add('avatar', input.avatar)
    if (input.roleId !== undefined) add('role_id', input.roleId)
    if (input.password !== undefined) add('password_hash', await hashPassword(input.password))

    if (updates.length > 0) {
      values.push(id)
      try {
        await db.query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`,
          values,
        )
      } catch (error) {
        if (isDatabaseError(error, '23505')) throw new AppError(409, '用户名已存在')
        throw error
      }
    }
    return ok(reply, await getUserById(db, id), '更新用户成功')
  })

  app.delete('/api/users/:id', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const { id } = parse(idParamsSchema, request.params)
    if (id === actor.id) throw new AppError(400, '不能删除当前登录账号')
    try {
      const result = await db.query('DELETE FROM users WHERE id = $1', [id])
      if (!result.rowCount) throw new AppError(404, '用户不存在')
      return ok(reply, null, '删除用户成功')
    } catch (error) {
      if (isDatabaseError(error, '23503')) {
        throw new AppError(409, '用户存在关联数据，无法删除')
      }
      throw error
    }
  })

  app.patch('/api/users/:id/status', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const { id } = parse(idParamsSchema, request.params)
    const { status } = parse(statusSchema, request.body)
    if (id === actor.id && status === 0) throw new AppError(400, '不能停用当前登录账号')
    const result = await db.query(
      'UPDATE users SET status = $1 WHERE id = $2',
      [status, id],
    )
    if (!result.rowCount) throw new AppError(404, '用户不存在')
    return ok(reply, null, '用户状态已更新')
  })

  app.put('/api/users/:id/password', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const { id } = parse(idParamsSchema, request.params)
    const newPassword = randomPassword()
    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [await hashPassword(newPassword), id],
    )
    if (!result.rowCount) throw new AppError(404, '用户不存在')
    return ok(reply, { newPassword }, '密码重置成功')
  })

  app.post('/api/upload/avatar', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    if (!request.isMultipart()) throw new AppError(400, '请使用 multipart/form-data 上传头像')
    const file = await request.file()
    if (!file) throw new AppError(400, '未收到头像文件')
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mimetype)) {
      throw new AppError(400, '仅支持 PNG、JPEG、GIF 或 WebP')
    }
    let data: Buffer
    try {
      data = await file.toBuffer()
    } catch {
      throw new AppError(413, `头像不能超过 ${config.uploadMaxBytes} 字节`)
    }
    if (data.length === 0 || data.length > config.uploadMaxBytes) {
      throw new AppError(413, '头像文件大小不合法')
    }
    const actualMime = detectImageMime(data)
    if (actualMime !== file.mimetype) throw new AppError(400, '文件内容与图片类型不匹配')

    const id = randomUUID()
    await db.query(
      `INSERT INTO avatars(id, filename, mime_type, data, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, file.filename.slice(0, 255), file.mimetype, data, actor.id],
    )
    return ok(reply, {
      url: `/api/uploads/${id}`,
      filename: file.filename,
    }, '头像上传成功')
  })

  app.get('/api/uploads/:id', async (request, reply) => {
    const { id } = parse(z.object({ id: z.uuid() }), request.params)
    const result = await db.query<{
      mime_type: string
      data: Buffer
    }>('SELECT mime_type, data FROM avatars WHERE id = $1', [id])
    const avatar = result.rows[0]
    if (!avatar) throw new AppError(404, '头像不存在')
    return reply
      .header('Cache-Control', 'public, max-age=86400')
      .type(avatar.mime_type)
      .send(avatar.data)
  })
}

function detectImageMime(data: Buffer): string | null {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.subarray(0, 6).toString() === 'GIF87a' || data.subarray(0, 6).toString() === 'GIF89a') {
    return 'image/gif'
  }
  if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') {
    return 'image/webp'
  }
  return null
}

type PermissionRow = {
  id: number
  name: string
  label: string
  parent_id: number | null
  type: string
  path: string | null
  icon: string | null
  sort_order: number
}

type RoleRow = {
  id: number
  name: string
  code: string
  description: string | null
  status: number
  created_at: Date | string
  updated_at: Date | string
}

const roleInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/),
  description: z.string().trim().max(1000).optional(),
}).strict()

function permissionTree(rows: PermissionRow[]): Array<Record<string, unknown>> {
  const nodes = new Map<number, Record<string, unknown>>()
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      label: row.label,
      parentId: row.parent_id,
      type: row.type,
      path: row.path,
      icon: row.icon,
      sortOrder: row.sort_order,
      children: [],
    })
  }
  const roots: Array<Record<string, unknown>> = []
  for (const row of rows) {
    const node = nodes.get(row.id)!
    const parent = row.parent_id === null ? undefined : nodes.get(row.parent_id)
    if (parent) {
      (parent.children as Array<Record<string, unknown>>).push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function mapRole(row: RoleRow) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

export async function registerRoleRoutes(
  app: FastifyInstance,
  db: Database,
  config: AppConfig,
): Promise<void> {
  app.get('/api/roles', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const result = await db.query<RoleRow>(
      'SELECT * FROM roles WHERE code = ANY($1::text[]) ORDER BY id',
      [SYSTEM_ROLE_CODES],
    )
    return ok(reply, result.rows.map(mapRole))
  })

  app.get('/api/roles/:id', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const { id } = parse(idParamsSchema, request.params)
    const role = await db.query<RoleRow>('SELECT * FROM roles WHERE id = $1', [id])
    if (!role.rows[0]) throw new AppError(404, '角色不存在')
    if (!isSystemRoleCode(role.rows[0].code)) throw new AppError(404, '角色不存在')
    const permissions = await db.query<PermissionRow>(
      `SELECT p.id, p.code AS name, p.label, p.parent_id, p.type, p.path,
              p.icon, p.sort_order
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1 ORDER BY p.sort_order, p.id`,
      [id],
    )
    return ok(reply, {
      ...mapRole(role.rows[0]),
      permissions: permissionTree(permissions.rows),
    })
  })

  app.get('/api/permissions', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const result = await db.query<PermissionRow>(
      `SELECT id, code AS name, label, parent_id, type, path, icon, sort_order
       FROM permissions ORDER BY sort_order, id`,
    )
    return ok(reply, permissionTree(result.rows))
  })

  app.post('/api/roles', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    throw new AppError(409, '当前使用固定 RBAC，不支持新增自定义角色')
  })

  app.put('/api/roles/:id', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const { id } = parse(idParamsSchema, request.params)
    const input = parse(roleInputSchema, request.body)
    const existing = await db.query<RoleRow>('SELECT * FROM roles WHERE id = $1', [id])
    if (!existing.rows[0]) throw new AppError(404, '角色不存在')
    if (!isSystemRoleCode(existing.rows[0].code)) throw new AppError(404, '角色不存在')
    if (existing.rows[0].code !== input.code) throw new AppError(400, '角色编码不可修改')
    const result = await db.query<RoleRow>(
      `UPDATE roles SET name = $1, description = $2 WHERE id = $3 RETURNING *`,
      [input.name, input.description || null, id],
    )
    return ok(reply, mapRole(result.rows[0]!), '更新角色成功')
  })

  app.delete('/api/roles/:id', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const { id } = parse(idParamsSchema, request.params)
    const role = await db.query<{ code: string }>('SELECT code FROM roles WHERE id = $1', [id])
    if (!role.rows[0]) throw new AppError(404, '角色不存在')
    throw new AppError(409, '当前使用固定 RBAC，不支持删除系统角色')
  })

  app.put('/api/roles/:id/permissions', async (request, reply) => {
    const actor = await authenticate(request, db, config.jwtSecret)
    requireRoles(actor, ['super_admin', 'admin'])
    const { id } = parse(idParamsSchema, request.params)
    const role = await db.query('SELECT id FROM roles WHERE id = $1', [id])
    if (!role.rowCount) throw new AppError(404, '角色不存在')
    throw new AppError(
      409,
      '当前使用固定 RBAC，权限树仅供查看，不支持动态授权',
    )
  })
}
