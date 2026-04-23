import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const { skill_id, skill_type, slot_index } = await readBody(event)

    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [userId]
    )

    if (charRows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }

    const charId = charRows[0].id

    // 查询已装备的功法
    const { rows: equipped } = await pool.query(
      'SELECT * FROM character_skills WHERE character_id = $1 AND skill_id = $2 AND skill_type = $3 AND slot_index = $4',
      [charId, skill_id, skill_type, slot_index]
    )

    if (equipped.length === 0) {
      return { code: 400, message: '功法未装备' }
    }

    const currentLevel = equipped[0].level
    if (currentLevel >= 5) {
      return { code: 400, message: '已满级' }
    }

    // 升级消耗:每升一级需要 N 个同名功法残页 (level)
    const needPages = currentLevel

    const { rows: pages } = await pool.query(
      'SELECT * FROM character_skill_inventory WHERE character_id = $1 AND skill_id = $2',
      [charId, skill_id]
    )

    const havePages = pages.length > 0 ? pages[0].count : 0
    if (havePages < needPages) {
      return { code: 400, message: `需要 ${needPages} 个 ${skill_id} 残页(当前 ${havePages})` }
    }

    // 扣残页
    await pool.query(
      'UPDATE character_skill_inventory SET count = count - $1 WHERE character_id = $2 AND skill_id = $3',
      [needPages, charId, skill_id]
    )

    // 升级（同步更新 inventory 的等级主权位置，卸下也不丢）
    await pool.query(
      'UPDATE character_skills SET level = level + 1 WHERE id = $1',
      [equipped[0].id]
    )
    await pool.query(
      'UPDATE character_skill_inventory SET level = $1 WHERE character_id = $2 AND skill_id = $3',
      [currentLevel + 1, charId, skill_id]
    )

    checkAchievements(charId, 'skill_max_level', currentLevel + 1).catch(() => {})

    return {
      code: 200,
      message: '升级成功',
      data: { newLevel: currentLevel + 1 },
    }
  } catch (error) {
    console.error('升级功法失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
