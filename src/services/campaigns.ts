import pb from '@/lib/pocketbase/client'

export interface CampaignRecord {
  id: string
  name: string
  type: 'desconto' | 'banner' | 'landing' | 'social'
  coupon_code?: string
  discount_percent?: number
  spend?: number
  status: 'draft' | 'active' | 'paused' | 'ended'
  description?: string
  created: string
}

export const getCampaigns = () =>
  pb.collection('campaigns').getFullList<CampaignRecord>({ sort: '-created' })

export const createCampaign = (data: Partial<CampaignRecord>) =>
  pb.collection('campaigns').create<CampaignRecord>(data)

export const updateCampaign = (id: string, data: Partial<CampaignRecord>) =>
  pb.collection('campaigns').update(id, data)

export const deleteCampaign = (id: string) => pb.collection('campaigns').delete(id)
