import { getPool } from '~/server/database/db'
import { ACHIEVEMENTS, TITLES } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { title } = await readBody(event) // null = 取消称号
    const { rows: charRows } = await pool.query(
      'SELECT id, level FROM characters WHERE user_id = $1', [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const charId = charRows[0].id

    if (title) {
      // 检查是否已解锁该称号
      const titleDef = TITLES[title]
      if (!titleDef) return { code: 400, message: '称号不存在' }

      // 找到授予该称号的成就，检查是否已领取
      const achWithTitle = ACHIEVEMENTS.find(a => a.title === title)
      if (!achWithTitle) return { code: 400, message: '称号来源不存在' }

      const { rows } = await pool.query(
        'SELECT claimed FROM character_achievements WHERE character_id = $1 AND achievement_id = $2 AND claimed = TRUE',
        [charId, achWithTitle.id]
      )
      if (rows.length === 0) return { code: 400, message: '称号未解锁' }
    }

    await pool.query('UPDATE characters SET title = $1 WHERE id = $2', [title || null, charId])
    return { code: 200, message: title ? `已佩戴称号【${title}】` : '已取消称号' }
  } catch (error) {
    console.error('切换称号失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
