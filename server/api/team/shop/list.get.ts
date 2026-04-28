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

    // 收集所有兑换型条目所需的源道具 pill_id，一次查出库存返回前端做"道具不足"灰按钮判断
    const exchangePillIds = Array.from(new Set(
      REALM_SHOP_ITEMS.map(i => i.exchangeFrom?.pillId).filter((x): x is string => !!x)
    ))
    const ownedPills: Record<string, number> = {}
    if (exchangePillIds.length > 0) {
      const { rows: pillRows } = await pool.query(
        `SELECT pill_id, COALESCE(SUM(count), 0)::int AS count
         FROM character_pills
         WHERE character_id = $1 AND pill_id = ANY($2::text[])
         GROUP BY pill_id`,
        [char.id, exchangePillIds]
      )
      for (const r of pillRows) ownedPills[r.pill_id] = Number(r.count)
      for (const id of exchangePillIds) if (!(id in ownedPills)) ownedPills[id] = 0
    }

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
      exchange_from: item.exchangeFrom ? { pill_id: item.exchangeFrom.pillId, qty: item.exchangeFrom.qty } : undefined,
    }))

    return {
      code: 200,
      data: {
        realm_points: Number(char.realm_points || 0),
        breakthrough_boost_pct: Number(char.breakthrough_boost_pct || 0),
        week_start: ws,
        items,
        owned_pills: ownedPills,
      },
    }
  } catch (error) {
    console.error('获取秘境商店失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
