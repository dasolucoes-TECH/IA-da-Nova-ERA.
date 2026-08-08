export function normalizeShopDomain(domain: string): string {
  if (!domain) return ''
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

export function validateShopDomain(domain: string): boolean {
  const d = normalizeShopDomain(domain)
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(d)
}

export function validateApiVersion(version: string): boolean {
  return /^\d{4}-\d{2}$/.test(version)
}

export function parseGraphQLErrors(body: unknown): string[] {
  if (!body || typeof body !== 'object') return []
  const b = body as Record<string, unknown>
  const errors: string[] = []
  if (b.errors) {
    const errStr = JSON.stringify(b.errors)
    if (errStr.includes('ACCESS_DENIED')) {
      errors.push('Permissão Shopify insuficiente')
    } else {
      errors.push('Erro GraphQL: ' + errStr)
    }
  }
  return errors
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export function formatVariation(current: number | null, previous: number | null): string {
  if (previous === null || previous === 0 || current === null) return 'Sem comparação disponível'
  const variation = ((current - previous) / previous) * 100
  const sign = variation >= 0 ? '+' : ''
  return `${sign}${variation.toFixed(1)}% vs período anterior`
}
