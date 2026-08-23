import { Coins, CreditCard, LoaderCircle, LockKeyhole, PackageOpen, ShoppingBag, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { loadShopState, purchaseShopItem, type ShopState } from '../lib/shopData'

const emptyShop: ShopState = { level: 1, coins: 0, lifetimeCoins: 0, items: [], purchasedIds: [] }

export function ShopPage({ userId, refreshToken = 0 }: { userId: string; refreshToken?: number }) {
  const [shop, setShop] = useState<ShopState>(emptyShop)
  const [loading, setLoading] = useState(true)
  const [buyingId, setBuyingId] = useState('')
  const [message, setMessage] = useState('')
  const maxed = shop.level >= 100

  useEffect(() => {
    let active = true
    setLoading(true)
    loadShopState(userId)
      .then((value) => active && setShop(value))
      .catch(() => active && setMessage('The shop shelves are resting. Your progress and coins are still safe.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [userId, refreshToken])

  async function buyItem(itemId: string) {
    setBuyingId(itemId)
    setMessage('')
    try {
      await purchaseShopItem(itemId)
      setShop(await loadShopState(userId))
      setMessage('Added to your customization collection.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That item could not be purchased yet.')
    } finally {
      setBuyingId('')
    }
  }

  return (
    <div className="shop-page">
      <section className="shop-hero">
        <div className="shop-hero-copy">
          <p className="eyebrow">THE READER'S WORKSHOP</p>
          <h2>A little something for your shelf.</h2>
          <p>At Level 100, every XP reward becomes one Shelf Coin. Coins never expire, and the things you earn here are purely for making Shelfie feel more like yours.</p>
          <div className="shop-actions">
            <button className="shop-pay-button" type="button" onClick={() => setMessage("You can't pay to win books. Want coins? Start reading. 😄")}><CreditCard size={17} /> Buy coins</button>
            {!maxed && <span><LockKeyhole size={15} /> Coin earning unlocks at Level 100</span>}
          </div>
        </div>
        <div className={maxed ? 'coin-vault unlocked' : 'coin-vault'}>
          <span className="coin-vault-icon"><Coins size={25} /></span>
          <small>SHELF COINS</small>
          <strong>{loading ? '—' : shop.coins.toLocaleString()}</strong>
          <span>{maxed ? `${shop.lifetimeCoins.toLocaleString()} earned all time` : `Level ${shop.level} · unlocks at 100`}</span>
        </div>
      </section>

      {message && <div className="shop-message" role="status"><Sparkles size={17} /> {message}</div>}

      <section className="shop-catalog-heading">
        <div><p className="eyebrow">CUSTOMIZATION</p><h3>Workshop collection</h3></div>
        <span><ShoppingBag size={16} /> {shop.purchasedIds.length} owned</span>
      </section>

      {loading ? (
        <div className="shop-empty"><LoaderCircle className="spin" size={28} /><p>Opening the workshop…</p></div>
      ) : shop.items.length === 0 ? (
        <div className="shop-empty">
          <span className="shop-empty-icon"><PackageOpen size={34} /></span>
          <h3>The workshop is ready.</h3>
          <p>New shelf styles will arrive one carefully crafted design at a time. Your coins will wait safely for the right one.</p>
        </div>
      ) : (
        <div className="shop-grid">
          {shop.items.map((item) => {
            const owned = shop.purchasedIds.includes(item.id)
            return (
              <article className="shop-item" key={item.id}>
                <div className="shop-item-preview"><Sparkles size={28} /></div>
                <small>{item.rarity} · {item.itemType.replaceAll('_', ' ')}</small>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <button type="button" disabled={owned || !maxed || shop.coins < item.coinCost || Boolean(buyingId)} onClick={() => void buyItem(item.id)}>
                  {buyingId === item.id ? <LoaderCircle className="spin" size={16} /> : <Coins size={16} />}
                  {owned ? 'Owned' : `${item.coinCost.toLocaleString()} coins`}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
