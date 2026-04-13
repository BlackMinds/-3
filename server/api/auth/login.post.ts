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
    'SELECT id, username, password, status FROM users WHERE username = $1',
    [username]
  )
  if (rows.length === 0) {
    return { code: 400, message: '用户名或密码错误' }
  }

  const user = rows[0]
  if (user.status === 0) {
    return { code: 403, message: '账号已被封禁' }
  }

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    return { code: 400, message: '用户名或密码错误' }
  }

  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])

  const secret = process.env.JWT_SECRET || 'xiantu_secret_key_2026'
  const token = jwt.sign({ id: user.id }, secret, { expiresIn: '7d' })

  return {
    code: 200,
    message: '登录成功',
    data: {
      token,
      user: { id: user.id, username: user.username },
    },
  }
})
