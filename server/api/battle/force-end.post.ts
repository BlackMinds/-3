import { getPool } from '~/server/database/db'

// 强制结束上场战斗: 用于"A 端登录战斗未播完, B 端登录被 battle_end_at 一直拦"的场景
// 只清 DB 持久化锁; fight.post.ts 内存锁的 cooldownUntil(1.5s) / inProgressSince(10s) 会自然过期
export default defineEventHandler(async (event) => {
  if (!event.context.userId) {
    return { code: 401, message: '未登录' }
  }
  const pool = getPool()
  const { rows: charRows } = await pool.query(
    'SELECT id FROM characters WHERE user_id = $1',
    [event.context.userId]
  )
  if (charRows.length === 0) return { code: 400, message: '角色不存在' }
  const charId = charRows[0].id
  await pool.query('UPDATE characters SET battle_end_at = NULL WHERE id = $1', [charId])
  return { code: 200, message: '已强制结束上场战斗' }
})
