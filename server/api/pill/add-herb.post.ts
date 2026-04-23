import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const { herb_id, quality, count } = await readBody(event)

    if (!herb_id || !quality || !count) return { code: 400, message: '参数错误' }

    const { rows: charRows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }

    await pool.query(
      `INSERT INTO character_materials (character_id, material_id, quality, count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (character_id, material_id, quality) DO UPDATE SET count = character_materials.count + $5`,
      [charRows[0].id, herb_id, quality, count, count]
    )

    if (quality === 'red') {
      checkAchievements(charRows[0].id, 'herb_red', 1).catch(() => {})
    }

    // 百草识尽：已收集的不同灵草种类数
    const { rows: herbTypeRows } = await pool.query(
      'SELECT COUNT(DISTINCT material_id) AS cnt FROM character_materials WHERE character_id = $1 AND count > 0',
      [charRows[0].id]
    )
    const herbTypeCount = Number(herbTypeRows[0]?.cnt || 0)
    if (herbTypeCount > 0) {
      checkAchievements(charRows[0].id, 'herb_types', herbTypeCount).catch(() => {})
    }

    return { code: 200 }
  } catch (error) {
    console.error('添加灵草失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
