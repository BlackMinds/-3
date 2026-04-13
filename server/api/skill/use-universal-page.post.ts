import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const { skill_id } = await readBody(event)

    if (!skill_id) return { code: 400, message: '请指定目标功法' }

    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const charId = charRows[0].id

    // 消耗万能残页
    const { rows: pillRows } = await pool.query(
      "SELECT id, count FROM character_pills WHERE character_id = $1 AND pill_id = 'universal_skill_page' AND count > 0 LIMIT 1",
      [charId]
    )
    if (pillRows.length === 0) return { code: 400, message: '没有万能功法残页' }

    await pool.query('UPDATE character_pills SET count = count - 1 WHERE id = $1', [pillRows[0].id])
    await pool.query('DELETE FROM character_pills WHERE id = $1 AND count <= 0', [pillRows[0].id])

    // 添加目标残页到背包
    await pool.query(
      `INSERT INTO character_skill_inventory (character_id, skill_id, count) VALUES ($1, $2, 1)
       ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
      [charId, skill_id]
    )

    return { code: 200, message: `获得【${skill_id}】残页 x1` }
  } catch (error) {
    console.error('万能残页使用失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
