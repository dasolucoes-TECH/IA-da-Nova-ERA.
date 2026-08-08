import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAnalyticsSummary } from '@/services/analytics'
import { getShopifyStatus } from '@/services/shopify'
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge'
import type { AnalyticsSummary, ShopifyStatus } from '@/types'

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus | null>(null)
  const [period, setPeriod] = useState(7)

  useEffect(() => {
    Promise.all([getAnalyticsSummary(period), getShopifyStatus().catch(() => null)]).then(
      ([s, st]) => {
        setSummary(s)
        setShopifyStatus(st)
      },
    )
  }, [period])

  if (!summary) return <div className="p-8 text-center text-xs">Carregando métricas...</div>

  const formatCurrency = (v: number | null) =>
    v !== null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics & Business Intelligence</h1>
          <p className="text-xs text-slate-500">
            Métricas consolidadas de ROAS, CPA e desempenho financeiro.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
            <SelectTrigger className="w-32 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <DataFreshnessBadge lastSync={shopifyStatus?.lastOrderSync} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500">ROAS Estimado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">
              {summary.roas !== null ? `${summary.roas.toFixed(1)}x` : '—'}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {summary.roas === null
                ? 'Sem dados de investimento'
                : 'Retorno sobre investimento em mídia'}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500">
              CPA (Custo por Pedido)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{formatCurrency(summary.cpa)}</div>
            <p className="text-[10px] text-slate-400 mt-1">
              {summary.cpa === null ? 'Sem dados de investimento' : 'Custo médio por pedido pago'}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500">
              Investimento Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{formatCurrency(summary.totalSpend)}</div>
            <p className="text-[10px] text-slate-400 mt-1">Gasto em marketing registrado</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500">Visitantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-400">—</div>
            <p className="text-[10px] text-blue-500 mt-1">
              Conecte o Google Analytics para visualizar visitantes e conversão.
            </p>
          </CardContent>
        </Card>
      </div>

      {summary.revenueData.length === 0 && (
        <Card className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10">
          <CardContent className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-500">
              Não há dados suficientes para o período selecionado.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Sincronize pedidos da Shopify para visualizar métricas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
