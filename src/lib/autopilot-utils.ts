export interface Condition {
  field?: string
  operator?: string
  value?: unknown
}

export interface ConditionGroup {
  all?: Condition[]
  any?: Condition[]
}

export type Conditions = Condition | ConditionGroup | null | undefined

export interface ActionMeta {
  name: string
  label: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  supportsAutopilot: boolean
  implemented: boolean
  estimatedMinutesSaved: number
}

export const ACTION_REGISTRY: ActionMeta[] = [
  {
    name: 'GENERATE_PRODUCT_SEO',
    label: 'Gerar SEO do Produto',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: true,
    estimatedMinutesSaved: 10,
  },
  {
    name: 'GENERATE_INSTAGRAM_CONTENT',
    label: 'Gerar Conteúdo Instagram',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: true,
    estimatedMinutesSaved: 15,
  },
  {
    name: 'CREATE_NOTIFICATION',
    label: 'Criar Notificação',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: true,
    estimatedMinutesSaved: 0,
  },
  {
    name: 'ANALYZE_LOW_STOCK',
    label: 'Analisar Estoque Baixo',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: true,
    estimatedMinutesSaved: 10,
  },
  {
    name: 'ANALYZE_PRODUCT_PERFORMANCE',
    label: 'Analisar Performance',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: true,
    estimatedMinutesSaved: 15,
  },
  {
    name: 'GENERATE_PRODUCT_CONTENT',
    label: 'Gerar Conteúdo do Produto',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: true,
    estimatedMinutesSaved: 20,
  },
  {
    name: 'CREATE_SHOPIFY_DRAFT',
    label: 'Criar Rascunho Shopify',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: false,
    estimatedMinutesSaved: 10,
  },
  {
    name: 'UPDATE_LOCAL_PRODUCT',
    label: 'Atualizar Produto Local',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: false,
    estimatedMinutesSaved: 5,
  },
  {
    name: 'CREATE_MARKETING_DRAFT',
    label: 'Criar Rascunho Marketing',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: false,
    estimatedMinutesSaved: 10,
  },
  {
    name: 'CREATE_DAILY_BRIEFING',
    label: 'Criar Briefing Diário',
    riskLevel: 'LOW',
    supportsAutopilot: true,
    implemented: false,
    estimatedMinutesSaved: 15,
  },
  {
    name: 'REQUEST_PRICE_CHANGE',
    label: 'Solicitar Alteração de Preço',
    riskLevel: 'HIGH',
    supportsAutopilot: false,
    implemented: false,
    estimatedMinutesSaved: 0,
  },
  {
    name: 'REQUEST_SHOPIFY_ACTIVATION',
    label: 'Solicitar Ativação Shopify',
    riskLevel: 'HIGH',
    supportsAutopilot: false,
    implemented: false,
    estimatedMinutesSaved: 0,
  },
]

export const UNSAFE_ACTIONS = ACTION_REGISTRY.filter((a) => !a.supportsAutopilot).map((a) => a.name)
export const UNIMPLEMENTED_ACTIONS = ACTION_REGISTRY.filter((a) => !a.implemented).map(
  (a) => a.name,
)

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function evaluateCondition(
  cond: Condition | null | undefined,
  payload: Record<string, unknown>,
): boolean {
  if (!cond || !cond.field) return true
  const val = getNestedValue(payload, cond.field)
  switch (cond.operator) {
    case 'equals':
      return val === cond.value
    case 'not_equals':
      return val !== cond.value
    case 'greater_than':
      return Number(val) > Number(cond.value)
    case 'greater_or_equal':
      return Number(val) >= Number(cond.value)
    case 'less_than':
      return Number(val) < Number(cond.value)
    case 'less_or_equal':
      return Number(val) <= Number(cond.value)
    case 'contains':
      return String(val ?? '').includes(String(cond.value))
    case 'not_contains':
      return !String(val ?? '').includes(String(cond.value))
    case 'is_empty':
      return !val || val === '' || val === null || val === undefined
    case 'is_not_empty':
      return !!val && val !== ''
    case 'in':
      return Array.isArray(cond.value) && cond.value.includes(val)
    case 'not_in':
      return Array.isArray(cond.value) && !cond.value.includes(val)
    default:
      return false
  }
}

export function evaluateConditions(
  conditions: Conditions,
  payload: Record<string, unknown>,
): boolean {
  if (!conditions) return true
  if ('all' in conditions && conditions.all) {
    return conditions.all.every((c) => evaluateCondition(c, payload))
  }
  if ('any' in conditions && conditions.any) {
    return conditions.any.some((c) => evaluateCondition(c, payload))
  }
  return evaluateCondition(conditions as Condition, payload)
}

export function buildShopifyDedupKey(
  storeId: string,
  webhookId: string | null,
  eventId: string | null,
  shopDomain: string,
  topic: string,
  entityId: string,
  updatedAt: string,
): string {
  if (webhookId) return `shopify:${storeId}:${webhookId}`
  if (eventId) return `shopify:${storeId}:${eventId}`
  return `shopify:${storeId}:${shopDomain}:${topic}:${entityId}:${updatedAt}`
}

export function buildManualDedupKey(
  source: string,
  eventType: string,
  entityId: string,
  userActionUuid?: string,
): string {
  if (userActionUuid) return `manual:${userActionUuid}`
  const ts = new Date().toISOString().substring(0, 13)
  return `manual:${source}:${eventType}:${entityId || ''}:${ts}`
}

export function isCooldownActive(lastExecutedAt: string | null, cooldownMinutes: number): boolean {
  if (!lastExecutedAt || cooldownMinutes <= 0) return false
  const lastDate = new Date(lastExecutedAt)
  const cooldownEnd = new Date(lastDate.getTime() + cooldownMinutes * 60000)
  return new Date() < cooldownEnd
}

export function canRoleApprove(role: string, riskLevel: string): boolean {
  if (role === 'VIEWER') return false
  if (role === 'EDITOR' && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL')) return false
  if (riskLevel === 'CRITICAL' && role !== 'OWNER') return false
  return true
}

export function canManageRules(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

export function canToggleAutopilot(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

export function resolveAutonomyMode(autonomyMode: string, supportsAutopilot: boolean): string {
  if (autonomyMode === 'AUTOPILOT' && !supportsAutopilot) return 'APPROVAL'
  return autonomyMode
}

export function isRetryableError(errorStr: string): boolean {
  const s = String(errorStr)
  return (
    s.includes('429') ||
    s.includes('timeout') ||
    s.includes('SkipAi') ||
    s.includes('500') ||
    s.includes('502') ||
    s.includes('503') ||
    s.includes('504')
  )
}

export function calculateBackoff(attempts: number): number {
  if (attempts === 1) return 1
  if (attempts === 2) return 5
  return 15
}

export function canExecuteAction(action: ActionMeta): boolean {
  return action.implemented
}

export function isScheduledForReady(scheduledFor: string | null, now: Date = new Date()): boolean {
  if (!scheduledFor) return true
  return new Date(scheduledFor) <= now
}

export function shouldProcessJob(
  jobStatus: string,
  autopilotEnabled: boolean,
  scheduledFor: string | null,
): boolean {
  if (!autopilotEnabled) return false
  if (jobStatus !== 'QUEUED' && jobStatus !== 'RETRYING') return false
  return isScheduledForReady(scheduledFor)
}

export function buildIdempotencyKey(
  storeId: string,
  ruleId: string,
  eventId: string,
  entityId: string,
  actionType: string,
): string {
  return `${storeId}:${ruleId}:${eventId}:${entityId || ''}:${actionType}`
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export function canAccessStore(userStoreId: string, resourceStoreId: string): boolean {
  return userStoreId === resourceStoreId
}

export function shouldExecuteApproval(approvalStatus: string, jobStatus: string): boolean {
  if (approvalStatus !== 'PENDING') return false
  if (jobStatus === 'COMPLETED' || jobStatus === 'RUNNING') return false
  return true
}

export function getNotificationSeverityForExecution(executionStatus: string): string {
  if (executionStatus === 'COMPLETED') return 'SUCCESS'
  if (executionStatus === 'FAILED') return 'ERROR'
  return 'INFO'
}

export function resolveLocalProductId(
  products: Array<{ id: string; shopify_id: string }>,
  shopifyId: string,
): string | null {
  const p = products.find((pr) => pr.shopify_id === shopifyId)
  return p ? p.id : null
}

export function normalizeDomain(domain: string): string {
  if (!domain) return ''
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

export function validateSeoOutput(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    typeof d.seo_title === 'string' &&
    d.seo_title.length > 0 &&
    typeof d.meta_description === 'string' &&
    typeof d.keywords === 'string' &&
    typeof d.slug === 'string' &&
    typeof d.alt_text === 'string'
  )
}

export function validateInstagramOutput(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return typeof d.caption === 'string' && d.caption.length > 0 && typeof d.hashtags === 'string'
}

export function validateProductContentOutput(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    typeof d.description === 'string' &&
    d.description.length > 0 &&
    typeof d.seo_title === 'string' &&
    d.seo_title.length > 0 &&
    typeof d.meta_description === 'string' &&
    typeof d.keywords === 'string' &&
    typeof d.slug === 'string'
  )
}

export function cleanAiJson(text: string): string {
  let t = text.trim()
  if (t.includes('```json')) {
    t = t
      .replace(/```json\s*/g, '')
      .replace(/```/g, '')
      .trim()
  } else if (t.includes('```')) {
    t = t
      .replace(/```\s*/g, '')
      .replace(/```/g, '')
      .trim()
  }
  return t
}
