import bcrypt from 'bcryptjs'
import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  const { username, password } = await readBody(event)

  if (!username || !password) {
    return { code: 400, message: '用户名和密码不能为空' }
  }
  if (username.length < 2 || username.length > 16) {
    return { code: 400, message: '用户名长度2-16位' }
  }
  if (password.length < 6 || password.length > 32) {
    return { code: 400, message: '密码长度6-32位' }
  }

  const pool = getPool()

  const { rows: existing } = await pool.query(
    'SELECT id FROM users WHERE username = $1',
    [username]
  )
  if (existing.length > 0) {
    return { code: 400, message: '用户名已存在' }
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  await pool.query(
    'INSERT INTO users (username, password) VALUES ($1, $2)',
    [username, hashedPassword]
  )

  return { code: 200, message: '注册成功' }
})
