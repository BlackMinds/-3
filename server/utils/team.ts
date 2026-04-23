// 秘境组队辅助函数

import { getPool } from '~/server/database/db'
import { getSecretRealm, getDailyCountByRealm } from '~/server/engine/secretRealmData'

/** 获取角色（按 user_id） */
export async function getCharacterByUserId(userId: number): Promise<any | null> {
  const pool = getPool()
  const { rows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [userId])
  return rows[0] || null
}

/**
 * 秘境每日上限 = 境界基础上限 + 未过期的 sr_daily_bonus（赞助加成）
 */
export function getSrDailyMax(char: any): number {
  const base = getDailyCountByRealm(char?.realm_tier || 1)
  const bonus = Number(char?.sr_daily_bonus || 0)
  if (bonus <= 0) return base
  const expire = char?.sr_bonus_expire_at
  if (expire && new Date(expire).getTime() < Date.now()) return base
  return base + bonus
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

/**
 * 校验玩家是否可进入某秘境
 * @param opts.skipDailyCount 为 true 时不校验每日次数（供"带人"模式使用 — 队员无次数可进，
 *                            但战斗结算时会被标记 no_quota 不发奖励、不扣次数）
 */
export function validateRealmEntry(
  char: any,
  realmId: string,
  opts: { skipDailyCount?: boolean } = {},
): { ok: boolean; message?: string } {
  const realm = getSecretRealm(realmId)
  if (!realm) return { ok: false, message: '秘境不存在' }
  if ((char.realm_tier || 1) < realm.reqRealmTier) return { ok: false, message: `需要境界：${realmNames[realm.reqRealmTier]}` }
  if ((char.level || 1) < realm.reqLevel) return { ok: false, message: `需要等级：Lv.${realm.reqLevel}` }
  if (char.offline_start) return { ok: false, message: '离线挂机中，无法进入' }
  if (!opts.skipDailyCount) {
    const max = getSrDailyMax(char)
    if ((char.sr_daily_count || 0) >= max) return { ok: false, message: '今日次数已用完' }
  }
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

/**
 * 聚合单场秘境战斗详情 — 给"历史日志 / 队员回放"用
 * 注意：team_buffs 和 awaken_items 未持久化，回放场景下会缺失（is_replay: true 时前端不展示）
 */
export async function fetchBattleDetail(battleId: number): Promise<any | null> {
  const pool = getPool()
  const { rows: bRows } = await pool.query(
    `SELECT id, room_id, secret_realm_id, difficulty, result, waves_cleared, total_turns, rating, battle_log, finished_at
     FROM secret_realm_battles WHERE id = $1`,
    [battleId]
  )
  if (bRows.length === 0) return null
  const b = bRows[0]

  const { rows: contribRows } = await pool.query(
    `SELECT sc.character_id, sc.damage_dealt, sc.healing_done, sc.damage_taken, sc.contribution,
            c.name
     FROM secret_realm_contributions sc
     JOIN characters c ON c.id = sc.character_id
     WHERE sc.battle_id = $1
     ORDER BY sc.contribution DESC`,
    [battleId]
  )

  const { rows: rewardRows } = await pool.query(
    `SELECT character_id, spirit_stone, exp_gained, level_exp, realm_points, equipment_ids, extra_drops
     FROM secret_realm_rewards WHERE battle_id = $1`,
    [battleId]
  )
  const rewardMap = new Map<number, any>()
  for (const r of rewardRows) rewardMap.set(r.character_id, r)

  // 收集所有 equipment_ids，一次性 join character_equipment（可能已处理 / 强化）
  const allEquipIds: number[] = []
  for (const r of rewardRows) {
    const ids = Array.isArray(r.equipment_ids) ? r.equipment_ids : []
    for (const id of ids) if (typeof id === 'number') allEquipIds.push(id)
  }
  const equipMap = new Map<number, any>()
  if (allEquipIds.length > 0) {
    const { rows: eqRows } = await pool.query(
      `SELECT id, name, rarity, tier, base_slot FROM character_equipment WHERE id = ANY($1::int[])`,
      [allEquipIds]
    )
    for (const e of eqRows) equipMap.set(e.id, e)
  }

  const rewards = contribRows.map(c => {
    const rwd = rewardMap.get(c.character_id)
    const equipIds: number[] = rwd && Array.isArray(rwd.equipment_ids) ? rwd.equipment_ids : []
    const extra = rwd?.extra_drops || {}
    // 装备：命中则展示详情，未命中则返回占位（说明已处理）
    const equipments = equipIds.map(id => {
      const e = equipMap.get(id)
      if (e) return { id: e.id, name: e.name, rarity: e.rarity, tier: e.tier, base_slot: e.base_slot }
      return { id, name: '[已处理装备]', rarity: 'normal', tier: 0, base_slot: '' }
    })
    return {
      character_id: c.character_id,
      name: c.name,
      contribution: Number(c.contribution),
      damage_dealt: Number(c.damage_dealt),
      healing_done: Number(c.healing_done),
      damage_taken: Number(c.damage_taken),
      spirit_stone: rwd ? Number(rwd.spirit_stone) : 0,
      exp_gained: rwd ? Number(rwd.exp_gained) : 0,
      realm_points: rwd ? Number(rwd.realm_points) : 0,
      equipments,
      herbs: Array.isArray(extra.herbs) ? extra.herbs : [],
      skill_pages: Array.isArray(extra.skill_pages) ? extra.skill_pages : [],
      awaken_items: { awaken_stone: 0, awaken_reroll: 0 }, // 未持久化
      no_quota: !rwd, // 没有奖励记录 = 当时带人模式
    }
  })

  const realm = getSecretRealm(b.secret_realm_id)
  const diffCfg = realm?.difficulties[b.difficulty as 1 | 2 | 3]

  return {
    battle_id: b.id,
    room_id: b.room_id,
    secret_realm_id: b.secret_realm_id,
    secret_realm_name: realm?.name || b.secret_realm_id,
    difficulty: b.difficulty,
    difficulty_name: diffCfg?.name || '',
    result: b.result,
    waves_cleared: b.waves_cleared,
    total_waves: diffCfg?.waves.length || b.waves_cleared,
    total_turns: b.total_turns,
    rating: b.rating,
    finished_at: b.finished_at,
    logs: Array.isArray(b.battle_log) ? b.battle_log : [],
    team_buffs: [], // 未持久化
    rewards,
    is_replay: true,
  }
}

/**
 * 判断角色是否参与过某场战斗（用于鉴权）
 */
export async function isCharacterInBattle(charId: number, battleId: number): Promise<boolean> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT 1 FROM secret_realm_contributions WHERE battle_id = $1 AND character_id = $2 LIMIT 1',
    [battleId, charId]
  )
  return rows.length > 0
}
