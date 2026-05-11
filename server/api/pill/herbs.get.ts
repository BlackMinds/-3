import { getPool } from '~/server/database/db'
import { HERBS } from '~/game/herbData'
import { GIFT_RECIPE_MAP } from '~/server/engine/giftRecipeData'

// 只返回灵草 + 礼物成品 (HERBS 注册的 id + GIFT_RECIPE_MAP 注册的礼物 id)。
// character_materials 表混存了灵草、成品礼物、情花种子等，必须过滤，
// 否则炼丹房"灵草库存"会显示 lifelong_grass_seed 这类英文死货。
const ALLOWED_IDS = new Set<string>([
  ...HERBS.map(h => h.id),
  ...Object.keys(GIFT_RECIPE_MAP),
])

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId

    const { rows: charRows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query(
      "SELECT material_id as herb_id, quality, count FROM character_materials WHERE character_id = $1 AND count > 0 ORDER BY material_id, quality",
      [charRows[0].id]
    )

    const filtered = rows.filter((r: any) => ALLOWED_IDS.has(r.herb_id))

    return { code: 200, data: filtered }
  } catch (error) {
    console.error('获取灵草失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
