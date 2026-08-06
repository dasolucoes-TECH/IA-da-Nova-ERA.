import { useEffect, useState } from 'react'
import { Image as ImageIcon, Plus, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getBanners, createBanner, BannerRecord } from '@/services/banners'
import { toast } from '@/components/ui/use-toast'

export default function BannersPage() {
  const [banners, setBanners] = useState<BannerRecord[]>([])

  const loadData = async () => {
    const data = await getBanners()
    setBanners(data)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAddDemo = async () => {
    await createBanner({
      title: 'Banner Especial de Vendas IA',
      subtitle: 'Ofertas exclusivas com frete grátis',
      position: 'hero',
      active: true,
      link: '/produtos',
    })
    toast({ title: 'Banner criado!' })
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Banners e Mídias</h1>
          <p className="text-xs text-slate-500">
            Gerencie os destaques visuais e artes da sua loja.
          </p>
        </div>
        <Button
          onClick={handleAddDemo}
          className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Banner
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {banners.map((b) => (
          <Card
            key={b.id}
            className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B] overflow-hidden"
          >
            <div className="h-32 bg-gradient-to-r from-amber-400 to-amber-600 p-6 flex flex-col justify-end text-[#071B3B]">
              <span className="text-xs font-bold uppercase tracking-wider">{b.position}</span>
              <h2 className="text-xl font-black">{b.title}</h2>
            </div>
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">{b.subtitle}</span>
              <Badge className={b.active ? 'bg-emerald-500' : 'bg-slate-400'}>
                {b.active ? 'Ativo' : 'Inativo'}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
