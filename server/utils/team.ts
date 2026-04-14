// 秘境组队辅助函数

import { getPool } from '~/server/database/db'
import { getSecretRealm, getDailyCountByRealm } from '~/server/engine/secretRealmData'

/** 获取角色（按 user_id） */
export async function getCharacterByUserId(userId: number): Promise<any | null> {
  const pool = getPool()
  const { rows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [userId])
  return rows[0] || null
}

/** 重置每日次数（如果跨天） */
export async function ensureDailyReset(charId: number, char: any): Promise<any> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const storedDate = char.sr_daily_date
    ? new Date(char.sr_daily_date).toISOString().slice(0, 10)
    : null
  if (storedDate !== today) {
    const pool = getPool()
    await pool.query(
      'UPDATE characters SET sr_daily_count = 0, sr_daily_date = $1 WHERE id = $2',
      [today, charId]
    )
    char.sr_daily_count = 0
    char.sr_daily_date = today
  }
  return char
}

/** 校验玩家是否可进入某秘境 */
export function validateRealmEntry(char: any, realmId: string): { ok: boolean; message?: string } {
  const realm = getSecretRealm(realmId)
  if (!realm) return { ok: false, message: '秘境不存在' }
  if ((char.realm_tier || 1) < realm.reqRealmTier) return { ok: false, message: `需要境界：${realmNames[realm.reqRealmTier]}` }
  if ((char.level || 1) < realm.reqLevel) return { ok: false, message: `需要等级：Lv.${realm.reqLevel}` }
  if (char.offline_start) return { ok: false, message: '离线挂机中，无法进入' }
  const max = getDailyCountByRealm(char.realm_tier || 1)
  if ((char.sr_daily_count || 0) >= max) return { ok: false, message: '今日次数已用完' }
  return { ok: true }
}

const realmNames: Record<number, string> = {
  1: '练气', 2: '筑基', 3: '金丹', 4: '元婴',
  5: '化神', 6: '渡劫', 7: '大乘', 8: '飞升',
}

/** 查询玩家当前所在房间 */
export async function getPlayerCurrentRoomId(charId: number): Promise<number | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT tm.room_id FROM team_members tm
     JOIN team_rooms tr ON tm.room_id = tr.id
     WHERE tm.character_id = $1 AND tr.status IN ('waiting', 'fighting')
     LIMIT 1`,
    [charId]
  )
  return rows[0]?.room_id || null
}

/** 获取房间完整信息（含成员列表） */
export async function getRoomDetail(roomId: number): Promise<any | null> {
  const pool = getPool()
  const { rows: roomRows } = await pool.query('SELECT * FROM team_rooms WHERE id = $1', [roomId])
  if (roomRows.length === 0) return null
  const room = roomRows[0]
  const { rows: memberRows } = await pool.query(
    `SELECT tm.*, c.name, c.realm_tier, c.realm_stage, c.level, c.spiritual_root,
            c.sect_id, s.name AS sect_name
     FROM team_members tm
     JOIN characters c ON tm.character_id = c.id
     LEFT JOIN sects s ON c.sect_id = s.id
     WHERE tm.room_id = $1
     ORDER BY tm.is_leader DESC, tm.join_time ASC`,
    [roomId]
  )
  const realm = getSecretRealm(room.secret_realm_id)
  return {
    room_id: room.id,
    secret_realm_id: room.secret_realm_id,
    secret_realm_name: realm?.name || room.secret_realm_id,
    difficulty: room.difficulty,
    difficulty_name: realm?.difficulties[room.difficulty as 1 | 2 | 3]?.name || '',
    status: room.status,
    max_members: room.max_members,
    current_members: room.current_members,
    created_at: room.created_at,
    members: memberRows.map(m => ({
      character_id: m.character_id,
      name: m.name,
      realm_tier: m.realm_tier,
      realm_stage: m.realm_stage,
      level: m.level,
      spiritual_root: m.spiritual_root,
      sect_id: m.sect_id,
      sect_name: m.sect_name,
      is_leader: m.is_leader,
      is_ready: m.is_ready,
    })),
  }
}
