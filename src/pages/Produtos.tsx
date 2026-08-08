import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Copy, Trash2, Sparkles, Search, Check, RefreshCw, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductCollections,
  getSuppliers,
  generateProductAIContent,
  ProductRecord,
} from '@/services/products'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from '@/components/ui/use-toast'

export default function Produtos() {
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  const [modalOpen, setModalOpen] = useState(searchParams.get('novo') === 'true')
  const [generating, setGenerating] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 199.9,
    cost: 70.0,
    stock: 50,
    supplier: '',
    collection: '',
    status: 'rascunho' as 'rascunho' | 'publicado',
    slug: '',
    seo_title: '',
    meta_description: '',
    keywords: '',
    alt_text: '',
    instagram_caption: '',
    instagram_hashtags: '',
    stories: '',
    email_marketing: '',
    faq: [] as any[],
    benefits: [] as any[],
    specifications: [] as any[],
  })

  const loadData = async () => {
    try {
      const [prods, colles, sups] = await Promise.all([
        getProducts(),
        getProductCollections(),
        getSuppliers(),
      ])
      const normalizedProducts = Array.isArray(prods)
        ? prods
        : Array.isArray((prods as any)?.items)
          ? (prods as any).items
          : []
      const normalizedCollections = Array.isArray(colles)
        ? colles
        : Array.isArray((colles as any)?.items)
          ? (colles as any).items
          : []
      const normalizedSuppliers = Array.isArray(sups)
        ? sups
        : Array.isArray((sups as any)?.items)
          ? (sups as any).items
          : []
      setProducts(normalizedProducts)
      setCollections(normalizedCollections)
      setSuppliers(normalizedSuppliers)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('products', () => loadData())

  const handleOpenNew = () => {
    setEditingProduct(null)
    setFormData({
      name: '',
      description: '',
      price: 199.9,
      cost: 70.0,
      stock: 50,
      supplier: suppliers[0]?.id || '',
      collection: collections[0]?.id || '',
      status: 'rascunho',
      slug: '',
      seo_title: '',
      meta_description: '',
      keywords: '',
      alt_text: '',
      instagram_caption: '',
      instagram_hashtags: '',
      stories: '',
      email_marketing: '',
      faq: [],
      benefits: [],
      specifications: [],
    })
    setModalOpen(true)
  }

  const handleGenerateAI = async () => {
    if (!formData.name) {
      toast({
        title: 'Atenção',
        description: 'Preencha o nome do produto primeiro.',
        variant: 'destructive',
      })
      return
    }
    setGenerating(true)
    try {
      const sup = suppliers.find((s) => s.id === formData.supplier)
      const res = await generateProductAIContent({
        name: formData.name,
        currentDescription: formData.description,
        price: formData.price,
        cost: formData.cost,
        supplierName: sup?.name,
      })

      setFormData((prev) => ({
        ...prev,
        description: res.description || prev.description,
        seo_title: res.seo_title || prev.seo_title,
        meta_description: res.meta_description || prev.meta_description,
        keywords: res.keywords || prev.keywords,
        slug: res.slug || prev.slug,
        alt_text: res.alt_text || prev.alt_text,
        instagram_caption: res.instagram_caption || prev.instagram_caption,
        instagram_hashtags: res.instagram_hashtags || prev.instagram_hashtags,
        stories: res.stories || prev.stories,
        email_marketing: res.email_marketing || prev.email_marketing,
        faq: res.faq || [],
        benefits: res.benefits || [],
        specifications: res.specifications || [],
      }))

      toast({ title: 'Cadastro Inteligente Concluído!', description: 'Campos preenchidos com IA.' })
    } catch (e: any) {
      toast({ title: 'Erro na geração', description: e.message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData)
        toast({ title: 'Produto atualizado' })
      } else {
        await createProduct(formData)
        toast({ title: 'Produto criado como Rascunho' })
      }
      setModalOpen(false)
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' })
    }
  }

  const handleDuplicate = async (p: ProductRecord) => {
    try {
      await createProduct({
        ...p,
        name: `${p.name} (cópia)`,
        slug: `${p.slug}-copia`,
        status: 'rascunho',
      })
      toast({ title: 'Produto duplicado como rascunho' })
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro ao duplicar', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      await deleteProduct(id)
      toast({ title: 'Produto excluído' })
      loadData()
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter
    return matchesQuery && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Produtos</h1>
          <p className="text-xs text-slate-500">
            Gerencie e cadastre produtos com o Cadastro Inteligente IA.
          </p>
        </div>
        <Button
          onClick={handleOpenNew}
          className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto IA
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nome do produto..."
            value={query}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="publicado">Publicado</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl border-0 shadow-elevation bg-white dark:bg-[#071B3B]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 bg-slate-50/50 dark:bg-white/5">
                  <th className="p-4 font-semibold">Produto</th>
                  <th className="p-4 font-semibold">Preço</th>
                  <th className="p-4 font-semibold">Margem</th>
                  <th className="p-4 font-semibold">Estoque</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredProducts.map((p) => {
                  const margin = p.cost ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : 'N/A'
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-[#FFC400]">
                            📦
                          </div>
                          <div>
                            <span className="block">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{p.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-bold">R$ {p.price.toFixed(2)}</td>
                      <td className="p-4">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-600 border-emerald-200"
                        >
                          {margin}%
                        </Badge>
                      </td>
                      <td className="p-4 font-semibold">
                        <span className={p.stock <= 5 ? 'text-rose-500 font-bold' : ''}>
                          {p.stock} un
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge
                          className={
                            p.status === 'publicado'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-amber-400 text-[#071B3B] font-bold'
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingProduct(p)
                            setFormData({
                              name: p.name,
                              description: p.description || '',
                              price: p.price,
                              cost: p.cost || 0,
                              stock: p.stock,
                              supplier: p.supplier || '',
                              collection: p.collection || '',
                              status: p.status,
                              slug: p.slug || '',
                              seo_title: p.seo_title || '',
                              meta_description: p.meta_description || '',
                              keywords: p.keywords || '',
                              alt_text: p.alt_text || '',
                              instagram_caption: p.instagram_caption || '',
                              instagram_hashtags: p.instagram_hashtags || '',
                              stories: p.stories || '',
                              email_marketing: p.email_marketing || '',
                              faq: p.faq || [],
                              benefits: p.benefits || [],
                              specifications: p.specifications || [],
                            })
                            setModalOpen(true)
                          }}
                          className="h-8 w-8"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(p)}
                          className="h-8 w-8"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(p.id)}
                          className="h-8 w-8 text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-xl font-bold">
              {editingProduct ? 'Editar Produto' : 'Cadastro Inteligente com IA'}
            </DialogTitle>
            <Button
              onClick={handleGenerateAI}
              disabled={generating}
              className="bg-gradient-to-r from-[#FFC400] to-amber-400 text-[#071B3B] font-bold hover:from-amber-400 hover:to-[#FFC400] rounded-xl text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {generating ? 'Gerando IA...' : 'Cadastro Inteligente'}
            </Button>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="pname">Nome do Produto</Label>
                <Input
                  id="pname"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Tênis Runner Pro"
                  className="rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="pprice">Preço Venda (R$)</Label>
                  <Input
                    id="pprice"
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="pcost">Custo (R$)</Label>
                  <Input
                    id="pcost"
                    type="number"
                    value={formData.cost}
                    onChange={(e) =>
                      setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Estoque</Label>
                  <Input
                    type="number"
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: 'rascunho' | 'publicado') =>
                      setFormData({ ...formData, status: val })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="publicado">Publicado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Descrição Profissional</Label>
                <Textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="A IA gera ou aprimora este texto..."
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
              <span className="text-xs font-bold text-[#FFC400] uppercase tracking-wider block">
                Conteúdo Gerado por IA
              </span>

              <Accordion type="single" collapsible className="w-full text-xs">
                <AccordionItem value="seo">
                  <AccordionTrigger className="py-2 font-semibold">SEO & URL</AccordionTrigger>
                  <AccordionContent className="space-y-2 pt-2">
                    <Input
                      placeholder="Título SEO"
                      value={formData.seo_title}
                      onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                    />
                    <Textarea
                      placeholder="Meta Descrição"
                      value={formData.meta_description}
                      onChange={(e) =>
                        setFormData({ ...formData, meta_description: e.target.value })
                      }
                      rows={2}
                    />
                    <Input
                      placeholder="Palavras-chave"
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="instagram">
                  <AccordionTrigger className="py-2 font-semibold">
                    Instagram & Redes
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pt-2">
                    <Textarea
                      placeholder="Legenda para Feed"
                      value={formData.instagram_caption}
                      onChange={(e) =>
                        setFormData({ ...formData, instagram_caption: e.target.value })
                      }
                      rows={3}
                    />
                    <Input
                      placeholder="Hashtags"
                      value={formData.instagram_hashtags}
                      onChange={(e) =>
                        setFormData({ ...formData, instagram_hashtags: e.target.value })
                      }
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="email">
                  <AccordionTrigger className="py-2 font-semibold">
                    E-mail Marketing
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <Textarea
                      placeholder="Corpo do e-mail"
                      value={formData.email_marketing}
                      onChange={(e) =>
                        setFormData({ ...formData, email_marketing: e.target.value })
                      }
                      rows={4}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#FFC400] text-[#071B3B] font-bold hover:bg-amber-400 rounded-xl"
            >
              Salvar Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
