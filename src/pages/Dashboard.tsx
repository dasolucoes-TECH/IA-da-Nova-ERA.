import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Percent,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  PackageCheck,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAnalyticsSummary, AnalyticsSummary } from '@/services/analytics'
import { getOrders, OrderRecord } from '@/services/orders'
import { getShopifyStatus, type ShopifyStatus } from '@/services/shopify'
import { useRealtime } from '@/hooks/use-realtime'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart'

const chartData = [
  { day: 'Seg', receita: 3200, visitantes: 410 },
  { day: 'Ter', receita: 4500, visitantes: 520 },
  { day: 'Qua', receita: 5100, visitantes: 630 },
  { day: 'Qui', receita: 3900, visitantes: 480 },
  { day: 'Sex', receita: 6800, visitantes: 820 },
  { day: 'Sáb', receita: 8400, visitantes: 990 },
  { day: 'Dom', receita: 7200, visitantes: 890 },
]

export default function Dashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(true)

  const loadData = async () => {
    try {
      const [sum, ords, shopStatus] = await Promise.all([
        getAnalyticsSummary(),
        getOrders(),
        getShopifyStatus().catch(() => null),
      ])
      setSummary(sum)
      setOrders(ords.slice(0, 5))
      setDemoMode(!shopStatus?.connected)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('orders', () => loadData())
  useRealtime('products', () => loadData())

  if (loading || !summary) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Geral da Loja</h1>
          <p className="text-xs text-slate-500">
            Métricas e vendas em tempo real atualizadas via IA.
          </p>
        </div>
        {demoMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Modo demonstração — dados abaixo são exemplos.
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
          >
            <Link to="/produtos?novo=true">+ Novo Produto</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Receita Total
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-400/10 text-[#FFC400]">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              R$ {summary.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+18.4% vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pedidos
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{summary.totalOrders}</div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+12.1% novos pedidos</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ticket Médio
            </CardTitle>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              R$ {summary.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+5.2% por cliente</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Taxa de Conversão
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Percent className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{summary.conversionRate.toFixed(1)}%</div>
            <div className="flex items-center gap-1 text-xs font-semibold text-rose-500 mt-1">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>-0.3% estabilidade</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-base font-bold">Vendas nos Últimos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ChartContainer config={{ receita: { label: 'Receita (R$)', color: '#FFC400' } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFC400" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#FFC400" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="receita"
                      stroke="#FFC400"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorReceita)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-base font-bold">Visitantes da Loja</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ChartContainer config={{ visitantes: { label: 'Visitantes', color: '#3B82F6' } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="visitantes" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold">Pedidos Recentes</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/shopify">
                Ver todos <ChevronRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400">
                    <th className="pb-3 font-semibold">Número</th>
                    <th className="pb-3 font-semibold">Cliente</th>
                    <th className="pb-3 font-semibold">Origem</th>
                    <th className="pb-3 font-semibold">Total</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 font-bold text-slate-900 dark:text-white">
                        {o.order_number}
                      </td>
                      <td className="py-3 font-medium">{o.customer_name}</td>
                      <td className="py-3 capitalize text-slate-500">{o.source}</td>
                      <td className="py-3 font-bold">R$ {o.total.toFixed(2)}</td>
                      <td className="py-3">
                        <Badge
                          variant="outline"
                          className={
                            o.status === 'delivered' || o.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : 'bg-amber-50 text-amber-600 border-amber-200'
                          }
                        >
                          {o.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Estoque Baixo (≤ 5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-500/10 border border-amber-200/50"
                  >
                    <div>
                      <p className="text-xs font-bold">{p.name}</p>
                      <p className="text-[10px] text-slate-500">R$ {p.price.toFixed(2)}</p>
                    </div>
                    <Badge variant="destructive" className="bg-rose-500 font-bold">
                      {p.stock} un
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-[#FFC400]" />
                Produtos Mais Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.topProducts.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/10 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-semibold line-clamp-1 max-w-[140px]">{p.name}</span>
                    </div>
                    <span className="font-bold text-[#FFC400]">{p.sales_count} vendas</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
