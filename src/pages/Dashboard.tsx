import { useEffect, useState, useCallback } from 'react'
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
  Sparkles,
  Bot,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAnalyticsSummary } from '@/services/analytics'
import { getOrders } from '@/services/orders'
import { getShopifyStatus } from '@/services/shopify'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import type { AnalyticsSummary, OrderRecord, ShopifyStatus } from '@/types'

export default function Dashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(7)
  const [agentInput, setAgentInput] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [sum, ords, status] = await Promise.all([
        getAnalyticsSummary(period),
        getOrders(1, 5)
          .then((r) => r.items)
          .catch(() => []),
        getShopifyStatus().catch(() => null),
      ])
      setSummary(sum)
      setOrders(ords)
      setShopifyStatus(status)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  const formatCurrency = (v: number | null) =>
    v !== null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
  const formatVariation = (v: number | null) => {
    if (v === null) return 'Sem comparação disponível'
    const sign = v >= 0 ? '+' : ''
    return `${sign}${v.toFixed(1)}% vs período anterior`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centro de Comando Nova Era</h1>
          <p className="text-xs text-slate-500">
            {new Date().getHours() < 12
              ? 'Bom dia'
              : new Date().getHours() < 18
                ? 'Boa tarde'
                : 'Boa noite'}
            , {user?.name || 'Lojista'} 👋
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
          <DataFreshnessBadge lastSync={shopifyStatus?.lastProductSync} />
        </div>
      </div>

      <Card className="rounded-2xl border-0 shadow-elevation bg-gradient-to-r from-[#071B3B] to-[#0b275c] text-white p-2">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  className={
                    shopifyStatus?.connected ? 'bg-emerald-500' : 'bg-amber-400 text-[#071B3B]'
                  }
                >
                  {shopifyStatus?.connected ? 'Shopify Conectada' : 'Shopify Desconectada'}
                </Badge>
                {shopifyStatus?.shopName && (
                  <span className="text-xs text-slate-300">{shopifyStatus.shopName}</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Pedidos do período</p>
                  <p className="text-lg font-bold">{summary.totalOrders ?? 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Receita do período</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Estoque baixo</p>
                  <p className="text-lg font-bold">{summary.lowStockProducts.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Ações IA pendentes</p>
                  <p className="text-lg font-bold">—</p>
                </div>
              </div>
            </div>
            <div className="w-full md:w-64">
              <div className="relative">
                <Sparkles className="w-4 h-4 absolute left-3 top-3 text-[#FFC400]" />
                <input
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && agentInput.trim()) window.location.href = '/ia'
                  }}
                  placeholder="O que você quer fazer hoje?"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FFC400]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <div className="text-2xl font-black">{formatCurrency(summary.totalRevenue)}</div>
            <div className="flex items-center gap-1 text-xs font-semibold mt-1 text-slate-400">
              {summary.variations.revenue !== null ? (
                <span
                  className={summary.variations.revenue >= 0 ? 'text-emerald-600' : 'text-rose-500'}
                >
                  {summary.variations.revenue >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 inline" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 inline" />
                  )}
                  {formatVariation(summary.variations.revenue)}
                </span>
              ) : (
                <span>Sem comparação disponível</span>
              )}
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
            <div className="text-2xl font-black">{summary.totalOrders ?? 0}</div>
            <div className="text-xs font-semibold mt-1 text-slate-400">
              {summary.variations.orders !== null
                ? formatVariation(summary.variations.orders)
                : 'Sem comparação disponível'}
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
            <div className="text-2xl font-black">{formatCurrency(summary.ticketMedio)}</div>
            <div className="text-xs font-semibold mt-1 text-slate-400">
              {summary.variations.ticketMedio !== null
                ? formatVariation(summary.variations.ticketMedio)
                : 'Sem comparação disponível'}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ROAS
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Percent className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {summary.roas !== null ? `${summary.roas.toFixed(1)}x` : '—'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary.roas === null ? 'Sem dados de investimento' : 'ROAS estimado'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-base font-bold">Receita — Últimos {period} dias</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.revenueData.length > 0 ? (
              <div className="h-72 w-full">
                <ChartContainer config={{ revenue: { label: 'Receita (R$)', color: '#FFC400' } }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary.revenueData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FFC400" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#FFC400" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#FFC400"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-xs">
                <ShoppingBag className="w-8 h-8 mb-2 opacity-50" />
                Sem pedidos sincronizados para este período.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.lowStockProducts.length > 0 ? (
                <div className="space-y-2">
                  {summary.lowStockProducts.slice(0, 5).map((p) => (
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
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">
                  Nenhum produto com estoque baixo.
                </p>
              )}
            </CardContent>
          </Card>

          {summary.visitsCount === null && (
            <Card className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 dark:bg-blue-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-semibold text-blue-600 mb-1">Visitantes & Conversão</p>
                <p className="text-[10px] text-slate-500">
                  Conecte o Google Analytics para visualizar visitantes e conversão.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
