// 子女自动成长 cron - POST /api/cron/child-grow
// 每天调用一次：婴幼(infant)/童年(child) 阶段子女自动 +1 级（最高到 30，跨入少年期后停止）
// 避免婴儿期黑徽章贵 — 玩家不需要每天喂养也能慢慢长大
// design 10.12
// 2026-05-15：防御性同步父母 +30 上限（理论上 1→30 区间几乎不会触发，但保险起见显式约束）

import { getPool } from '~/server/database/db'
import { calcChildBaseStats, getEffectiveChildLevelCap, type ChildAptitude } from '~/server/utils/child'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // 找出所有婴幼/童年期子女（level < 31）+ JOIN 父母 level 用于上限计算
  const { rows: candidates } = await pool.query(`
    SELECT c.id, c.character_id, c.level, c.aptitude, ch.level AS parent_level
      FROM children c
      JOIN characters ch ON ch.id = c.character_id
     WHERE c.level < 31
       AND c.has_left_home = FALSE
  `)

  let grown = 0
  for (const c of candidates) {
    const effectiveCap = getEffectiveChildLevelCap(c.aptitude, Number(c.parent_level || 1))
    const newLevel = Math.min(30, c.level + 1, effectiveCap)
    if (newLevel === c.level) continue
    const newStats = calcChildBaseStats(c.aptitude as ChildAptitude, newLevel)
    const newStage = newLevel <= 10 ? 'infant' : newLevel <= 30 ? 'child' : 'youth'
    // 自动成长同样不重滚 crit/dodge（保留出生时锁定的浮动值）
    await pool.query(
      `UPDATE children SET
        level = $1, stage = $2,
        max_hp = $3, atk = $4, def = $5, spd = $6,
        spirit = $7, resist_ctrl = $8
       WHERE id = $9`,
      [newLevel, newStage,
       newStats.maxHp, newStats.atk, newStats.def, newStats.spd,
       newStats.spirit, newStats.resistCtrl,
       c.id]
    )
    grown++
  }

  return { ok: true, scanned: candidates.length, grown }
})
