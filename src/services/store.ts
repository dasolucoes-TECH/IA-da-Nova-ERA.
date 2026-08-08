import pb from '@/lib/pocketbase/client'
import type { StoreSettings } from '@/types'

export const getStoreSettings = (): Promise<Partial<StoreSettings>> =>
  pb.send('/backend/v1/store/settings', { method: 'GET' })

export const updateStoreSettings = (data: Partial<StoreSettings>) =>
  pb.send('/backend/v1/store/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
