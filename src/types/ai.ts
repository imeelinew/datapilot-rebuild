import type { ApiResult } from '@/types/auth'
import type { PageData } from '@/types/dashboardManage'

export type AiMessage = {
  id?: number
  conversationId?: number
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown> | null
  createdAt?: string
}

export type AiConversation = {
  id: number
  userId: number
  title: string | null
  dashboardId: number | null
  createdAt: string
  messages?: AiMessage[]
}

export type ConversationPageResult = ApiResult<PageData<AiConversation>>
export type ConversationResult = ApiResult<AiConversation>
export type MessageResult = ApiResult<AiMessage>
