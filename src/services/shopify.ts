import pb from '@/lib/pocketbase/client'

export type ShopifyConnectionStatus =
  | 'NOT_CONFIGURED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'AUTH_ERROR'
  | 'PERMISSION_ERROR'
  | 'API_ERROR'

export interface ShopifyStatus {
  connected: boolean
  status: ShopifyConnectionStatus
  storeDomain: string
  apiVersion: string
  shopName?: string
  domain?: string
  myshopifyDomain?: string
  syncedProducts?: number
  syncedOrders?: number
  lastProductSync?: string
  lastOrderSync?: string
  verifiedAt?: string
  message?: string
}

export interface SyncResult {
  created: number
  updated: number
  total: number
  errors: Array<{ product?: string; order?: string; error: string }>
  status?: 'success' | 'permission_required'
  message?: string
}

export interface PublishResult {
  productId: string
  handle: string
  status: string
  message: string
  reused: boolean
}

export const getShopifyStatus = () =>
  pb.send<ShopifyStatus>('/backend/v1/shopify/status', { method: 'GET' })

export const syncProducts = () =>
  pb.send<SyncResult>('/backend/v1/shopify/sync-products', { method: 'POST' })

export const syncOrders = () =>
  pb.send<SyncResult>('/backend/v1/shopify/sync-orders', { method: 'POST' })

export const publishProduct = (id: string) =>
  pb.send<PublishResult>(`/backend/v1/shopify/publish/${id}`, { method: 'POST' })
