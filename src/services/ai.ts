import pb from '@/lib/pocketbase/client'
import type { SeoContent, InstagramContent, ProductAIContent } from '@/types'

export const generateSeoContent = (
  productName: string,
  productDescription?: string,
): Promise<SeoContent> =>
  pb.send('/backend/v1/content/seo', {
    method: 'POST',
    body: JSON.stringify({ productName, productDescription }),
    headers: { 'Content-Type': 'application/json' },
  })

export const generateInstagramContent = (
  productName: string,
  price?: number,
  description?: string,
): Promise<InstagramContent> =>
  pb.send('/backend/v1/content/instagram', {
    method: 'POST',
    body: JSON.stringify({ productName, price, description }),
    headers: { 'Content-Type': 'application/json' },
  })

export const sendAgentMessage = (message: string, conversation_id?: string | null) =>
  pb.send('/backend/v1/agents/nova-era-assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id }),
    headers: { 'Content-Type': 'application/json' },
  })

export const listAgentConversations = (limit: number = 20) =>
  pb.send('/backend/v1/agents/nova-era-assistant/conversations', {
    method: 'GET',
    params: { limit: String(limit) },
  })

export const getAgentMessages = (conversationId: string) =>
  pb.send(`/backend/v1/agents/nova-era-assistant/conversations/${conversationId}/messages`, {
    method: 'GET',
  })

export const getActionLogs = (limit: number = 20) =>
  pb.send('/backend/v1/action-logs', {
    method: 'GET',
    params: { limit: String(limit) },
  })
