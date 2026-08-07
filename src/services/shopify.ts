import pb from '@/lib/pocketbase/client'

export interface ShopifyStatus {
  connected: boolean
  storeDomain: string
  apiVersion: string
  shopName?: string
  shopEmail?: string
  shopCurrency?: string
  syncedProducts?: number
  syncedOrders?: number
  lastProductSync?: string
  lastOrderSync?: string
  message?: string
}

export interface SyncResult {
  created: number
  updated: number
  total: number
  errors: Array<{ product?: string; order?: string; error: string }>
}

export interface PublishResult {
  draftId: string
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
