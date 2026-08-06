import pb from '@/lib/pocketbase/client'

export interface OrderRecord {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  total: number
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  items: any
  source: string
  created: string
  updated: string
}

export const getOrders = () =>
  pb.collection('orders').getFullList<OrderRecord>({ sort: '-created' })

export const updateOrderStatus = (id: string, status: OrderRecord['status']) =>
  pb.collection('orders').update(id, { status })
