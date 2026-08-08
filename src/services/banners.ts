import pb from '@/lib/pocketbase/client'
import type { BannerRecord } from '@/types'

export const getBanners = () =>
  pb.collection('banners').getFullList<BannerRecord>({ sort: '-created' })

export const createBanner = (data: Partial<BannerRecord>) =>
  pb.collection('banners').create<BannerRecord>(data)

export const updateBanner = (id: string, data: Partial<BannerRecord>) =>
  pb.collection('banners').update(id, data)

export const deleteBanner = (id: string) => pb.collection('banners').delete(id)
