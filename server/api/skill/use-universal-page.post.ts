import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'

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

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 消耗万能残页（FOR UPDATE 防并发重复使用）
      const { rows: pillRows } = await client.query(
        "SELECT id, count FROM character_pills WHERE character_id = $1 AND pill_id = 'universal_skill_page' AND count > 0 LIMIT 1 FOR UPDATE",
        [charId]
      )
      if (pillRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '没有万能功法残页' }
      }

      const { rowCount: consumed } = await client.query(
        'UPDATE character_pills SET count = count - 1 WHERE id = $1 AND count >= 1',
        [pillRows[0].id]
      )
      if (!consumed) {
        await client.query('ROLLBACK')
        return { code: 400, message: '没有万能功法残页' }
      }
      await client.query('DELETE FROM character_pills WHERE id = $1 AND count <= 0', [pillRows[0].id])

      // 添加目标残页到背包
      await client.query(
        `INSERT INTO character_skill_inventory (character_id, skill_id, count) VALUES ($1, $2, 1)
         ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
        [charId, skill_id]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }

    checkAchievements(charId, 'universal_page_use', 1).catch(() => {})

    return { code: 200, message: `获得【${skill_id}】残页 x1` }
  } catch (error) {
    console.error('万能残页使用失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
