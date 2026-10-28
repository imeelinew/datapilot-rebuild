import request from '@/utils/request'
import type {
  ConversationPageResult,
  ConversationResult,
} from '@/types/ai'

const aiService = {
  getConversations() {
    return request.get('/ai/conversations', {
      params: { page: 1, pageSize: 50 },
    }) as Promise<ConversationPageResult>
  },
  createConversation(title?: string) {
    return request.post('/ai/conversations', {
      title,
    }) as Promise<ConversationResult>
  },
  getConversation(id: number) {
    return request.get(
      `/ai/conversations/${id}`,
    ) as Promise<ConversationResult>
  },
  deleteConversation(id: number) {
    return request.delete(`/ai/conversations/${id}`)
  },
}

export default aiService
