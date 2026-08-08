import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { getStoreSettings, updateStoreSettings } from '@/services/store'
import { toast } from '@/components/ui/use-toast'

export default function Configuracoes() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    store_name: '',
    brand_name: 'Nova Era',
    slogan: 'Tecnologia que transforma',
    instagram: '@nvera.store',
    brand_tone: 'moderno, tecnológico, descontraído',
    currency: 'BRL',
    locale: 'pt-BR',
    free_shipping_enabled: false,
    shipping_text: '',
    warranty_text: '',
    default_cta: 'Compre agora',
    timezone: 'America/Sao_Paulo',
  })

  useEffect(() => {
    getStoreSettings()
      .then((data: any) => {
        if (data.store_name) setSettings((prev) => ({ ...prev, store_name: data.store_name }))
        if (data.brand_name) setSettings((prev) => ({ ...prev, brand_name: data.brand_name }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateStoreSettings(settings)
      toast({ title: 'Configurações salvas com sucesso!' })
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-xs">Carregando configurações...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações da Conta e Loja</h1>
        <p className="text-xs text-slate-500">Gerencie preferências gerais do sistema.</p>
      </div>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
        <CardHeader>
          <CardTitle className="text-base font-bold">Perfil do Lojista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>E-mail</Label>
            <Input value={user?.email || ''} disabled className="rounded-xl bg-slate-50" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
        <CardHeader>
          <CardTitle className="text-base font-bold">Identidade da Marca</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome da Loja</Label>
            <Input
              value={settings.store_name}
              onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
              className="rounded-xl"
              placeholder="Nova Era AI Store"
            />
          </div>
          <div>
            <Label>Nome da Marca</Label>
            <Input
              value={settings.brand_name}
              onChange={(e) => setSettings({ ...settings, brand_name: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div>
            <Label>Slogan</Label>
            <Input
              value={settings.slogan}
              onChange={(e) => setSettings({ ...settings, slogan: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div>
            <Label>Instagram</Label>
            <Input
              value={settings.instagram}
              onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div>
            <Label>Tom da Marca</Label>
            <Input
              value={settings.brand_tone}
              onChange={(e) => setSettings({ ...settings, brand_tone: e.target.value })}
              className="rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
        <CardHeader>
          <CardTitle className="text-base font-bold">Comércio & Logística</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Frete Grátis</Label>
            <Switch
              checked={settings.free_shipping_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, free_shipping_enabled: v })}
            />
          </div>
          <div>
            <Label>Texto de Frete</Label>
            <Input
              value={settings.shipping_text}
              onChange={(e) => setSettings({ ...settings, shipping_text: e.target.value })}
              className="rounded-xl"
              placeholder="Frete grátis para todo o Brasil"
            />
          </div>
          <div>
            <Label>Texto de Garantia</Label>
            <Textarea
              value={settings.warranty_text}
              onChange={(e) => setSettings({ ...settings, warranty_text: e.target.value })}
              className="rounded-xl"
              placeholder="Política de garantia..."
            />
          </div>
          <div>
            <Label>CTA Padrão</Label>
            <Input
              value={settings.default_cta}
              onChange={(e) => setSettings({ ...settings, default_cta: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div>
            <Label>Moeda</Label>
            <Select
              value={settings.currency}
              onValueChange={(v) => setSettings({ ...settings, currency: v })}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">Real (BRL)</SelectItem>
                <SelectItem value="USD">Dólar (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl w-full"
      >
        {saving ? 'Salvando...' : 'Salvar Alterações'}
      </Button>
    </div>
  )
}
