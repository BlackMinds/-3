import jwt from 'jsonwebtoken'

const WHITELIST_USER_ID = 1

export default defineEventHandler(async (event) => {
  if (process.env.MAINTENANCE_MODE !== 'on') return

  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/')) return
  if (path === '/api/health' || path.startsWith('/api/admin/')) return
  if (path === '/api/auth/login') return

  const token = getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (token) {
    try {
      const secret = process.env.JWT_SECRET || 'xiantu_secret_key_2026'
      const decoded = jwt.verify(token, secret) as { id: number }
      if (decoded.id === WHITELIST_USER_ID) return
    } catch {
      // fall through to maintenance response
    }
  }

  throw createError({
    statusCode: 503,
    statusMessage: 'Service Unavailable',
    data: {
      code: 503,
      message: '关服维护中，5月18日 11:00 重新开服',
      maintenance: true,
      reopen_at: '2026-05-18T11:00:00+08:00',
    },
  })
})
