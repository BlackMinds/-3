// POST /api/tower/sweep
// 通天塔每日扫荡：每日一次，按 max_floor 给奖励
//   MVP 阶段（Phase 4 前）：流程已开放，但暂不发任何实际奖励，仅消费"今日已领取"
//   Phase 4 上线时：在下面 "TODO" 处填入 §5.3 公式
import { getPool } from '~/server/database/db'
import { ENTRY_REALM_TIER, ENTRY_LEVEL } from '~/server/engine/towerData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()

    const { rows: charRows } = await pool.query(
      `SELECT id, name, realm_tier, level, tower_max_floor, tower_last_sweep_date
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
    const todayStr = todayString()
    const lastDate = c.tower_last_sweep_date ? formatDate(c.tower_last_sweep_date) : null
    if (lastDate === todayStr) {
      return { code: 400, message: '今日已领取扫荡奖励，明日 00:00 重置' }
    }

    // 标记今日已领取（事务内更新）
    await pool.query(
      'UPDATE characters SET tower_last_sweep_date = CURRENT_DATE WHERE id = $1',
      [c.id]
    )

    // ===== TODO Phase 4：按 §5.3 公式发奖励 =====
    // const maxFloor = c.tower_max_floor
    // const stoneGain = maxFloor * 20000
    // const expGain = maxFloor * 30000
    // const universalPages = maxFloor >= 75 ? 3 : maxFloor >= 45 ? 2 : maxFloor >= 15 ? 1 : 0
    // const breakthroughPills = maxFloor >= 90 ? 3 : maxFloor >= 60 ? 2 : maxFloor >= 30 ? 1 : 0
    // const ancientSouls = maxFloor >= 90 ? 2 : maxFloor >= 60 ? 1 : 0
    // 然后 UPDATE characters SET spirit_stone += stoneGain, ... 以及 inventory 入库

    return {
      code: 200,
      data: {
        max_floor: c.tower_max_floor,
        // MVP 阶段奖励占位 — Phase 4 接入物品时填入实际数值
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

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function formatDate(d: any): string {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  if (typeof d === 'string') return d.slice(0, 10)
  return ''
}
