import pb from '@/lib/pocketbase/client'
import type { AnalyticsSummary } from '@/types'

export const getAnalyticsSummary = (
  period: number = 7,
  includeDemo: boolean = false,
): Promise<AnalyticsSummary> =>
  pb.send('/backend/v1/analytics/summary', {
    method: 'POST',
    body: JSON.stringify({ period, includeDemo }),
    headers: { 'Content-Type': 'application/json' },
  })
