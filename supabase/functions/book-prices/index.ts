import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
type PriceOption = { id: 'ebay' | 'google'; price: number; shipping?: number; averagePrice?: number; listingCount?: number; currencyCode: string; condition?: string; url: string; livePrice: true }

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
  return { id: 'ebay', price: Number(best.item.price.value), shipping: best.shipping, averagePrice: Math.round(averagePrice * 100) / 100, listingCount: listings.length, currencyCode: best.item.price.currency ?? 'USD', condition: best.item.condition, url: best.item.itemWebUrl, livePrice: true }
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
      const { isbn = '', title = '' } = await request.json()
      if (!isbn && !title) throw new Error('ISBN or title is required.')
      const normalizedIsbn = String(isbn).replace(/[^0-9X]/gi, '')
      const settled = await Promise.allSettled([ebayPrice(normalizedIsbn, String(title)), googlePrice(normalizedIsbn, String(title))])
      const options = settled.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : [])
      return new Response(JSON.stringify({ options, checkedAt: new Date().toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Pricing failed.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  },
}
