import { getCharId } from '~/server/utils/equipment'
import {
  buildCategoryKey,
  getReferencePrice,
  MARKET_PRICE_FLOOR_RATIO,
  MARKET_PRICE_CEILING_RATIO,
} from '~/server/utils/market'

export default defineEventHandler(async (event) => {
  try {
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const q = getQuery(event)
    const rarity = String(q.rarity || '')
    const slot = String(q.slot || '')
    const tier = Number(q.tier)
    const enhance = Number(q.enhance ?? 0)

    if (!rarity || !slot || !tier) {
      return { code: 400, message: '缺少 rarity/slot/tier 参数' }
    }

    const key = buildCategoryKey({ base_slot: slot, rarity, tier, enhance_level: enhance })
    const ref = await getReferencePrice(key, { rarity, tier, enhance })

    return {
      code: 200,
      data: {
        category_key: key,
        ref_price: ref.price,
        ref_method: ref.method,
        floor: Math.floor(ref.price * MARKET_PRICE_FLOOR_RATIO),
        ceiling: Math.floor(ref.price * MARKET_PRICE_CEILING_RATIO),
      },
    }
  } catch (error) {
    console.error('查询参考价失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
