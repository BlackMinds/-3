import { getPool } from '~/server/database/db'
import { getPillById } from '~/game/pillData'
import { issueCraftToken } from '~/server/utils/craftSession'

export default defineEventHandler(async (event) => {
  try {
  const pool = getPool()
  const userId = event.context.userId
  const { pill_id } = await readBody(event)

  const recipe = getPillById(pill_id)
  if (!recipe) return { code: 400, message: '丹方不存在' }

  const { rows: charRows } = await pool.query(
    'SELECT id FROM characters WHERE user_id = $1',
    [userId]
  )
  if (charRows.length === 0) return { code: 400, message: '角色不存在' }
  const charId = charRows[0].id

  if (recipe.requireUnlock) {
    const { rows: unlockRows } = await pool.query(
      'SELECT id FROM character_unlocked_recipes WHERE character_id = $1 AND pill_id = $2',
      [charId, pill_id]
    )
    if (unlockRows.length === 0) {
      return { code: 400, message: '该丹方尚未解锁,请先在宗门商店购买' }
    }
  }

  // 服务端权威 craftRate（用于前端预览）
  const { rows: pillRoomRows } = await pool.query(
    "SELECT level FROM character_cave WHERE character_id = $1 AND building_id = 'pill_room'",
    [charId]
  )
  const pillRoomLevel = pillRoomRows.length > 0 ? Number(pillRoomRows[0].level) : 0
  const craftRate = pillRoomLevel > 0 ? 5 + 3 * (pillRoomLevel - 1) : 0
  const successRate = Math.min(0.95, recipe.successRate * (1 + craftRate / 100))

  const token = await issueCraftToken(charId, pill_id)

  return {
    code: 200,
    data: {
      token,
      cost: recipe.cost,
      success_rate: Math.round(successRate * 1000) / 1000,
      cave_craft_rate: craftRate,
    },
  }
  } catch (error) {
    console.error('炼丹开始失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
