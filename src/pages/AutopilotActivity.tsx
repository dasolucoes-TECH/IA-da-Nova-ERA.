import { useEffect, useState, useCallback } from 'react'
import { Activity as ActivityIcon, Bot, ShoppingBag, User, Cpu } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getActivity } from '@/services/autopilot'
import type { ActivityLog } from '@/types'

const sourceIcons: Record<string, typeof Bot> = {
  AUTOMATION: Bot,
  AI: Cpu,
  SHOPIFY_WEBHOOK: ShoppingBag,
  USER: User,
  SYSTEM: ActivityIcon,
}

const statusColors: Record<string, string> = {
  EXECUTED: 'bg-emerald-500 text-white',
  PROPOSED: 'bg-amber-400 text-[#071B3B]',
  FAILED: 'bg-rose-500 text-white',
  APPROVED: 'bg-blue-500 text-white',
}

export default function AutopilotActivity() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (sourceFilter !== 'all') params.source = sourceFilter
      if (statusFilter !== 'all') params.status = statusFilter
      const res = await getActivity(params)
      setLogs(res.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [sourceFilter, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atividade</h1>
          <p className="text-xs text-slate-500">Timeline de todas as automações e ações.</p>
        </div>
        <div className="flex gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-36 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Fontes</SelectItem>
              <SelectItem value="AI">IA</SelectItem>
              <SelectItem value="SHOPIFY">Shopify</SelectItem>
              <SelectItem value="SYSTEM">Sistema</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="EXECUTED">Executado</SelectItem>
              <SelectItem value="PROPOSED">Pendente</SelectItem>
              <SelectItem value="FAILED">Falhou</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
        <CardContent className="p-6">
          {logs.length === 0 && !loading ? (
            <div className="text-center py-12">
              <ActivityIcon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">Nenhuma atividade registrada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const Icon = sourceIcons[log.execution_source || 'SYSTEM'] || ActivityIcon
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-white/5 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[#FFC400]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold">{log.action_type}</p>
                        <Badge className={statusColors[log.status] || 'bg-slate-500 text-white'}>
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{log.summary}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(log.created).toLocaleString('pt-BR')}
                        {log.estimated_minutes_saved
                          ? ` · ${log.estimated_minutes_saved}min economizados`
                          : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
