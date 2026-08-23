import { supabase } from './supabase'

export type ShopItemType = 'shelf_style' | 'shelf_finish' | 'site_theme' | 'decoration' | 'effect' | 'profile_frame'

export type ShopItem = {
  id: string
  name: string
  description: string
  itemType: ShopItemType
  coinCost: number
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'
  payload: Record<string, unknown>
}

export type ShopState = {
  level: number
  coins: number
  lifetimeCoins: number
  items: ShopItem[]
  purchasedIds: string[]
}

function requireSupabase() {
  if (!supabase) throw new Error('Shelfie is not connected to Supabase.')
  return supabase
}

export async function loadShopState(userId: string): Promise<ShopState> {
  const client = requireSupabase()
  const [progressResult, itemsResult, purchasesResult] = await Promise.all([
    client.from('reader_progress').select('level, coins, lifetime_coins').eq('user_id', userId).single(),
    client.from('shop_items').select('id, name, description, item_type, coin_cost, rarity, payload').eq('active', true).order('coin_cost'),
    client.from('shop_purchases').select('shop_item_id').eq('user_id', userId),
  ])

  if (progressResult.error) throw progressResult.error
  if (itemsResult.error) throw itemsResult.error
  if (purchasesResult.error) throw purchasesResult.error

  return {
    level: progressResult.data.level ?? 1,
    coins: progressResult.data.coins ?? 0,
    lifetimeCoins: progressResult.data.lifetime_coins ?? 0,
    items: (itemsResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      itemType: item.item_type as ShopItemType,
      coinCost: item.coin_cost,
      rarity: item.rarity as ShopItem['rarity'],
      payload: item.payload ?? {},
    })),
    purchasedIds: (purchasesResult.data ?? []).map((purchase) => purchase.shop_item_id),
  }
}

export async function purchaseShopItem(itemId: string) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('purchase_shop_item', { p_shop_item_id: itemId })
  if (error) throw error
  return data
}
