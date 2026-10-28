import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  Empty,
  Input,
  List,
  Popconfirm,
  Space,
  Spin,
  Typography,
  message as antdMessage,
} from 'antd'
import {
  DeleteOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useSelector } from 'react-redux'

import aiService from '@/api/ai'
import type { RootState } from '@/store'
import type { AiConversation, AiMessage } from '@/types/ai'

function AIChat() {
  const token = useSelector((state: RootState) => state.auth.token)
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [conversationId, setConversationId] = useState<number>()
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => () => requestRef.current?.abort(), [])

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const result = await aiService.getConversations()
      setConversations(Array.isArray(result.data?.list) ? result.data.list : [])
    } catch (error) {
      console.error(error)
      antdMessage.error('获取历史对话失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function openConversation(id: number) {
    if (sending) return
    setConversationId(id)
    setLoading(true)
    try {
      const result = await aiService.getConversation(id)
      setMessages(Array.isArray(result.data?.messages) ? result.data.messages : [])
    } catch (error) {
      console.error(error)
      antdMessage.error('获取对话内容失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (sending) return
    try {
      await aiService.deleteConversation(id)
      if (conversationId === id) {
        setConversationId(undefined)
        setMessages([])
      }
      await loadConversations()
      antdMessage.success('对话已删除')
    } catch (error) {
      console.error(error)
      antdMessage.error('删除对话失败')
    }
  }

  function appendAssistantText(content: string) {
    setMessages((current) => {
      const next = [...current]
      const last = next[next.length - 1]
      if (last?.role === 'assistant') {
        next[next.length - 1] = {
          ...last,
          content: last.content + content,
        }
      }
      return next
    })
  }

  async function handleSend() {
    const content = input.trim()
    if (!content || sending) return

    setInput('')
    setSending(true)
    const userMessage: AiMessage = { role: 'user', content }
    const requestMessages = [...messages, userMessage]
    setMessages([...requestMessages, { role: 'assistant', content: '' }])

    let activeId = conversationId
    const controller = new AbortController()
    requestRef.current = controller
    let receivedText = false

    try {
      if (!activeId) {
        const created = await aiService.createConversation(content.slice(0, 24))
        activeId = created.data.id
        setConversationId(activeId)
      }
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: activeId,
          content,
        }),
      })
      if (!response.ok || !response.body) {
        throw new Error(`AI 请求失败：${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        events.forEach((event) => {
          const dataLine = event
            .split('\n')
            .find((line) => line.startsWith('data:'))
          if (!dataLine) return
          if (dataLine.slice(5).trim() === '[DONE]') return
          try {
            const payload = JSON.parse(dataLine.slice(5).trim()) as {
              type?: string
              content?: string
            }
            if (
              payload.content &&
              ['text', 'fallback', 'thinking'].includes(payload.type || '')
            ) {
              receivedText = true
              appendAssistantText(payload.content)
            }
          } catch (error) {
            console.error('SSE 数据解析失败', error)
          }
        })
        if (done) break
      }

      if (!receivedText) throw new Error('AI 未返回有效内容')
      // 服务端在同一事务保存整轮消息，重新读取权威记录以保持页面与数据库一致。
      const saved = await aiService.getConversation(activeId)
      setMessages(saved.data.messages || [])
      await loadConversations()
    } catch (error) {
      if (controller.signal.aborted) return
      console.error(error)
      if (activeId) {
        try {
          const saved = await aiService.getConversation(activeId)
          setMessages(saved.data.messages || [])
        } catch {
          setMessages(requestMessages.slice(0, -1))
        }
      } else {
        setMessages(requestMessages.slice(0, -1))
      }
      setInput(content)
      antdMessage.error('AI 请求失败')
    } finally {
      requestRef.current = null
      setSending(false)
    }
  }

  return (
    <div className="ai-layout">
      <Card
        className="ai-sidebar"
        title="历史对话"
        extra={
          <Button
            type="text"
            icon={<PlusOutlined />}
            disabled={sending}
            onClick={() => {
              setConversationId(undefined)
              setMessages([])
            }}
          />
        }
      >
        <Spin spinning={loading}>
          <List
            dataSource={conversations}
            locale={{ emptyText: '暂无历史对话' }}
            renderItem={(item) => (
              <List.Item
                className={conversationId === item.id ? 'ai-history-active' : ''}
                onClick={() => void openConversation(item.id)}
                actions={[
                  <Popconfirm
                    key="delete"
                    title="删除这段对话？"
                    disabled={sending}
                    onConfirm={() => void handleDelete(item.id)}
                  >
                    <Button
                      type="text"
                      danger
                      disabled={sending}
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
              >
                <Typography.Text ellipsis>
                  {item.title || '新对话'}
                </Typography.Text>
              </List.Item>
            )}
          />
        </Spin>
      </Card>

      <Card className="ai-main" title="城市视图 AI 助手">
        <div className="ai-messages">
          {messages.length === 0 ? (
            <Empty
              image={<RobotOutlined style={{ fontSize: 52 }} />}
              description="询问城市数据、图表分析或运营建议"
            />
          ) : (
            messages.map((item, index) => (
              <div
                className={`ai-message ai-message-${item.role}`}
                key={item.id || `${item.role}-${index}`}
              >
                <div className="ai-avatar">
                  {item.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                </div>
                <div className="ai-bubble">
                  {item.content || (sending ? '正在思考…' : '')}
                </div>
              </div>
            ))
          )}
          <div ref={messageEndRef} />
        </div>

        <Space.Compact className="ai-input">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 5 }}
            value={input}
            placeholder="请输入问题，Command/Ctrl + Enter 发送"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                void handleSend()
              }
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={sending}
            onClick={() => void handleSend()}
          >
            发送
          </Button>
        </Space.Compact>
      </Card>
    </div>
  )
}

export default AIChat
