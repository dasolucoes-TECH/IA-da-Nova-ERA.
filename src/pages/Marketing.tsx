import { useEffect, useState } from 'react'
import { Megaphone, Plus, Tag, Sparkles, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { getCampaigns, createCampaign, CampaignRecord } from '@/services/campaigns'
import { toast } from '@/components/ui/use-toast'

export default function Marketing() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([])
  const [open, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [coupon, setCoupon] = useState('VERAO20')
  const [discount, setDiscount] = useState(20)
  const [spend, setSpend] = useState(500)

  const loadData = async () => {
    const data = await getCampaigns()
    setCampaigns(data)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async () => {
    try {
      await createCampaign({
        name,
        type: 'desconto',
        coupon_code: coupon,
        discount_percent: discount,
        spend,
        status: 'draft',
        description: `Cupom de ${discount}% de desconto. Planejamento de campanha — somente Nova Era AI.`,
      })
      toast({ title: 'Campanha criada com sucesso!' })
      setModalOpen(false)
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing & Campanhas</h1>
          <p className="text-xs text-slate-500">
            Crie cupons, banners e campanhas de conversão com IA.
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((c) => (
          <Card
            key={c.id}
            className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold">{c.name}</CardTitle>
              <Badge
                className={c.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-slate-400'}
              >
                {c.status === 'draft' ? 'Somente Nova Era AI' : c.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">{c.description}</p>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-white/10">
                <span className="font-semibold text-amber-500 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> {c.coupon_code || 'SEM CUPOM'}
                </span>
                <span className="font-bold">Investimento: R$ {c.spend || 0}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-2">
            <div>
              <Label>Nome da Campanha</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Oferta de Inverno"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Código do Cupom</Label>
                <Input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  className="rounded-xl uppercase font-bold"
                />
              </div>
              <div>
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label>Investimento em Mídia (R$)</Label>
              <Input
                type="number"
                value={spend}
                onChange={(e) => setSpend(Number(e.target.value))}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl w-full"
            >
              Salvar Campanha (Rascunho)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
