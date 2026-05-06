import { randomBytes } from 'crypto'
import { getPool } from '~/server/database/db'

const TTL_MS = 60_000

export async function issueCraftToken(charId: number, pillId: string): Promise<string> {
  const token = randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + TTL_MS)
  const pool = getPool()
  await pool.query(
    'INSERT INTO craft_sessions (token, character_id, pill_id, expires_at) VALUES ($1, $2, $3, $4)',
    [token, charId, pillId, expiresAt]
  )
  // 偶发性清理过期会话（5% 概率，避开热路径）
  if (Math.random() < 0.05) {
    pool.query('DELETE FROM craft_sessions WHERE expires_at < NOW()').catch(() => {})
  }
  return token
}

/**
 * 一次性消费 token：DELETE … RETURNING 实现"校验+消费"原子操作。
 * 即使并发同 token 也只有一行成功。
 */
export async function consumeCraftToken(token: string, charId: number, pillId: string): Promise<boolean> {
  if (!token || typeof token !== 'string') return false
  const pool = getPool()
  const { rowCount } = await pool.query(
    'DELETE FROM craft_sessions WHERE token = $1 AND character_id = $2 AND pill_id = $3 AND expires_at > NOW()',
    [token, charId, pillId]
  )
  return (rowCount ?? 0) > 0
}
