import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { getShopifyStatus } from '@/services/shopify'
import type { ShopifyStatus } from '@/types'

const integrations = [
  { name: 'Shopify Admin API', icon: '🛍️', key: 'shopify' },
  { name: 'Skip AI Gateway', icon: '🤖', key: 'ai' },
  { name: 'Instagram / Meta', icon: '📸', key: 'meta' },
  { name: 'Google Analytics 4', icon: '📊', key: 'ga4' },
  { name: 'Google Merchant Center', icon: '🏷️', key: 'gmc' },
  { name: 'Email (Resend)', icon: '✉️', key: 'email' },
]

export default function IntegrationsPage() {
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus | null>(null)

  useEffect(() => {
    getShopifyStatus()
      .then(setShopifyStatus)
      .catch(() => {})
  }, [])

  const getStatus = (key: string) => {
    switch (key) {
      case 'shopify':
        return shopifyStatus?.connected ? 'connected' : 'not_configured'
      case 'ai':
        return 'connected'
      default:
        return 'not_configured'
    }
  }

  const statusConfig = {
    connected: { label: 'Conectado', color: 'bg-emerald-500 text-white', icon: CheckCircle2 },
    not_configured: {
      label: 'Não configurado',
      color: 'bg-slate-300 text-slate-700',
      icon: XCircle,
    },
    error: { label: 'Erro', color: 'bg-rose-500 text-white', icon: AlertCircle },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="text-xs text-slate-500">Status das integrações conectadas à plataforma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((item) => {
          const status = getStatus(item.key)
          const config = statusConfig[status as keyof typeof statusConfig]
          const Icon = config.icon
          return (
            <Card
              key={item.key}
              className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="text-xl">{item.icon}</span>
                  {item.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <Badge className={config.color}>{config.label}</Badge>
                </div>
                {item.key === 'shopify' && shopifyStatus?.connected && (
                  <p className="text-[10px] text-slate-500">
                    {shopifyStatus.shopName} · API {shopifyStatus.apiVersion}
                  </p>
                )}
                {item.key === 'meta' && (
                  <p className="text-[10px] text-slate-500">
                    Gerador de conteúdo ativo — integração direta requer Meta API.
                  </p>
                )}
                {item.key === 'ga4' && (
                  <p className="text-[10px] text-slate-500">
                    Necessário para métricas de visitantes e conversão.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
