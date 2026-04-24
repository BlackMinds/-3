// 秘境积分商店：列出商品 + 本周已购数量
import { getPool } from '~/server/database/db'
import { getCharByUserId, weekStartStr } from '~/server/utils/sect'
import { REALM_SHOP_ITEMS, isRealmShopItemUnlocked } from '~/server/engine/secretShopData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const ws = weekStartStr()

    const { rows: boughtRows } = await pool.query(
      `SELECT item_key, COALESCE(SUM(quantity), 0)::int AS bought
       FROM realm_shop_purchases
       WHERE character_id = $1 AND week_start = $2
       GROUP BY item_key`,
      [char.id, ws]
    )
    const boughtMap: Record<string, number> = {}
    for (const r of boughtRows) boughtMap[r.item_key] = Number(r.bought)

    const realmTier = Number(char.realm_tier || 1)
    const level = Number(char.level || 1)

    const items = REALM_SHOP_ITEMS.map(item => ({
      key: item.key,
      name: item.name,
      description: item.description,
      cost: item.cost,
      weekly_limit: item.weeklyLimit,
      bought: boughtMap[item.key] || 0,
      category: item.category,
      req_realm_tier: item.reqRealmTier,
      req_level: item.reqLevel,
      unlocked: isRealmShopItemUnlocked(item, realmTier, level),
    }))

    return {
      code: 200,
      data: {
        realm_points: Number(char.realm_points || 0),
        breakthrough_boost_pct: Number(char.breakthrough_boost_pct || 0),
        week_start: ws,
        items,
      },
    }
  } catch (error) {
    console.error('获取秘境商店失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
