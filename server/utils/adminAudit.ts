import type { PoolClient } from 'pg'
import { getPool } from '~/server/database/db'
import type { H3Event } from 'h3'

// 写一条 admin_audit_log
export async function writeAudit(opts: {
  adminId: number
  action: string
  targetCharacterId?: number | null
  payload: any
  ip?: string | null
  client?: PoolClient
}) {
  const runner = opts.client || getPool()
  await runner.query(
    `INSERT INTO admin_audit_log (admin_id, action, target_character_id, payload, ip)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [
      opts.adminId,
      opts.action,
      opts.targetCharacterId ?? null,
      JSON.stringify(opts.payload ?? {}),
      opts.ip || null,
    ]
  )
}

export function getClientIp(event: H3Event): string | null {
  const xff = getRequestHeader(event, 'x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || null
  return getRequestHeader(event, 'x-real-ip')
      || event.node.req.socket?.remoteAddress
      || null
}

// 校验玩家存在并返回 user_id（GM 操作需要）
export async function loadTargetCharacter(characterId: number): Promise<{ id: number; user_id: number; name: string } | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT id, user_id, name FROM characters WHERE id = $1`,
    [characterId]
  )
  return rows[0] || null
}
