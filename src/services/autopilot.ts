import pb from '@/lib/pocketbase/client'
import type { AutomationRule, AutomationApproval, AutopilotSummary, ActivityLog } from '@/types'

export const getAutopilotSummary = (): Promise<AutopilotSummary> =>
  pb.send('/backend/v1/autopilot/summary', { method: 'GET' })

export const getAutomationRules = (): Promise<{ items: AutomationRule[] }> =>
  pb.send('/backend/v1/autopilot/rules', { method: 'GET' })

export const createAutomationRule = (data: Partial<AutomationRule>): Promise<{ id: string }> =>
  pb.send('/backend/v1/autopilot/rules', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const updateAutomationRule = (
  id: string,
  data: Partial<AutomationRule>,
): Promise<{ success: boolean }> =>
  pb.send(`/backend/v1/autopilot/rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const toggleAutomationRule = (id: string): Promise<{ id: string; enabled: boolean }> =>
  pb.send(`/backend/v1/autopilot/rules/${id}/toggle`, { method: 'POST' })

export const getApprovals = (
  status: string = 'PENDING',
): Promise<{ items: AutomationApproval[] }> =>
  pb.send('/backend/v1/autopilot/approvals', { method: 'GET', params: { status } })

export const approveAction = (id: string): Promise<{ success: boolean }> =>
  pb.send(`/backend/v1/autopilot/approvals/${id}/approve`, { method: 'POST' })

export const rejectAction = (id: string): Promise<{ success: boolean }> =>
  pb.send(`/backend/v1/autopilot/approvals/${id}/reject`, { method: 'POST' })

export const getActivity = (params?: {
  source?: string
  status?: string
}): Promise<{ items: ActivityLog[] }> =>
  pb.send('/backend/v1/autopilot/activity', { method: 'GET', params })

export const processJobs = (): Promise<{ processed: number; failed: number }> =>
  pb.send('/backend/v1/autopilot/process-jobs', { method: 'POST' })

export const emitEvent = (data: {
  eventType: string
  source?: string
  entityType?: string
  entityId?: string
  payload?: Record<string, unknown>
  deduplicationKey?: string
}): Promise<{ status: string; eventId: string; jobsCreated: number }> =>
  pb.send('/backend/v1/autopilot/emit-event', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const EVENT_TYPES = [
  'SHOPIFY_PRODUCT_CREATED',
  'SHOPIFY_PRODUCT_UPDATED',
  'SHOPIFY_PRODUCT_DELETED',
  'SHOPIFY_ORDER_CREATED',
  'SHOPIFY_ORDER_UPDATED',
  'SHOPIFY_ORDER_PAID',
  'SHOPIFY_ORDER_FULFILLED',
  'SHOPIFY_INVENTORY_UPDATED',
  'PRODUCT_SYNC_COMPLETED',
  'ORDER_SYNC_COMPLETED',
  'PRODUCT_CREATED_LOCAL',
  'PRODUCT_UPDATED_LOCAL',
  'SEO_MISSING',
  'LOW_STOCK_DETECTED',
  'OUT_OF_STOCK_DETECTED',
  'DAILY_BRIEFING_TRIGGERED',
  'USER_ACTION_REQUESTED',
] as const

export const ACTION_TYPES = [
  {
    name: 'GENERATE_PRODUCT_SEO',
    label: 'Gerar SEO do Produto',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 10,
  },
  {
    name: 'GENERATE_PRODUCT_CONTENT',
    label: 'Gerar Conteúdo do Produto',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 20,
  },
  {
    name: 'GENERATE_INSTAGRAM_CONTENT',
    label: 'Gerar Conteúdo Instagram',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 15,
  },
  {
    name: 'CREATE_SHOPIFY_DRAFT',
    label: 'Criar Rascunho Shopify',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 10,
  },
  {
    name: 'UPDATE_LOCAL_PRODUCT',
    label: 'Atualizar Produto Local',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 5,
  },
  {
    name: 'CREATE_MARKETING_DRAFT',
    label: 'Criar Rascunho Marketing',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 10,
  },
  {
    name: 'CREATE_NOTIFICATION',
    label: 'Criar Notificação',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 0,
  },
  {
    name: 'CREATE_DAILY_BRIEFING',
    label: 'Criar Briefing Diário',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 15,
  },
  {
    name: 'ANALYZE_LOW_STOCK',
    label: 'Analisar Estoque Baixo',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 10,
  },
  {
    name: 'ANALYZE_PRODUCT_PERFORMANCE',
    label: 'Analisar Performance',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    minutesSaved: 15,
  },
  {
    name: 'REQUEST_PRICE_CHANGE',
    label: 'Solicitar Alteração de Preço',
    riskLevel: 'HIGH',
    supportsAutopilot: false,
    minutesSaved: 0,
  },
  {
    name: 'REQUEST_SHOPIFY_ACTIVATION',
    label: 'Solicitar Ativação Shopify',
    riskLevel: 'HIGH',
    supportsAutopilot: false,
    minutesSaved: 0,
  },
] as const

export const UNSAFE_ACTIONS = ACTION_TYPES.filter((a) => !a.supportsAutopilot).map((a) => a.name)
