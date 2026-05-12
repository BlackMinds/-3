// 红尘玉商店列表 - GET /api/companion/red-jade-shop/list
// 返回 8 个商品 + 当前周/月已购数 + 玩家红尘玉余额

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { RED_JADE_SHOP_ITEMS, getPeriodKey } from '~/server/engine/redJadeShopData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const weekKey = getPeriodKey('week')
    const monthKey = getPeriodKey('month')

    // 一次取当前周/月所有计数
    const { rows: purchases } = await pool.query(
      `SELECT item_id, period_type, count FROM character_red_jade_purchases
        WHERE character_id = $1
          AND ((period_type = 'week' AND period_key = $2)
            OR (period_type = 'month' AND period_key = $3))`,
      [char.id, weekKey, monthKey]
    )
    const purchaseMap = new Map<string, number>()
    for (const p of purchases) {
      purchaseMap.set(`${p.item_id}_${p.period_type}`, p.count)
    }

    const list = RED_JADE_SHOP_ITEMS.map(it => {
      const bought = purchaseMap.get(`${it.id}_${it.limit.type}`) || 0
      return {
        id: it.id,
        name: it.name,
        desc: it.desc,
        price: it.price,
        limitType: it.limit.type,
        limitCount: it.limit.count,
        bought,
        remaining: Math.max(0, it.limit.count - bought),
      }
    })

    return {
      code: 200,
      data: {
        items: list,
        redJade: char.red_jade || 0,
        weekKey,
        monthKey,
      },
    }
  } catch (error) {
    console.error('红尘玉商店列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
