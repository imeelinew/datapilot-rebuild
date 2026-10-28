import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { generateAnswer } from '../ai.js'
import type { AppConfig } from '../config.js'
import type { Database } from '../db.js'
import { withTransaction } from '../db.js'
import { AppError } from '../errors.js'
import { authenticate, ok, parse } from '../http.js'

const idParams = z.object({ id: z.coerce.number().int().positive() })
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})
const createConversationSchema = z.object({
  title: z.string().trim().max(200).optional(),
}).strict()
const userMessageSchema = z.object({
  role: z.literal('user'),
  content: z.string().trim().min(1).max(8000),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict()
const chatSchema = z.object({
  conversationId: z.number().int().positive(),
  content: z.string().trim().min(1).max(8000),
}).strict()

type ConversationRow = {
  id: number
  user_id: number
  title: string | null
  dashboard_id: number | null
  created_at: Date | string
  updated_at: Date | string
}

type MessageRow = {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  metadata: Record<string, unknown> | null
  created_at: Date | string
}

function mapConversation(row: ConversationRow, messages?: MessageRow[]) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    dashboardId: row.dashboard_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    ...(messages ? { messages: messages.map(mapMessage) } : {}),
  }
}

function mapMessage(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

async function requireConversation(
  db: Database,
  userId: number,
  id: number,
): Promise<ConversationRow> {
  const result = await db.query<ConversationRow>(
    `SELECT id, user_id, title, dashboard_id, created_at,
            updated_at::text AS updated_at
     FROM ai_conversations WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  const conversation = result.rows[0]
  if (!conversation) throw new AppError(404, '会话不存在')
  return conversation
}

export async function registerAiRoutes(
  app: FastifyInstance,
  db: Database,
  config: AppConfig,
): Promise<void> {
  app.get('/api/ai/conversations', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const query = parse(pageQuery, request.query)
    const total = await db.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM ai_conversations WHERE user_id = $1',
      [user.id],
    )
    const result = await db.query<ConversationRow>(
      `SELECT * FROM ai_conversations WHERE user_id = $1
       ORDER BY updated_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [user.id, query.pageSize, (query.page - 1) * query.pageSize],
    )
    return ok(reply, {
      list: result.rows.map((row) => mapConversation(row)),
      total: Number(total.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.post('/api/ai/conversations', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const input = parse(createConversationSchema, request.body)
    const result = await db.query<ConversationRow>(
      `INSERT INTO ai_conversations(user_id, title)
       VALUES ($1, $2) RETURNING *`,
      [user.id, input.title || null],
    )
    return ok(reply, mapConversation(result.rows[0]!), '创建会话成功')
  })

  app.get('/api/ai/conversations/:id', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const { id } = parse(idParams, request.params)
    const conversation = await requireConversation(db, user.id, id)
    const messages = await db.query<MessageRow>(
      'SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY id',
      [id],
    )
    return ok(reply, mapConversation(conversation, messages.rows))
  })

  app.delete('/api/ai/conversations/:id', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const { id } = parse(idParams, request.params)
    const result = await db.query(
      'DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2',
      [id, user.id],
    )
    if (!result.rowCount) throw new AppError(404, '会话不存在')
    return ok(reply, null, '删除会话成功')
  })

  // Deprecated compatibility endpoint. It can only persist user input; assistant
  // messages are written atomically with the answer by POST /api/ai/chat.
  app.post('/api/ai/conversations/:id/messages', async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const { id } = parse(idParams, request.params)
    await requireConversation(db, user.id, id)
    const input = parse(userMessageSchema, request.body)
    const result = await withTransaction(db, async (client) => {
      const conversation = await client.query(
        'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, user.id],
      )
      if (!conversation.rowCount) throw new AppError(404, '会话不存在')
      const inserted = await client.query<MessageRow>(
        `INSERT INTO ai_messages(conversation_id, role, content, metadata)
         VALUES ($1, 'user', $2, $3) RETURNING *`,
        [id, input.content, input.metadata ? JSON.stringify(input.metadata) : null],
      )
      await client.query('UPDATE ai_conversations SET updated_at = now() WHERE id = $1', [id])
      return inserted.rows[0]!
    })
    return ok(reply, mapMessage(result), '消息已保存')
  })

  app.post('/api/ai/chat', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const user = await authenticate(request, db, config.jwtSecret)
    const input = parse(chatSchema, request.body)
    const conversation = await requireConversation(db, user.id, input.conversationId)
    const expectedUpdatedAt = conversation.updated_at

    const historyResult = await db.query<MessageRow>(
      `SELECT * FROM ai_messages WHERE conversation_id = $1
       ORDER BY id DESC LIMIT 20`,
      [input.conversationId],
    )
    const history = historyResult.rows.reverse().map((message) => ({
      role: message.role,
      content: message.content,
    }))
    const answer = await generateAnswer(db, config, history, input.content)

    await withTransaction(db, async (client) => {
      const conversation = await client.query(
        `SELECT id FROM ai_conversations
         WHERE id = $1 AND user_id = $2 AND updated_at = $3::timestamptz FOR UPDATE`,
        [input.conversationId, user.id, expectedUpdatedAt],
      )
      if (!conversation.rowCount) {
        const stillExists = await client.query(
          'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2',
          [input.conversationId, user.id],
        )
        if (!stillExists.rowCount) throw new AppError(404, '会话不存在')
        throw new AppError(409, '会话已更新，请重新发送')
      }
      await client.query(
        `INSERT INTO ai_messages(conversation_id, role, content)
         VALUES ($1, 'user', $2)`,
        [input.conversationId, input.content],
      )
      await client.query(
        `INSERT INTO ai_messages(conversation_id, role, content, metadata)
         VALUES ($1, 'assistant', $2, $3)`,
        [
          input.conversationId,
          answer.content,
          JSON.stringify({ source: answer.source, ...(config.aiApiKey ? { model: config.aiModel } : {}) }),
        ],
      )
      await client.query(
        'UPDATE ai_conversations SET updated_at = now() WHERE id = $1',
        [input.conversationId],
      )
    })

    const event = JSON.stringify({ type: answer.type, content: answer.content })
    return reply
      .header('Content-Type', 'text/event-stream; charset=utf-8')
      .header('Cache-Control', 'no-cache, no-transform')
      .header('Connection', 'keep-alive')
      .header('X-Accel-Buffering', 'no')
      .send(`data: ${event}\n\ndata: [DONE]\n\n`)
  })
}
