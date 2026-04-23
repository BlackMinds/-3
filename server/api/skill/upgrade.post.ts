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

    // 验证装备关系（必须装在对应槽位、且 equipped=TRUE，避免命中历史脏行）
    const { rows: equipped } = await pool.query(
      'SELECT id FROM character_skills WHERE character_id = $1 AND skill_id = $2 AND skill_type = $3 AND slot_index = $4 AND equipped = TRUE',
      [charId, skill_id, skill_type, slot_index]
    )

    if (equipped.length === 0) {
      return { code: 400, message: '功法未装备' }
    }

    // 等级以 inventory 为唯一真相（卸下/装备/同名脏行都不影响）
    const { rows: invRows } = await pool.query(
      'SELECT count, level FROM character_skill_inventory WHERE character_id = $1 AND skill_id = $2',
      [charId, skill_id]
    )

    const currentLevel = Number(invRows[0]?.level) || 1
    if (currentLevel >= 5) {
      return { code: 400, message: '已满级' }
    }

    // 升级消耗：每升一级需要 N 个同名功法残页 (N = 当前等级)
    const needPages = currentLevel
    const havePages = Number(invRows[0]?.count) || 0
    if (havePages < needPages) {
      return { code: 400, message: `需要 ${needPages} 个 ${skill_id} 残页(当前 ${havePages})` }
    }

    const newLevel = currentLevel + 1

    // 扣残页 + 升 inventory 等级（唯一真相源）
    await pool.query(
      'UPDATE character_skill_inventory SET count = count - $1, level = $2 WHERE character_id = $3 AND skill_id = $4',
      [needPages, newLevel, charId, skill_id]
    )

    // 同步 character_skills 镜像：同 skill_id 的所有行一起更新（兼容历史脏数据）
    await pool.query(
      'UPDATE character_skills SET level = $1 WHERE character_id = $2 AND skill_id = $3',
      [newLevel, charId, skill_id]
    )

    checkAchievements(charId, 'skill_max_level', newLevel).catch(() => {})

    // 功法全满：已装备功法 >=7 且全部 Lv.5
    const { rows: eqStat } = await pool.query(
      'SELECT COUNT(*) AS cnt, COUNT(*) FILTER (WHERE level >= 5) AS maxed FROM character_skills WHERE character_id = $1 AND equipped = TRUE',
      [charId]
    )
    if (eqStat[0] && Number(eqStat[0].cnt) >= 7 && Number(eqStat[0].maxed) >= 7) {
      checkAchievements(charId, 'all_skills_maxed', 1).catch(() => {})
    }

    return {
      code: 200,
      message: '升级成功',
      data: { newLevel },
    }
  } catch (error) {
    console.error('升级功法失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
