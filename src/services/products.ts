import pb from '@/lib/pocketbase/client'
import type { ProductRecord } from '@/types'

export const getProducts = (page: number = 1, perPage: number = 50) =>
  pb.collection('products').getList<ProductRecord>(page, perPage, {
    sort: '-created',
    expand: 'supplier,collection',
  })

export const getAllProducts = () =>
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
}): Promise<Partial<ProductRecord>> =>
  pb.send('/backend/v1/products/generate', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
