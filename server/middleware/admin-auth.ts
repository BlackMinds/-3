import jwt from 'jsonwebtoken'

// admin 鉴权中间件：只处理 /api/admin/* 路径
// 例外：/api/admin/login 不需要 token（登录接口本身）
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const path = url.pathname

  if (!path.startsWith('/api/admin/')) return
  if (path === '/api/admin/login') return

  const authHeader = getHeader(event, 'authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: '后台未登录' })
  }

  try {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'xiantu_secret_key_2026'
    const decoded = jwt.verify(token, secret) as { id: number; role: string; kind: string }
    if (decoded.kind !== 'admin') {
      throw createError({ statusCode: 401, statusMessage: 'token 类型错误' })
    }
    event.context.adminId = decoded.id
    event.context.adminRole = decoded.role
  } catch (e: any) {
    if (e.statusCode) throw e
    throw createError({ statusCode: 401, statusMessage: '后台登录已过期' })
  }
})
