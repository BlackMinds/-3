// 礼物库存 - GET /api/companion/gift-inventory
// 返回当前角色所有可赠礼物的合计数量（character_materials 表，合并各品质）
// 用于赠礼弹窗显示玩家持有量

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { GIFT_RECIPE_MAP } from '~/server/engine/giftRecipeData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const giftIds = Object.keys(GIFT_RECIPE_MAP)
    const inventory: Record<string, number> = {}
    for (const id of giftIds) inventory[id] = 0

    if (giftIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT material_id, SUM(count)::int AS total
           FROM character_materials
          WHERE character_id = $1 AND material_id = ANY($2::text[]) AND count > 0
          GROUP BY material_id`,
        [char.id, giftIds]
      )
      for (const r of rows) inventory[r.material_id] = Number(r.total) || 0
    }

    return { code: 200, data: { inventory } }
  } catch (error) {
    console.error('礼物库存查询失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
