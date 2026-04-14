import jwt from 'jsonwebtoken'
import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const path = url.pathname

  // 跳过不需要鉴权的路径
  if (path.startsWith('/api/auth/') ||
      path === '/api/health' ||
      path.startsWith('/api/cron/')) return

  // 只拦截 /api/ 路径
  if (!path.startsWith('/api/')) return

  const authHeader = getHeader(event, 'authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  try {
    const secret = process.env.JWT_SECRET || 'xiantu_secret_key_2026'
    const decoded = jwt.verify(token, secret) as { id: number }
    event.context.userId = decoded.id
  } catch {
    throw createError({ statusCode: 401, statusMessage: '登录已过期' })
  }

  // 标记活跃度（用于天道造化抽奖候选池），失败不影响主流程
  try {
    const pool = getPool()
    await pool.query(
      'UPDATE characters SET last_active_at = NOW() WHERE user_id = $1',
      [event.context.userId]
    )
  } catch {
    // 静默失败
  }
})
