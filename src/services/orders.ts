import pb from '@/lib/pocketbase/client'
import type { OrderRecord } from '@/types'

export const getOrders = (page: number = 1, perPage: number = 50) =>
  pb.collection('orders').getList<OrderRecord>(page, perPage, { sort: '-created' })

export const getAllOrders = () =>
  pb.collection('orders').getFullList<OrderRecord>({ sort: '-created' })

export const updateOrderStatus = (id: string, status: OrderRecord['status']) =>
  pb.collection('orders').update(id, { status })
