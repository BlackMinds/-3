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

  // 标记活跃度（用于天道造化抽奖候选池 / 灵脉守卫权重），失败不影响主流程
  // 原先每次 API 请求都 UPDATE 一次，200+ 玩家下每秒数百次 characters 写入 —
  // WAL / Neon page version 放大严重。改为 SQL 层条件更新，只在距上次更新超 5 分钟
  // 才真正改行；WHERE 不命中时 Postgres 不会产生 tuple 变更和 dead row，几乎零写入成本。
  // 精度 5 分钟对 guardShareRatio(spiritVeinEngine) 这类用途已足够。
  try {
    const pool = getPool()
    await pool.query(
      `UPDATE characters SET last_active_at = NOW()
       WHERE user_id = $1
         AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '5 minutes')`,
      [event.context.userId]
    )
  } catch {
    // 静默失败
  }
})
