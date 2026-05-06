// POST /api/tower/sweep
// 通天塔每日扫荡：每日一次，按 max_floor 给奖励
//   "今日"判定走 SQL 层 (NOW() AT TIME ZONE 'UTC')::DATE → 北京时间 8:00 重置
//   MVP 阶段（Phase 4 前）：流程已开放，但暂不发任何实际奖励
import { getPool } from '~/server/database/db'
import { ENTRY_REALM_TIER, ENTRY_LEVEL } from '~/server/engine/towerData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()

    const { rows: charRows } = await pool.query(
      `SELECT id, name, realm_tier, level, tower_max_floor,
              (tower_last_sweep_date = (NOW() AT TIME ZONE 'UTC')::DATE) AS sweep_done_today
         FROM characters WHERE user_id = $1`,
      [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const c = charRows[0]

    // 大乘门槛
    if ((c.realm_tier || 1) < ENTRY_REALM_TIER || (c.level || 1) < ENTRY_LEVEL) {
      return { code: 403, message: '通天塔需大乘境界且等级 ≥ 140' }
    }

    // 没通关任何层无法扫荡
    if ((c.tower_max_floor || 0) <= 0) {
      return { code: 400, message: '请先通关至少 1 层后再扫荡' }
    }

    // 今日已领取？
    if (c.sweep_done_today) {
      return { code: 400, message: '今日已领取扫荡奖励，明日 8:00 重置' }
    }

    // 标记今日已领取（用 SQL 表达式直接写 UTC DATE，避免 JS 端时区误差）
    await pool.query(
      `UPDATE characters
          SET tower_last_sweep_date = (NOW() AT TIME ZONE 'UTC')::DATE
        WHERE id = $1`,
      [c.id]
    )

    // ===== TODO Phase 4：按 §5.3 公式发奖励 =====
    // const maxFloor = c.tower_max_floor
    // const stoneGain = maxFloor * 20000
    // const expGain = maxFloor * 30000
    // const universalPages = maxFloor >= 75 ? 3 : maxFloor >= 45 ? 2 : maxFloor >= 15 ? 1 : 0
    // const breakthroughPills = maxFloor >= 90 ? 3 : maxFloor >= 60 ? 2 : maxFloor >= 30 ? 1 : 0
    // const ancientSouls = maxFloor >= 90 ? 2 : maxFloor >= 60 ? 1 : 0

    return {
      code: 200,
      data: {
        max_floor: c.tower_max_floor,
        rewards: {
          spirit_stone: 0,
          exp: 0,
          universal_page: 0,
          breakthrough_pill: 0,
          ancient_soul: 0,
          note: '当前为 MVP 阶段，扫荡功能已开放但暂未发放实际物品奖励',
        },
      },
      message: '扫荡完成（暂未启用奖励发放）',
    }
  } catch (err: any) {
    console.error('通天塔 sweep 接口错误:', err)
    return { code: 500, message: '服务器错误' }
  }
})
