import { getPool } from '~/server/database/db'
import { ACHIEVEMENTS, ACHIEVEMENTS_MAP, TITLES } from '~/server/engine/achievementData'
import { initAchievementsIfNeeded } from '~/server/utils/achievement'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()

    // getCharId
    const { rows: charRows } = await pool.query(
      'SELECT id, level FROM characters WHERE user_id = $1', [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const charId = charRows[0].id

    // 首次访问时补录历史进度
    await initAchievementsIfNeeded(charId)

    // 查询所有成就进度
    const { rows: progressRows } = await pool.query(
      'SELECT achievement_id, progress, completed, claimed FROM character_achievements WHERE character_id = $1',
      [charId]
    )

    const progressMap: Record<string, { progress: number; completed: boolean; claimed: boolean }> = {}
    for (const r of progressRows) {
      progressMap[r.achievement_id] = { progress: r.progress, completed: !!r.completed, claimed: !!r.claimed }
    }

    // 获取当前称号
    const { rows: titleRows } = await pool.query(
      'SELECT title FROM characters WHERE id = $1', [charId]
    )
    const currentTitle = titleRows[0]?.title || null

    // 组装列表
    const list = ACHIEVEMENTS.map(a => {
      const p = progressMap[a.id]
      return {
        id: a.id,
        name: a.name,
        desc: a.desc,
        category: a.category,
        target: a.target,
        progress: p?.progress || 0,
        completed: p?.completed || false,
        claimed: p?.claimed || false,
        reward: a.reward,
        title: a.title || null,
      }
    })

    // 统计
    const totalCount = ACHIEVEMENTS.length
    const completedCount = progressRows.filter(r => r.completed).length
    const claimableCount = progressRows.filter(r => r.completed && !r.claimed).length

    // 已解锁的称号列表
    const unlockedTitles: Array<{ id: string; name: string; quality: string }> = []
    for (const r of progressRows) {
      if (!r.completed || !r.claimed) continue
      const def = ACHIEVEMENTS_MAP[r.achievement_id]
      if (def?.title && TITLES[def.title]) {
        unlockedTitles.push(TITLES[def.title])
      }
    }

    return {
      code: 200,
      data: {
        list,
        totalCount,
        completedCount,
        claimableCount,
        currentTitle,
        unlockedTitles,
      }
    }
  } catch (error) {
    console.error('获取成就列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
