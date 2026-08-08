import { useEffect, useState, useCallback } from 'react'
import { Plus, Zap, Shield, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
  getAutomationRules,
  createAutomationRule,
  toggleAutomationRule,
  EVENT_TYPES,
  ACTION_TYPES,
  UNSAFE_ACTIONS,
} from '@/services/autopilot'
import { toast } from '@/components/ui/use-toast'
import type { AutomationRule } from '@/types'

const TRIGGER_LABELS: Record<string, string> = {
  SHOPIFY_PRODUCT_CREATED: 'Produto Shopify Criado',
  SHOPIFY_PRODUCT_UPDATED: 'Produto Shopify Atualizado',
  SHOPIFY_ORDER_CREATED: 'Pedido Shopify Criado',
  SHOPIFY_INVENTORY_UPDATED: 'Estoque Atualizado',
  PRODUCT_SYNC_COMPLETED: 'Sincronização de Produtos Concluída',
  ORDER_SYNC_COMPLETED: 'Sincronização de Pedidos Concluída',
  LOW_STOCK_DETECTED: 'Estoque Baixo Detectado',
  DAILY_BRIEFING_TRIGGERED: 'Briefing Diário',
}

export default function AutopilotRules() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: 'SHOPIFY_PRODUCT_CREATED',
    action_type: 'GENERATE_PRODUCT_SEO',
    autonomy_mode: 'APPROVAL' as 'SUGGEST' | 'APPROVAL' | 'AUTOPILOT',
    cooldown_minutes: 0,
    max_executions_per_day: 50,
  })

  const loadData = useCallback(async () => {
    try {
      const res = await getAutomationRules()
      setRules(res.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggle = async (id: string) => {
    try {
      await toggleAutomationRule(id)
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const handleCreate = async () => {
    if (!form.name) {
      toast({ title: 'Atenção', description: 'Nome é obrigatório', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      await createAutomationRule(form)
      toast({ title: 'Regra criada (desativada)' })
      setModalOpen(false)
      setForm({
        name: '',
        description: '',
        trigger_type: 'SHOPIFY_PRODUCT_CREATED',
        action_type: 'GENERATE_PRODUCT_SEO',
        autonomy_mode: 'APPROVAL',
        cooldown_minutes: 0,
        max_executions_per_day: 50,
      })
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const selectedAction = ACTION_TYPES.find((a) => a.name === form.action_type)
  const isUnsafe = UNSAFE_ACTIONS.includes(form.action_type as any)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Regras de Automação</h1>
          <p className="text-xs text-slate-500">Crie e gerencie automações inteligentes.</p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova Automação
        </Button>
      </div>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
        <CardContent className="p-0">
          {rules.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Zap className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">
                Você ainda não possui automações ativas.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Clique em "Nova Automação" para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 bg-slate-50/50 dark:bg-white/5">
                    <th className="p-4 font-semibold">Nome</th>
                    <th className="p-4 font-semibold">Trigger</th>
                    <th className="p-4 font-semibold">Ação</th>
                    <th className="p-4 font-semibold">Modo</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Execuções</th>
                    <th className="p-4 font-semibold text-right">Ativar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="p-4 font-bold">{r.name}</td>
                      <td className="p-4">{TRIGGER_LABELS[r.trigger_type] || r.trigger_type}</td>
                      <td className="p-4">
                        {ACTION_TYPES.find((a) => a.name === r.action_type)?.label || r.action_type}
                      </td>
                      <td className="p-4">
                        <Badge
                          className={
                            r.autonomy_mode === 'AUTOPILOT'
                              ? 'bg-emerald-500 text-white'
                              : r.autonomy_mode === 'APPROVAL'
                                ? 'bg-amber-400 text-[#071B3B]'
                                : 'bg-blue-500 text-white'
                          }
                        >
                          {r.autonomy_mode}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={r.enabled ? 'default' : 'outline'}
                          className={r.enabled ? 'bg-emerald-500 text-white' : ''}
                        >
                          {r.enabled ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </td>
                      <td className="p-4">{r.execution_count || 0}</td>
                      <td className="p-4 text-right">
                        <Switch checked={r.enabled} onCheckedChange={() => handleToggle(r.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#FFC400]" /> Nova Automação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome da Automação</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: SEO automático"
                className="rounded-xl"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>1. QUANDO (Trigger)</Label>
                <Select
                  value={form.trigger_type}
                  onValueChange={(v) => setForm({ ...form, trigger_type: v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TRIGGER_LABELS[t] || t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>3. ENTÃO (Ação)</Label>
                <Select
                  value={form.action_type}
                  onValueChange={(v) => setForm({ ...form, action_type: v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((a) => (
                      <SelectItem key={a.name} value={a.name}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>4. MODO (Autonomia)</Label>
              <Select
                value={form.autonomy_mode}
                onValueChange={(v: any) => setForm({ ...form, autonomy_mode: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUGGEST">Sugestão (apenas recomenda)</SelectItem>
                  <SelectItem value="APPROVAL">Pedir Aprovação (executa após aprovação)</SelectItem>
                  {!isUnsafe && (
                    <SelectItem value="AUTOPILOT">Autopilot (executa automaticamente)</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {isUnsafe && (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg">
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                  Por segurança, alterações de preço exigem aprovação.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cooldown (minutos)</Label>
                <Input
                  type="number"
                  value={form.cooldown_minutes}
                  onChange={(e) =>
                    setForm({ ...form, cooldown_minutes: parseInt(e.target.value) || 0 })
                  }
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label>Máx. execuções/dia</Label>
                <Input
                  type="number"
                  value={form.max_executions_per_day}
                  onChange={(e) =>
                    setForm({ ...form, max_executions_per_day: parseInt(e.target.value) || 50 })
                  }
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
            >
              {creating ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : null}
              Criar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
