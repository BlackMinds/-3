import jwt from 'jsonwebtoken'

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
})
