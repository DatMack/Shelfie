import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const sharedCacheTtl = 14 * 24 * 60 * 60 * 1000
const emptyCacheTtl = 24 * 60 * 60 * 1000
type PriceOption = {
  id: 'ebay' | 'google' | 'shopping'
  price: number
  shipping?: number
  averagePrice?: number
  listingCount?: number
  currencyCode: string
  condition?: string
  store?: string
  url: string
  livePrice: true
}

type CachedPrice = {
  options: PriceOption[]
  checked_at: string
  expires_at: string
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function priceCacheKey(isbn: string, title: string, author: string) {
  if (isbn) return `isbn:${isbn}`
  return `book:${normalizeText(title)}|${normalizeText(author)}`.slice(0, 500)
}

function cacheHeaders() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return null
  return {
    url,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
  }
}

async function readSharedCache(cacheKey: string): Promise<CachedPrice | null> {
  const connection = cacheHeaders()
  if (!connection) return null
  const params = new URLSearchParams({ cache_key: `eq.${cacheKey}`, select: 'options,checked_at,expires_at', limit: '1' })
  const response = await fetch(`${connection.url}/rest/v1/book_price_cache?${params}`, { headers: connection.headers })
  if (!response.ok) return null
  const rows = await response.json()
  const cached = rows?.[0]
  return cached && Array.isArray(cached.options) ? cached as CachedPrice : null
}

async function writeSharedCache(cacheKey: string, isbn: string, title: string, author: string, options: PriceOption[]) {
  const connection = cacheHeaders()
  if (!connection) return
  const checkedAt = new Date()
  const ttl = options.length ? sharedCacheTtl : emptyCacheTtl
  const response = await fetch(`${connection.url}/rest/v1/book_price_cache?on_conflict=cache_key`, {
    method: 'POST',
    headers: { ...connection.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      cache_key: cacheKey,
      isbn: isbn || null,
      title,
      author: author || null,
      options,
      checked_at: checkedAt.toISOString(),
      expires_at: new Date(checkedAt.getTime() + ttl).toISOString(),
    }),
  })
  if (!response.ok) console.error('Unable to update shared price cache.', response.status)
}

async function deferSharedCacheRetry(cacheKey: string) {
  const connection = cacheHeaders()
  if (!connection) return
  const params = new URLSearchParams({ cache_key: `eq.${cacheKey}` })
  const response = await fetch(`${connection.url}/rest/v1/book_price_cache?${params}`, {
    method: 'PATCH',
    headers: { ...connection.headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ expires_at: new Date(Date.now() + emptyCacheTtl).toISOString() }),
  })
  if (!response.ok) console.error('Unable to defer shared price cache retry.', response.status)
}

function priceResponse(options: PriceOption[], checkedAt: string, expiresAt: string, cacheStatus: 'hit' | 'refreshed' | 'stale') {
  return new Response(JSON.stringify({ options, checkedAt, expiresAt, cacheStatus }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function ebayToken() {
  const clientId = Deno.env.get('EBAY_CLIENT_ID')
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  })
  if (!response.ok) return null
  return (await response.json()).access_token as string
}

async function ebayPrice(isbn: string, title: string): Promise<PriceOption | null> {
  const token = await ebayToken()
  if (!token) return null
  const params = new URLSearchParams({ q: isbn || title, limit: '20', sort: 'price' })
  if (isbn) params.set('gtin', isbn)
  const response = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
  })
  if (!response.ok) return null
  const items = (await response.json()).itemSummaries ?? []
  const listings = items.filter((item: any) => item.price?.value && item.itemWebUrl).map((item: any) => {
    const shipping = Number(item.shippingOptions?.[0]?.shippingCost?.value ?? 0)
    return { item, shipping, total: Number(item.price.value) + shipping }
  }).sort((a: any, b: any) => a.total - b.total)
  const best = listings[0]
  if (!best) return null
  const averagePrice = listings.reduce((sum: number, listing: any) => sum + listing.total, 0) / listings.length
  return { id: 'ebay', price: Number(best.item.price.value), shipping: best.shipping, averagePrice: roundMoney(averagePrice), listingCount: listings.length, currencyCode: best.item.price.currency ?? 'USD', condition: best.item.condition, store: 'eBay', url: best.item.itemWebUrl, livePrice: true }
}

function numberFromPrice(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number(value.replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function looksDigital(result: any) {
  const text = [result.title, result.source, result.snippet, ...(result.extensions ?? [])].filter(Boolean).join(' ')
  return /\b(e-?book|kindle|audio\s*book|audible|digital|download|epub|pdf|mp3)\b/i.test(text)
}

async function shoppingPrice(isbn: string, title: string, author: string): Promise<PriceOption | null> {
  const key = Deno.env.get('SERPAPI_API_KEY')
  if (!key) return null
  const query = isbn ? `${isbn} physical book` : [title, author, 'physical book'].filter(Boolean).join(' ')
  const params = new URLSearchParams({ engine: 'google_shopping', q: query, gl: 'us', hl: 'en', api_key: key })
  const response = await fetch(`https://serpapi.com/search.json?${params}`)
  if (!response.ok) return null
  const payload = await response.json()
  const listings = (payload.shopping_results ?? []).flatMap((result: any) => {
    const price = numberFromPrice(result.extracted_price ?? result.price)
    const url = result.link ?? result.product_link
    if (!price || price <= 0 || !url || looksDigital(result)) return []
    return [{
      price,
      url: String(url),
      store: String(result.source ?? 'Google Shopping'),
      condition: result.second_hand_condition ? String(result.second_hand_condition) : undefined,
    }]
  }).sort((a: any, b: any) => a.price - b.price)
  if (!listings.length) return null

  const median = listings[Math.floor(listings.length / 2)].price
  const plausible = listings.filter((listing: any) => listing.price >= median * 0.2 && listing.price <= median * 3)
  const pricedListings = plausible.length >= 3 ? plausible : listings
  const best = pricedListings[0]
  const averagePrice = pricedListings.reduce((sum: number, listing: any) => sum + listing.price, 0) / pricedListings.length
  return {
    id: 'shopping',
    price: roundMoney(best.price),
    averagePrice: roundMoney(averagePrice),
    listingCount: pricedListings.length,
    currencyCode: 'USD',
    condition: best.condition,
    store: best.store,
    url: best.url,
    livePrice: true,
  }
}

async function googlePrice(isbn: string, title: string): Promise<PriceOption | null> {
  const key = Deno.env.get('GOOGLE_BOOKS_API_KEY')
  if (!key) return null
  const params = new URLSearchParams({ q: isbn ? `isbn:${isbn}` : title, country: 'US', maxResults: '10', key })
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
  if (!response.ok) return null
  const priced = ((await response.json()).items ?? []).map((volume: any) => ({ volume, price: volume.saleInfo?.retailPrice ?? volume.saleInfo?.listPrice }))
    .filter((entry: any) => entry.price?.amount && entry.volume.saleInfo?.buyLink).sort((a: any, b: any) => a.price.amount - b.price.amount)[0]
  if (!priced) return null
  return { id: 'google', price: Number(priced.price.amount), currencyCode: priced.price.currencyCode ?? 'USD', url: priced.volume.saleInfo.buyLink, livePrice: true }
}

export default {
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
    try {
      const { isbn = '', title = '', author = '' } = await request.json()
      if (!isbn && !title) throw new Error('ISBN or title is required.')
      const normalizedIsbn = String(isbn).replace(/[^0-9X]/gi, '')
      const normalizedTitle = String(title).trim()
      const normalizedAuthor = String(author).trim()
      const cacheKey = priceCacheKey(normalizedIsbn, normalizedTitle, normalizedAuthor)
      const cached = await readSharedCache(cacheKey)
      if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
        return priceResponse(cached.options, cached.checked_at, cached.expires_at, 'hit')
      }
      const settled = await Promise.allSettled([ebayPrice(normalizedIsbn, normalizedTitle), googlePrice(normalizedIsbn, normalizedTitle)])
      const options = settled.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : [])
      if (!options.some((option) => option.id === 'ebay')) {
        const shopping = await shoppingPrice(normalizedIsbn, normalizedTitle, normalizedAuthor)
        if (shopping) options.push(shopping)
      }
      if (!options.length && cached?.options.length) {
        const retryAt = new Date(Date.now() + emptyCacheTtl).toISOString()
        await deferSharedCacheRetry(cacheKey)
        return priceResponse(cached.options, cached.checked_at, retryAt, 'stale')
      }
      const checkedAt = new Date()
      const ttl = options.length ? sharedCacheTtl : emptyCacheTtl
      const expiresAt = new Date(checkedAt.getTime() + ttl)
      await writeSharedCache(cacheKey, normalizedIsbn, normalizedTitle, normalizedAuthor, options)
      return priceResponse(options, checkedAt.toISOString(), expiresAt.toISOString(), 'refreshed')
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Pricing failed.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  },
}
