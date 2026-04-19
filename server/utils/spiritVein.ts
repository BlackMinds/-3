/**
 * 灵脉潮汐工具
 */
import { getPool } from '~/server/database/db'
import type { PoolClient } from 'pg'

export async function getActiveCd(
  characterId: number,
  cdType: 'defend_injured' | 'attack_injured' | 'attack_node',
  targetNodeId?: number
): Promise<{ active: boolean; expiresAt?: Date }> {
  const pool = getPool()
  const params: any[] = [characterId, cdType]
  let sql = `SELECT expires_at FROM spirit_vein_cooldown
              WHERE character_id = $1 AND cd_type = $2 AND expires_at > NOW()`
  if (cdType === 'attack_node' && targetNodeId != null) {
    params.push(targetNodeId)
    sql += ` AND target_node_id = $3`
  }
  sql += ' ORDER BY expires_at DESC LIMIT 1'
  const { rows } = await pool.query(sql, params)
  if (rows.length === 0) return { active: false }
  return { active: true, expiresAt: rows[0].expires_at }
}

export async function setCd(
  characterId: number,
  cdType: 'defend_injured' | 'attack_injured' | 'attack_node',
  durationSec: number,
  targetNodeId: number | null = null,
  client?: PoolClient
): Promise<void> {
  const pool = getPool()
  const runner = client || pool
  const expires = new Date(Date.now() + durationSec * 1000)
  await runner.query(
    `INSERT INTO spirit_vein_cooldown (character_id, cd_type, target_node_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [characterId, cdType, targetNodeId, expires]
  )
}

export async function getDailyRaidCount(characterId: number): Promise<number> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT count FROM spirit_vein_daily_raid_count
      WHERE character_id = $1 AND raid_date = CURRENT_DATE`,
    [characterId]
  )
  return rows[0]?.count || 0
}

export async function incrDailyRaidCount(characterId: number, client?: PoolClient): Promise<void> {
  const pool = getPool()
  const runner = client || pool
  await runner.query(
    `INSERT INTO spirit_vein_daily_raid_count (character_id, raid_date, count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (character_id, raid_date)
     DO UPDATE SET count = spirit_vein_daily_raid_count.count + 1`,
    [characterId]
  )
}

export async function refreshGuardCount(nodeId: number, client?: PoolClient): Promise<void> {
  const pool = getPool()
  const runner = client || pool
  await runner.query(
    `UPDATE spirit_vein_occupation SET current_guard_count =
      (SELECT COUNT(*)::int FROM spirit_vein_guard WHERE node_id = $1 AND expires_at > NOW())
     WHERE node_id = $1`,
    [nodeId]
  )
}

/**
 * 判断宗门是否处于保护期（保护期 = 等级 ≤ 2 且宗门创建 ≤ 7 天）
 */
export async function isSectProtected(sectId: number): Promise<boolean> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT level, created_at FROM sects WHERE id = $1`,
    [sectId]
  )
  if (rows.length === 0) return false
  const s = rows[0]
  if (s.level > 2) return false
  const daysSinceCreate = (Date.now() - new Date(s.created_at).getTime()) / (24 * 3600 * 1000)
  return daysSinceCreate <= 7
}

/**
 * 根据最近登录时间判断个人分成比例：≤24h=1, ≤72h=0.5, >72h=0
 */
export function guardShareRatio(lastActive: Date | null | string): number {
  if (!lastActive) return 0
  const lastMs = typeof lastActive === 'string' ? new Date(lastActive).getTime() : lastActive.getTime()
  const hoursSince = (Date.now() - lastMs) / (3600 * 1000)
  if (hoursSince <= 24) return 1
  if (hoursSince <= 72) return 0.5
  return 0
}
