import pb from '@/lib/pocketbase/client'
import type { CampaignRecord } from '@/types'

export const getCampaigns = () =>
  pb.collection('campaigns').getFullList<CampaignRecord>({ sort: '-created' })

export const createCampaign = (data: Partial<CampaignRecord>) =>
  pb.collection('campaigns').create<CampaignRecord>(data)

export const updateCampaign = (id: string, data: Partial<CampaignRecord>) =>
  pb.collection('campaigns').update(id, data)

export const deleteCampaign = (id: string) => pb.collection('campaigns').delete(id)
