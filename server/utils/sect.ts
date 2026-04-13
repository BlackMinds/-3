import { getPool } from '~/server/database/db'
import {
  DAILY_TASK_TYPES, WEEKLY_TASK_TYPES,
} from '~/server/engine/sectData'

// ===== 工具函数 =====
export async function getCharByUserId(userId: number) {
  const pool = getPool()
  const { rows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [userId])
  return rows[0] || null
}

export async function getMembership(charId: number) {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT sm.*, s.name as sect_name, s.level as sect_level, s.fund, s.join_mode, s.announcement, s.leader_id, s.member_count FROM sect_members sm JOIN sects s ON sm.sect_id = s.id WHERE sm.character_id = $1`,
    [charId]
  )
  return rows[0] || null
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function weekStartStr() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().slice(0, 10)
}

export function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 生成每日任务(内部调用)
export async function generateDailyTasks(charId: number, sectId: number, sectLevel: number) {
  const pool = getPool()
  const today = todayStr()
  const { rows: existing } = await pool.query(
    'SELECT id FROM sect_daily_tasks WHERE character_id = $1 AND task_date = $2', [charId, today]
  )
  if (existing.length > 0) return

  const shuffled = [...DAILY_TASK_TYPES].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, 3)

  for (const task of selected) {
    const target = Math.ceil(task.baseTarget * (1 + sectLevel * 0.1))
    await pool.query(
      'INSERT INTO sect_daily_tasks (character_id, sect_id, task_type, target_count, reward_contribution, task_date) VALUES ($1, $2, $3, $4, $5, $6)',
      [charId, sectId, task.type, target, task.baseContribution, today]
    )
  }
}

// 生成周常任务(内部)
export async function generateWeeklyTask(sectId: number, sectLevel: number) {
  const pool = getPool()
  const ws = weekStartStr()
  const { rows: existing } = await pool.query(
    'SELECT id FROM sect_weekly_tasks WHERE sect_id = $1 AND week_start = $2', [sectId, ws]
  )
  if (existing.length > 0) return

  const task = WEEKLY_TASK_TYPES[Math.floor(Math.random() * WEEKLY_TASK_TYPES.length)]
  const target = Math.ceil(task.baseTarget * (1 + sectLevel * 0.1))

  await pool.query(
    'INSERT INTO sect_weekly_tasks (sect_id, task_type, target_count, week_start) VALUES ($1, $2, $3, $4)',
    [sectId, task.type, target, ws]
  )
}

// 更新周常任务进度
export async function updateWeeklyTask(sectId: number, taskType: string, increment: number) {
  const pool = getPool()
  const ws = weekStartStr()
  await pool.query(
    'UPDATE sect_weekly_tasks SET current_count = LEAST(current_count + $1, target_count) WHERE sect_id = $2 AND week_start = $3 AND task_type = $4 AND completed = FALSE',
    [increment, sectId, ws, taskType]
  )
  await pool.query(
    'UPDATE sect_weekly_tasks SET completed = TRUE WHERE sect_id = $1 AND week_start = $2 AND current_count >= target_count AND completed = FALSE',
    [sectId, ws]
  )
}

// 公开导出: 任务进度更新函数(供其他路由调用)
export async function updateSectDailyTask(charId: number, taskType: string, increment: number = 1) {
  try {
    const pool = getPool()
    const today = todayStr()
    await pool.query(
      `UPDATE sect_daily_tasks SET current_count = LEAST(current_count + $1, target_count), completed = CASE WHEN current_count + $2 >= target_count THEN TRUE ELSE completed END WHERE character_id = $3 AND task_type = $4 AND task_date = $5 AND claimed = FALSE`,
      [increment, increment, charId, taskType, today]
    )
  } catch {
    // 静默失败，不影响主流程
  }
}

export async function updateSectWeeklyTaskByCharId(charId: number, taskType: string, increment: number = 1) {
  try {
    const pool = getPool()
    const { rows: memberRows } = await pool.query(
      'SELECT sect_id FROM sect_members WHERE character_id = $1', [charId]
    )
    if (memberRows.length > 0) {
      await updateWeeklyTask(memberRows[0].sect_id, taskType, increment)
    }
  } catch {
    // 静默失败
  }
}
