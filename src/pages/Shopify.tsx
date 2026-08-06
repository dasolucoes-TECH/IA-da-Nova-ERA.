import { useState } from 'react'
import { ShoppingBag, CheckCircle, Globe, RefreshCw, ExternalLink, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'

const integrations = [
  { name: 'Shopify Admin API', icon: '🛍️', status: 'Rascunhos Ativos', connected: true },
  { name: 'Meta Graph & Instagram', icon: '📸', status: 'Simulado Local', connected: false },
  { name: 'Google Analytics 4', icon: '📊', status: 'Simulado Local', connected: false },
  { name: 'Google Merchant Center', icon: '🏷️', status: 'Requer Chave', connected: false },
  { name: 'Resend Email API', icon: '✉️', status: 'Requer Chave', connected: false },
  { name: 'Cloudinary CDN', icon: '🖼️', status: 'Requer Chave', connected: false },
]

export default function Shopify() {
  const [publishing, setPublishing] = useState(false)

  const handlePublishDrafts = () => {
    setPublishing(true)
    setTimeout(() => {
      setPublishing(false)
      toast({
        title: 'Produtos Publicados!',
        description: 'Todos os produtos rascunho foram marcados como publicados na loja local.',
      })
    }, 1200)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Integração Shopify</h1>
        <p className="text-xs text-slate-500">
          Status de conexão e sincronização autônoma da sua loja.
        </p>
      </div>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B] p-2">
        <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-2xl">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Loja Nova Era AI (Simulada)</h2>
                <Badge className="bg-emerald-500 text-white">Conectado</Badge>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Globe className="w-3.5 h-3.5" /> nova-era-ai-store.myshopify.com
              </p>
            </div>
          </div>

          <Button
            onClick={handlePublishDrafts}
            disabled={publishing}
            className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${publishing ? 'animate-spin' : ''}`} />
            Publicar Rascunhos no Shopify
          </Button>
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
                <Badge variant={item.connected ? 'default' : 'outline'} className="text-[10px]">
                  {item.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-500">
                  {item.connected
                    ? 'Ativo para publicação de catálogo e sync de ordens.'
                    : 'Gerações rodando localmente via Skip AI Gateway.'}
                </p>
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
