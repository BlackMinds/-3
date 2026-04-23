import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId

    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [userId]
    )

    if (charRows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }

    // level 以 inventory 为唯一真相；character_skills.level 只是镜像
    const { rows: skills } = await pool.query(
      `SELECT cs.id, cs.character_id, cs.skill_id, cs.skill_type, cs.slot_index,
              cs.equipped, cs.created_at,
              COALESCE(csi.level, cs.level, 1) AS level
         FROM character_skills cs
         LEFT JOIN character_skill_inventory csi
                ON csi.character_id = cs.character_id AND csi.skill_id = cs.skill_id
        WHERE cs.character_id = $1 AND cs.equipped = TRUE`,
      [charRows[0].id]
    )

    return { code: 200, data: skills }
  } catch (error) {
    console.error('获取功法失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
