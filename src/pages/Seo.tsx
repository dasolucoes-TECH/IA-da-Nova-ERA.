import { useEffect, useState } from 'react'
import { Search, Sparkles, Check, Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getProducts, ProductRecord } from '@/services/products'
import { generateSeoContent } from '@/services/ai'
import { toast } from '@/components/ui/use-toast'

export default function SeoPage() {
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null)
  const [generating, setGenerating] = useState(false)
  const [seoData, setSeoData] = useState<any>(null)

  useEffect(() => {
    getProducts().then((data) => {
      setProducts(data)
      if (data.length > 0) setSelectedProduct(data[0])
    })
  }, [])

  const handleGenerateSeo = async () => {
    if (!selectedProduct) return
    setGenerating(true)
    try {
      const res = await generateSeoContent(selectedProduct.name, selectedProduct.description)
      setSeoData(res)
      toast({ title: 'SEO otimizado!' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Otimizador de SEO Inteligente</h1>
          <p className="text-xs text-slate-500">
            Gere títulos SEO, meta descriptions e Schemas de alta indexação no Google.
          </p>
        </div>
        <Button
          onClick={handleGenerateSeo}
          disabled={generating || !selectedProduct}
          className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {generating ? 'Otimizando...' : 'Gerar SEO com IA'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Selecione o Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {products.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedProduct(p)}
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
              <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer">
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
                  <strong className="text-xs text-slate-400 uppercase">
                    Palavras-chave Recomendadas:
                  </strong>
                  <p className="text-xs font-semibold text-amber-500 mt-1">{seoData.keywords}</p>
                </div>
                <div>
                  <strong className="text-xs text-slate-400 uppercase">Texto Alt da Imagem:</strong>
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
