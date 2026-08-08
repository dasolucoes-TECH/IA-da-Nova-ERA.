export interface Store {
  id: string
  name: string
  myshopify_domain: string
  primary_domain: string
  shopify_shop_name: string
  shopify_shop_gid: string
  api_version: string
  connected: boolean
  last_product_sync: string
  last_order_sync: string
  created: string
  updated: string
}

export interface Membership {
  id: string
  store: string
  user: string
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
  created: string
}

export interface ProductVariant {
  id: string
  store: string
  product: string
  shopify_variant_id: string
  title: string
  sku: string
  barcode: string
  price: number
  compare_at_price: number
  inventory_quantity: number
  inventory_item_id: string
  selected_options: Record<string, unknown>
  position: number
  created_at_shopify: string
  updated_at_shopify: string
}

export interface ActionLog {
  id: string
  store: string
  user: string
  action_type: string
  entity_type: string
  entity_id: string
  status: 'PROPOSED' | 'APPROVED' | 'EXECUTED' | 'FAILED' | 'CANCELLED'
  summary: string
  before_snapshot: Record<string, unknown>
  after_snapshot: Record<string, unknown>
  created: string
}

export interface IntegrationSync {
  id: string
  store: string
  sync_type: string
  status: string
  started_at: string
  completed_at: string
  records_processed: number
  records_created: number
  records_updated: number
  errors: unknown[]
  created: string
}

export type DataOrigin = 'shopify' | 'local' | 'demo' | 'system'
export type ShopifyProductStatus = 'LOCAL_DRAFT' | 'SHOPIFY_DRAFT' | 'SHOPIFY_ACTIVE' | 'SYNC_ERROR'

export interface ProductRecord {
  id: string
  name: string
  description?: string
  price: number
  cost?: number
  stock: number
  supplier?: string
  collection?: string
  status: 'rascunho' | 'publicado'
  shopify_status?: ShopifyProductStatus
  data_origin?: DataOrigin
  store?: string
  vendor?: string
  product_type?: string
  tags?: string
  images?: string[]
  slug?: string
  seo_title?: string
  meta_description?: string
  keywords?: string
  alt_text?: string
  faq?: unknown
  benefits?: unknown
  specifications?: unknown
  instagram_caption?: string
  instagram_hashtags?: string
  stories?: string
  carousel?: string
  email_marketing?: string
  sales_count?: number
  shopify_id?: string
  shopify_draft_id?: string
  shopify_created_at?: string
  shopify_updated_at?: string
  created?: string
  updated?: string
  expand?: {
    supplier?: { id: string; name: string }
    collection?: { id: string; name: string }
    store?: Store
  }
}

export interface OrderRecord {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  total: number
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  financial_status?: string
  fulfillment_status?: string
  currency?: string
  items: unknown
  source: string
  data_origin?: DataOrigin
  store?: string
  shopify_id?: string
  created_at_shopify?: string
  updated_at_shopify?: string
  created: string
  updated: string
}

export interface CampaignRecord {
  id: string
  name: string
  type: 'desconto' | 'banner' | 'landing' | 'social'
  coupon_code?: string
  discount_percent?: number
  spend?: number
  status: 'draft' | 'active' | 'paused' | 'ended'
  description?: string
  data_origin?: DataOrigin
  store?: string
  created: string
}

export interface BannerRecord {
  id: string
  title: string
  subtitle?: string
  link?: string
  position: 'hero' | 'promo' | 'footer'
  active: boolean
  image?: string
  data_origin?: DataOrigin
  store?: string
  created: string
}

export interface ShopifyStatus {
  connected: boolean
  status: string
  storeDomain: string
  apiVersion: string
  shopName?: string
  domain?: string
  myshopifyDomain?: string
  grantedScopes?: string[]
  missingScopes?: string[]
  syncedProducts?: number
  syncedOrders?: number
  lastProductSync?: string
  lastOrderSync?: string
  verifiedAt?: string
  message?: string
}

export interface AnalyticsSummary {
  totalRevenue: number | null
  totalOrders: number | null
  paidOrdersCount: number | null
  ticketMedio: number | null
  conversionRate: number | null
  totalSpend: number | null
  cpa: number | null
  roas: number | null
  visitsCount: number | null
  lowStockProducts: Array<{ id: string; name: string; stock: number; price: number }>
  topProducts: Array<{
    id: string
    name: string
    sales_count: number
    price: number
    stock: number
  }>
  revenueData: Array<{ date: string; revenue: number; orders: number }>
  variations: {
    revenue: number | null
    orders: number | null
    ticketMedio: number | null
  }
}

export interface SeoContent {
  seo_title: string
  meta_description: string
  keywords: string
  alt_text: string
  slug: string
  schema?: Record<string, unknown>
}

export interface InstagramContent {
  caption: string
  hashtags: string
  stories: string[]
  carousel: string[]
  reels_script: string
  cta: string
}

export interface ProductAIContent {
  description: string
  seo_title: string
  meta_description: string
  keywords: string
  slug: string
  alt_text: string
  faq: Array<{ question: string; answer: string }>
  benefits: string[]
  specifications: Array<{ label: string; value: string }>
  instagram_caption: string
  instagram_hashtags: string
  stories: string
  email_marketing: string
}

export interface AutomationRule {
  id: string
  name: string
  description?: string
  enabled: boolean
  trigger_type: string
  trigger_config?: string
  conditions?: string
  action_type: string
  action_config?: string
  autonomy_mode: 'SUGGEST' | 'APPROVAL' | 'AUTOPILOT'
  priority?: number
  cooldown_minutes?: number
  max_executions_per_day?: number
  last_executed_at?: string
  execution_count?: number
  created?: string
}

export interface AutomationApproval {
  id: string
  title: string
  description?: string
  entity_type?: string
  entity_id?: string
  proposed_action?: Record<string, unknown>
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'
  expires_at?: string
  approved_at?: string
  rejected_at?: string
  created: string
  rule?: string
  job?: string
}

export interface AutomationNotification {
  id: string
  type: string
  title: string
  message: string
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL'
  entity_type?: string
  entity_id?: string
  read: boolean
  created: string
}

export interface ActivityLog {
  id: string
  action_type: string
  entity_type?: string
  entity_id?: string
  status: string
  summary?: string
  execution_source?: string
  estimated_minutes_saved?: number
  automation?: boolean
  rule?: string
  created: string
}

export interface AutopilotSummary {
  activeRules: number
  executionsToday: number
  pendingApprovals: number
  failedToday: number
  estimatedMinutesSaved: number
  lastExecution?: {
    id: string
    status: string
    jobType: string
    completedAt: string
    createdAt: string
  } | null
  autopilotEnabled: boolean
}

export interface StoreSettings {
  store_name: string
  brand_name: string
  slogan: string
  instagram: string
  brand_tone: string
  currency: string
  locale: string
  free_shipping_enabled: boolean
  shipping_text: string
  warranty_text: string
  default_cta: string
  timezone: string
}
