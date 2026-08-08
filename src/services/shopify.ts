import pb from '@/lib/pocketbase/client'
import type { ShopifyStatus } from '@/types'

export type ShopifyConnectionStatus =
  | 'NOT_CONFIGURED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'AUTH_ERROR'
  | 'PERMISSION_ERROR'
  | 'API_ERROR'

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

export const getShopifyStatus = (): Promise<ShopifyStatus> =>
  pb.send('/backend/v1/shopify/status', { method: 'GET' })

export const syncProducts = (): Promise<SyncResult> =>
  pb.send('/backend/v1/shopify/sync-products', { method: 'POST' })

export const syncOrders = (): Promise<SyncResult> =>
  pb.send('/backend/v1/shopify/sync-orders', { method: 'POST' })

export const publishProduct = (id: string): Promise<PublishResult> =>
  pb.send(`/backend/v1/shopify/publish/${id}`, { method: 'POST' })

export interface DiagnosticsResult {
  steps: Array<Record<string, unknown>>
  summary: string
}

export const runDiagnostics = (): Promise<DiagnosticsResult> =>
  pb.send('/backend/v1/shopify/diagnostics', { method: 'POST' })
