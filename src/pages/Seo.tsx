import { useEffect, useState } from 'react'
import { Search, Sparkles, Save, Send, Globe, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getProducts, updateProduct } from '@/services/products'
import { generateSeoContent } from '@/services/ai'
import { toast } from '@/components/ui/use-toast'
import type { ProductRecord, SeoContent } from '@/types'

export default function SeoPage() {
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [seoData, setSeoData] = useState<SeoContent | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showHandleAlert, setShowHandleAlert] = useState(false)

  useEffect(() => {
    getProducts().then((data: any) => {
      const items = data.items || data
      setProducts(items)
      if (items.length > 0) setSelectedProduct(items[0])
    })
  }, [])

  const handleGenerate = async () => {
    if (!selectedProduct) return
    setGenerating(true)
    try {
      const res = await generateSeoContent(selectedProduct.name, selectedProduct.description)
      setSeoData(res)
      setEditMode(false)
      toast({ title: 'SEO gerado com sucesso!' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!selectedProduct || !seoData) return
    setSaving(true)
    try {
      await updateProduct(selectedProduct.id, {
        seo_title: seoData.seo_title,
        meta_description: seoData.meta_description,
        keywords: seoData.keywords,
        alt_text: seoData.alt_text,
      })
      toast({ title: 'SEO salvo no Nova Era AI!' })
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSendToShopify = async () => {
    if (!selectedProduct || !seoData) return
    if (seoData.slug !== selectedProduct.slug) {
      setShowHandleAlert(true)
      return
    }
    toast({
      title: 'SEO enviado para Shopify (simulação)',
      description: 'Integração de SEO Shopify em desenvolvimento.',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Otimizador de SEO Inteligente</h1>
          <p className="text-xs text-slate-500">
            Gere, edite e salve títulos SEO, meta descriptions e schemas.
          </p>
        </div>
        <div className="flex gap-2">
          {seoData && (
            <Button
              variant="outline"
              onClick={() => setEditMode(!editMode)}
              className="rounded-xl text-xs"
            >
              {editMode ? 'Visualizar' : 'Editar'}
            </Button>
          )}
          {seoData && (
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="outline"
              className="rounded-xl text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1" />{' '}
              {saving ? 'Salvando...' : 'Salvar no Nova Era AI'}
            </Button>
          )}
          {seoData && selectedProduct?.shopify_id && (
            <Button onClick={handleSendToShopify} variant="outline" className="rounded-xl text-xs">
              <Send className="w-3.5 h-3.5 mr-1" /> Enviar para Shopify
            </Button>
          )}
          <Button
            onClick={handleGenerate}
            disabled={generating || !selectedProduct}
            className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
          >
            <Sparkles className="w-4 h-4 mr-2" /> {generating ? 'Otimizando...' : 'Gerar SEO'}
          </Button>
        </div>
      </div>

      {showHandleAlert && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Alerta de Risco SEO</AlertTitle>
          <AlertDescription className="text-sm">
            <p>
              Alterar o handle (URL) de um produto ativo pode quebrar links indexados no Google.
            </p>
            <p className="mt-2">
              Handle atual: <code>{selectedProduct?.slug}</code> → Novo:{' '}
              <code>{seoData?.slug}</code>
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setShowHandleAlert(false)
                  toast({ title: 'SEO enviado para Shopify (simulação)' })
                }}
              >
                Confirmar alteração de URL
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowHandleAlert(false)}>
                Cancelar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Selecione o Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {products.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProduct(p)
                  setSeoData(null)
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedProduct?.id === p.id
                    ? 'border-[#FFC400] bg-amber-400/10 font-bold'
                    : 'border-slate-100 dark:border-white/10 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs line-clamp-1">{p.name}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Pré-visualização da SERP do Google</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 space-y-1 shadow-sm">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-mono">
                <Globe className="w-3 h-3" /> https://sualoja.com.br/produtos/
                {seoData?.slug || selectedProduct?.slug || 'produto'}
              </span>
              <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {seoData?.seo_title || selectedProduct?.seo_title || selectedProduct?.name}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {seoData?.meta_description ||
                  selectedProduct?.meta_description ||
                  selectedProduct?.description}
              </p>
            </div>

            {seoData && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <strong className="text-xs text-slate-400 uppercase">Palavras-chave:</strong>
                  <p className="text-xs font-semibold text-amber-500 mt-1">{seoData.keywords}</p>
                </div>
                <div>
                  <strong className="text-xs text-slate-400 uppercase">Texto Alt:</strong>
                  <p className="text-xs font-medium mt-1">{seoData.alt_text}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
