// GET /api/tower/info
// 查询通天塔总览状态：最高层、今日失败次数、是否可挑战、门槛检查等
import { getPool } from '~/server/database/db'
import {
  TOTAL_FLOORS, IMPLEMENTED_FLOORS, DAILY_FAIL_LIMIT,
  ENTRY_REALM_TIER, ENTRY_LEVEL,
} from '~/server/engine/towerData'

// "今日"判定全部走 SQL 层，避免 JS 端时区/类型转换坑
// (NOW() AT TIME ZONE 'UTC')::DATE 在北京时间 8:00 跨日 = 早 8 点重置（与秘境一致）

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()

    // 用 SQL 表达式直接计算 fail_today / sweep_today，避免 JS 端处理 DATE 字段时区问题
    const { rows: charRows } = await pool.query(
      `SELECT id, name, realm_tier, level,
              tower_max_floor,
              tower_daily_fail,
              (tower_daily_date = (NOW() AT TIME ZONE 'UTC')::DATE) AS fail_today,
              (tower_last_sweep_date = (NOW() AT TIME ZONE 'UTC')::DATE) AS sweep_done_today
         FROM characters WHERE user_id = $1`,
      [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const c = charRows[0]

    // 懒重置：tower_daily_date 不是今天 → 失败次数清零（持久化）
    let dailyFail = c.tower_daily_fail || 0
    if (!c.fail_today) {
      await pool.query(
        `UPDATE characters
            SET tower_daily_fail = 0,
                tower_daily_date = (NOW() AT TIME ZONE 'UTC')::DATE
          WHERE id = $1`,
        [c.id]
      )
      dailyFail = 0
    }

    const maxFloor = c.tower_max_floor || 0
    const realmTier = c.realm_tier || 1
    const level = c.level || 1
    const eligible = realmTier >= ENTRY_REALM_TIER && level >= ENTRY_LEVEL

    // 下一关：max_floor + 1，但不超过已实现层数
    const nextFloor = Math.min(IMPLEMENTED_FLOORS, maxFloor + 1)
    const canChallenge = eligible && dailyFail < DAILY_FAIL_LIMIT && maxFloor < IMPLEMENTED_FLOORS

    // 是否能扫荡：达到大乘 + 已通关至少 1 层 + 今日未领取
    const canSweep = eligible && maxFloor > 0 && !c.sweep_done_today

    return {
      code: 200,
      data: {
        max_floor: maxFloor,
        next_floor: nextFloor,
        daily_fail_used: dailyFail,
        daily_fail_max: DAILY_FAIL_LIMIT,
        can_challenge: canChallenge,
        can_sweep: canSweep,
        total_floors: TOTAL_FLOORS,
        implemented_floors: IMPLEMENTED_FLOORS,
        eligible,
        entry_realm_tier: ENTRY_REALM_TIER,
        entry_level: ENTRY_LEVEL,
        current_realm_tier: realmTier,
        current_level: level,
      }
    }
  } catch (err: any) {
    console.error('通天塔 info 接口错误:', err)
    return { code: 500, message: '服务器错误' }
  }
})
