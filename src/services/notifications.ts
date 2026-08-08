import pb from '@/lib/pocketbase/client'
import type { AutomationNotification } from '@/types'

export const getNotifications = (): Promise<{ items: AutomationNotification[]; unread: number }> =>
  pb.send('/backend/v1/notifications', { method: 'GET' })

export const markNotificationRead = (id: string): Promise<{ success: boolean }> =>
  pb.send(`/backend/v1/notifications/${id}/read`, { method: 'POST' })

export const markAllNotificationsRead = (): Promise<{ success: boolean; markedRead: number }> =>
  pb.send('/backend/v1/notifications/read-all', { method: 'POST' })
