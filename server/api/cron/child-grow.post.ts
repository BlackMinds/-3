// 子女自动成长 cron - POST /api/cron/child-grow
// 每天调用一次：婴幼(infant)/童年(child) 阶段子女自动 +1 级（最高到 30，跨入少年期后停止）
// 避免婴儿期黑徽章贵 — 玩家不需要每天喂养也能慢慢长大
// design 10.12

import { getPool } from '~/server/database/db'
import { calcChildBaseStats, type ChildAptitude } from '~/server/utils/child'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // 找出所有婴幼/童年期子女（level < 31）
  const { rows: candidates } = await pool.query(`
    SELECT id, character_id, level, aptitude
      FROM children
     WHERE level < 31
       AND has_left_home = FALSE
  `)

  let grown = 0
  for (const c of candidates) {
    const newLevel = Math.min(30, c.level + 1)
    if (newLevel === c.level) continue
    const newStats = calcChildBaseStats(c.aptitude as ChildAptitude, newLevel)
    const newStage = newLevel <= 10 ? 'infant' : newLevel <= 30 ? 'child' : 'youth'
    await pool.query(
      `UPDATE children SET
        level = $1, stage = $2,
        max_hp = $3, atk = $4, def = $5, spd = $6
       WHERE id = $7`,
      [newLevel, newStage, newStats.maxHp, newStats.atk, newStats.def, newStats.spd, c.id]
    )
    grown++
  }

  return { ok: true, scanned: candidates.length, grown }
})
