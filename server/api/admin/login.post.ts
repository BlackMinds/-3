import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  const { username, password } = await readBody(event)

  if (!username || !password) {
    return { code: 400, message: '用户名和密码不能为空' }
  }

  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT id, username, password, role, status FROM admins WHERE username = $1',
    [username]
  )
  if (rows.length === 0) {
    return { code: 400, message: '用户名或密码错误' }
  }

  const admin = rows[0]
  if (admin.status === 0) {
    return { code: 403, message: '账号已禁用' }
  }

  const isMatch = await bcrypt.compare(password, admin.password)
  if (!isMatch) {
    return { code: 400, message: '用户名或密码错误' }
  }

  await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id])

  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'xiantu_secret_key_2026'
  const token = jwt.sign(
    { id: admin.id, role: admin.role, kind: 'admin' },
    secret,
    { expiresIn: '7d' }
  )

  return {
    code: 200,
    message: '登录成功',
    data: {
      token,
      admin: { id: admin.id, username: admin.username, role: admin.role },
    },
  }
})
