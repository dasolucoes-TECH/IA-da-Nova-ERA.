import { useEffect, useState } from 'react'
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { getBanners, createBanner, deleteBanner, updateBanner } from '@/services/banners'
import { toast } from '@/components/ui/use-toast'
import type { BannerRecord } from '@/types'

export default function BannersPage() {
  const [banners, setBanners] = useState<BannerRecord[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    position: 'hero' as const,
    link: '',
    active: true,
  })

  const loadData = async () => {
    try {
      const data = await getBanners()
      setBanners(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async () => {
    try {
      await createBanner(form)
      toast({ title: 'Banner criado!' })
      setOpen(false)
      setForm({ title: '', subtitle: '', position: 'hero', link: '', active: true })
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este banner?')) {
      await deleteBanner(id)
      toast({ title: 'Banner excluído' })
      loadData()
    }
  }

  const handleToggle = async (b: BannerRecord) => {
    await updateBanner(b.id, { active: !b.active })
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Banners e Mídias</h1>
          <p className="text-xs text-slate-500">Gerencie destaques visuais da sua loja.</p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" /> Novo Banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <Card className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10">
          <CardContent className="p-12 text-center">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">Não há banners cadastrados.</p>
            <p className="text-xs text-slate-400 mt-1">
              Clique em "Novo Banner" para criar o primeiro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((b) => (
            <Card
              key={b.id}
              className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B] overflow-hidden"
            >
              <div className="h-32 bg-gradient-to-r from-amber-400 to-amber-600 p-6 flex flex-col justify-end text-[#071B3B]">
                <span className="text-xs font-bold uppercase tracking-wider">{b.position}</span>
                <h2 className="text-xl font-black">{b.title}</h2>
                {b.subtitle && <p className="text-xs">{b.subtitle}</p>}
              </div>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={b.active ? 'bg-emerald-500' : 'bg-slate-400'}>
                    {b.active ? 'Ativo no Nova Era AI' : 'Inativo'}
                  </Badge>
                  {!b.active && (
                    <span className="text-[10px] text-slate-400">Não publicado na loja</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(b)}
                    className="text-xs rounded-xl"
                  >
                    {b.active ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(b.id)}
                    className="h-8 w-8 text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Banner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-2">
            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl"
                placeholder="Ex: Oferta Especial"
              />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                className="rounded-xl"
                placeholder="Ex: Até 40% OFF"
              />
            </div>
            <div>
              <Label>Posição</Label>
              <Select
                value={form.position}
                onValueChange={(v: any) => setForm({ ...form, position: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hero">Hero</SelectItem>
                  <SelectItem value="promo">Promo</SelectItem>
                  <SelectItem value="footer">Footer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Link</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                className="rounded-xl"
                placeholder="/produtos"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
            >
              Criar Banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
