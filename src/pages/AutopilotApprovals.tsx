import { useEffect, useState, useCallback } from 'react'
import { Check, X, Clock, ShieldAlert, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getApprovals, approveAction, rejectAction } from '@/services/autopilot'
import { toast } from '@/components/ui/use-toast'
import type { AutomationApproval } from '@/types'

const riskColors: Record<string, string> = {
  LOW: 'bg-emerald-500 text-white',
  MEDIUM: 'bg-amber-400 text-[#071B3B]',
  HIGH: 'bg-orange-500 text-white',
  CRITICAL: 'bg-rose-500 text-white',
}

export default function AutopilotApprovals() {
  const [approvals, setApprovals] = useState<AutomationApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await getApprovals('PENDING')
      setApprovals(res.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleApprove = async (id: string) => {
    setProcessing(id)
    try {
      await approveAction(id)
      toast({ title: 'Ação aprovada e executada' })
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro ao aprovar', description: e.message, variant: 'destructive' })
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (id: string) => {
    setProcessing(id)
    try {
      await rejectAction(id)
      toast({ title: 'Ação rejeitada' })
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setProcessing(null)
    }
  }

  if (!loading && approvals.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aprovações</h1>
          <p className="text-xs text-slate-500">Ações que aguardam sua aprovação.</p>
        </div>
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardContent className="py-16 text-center">
            <Check className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-500">Não há aprovações pendentes.</p>
            <p className="text-xs text-slate-400 mt-1">Tudo em dia!</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aprovações</h1>
        <p className="text-xs text-slate-500">{approvals.length} ação(ões) aguardando aprovação.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {approvals.map((a) => (
          <Card
            key={a.id}
            className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold">{a.title}</h3>
                  <p className="text-[10px] text-slate-500">{a.description}</p>
                </div>
                <Badge className={riskColors[a.risk_level] || 'bg-slate-500'}>{a.risk_level}</Badge>
              </div>

              <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">Entidade:</span>
                  <span className="font-semibold">
                    {a.entity_type || '—'} / {a.entity_id?.slice(0, 8) || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">Criado em:</span>
                  <span className="font-semibold">
                    {new Date(a.created).toLocaleString('pt-BR')}
                  </span>
                </div>
                {a.proposed_action && (
                  <div className="text-[10px] text-slate-500 mt-2">
                    <span className="font-semibold">Ação proposta:</span>{' '}
                    {String((a.proposed_action as any).actionType || '—')}
                  </div>
                )}
              </div>

              {a.risk_level === 'HIGH' || a.risk_level === 'CRITICAL' ? (
                <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg">
                  <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                  Esta ação requer aprovação devido ao nível de risco.
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(a.id)}
                  disabled={processing === a.id}
                  className="bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl flex-1"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(a.id)}
                  disabled={processing === a.id}
                  className="rounded-xl text-rose-500 border-rose-200 hover:bg-rose-50"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Rejeitar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
