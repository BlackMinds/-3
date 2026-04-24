// 秘境积分商店：购买
import { getPool } from '~/server/database/db'
import { getCharByUserId, weekStartStr } from '~/server/utils/sect'
import { getRealmShopItem, isRealmShopItemUnlocked } from '~/server/engine/secretShopData'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const body = await readBody(event).catch(() => ({})) as { item_key?: string; quantity?: number }
  const itemKey = body?.item_key
  const quantity = Math.max(1, Math.min(99, Number(body?.quantity || 1)))

  if (!itemKey) return { code: 400, message: '参数错误' }

  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }

  const item = getRealmShopItem(itemKey)
  if (!item) return { code: 400, message: '商品不存在' }

  const realmTier = Number(char.realm_tier || 1)
  const level = Number(char.level || 1)
  if (!isRealmShopItemUnlocked(item, realmTier, level)) {
    return { code: 400, message: `境界或等级不足（需 tier≥${item.reqRealmTier} · Lv.${item.reqLevel}）` }
  }

  const totalCost = item.cost * quantity
  const ws = weekStartStr()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 事务内复查本周已购 + 上限
    const { rows: boughtRows } = await client.query(
      `SELECT COALESCE(SUM(quantity), 0)::int AS bought
       FROM realm_shop_purchases
       WHERE character_id = $1 AND item_key = $2 AND week_start = $3`,
      [char.id, itemKey, ws]
    )
    const bought = Number(boughtRows[0].bought || 0)
    if (bought + quantity > item.weeklyLimit) {
      await client.query('ROLLBACK')
      return { code: 400, message: `本周购买上限 ${item.weeklyLimit} 件（已购 ${bought}）` }
    }

    // 扣秘境积分（带条件防并发）
    const { rowCount: deducted } = await client.query(
      'UPDATE characters SET realm_points = realm_points - $1 WHERE id = $2 AND realm_points >= $1',
      [totalCost, char.id]
    )
    if (!deducted) {
      await client.query('ROLLBACK')
      return { code: 400, message: `秘境积分不足（需 ${totalCost}）` }
    }

    // 记录购买
    await client.query(
      `INSERT INTO realm_shop_purchases (character_id, item_key, quantity, cost_points, week_start)
       VALUES ($1, $2, $3, $4, $5)`,
      [char.id, itemKey, quantity, totalCost, ws]
    )

    // 入库到 character_pills
    await client.query(
      `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
       VALUES ($1, $2, $3, 1.0)
       ON CONFLICT (character_id, pill_id, quality_factor)
       DO UPDATE SET count = character_pills.count + EXCLUDED.count`,
      [char.id, item.pillId, quantity]
    )

    const { rows: updated } = await client.query(
      'SELECT realm_points FROM characters WHERE id = $1',
      [char.id]
    )

    await client.query('COMMIT')
    return {
      code: 200,
      message: `获得${item.name} ×${quantity}`,
      data: {
        realm_points: Number(updated[0].realm_points || 0),
        bought: bought + quantity,
      },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('秘境商店购买失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
