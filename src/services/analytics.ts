import pb from '@/lib/pocketbase/client'

export interface AnalyticsSummary {
  totalRevenue: number
  totalOrders: number
  paidOrdersCount: number
  ticketMedio: number
  conversionRate: number
  totalSpend: number
  cac: number
  roi: number
  visitsCount: number
  lowStockProducts: Array<{ id: string; name: string; stock: number; price: number }>
  topProducts: Array<{
    id: string
    name: string
    sales_count: number
    price: number
    stock: number
  }>
}

export const getAnalyticsSummary = (): Promise<AnalyticsSummary> =>
  pb.send('/backend/v1/analytics/summary', { method: 'GET' })
