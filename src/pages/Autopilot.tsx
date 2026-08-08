import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Zap, CheckCircle, AlertTriangle, Clock, TrendingUp, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAutopilotSummary, processJobs } from '@/services/autopilot'
import { getNotifications } from '@/services/notifications'
import type { AutopilotSummary, AutomationNotification } from '@/types'

export default function Autopilot() {
  const [summary, setSummary] = useState<AutopilotSummary | null>(null)
  const [notifs, setNotifs] = useState<AutomationNotification[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [s, n] = await Promise.all([
        getAutopilotSummary(),
        getNotifications().catch(() => ({ items: [], unread: 0 })),
      ])
      setSummary(s)
      setNotifs(n.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading || !summary) {
    return <div className="p-8 text-center text-xs">Carregando Autopilot...</div>
  }

  const recentNotifs = notifs.slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#FFC400]" /> Autopilot
          </h1>
          <p className="text-xs text-slate-500">Central de automações inteligentes da sua loja.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={summary.autopilotEnabled ? 'bg-emerald-500' : 'bg-amber-400 text-[#071B3B]'}
          >
            {summary.autopilotEnabled ? 'Ativo' : 'Pausado'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={async () => {
              await processJobs()
              loadData()
            }}
          >
            <Zap className="w-3.5 h-3.5 mr-1" /> Processar Jobs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Regras Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-[#FFC400]">{summary.activeRules}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Execuções Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{summary.executionsToday}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Aprovações Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">{summary.pendingApprovals}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Falhas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-500">{summary.failedToday}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Tempo Economizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-500">
              {summary.estimatedMinutesSaved}min
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#FFC400]" /> Últimas Automações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentNotifs.length > 0 ? (
              <div className="space-y-2">
                {recentNotifs.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5"
                  >
                    {n.severity === 'CRITICAL' || n.severity === 'ERROR' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                    ) : n.severity === 'SUCCESS' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-bold">{n.title}</p>
                      <p className="text-[10px] text-slate-500">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">
                Nenhuma automação executou hoje.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#FFC400]" /> Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/autopilot/rules">
              <Button variant="outline" className="w-full rounded-xl justify-start text-xs">
                <Zap className="w-3.5 h-3.5 mr-2" /> Criar Nova Automação
              </Button>
            </Link>
            <Link to="/autopilot/approvals">
              <Button variant="outline" className="w-full rounded-xl justify-start text-xs">
                <Clock className="w-3.5 h-3.5 mr-2" /> Ver Aprovações Pendentes (
                {summary.pendingApprovals})
              </Button>
            </Link>
            <Link to="/autopilot/activity">
              <Button variant="outline" className="w-full rounded-xl justify-start text-xs">
                <Activity className="w-3.5 h-3.5 mr-2" /> Ver Atividade Completa
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
