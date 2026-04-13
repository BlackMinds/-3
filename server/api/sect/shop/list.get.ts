import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership, weekStartStr } from '~/server/utils/sect'
import { getAvailableShopItems } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    const available = getAvailableShopItems(membership.sect_level)
    const ws = weekStartStr()

    // 查询本周购买数量
    const { rows: purchases } = await pool.query(
      'SELECT item_key, SUM(quantity) as bought FROM sect_shop_purchases WHERE character_id = $1 AND week_start = $2 GROUP BY item_key',
      [char.id, ws]
    )
    const boughtMap: Record<string, number> = {}
    for (const p of purchases) boughtMap[p.item_key] = Number(p.bought)

    const items = available.map(item => ({
      ...item,
      bought_this_week: boughtMap[item.key] || 0,
      can_buy: (boughtMap[item.key] || 0) < item.weeklyLimit,
    }))

    return { code: 200, data: items, contribution: Number(membership.contribution) }
  } catch (error) {
    console.error('商店列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
