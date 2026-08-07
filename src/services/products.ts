import pb from '@/lib/pocketbase/client'

export interface ProductRecord {
  id: string
  name: string
  description?: string
  price: number
  cost?: number
  stock: number
  supplier?: string
  collection?: string
  status: 'rascunho' | 'publicado'
  images?: string[]
  slug?: string
  seo_title?: string
  meta_description?: string
  keywords?: string
  alt_text?: string
  faq?: any
  benefits?: any
  specifications?: any
  instagram_caption?: string
  instagram_hashtags?: string
  stories?: string
  carousel?: string
  email_marketing?: string
  sales_count?: number
  shopify_id?: string
  shopify_draft_id?: string
  created?: string
  updated?: string
  expand?: {
    supplier?: { id: string; name: string }
    collection?: { id: string; name: string }
  }
}

export const getProducts = () =>
  pb.collection('products').getFullList<ProductRecord>({
    sort: '-created',
    expand: 'supplier,collection',
  })

export const getProduct = (id: string) =>
  pb.collection('products').getOne<ProductRecord>(id, {
    expand: 'supplier,collection',
  })

export const createProduct = (data: Partial<ProductRecord>) =>
  pb.collection('products').create<ProductRecord>(data)

export const updateProduct = (id: string, data: Partial<ProductRecord>) =>
  pb.collection('products').update<ProductRecord>(id, data)

export const deleteProduct = (id: string) => pb.collection('products').delete(id)

export const getProductCollections = () =>
  pb.collection('product_collections').getFullList({ sort: 'name' })

export const getSuppliers = () => pb.collection('suppliers').getFullList({ sort: 'name' })

export const generateProductAIContent = (data: {
  name: string
  currentDescription?: string
  price?: number
  cost?: number
  supplierName?: string
}) =>
  pb.send('/backend/v1/products/generate', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
