import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingBag,
  CheckCircle,
  Globe,
  RefreshCw,
  ExternalLink,
  Lock,
  Package,
  ShoppingCart,
  Upload,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import {
  getShopifyStatus,
  syncProducts,
  syncOrders,
  publishProduct,
  type ShopifyStatus,
} from '@/services/shopify'
import { getProducts, type ProductRecord } from '@/services/products'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const integrations = [
  {
    name: 'Shopify Admin API',
    icon: '🛍️',
    description: 'Sincronização de catálogo e pedidos em tempo real.',
  },
  {
    name: 'Meta Graph & Instagram',
    icon: '📸',
    description: 'Gerações rodando localmente via Skip AI Gateway.',
  },
  {
    name: 'Google Analytics 4',
    icon: '📊',
    description: 'Gerações rodando localmente via Skip AI Gateway.',
  },
  {
    name: 'Google Merchant Center',
    icon: '🏷️',
    description: 'Requer configuração de chave de API.',
  },
  { name: 'Resend Email API', icon: '✉️', description: 'Requer configuração de chave de API.' },
  { name: 'Cloudinary CDN', icon: '🖼️', description: 'Requer configuração de chave de API.' },
]

export default function Shopify() {
  const [status, setStatus] = useState<ShopifyStatus | null>(null)
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [syncingProducts, setSyncingProducts] = useState(false)
  const [syncingOrders, setSyncingOrders] = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const s = await getShopifyStatus()
      setStatus(s)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      const prods = await getProducts()
      setProducts(prods)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadStatus()
    loadProducts()
  }, [loadStatus, loadProducts])

  useRealtime('products', () => loadProducts())
  useRealtime('orders', () => loadStatus())

  const handleSyncProducts = async () => {
    setSyncingProducts(true)
    try {
      const result = await syncProducts()
      toast({
        title: 'Sincronização de Produtos Concluída',
        description: `${result.created} produtos importados, ${result.updated} atualizados.`,
      })
      loadStatus()
      loadProducts()
    } catch (e) {
      toast({
        title: 'Erro na Sincronização',
        description: getErrorMessage(e),
        variant: 'destructive',
      })
    } finally {
      setSyncingProducts(false)
    }
  }

  const handleSyncOrders = async () => {
    setSyncingOrders(true)
    try {
      const result = await syncOrders()
      toast({
        title: 'Sincronização de Pedidos Concluída',
        description: `${result.created} pedidos importados, ${result.updated} atualizados.`,
      })
      loadStatus()
    } catch (e) {
      toast({
        title: 'Erro na Sincronização',
        description: getErrorMessage(e),
        variant: 'destructive',
      })
    } finally {
      setSyncingOrders(false)
    }
  }

  const handlePublish = async (id: string, name: string) => {
    setPublishingId(id)
    try {
      const result = await publishProduct(id)
      toast({
        title: 'Produto Publicado na Shopify',
        description: `${name} → Draft #${result.draftId} (${result.status}). ${result.message}`,
      })
      loadProducts()
    } catch (e) {
      toast({
        title: 'Erro ao Publicar',
        description: getErrorMessage(e),
        variant: 'destructive',
      })
    } finally {
      setPublishingId(null)
    }
  }

  const draftProducts = products.filter((p) => p.status === 'rascunho' || !p.shopify_draft_id)
  const isConnected = status?.connected === true

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Integração Shopify</h1>
        <p className="text-xs text-slate-500">
          Status de conexão e sincronização da sua loja Shopify.
        </p>
      </div>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B] p-2">
        <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-amber-500/10 text-amber-500'
              }`}
            >
              {isConnected ? <Wifi className="w-8 h-8" /> : <WifiOff className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">
                  {loadingStatus
                    ? 'Verificando conexão...'
                    : isConnected
                      ? `Loja ${status?.shopName || 'Nova Era AI'}`
                      : 'Shopify não conectado'}
                </h2>
                <Badge
                  className={
                    isConnected
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-400 text-[#071B3B] font-bold'
                  }
                >
                  {isConnected ? 'Conectado' : 'Não configurado'}
                </Badge>
              </div>
              {isConnected ? (
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                  <Globe className="w-3.5 h-3.5" /> {status?.storeDomain} · API {status?.apiVersion}
                  {status?.syncedProducts !== undefined && (
                    <span className="ml-2">· {status.syncedProducts} produtos sincronizados</span>
                  )}
                  {status?.syncedOrders !== undefined && (
                    <span className="ml-1">· {status.syncedOrders} pedidos sincronizados</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-amber-500 mt-1">
                  {status?.message || 'Conexão não configurada.'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSyncProducts}
              disabled={!isConnected || syncingProducts}
              variant="outline"
              className="rounded-xl"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncingProducts ? 'animate-spin' : ''}`} />
              Sincronizar Produtos
            </Button>
            <Button
              onClick={handleSyncOrders}
              disabled={!isConnected || syncingOrders}
              variant="outline"
              className="rounded-xl"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Sincronizar Pedidos
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Package className="w-4 h-4 text-[#FFC400]" />
            Produtos Rascunho para Publicar
          </CardTitle>
          <CardDescription className="text-xs">
            Publique produtos locais como draft orders na Shopify.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {draftProducts.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              Todos os produtos já foram publicados ou não há rascunhos.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400">
                    <th className="pb-3 font-semibold">Produto</th>
                    <th className="pb-3 font-semibold">Preço</th>
                    <th className="pb-3 font-semibold">Status Shopify</th>
                    <th className="pb-3 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {draftProducts.slice(0, 10).map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[#FFC400]">
                            📦
                          </span>
                          <span className="line-clamp-1 max-w-[180px]">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 font-bold">R$ {p.price.toFixed(2)}</td>
                      <td className="py-3">
                        {p.shopify_draft_id ? (
                          <Badge className="bg-blue-500 text-white">
                            Draft #{p.shopify_draft_id}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-200">
                            Não publicado
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isConnected || publishingId === p.id}
                          onClick={() => handlePublish(p.id, p.name)}
                          className="rounded-xl text-xs"
                        >
                          {publishingId === p.id ? (
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3 mr-1" />
                          )}
                          Publicar na Shopify
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">Central de Integrações e APIs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((item, i) => (
            <Card
              key={i}
              className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="text-xl">{item.icon}</span>
                  {item.name}
                </CardTitle>
                {item.name === 'Shopify Admin API' ? (
                  <Badge
                    className={
                      isConnected ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-[#071B3B]'
                    }
                  >
                    {isConnected ? 'Ativo' : 'Pendente'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Local
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-500">{item.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toast({
                      title: item.name,
                      description:
                        'Insira sua chave de API nas Configurações quando desejar integrar ao serviço externo real.',
                    })
                  }
                  className="w-full text-xs rounded-xl"
                >
                  <Lock className="w-3 h-3 mr-1" /> Configurar Credenciais
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
