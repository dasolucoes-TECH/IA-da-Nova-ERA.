import { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle,
  Globe,
  RefreshCw,
  Package,
  ShoppingCart,
  Upload,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  Mail,
  ShieldAlert,
  KeyRound,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from '@/components/ui/use-toast'
import {
  getShopifyStatus,
  syncProducts,
  syncOrders,
  publishProduct,
  type ShopifyStatus,
  type ShopifyConnectionStatus,
} from '@/services/shopify'
import { getAllProducts, type ProductRecord } from '@/services/products'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const integrations = [
  {
    name: 'Shopify Admin API',
    icon: '🛍️',
    description: 'Sincronização de catálogo e pedidos via GraphQL com Client Credentials.',
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

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const statusConfig: Record<ShopifyConnectionStatus, { label: string; color: string }> = {
  NOT_CONFIGURED: { label: 'Não configurado', color: 'bg-amber-400 text-[#071B3B]' },
  CONNECTING: { label: 'Conectando...', color: 'bg-blue-400 text-white' },
  CONNECTED: { label: 'Conectado', color: 'bg-emerald-500 text-white' },
  AUTH_ERROR: { label: 'Erro de autenticação', color: 'bg-rose-500 text-white' },
  PERMISSION_ERROR: { label: 'Permissão insuficiente', color: 'bg-orange-500 text-white' },
  API_ERROR: { label: 'Erro de API', color: 'bg-rose-500 text-white' },
}

export default function Shopify() {
  const [status, setStatus] = useState<ShopifyStatus | null>(null)
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [syncingProducts, setSyncingProducts] = useState(false)
  const [syncingOrders, setSyncingOrders] = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
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
      const prods = await getAllProducts()
      setProducts(Array.isArray(prods) ? prods : [])
    } catch (e) {
      console.error(e)
      setProducts([])
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
        description: `${result.created} produtos importados, ${result.updated} atualizados${
          result.errors.length > 0 ? `, ${result.errors.length} erros` : ''
        }.`,
      })
      loadStatus()
      loadProducts()
    } catch (e) {
      toast({
        title: 'Erro na Sincronização de Produtos',
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
      if (result.status === 'permission_required') {
        toast({
          title: 'Permissão Necessária',
          description: result.message || 'O escopo read_orders precisa ser aprovado na Shopify.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Sincronização de Pedidos Concluída',
          description: `${result.created} pedidos importados, ${result.updated} atualizados${
            result.errors.length > 0 ? `, ${result.errors.length} erros` : ''
          }.`,
        })
      }
      loadStatus()
    } catch (e) {
      toast({
        title: 'Erro na Sincronização de Pedidos',
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
        title: result.reused ? 'Produto já publicado' : 'Produto Publicado na Shopify',
        description: `${name} → ${result.handle || result.productId} (${result.status}). ${result.message}`,
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

  const isConnected = status?.connected === true
  const connectionStatus: ShopifyConnectionStatus =
    status?.status || (loadingStatus ? 'CONNECTING' : 'NOT_CONFIGURED')
  const hasError = !isConnected && !!status?.message && status?.status !== 'NOT_CONFIGURED'
  const draftProducts = products.filter(
    (p) => !p.shopify_id || p.shopify_id === '' || p.status === 'rascunho',
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Integração Shopify</h1>
        <p className="text-xs text-slate-500">
          Status de conexão e sincronização da sua loja Shopify via Client Credentials.
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
                      ? `Shopify conectada — ${status?.shopName || 'Nova Era AI'}`
                      : 'Shopify não conectada'}
                </h2>
                <Badge className={statusConfig[connectionStatus].color}>
                  {statusConfig[connectionStatus].label}
                </Badge>
              </div>
              {isConnected ? (
                <div className="space-y-1 mt-1">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" /> {status?.storeDomain} · API{' '}
                    {status?.apiVersion}
                    {status?.domain && <span className="ml-1">· {status.domain}</span>}
                  </p>
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Conexão verificada agora
                  </p>
                  {(status?.syncedProducts !== undefined || status?.syncedOrders !== undefined) && (
                    <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      {status?.syncedProducts !== undefined && (
                        <span>· {status.syncedProducts} produtos sincronizados</span>
                      )}
                      {status?.syncedOrders !== undefined && (
                        <span>· {status.syncedOrders} pedidos sincronizados</span>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-500 mt-1">
                  {status?.message || 'Conexão não configurada.'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={loadStatus} disabled={loadingStatus} className="rounded-xl">
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingStatus ? 'animate-spin' : ''}`} />
              Verificar Conexão
            </Button>
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

      {hasError && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>
            {connectionStatus === 'AUTH_ERROR'
              ? 'Erro de Autenticação Shopify'
              : connectionStatus === 'PERMISSION_ERROR'
                ? 'Permissão Insuficiente'
                : 'Problema na Conexão Shopify'}
          </AlertTitle>
          <AlertDescription className="text-sm space-y-3">
            <p>{status?.message}</p>
            <div className="rounded-lg bg-destructive/10 p-3 text-xs space-y-2">
              <p className="font-semibold">Como resolver:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Acesse a aba <strong>Secrets</strong> no painel do Skip Cloud
                </li>
                <li>
                  Configure o secret{' '}
                  <code className="font-mono bg-destructive/20 px-1 rounded">
                    SHOPIFY_CLIENT_ID
                  </code>{' '}
                  com o Client ID do seu Custom App na Shopify
                </li>
                <li>
                  Configure o secret{' '}
                  <code className="font-mono bg-destructive/20 px-1 rounded">
                    SHOPIFY_CLIENT_SECRET
                  </code>{' '}
                  com o Client Secret do seu Custom App
                </li>
                <li>
                  Configure o secret{' '}
                  <code className="font-mono bg-destructive/20 px-1 rounded">
                    SHOPIFY_STORE_DOMAIN
                  </code>{' '}
                  com o domínio interno da loja (ex:{' '}
                  <code className="font-mono bg-destructive/20 px-1 rounded">
                    sualoja.myshopify.com
                  </code>
                  )
                </li>
                <li>Clique novamente em "Verificar Conexão" acima</li>
              </ol>
              <p className="text-destructive/80 pt-1 flex items-center gap-1">
                <KeyRound className="w-3 h-3" />
                A autenticação usa o fluxo oficial Client Credentials Grant — não são mais
                necessários tokens manuais (shpat_).
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Package className="w-4 h-4 text-[#FFC400]" />
            Produtos Rascunho para Publicar
          </CardTitle>
          <CardDescription className="text-xs">
            Publique produtos locais como DRAFT na Shopify via GraphQL.
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
                        {p.shopify_id ? (
                          <Badge className="bg-blue-500 text-white">
                            GID {p.shopify_id.slice(-8)}
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
                  className="w-full text-xs rounded-xl"
                  disabled={!isConnected && item.name === 'Shopify Admin API'}
                  onClick={() => {
                    if (item.name === 'Shopify Admin API') {
                      loadStatus()
                      toast({ title: 'Status atualizado', description: 'Verificando conexão...' })
                    } else {
                      toast({
                        title: item.name,
                        description:
                          'Insira sua chave de API nas Configurações quando desejar integrar ao serviço externo real.',
                      })
                    }
                  }}
                >
                  {item.name === 'Shopify Admin API'
                    ? 'Verificar Conexão'
                    : 'Configurar Credenciais'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {!isConnected && !loadingStatus && status?.status === 'NOT_CONFIGURED' && (
        <Card className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-500/5">
          <CardContent className="p-6 flex items-start gap-4">
            <ShieldAlert className="w-6 h-6 text-amber-500 flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold">Modo demonstração</h3>
              <p className="text-xs text-slate-500">
                A Shopify não está conectada. Configure as credenciais (Client ID, Client Secret e
                domínio da loja) nos Secrets do Skip Cloud para usar dados reais.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
