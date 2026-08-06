import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, DollarSign, Users, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAnalyticsSummary, AnalyticsSummary } from '@/services/analytics'

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)

  useEffect(() => {
    getAnalyticsSummary().then(setSummary)
  }, [])

  if (!summary) return <div className="p-8 text-center text-xs">Carregando métricas...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics & Business Intelligence</h1>
        <p className="text-xs text-slate-500">
          Métricas consolidadas de ROI, CAC, conversão e desempenho financeiro.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500">ROAS / ROI Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">{summary.roi.toFixed(1)}x</div>
            <p className="text-[10px] text-slate-400 mt-1">Retorno sobre investimento em mídia</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500">
              CAC (Custo de Aquisição)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">R$ {summary.cac.toFixed(2)}</div>
            <p className="text-[10px] text-slate-400 mt-1">Custo médio por pedido pago</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500">
              Investimento Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">R$ {summary.totalSpend.toFixed(2)}</div>
            <p className="text-[10px] text-slate-400 mt-1">Gasto em marketing registrado</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500">
              Total de Visitantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{summary.visitsCount}</div>
            <p className="text-[10px] text-slate-400 mt-1">Tráfego acumulado no período</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
