import pb from '@/lib/pocketbase/client'

export const generateSeoContent = (productName: string, productDescription?: string) =>
  pb.send('/backend/v1/content/seo', {
    method: 'POST',
    body: JSON.stringify({ productName, productDescription }),
    headers: { 'Content-Type': 'application/json' },
  })

export const generateInstagramContent = (productName: string, price?: number) =>
  pb.send('/backend/v1/content/instagram', {
    method: 'POST',
    body: JSON.stringify({ productName, price }),
    headers: { 'Content-Type': 'application/json' },
  })

export const sendAgentMessage = (message: string, conversation_id?: string | null) =>
  pb.send('/backend/v1/agents/nova-era-assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id }),
    headers: { 'Content-Type': 'application/json' },
  })
