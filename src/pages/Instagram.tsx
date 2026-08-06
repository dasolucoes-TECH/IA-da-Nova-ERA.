import { useEffect, useState } from 'react'
import { Instagram, Sparkles, Copy, Check, Image as ImageIcon, Play, Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { getProducts, ProductRecord } from '@/services/products'
import { generateInstagramContent } from '@/services/ai'
import { toast } from '@/components/ui/use-toast'

export default function InstagramPage() {
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null)
  const [generating, setGenerating] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getProducts().then((data) => {
      setProducts(data)
      if (data.length > 0) setSelectedProduct(data[0])
    })
  }, [])

  const handleGenerate = async () => {
    if (!selectedProduct) return
    setGenerating(true)
    try {
      const res = await generateInstagramContent(selectedProduct.name, selectedProduct.price)
      setContent(res)
      toast({ title: 'Conteúdo de Instagram gerado!' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({ title: 'Copiado para a área de transferência!' })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instagram Studio IA</h1>
          <p className="text-xs text-slate-500">
            Crie legendas, carrosséis, scripts de Reels e Stories persuasivos.
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating || !selectedProduct}
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold hover:opacity-90 rounded-xl"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {generating ? 'Gerando Conteúdo...' : 'Gerar para este Produto'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-sm font-bold">1. Selecione o Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {products.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedProduct?.id === p.id
                    ? 'border-[#FFC400] bg-amber-400/10 font-bold'
                    : 'border-slate-100 dark:border-white/10 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs line-clamp-1">{p.name}</span>
                <span className="text-xs font-bold text-amber-500">R$ {p.price.toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
          <CardHeader>
            <CardTitle className="text-sm font-bold">2. Conteúdo e Mídias Geradas</CardTitle>
          </CardHeader>
          <CardContent>
            {content ? (
              <Tabs defaultValue="caption" className="w-full">
                <TabsList className="grid grid-cols-4 rounded-xl bg-slate-100 dark:bg-white/10 p-1 mb-4 text-xs">
                  <TabsTrigger value="caption">Legenda</TabsTrigger>
                  <TabsTrigger value="stories">Stories</TabsTrigger>
                  <TabsTrigger value="carousel">Carrossel</TabsTrigger>
                  <TabsTrigger value="reels">Reels Script</TabsTrigger>
                </TabsList>

                <TabsContent value="caption" className="space-y-3">
                  <Textarea
                    value={content.caption}
                    readOnly
                    rows={6}
                    className="rounded-xl text-xs"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{content.hashtags}</span>
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(`${content.caption}\n\n${content.hashtags}`)}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar Legenda
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="stories" className="space-y-2">
                  {content.stories?.map((st: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-xs font-medium border"
                    >
                      <strong>Tela {idx + 1}:</strong> {st}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="carousel" className="space-y-2">
                  {content.carousel?.map((c: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-xs font-medium border"
                    >
                      <strong>Slide {idx + 1}:</strong> {c}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="reels" className="space-y-3">
                  <Textarea
                    value={content.reels_script}
                    readOnly
                    rows={6}
                    className="rounded-xl text-xs font-mono"
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                <Instagram className="w-10 h-10 mb-2 text-pink-500 opacity-50" />
                Selecione um produto e clique em "Gerar" para criar suas mídias.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
