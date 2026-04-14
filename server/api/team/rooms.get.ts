// 获取组队大厅房间列表
import { getPool } from '~/server/database/db'
import { getSecretRealm } from '~/server/engine/secretRealmData'
import { getCharacterByUserId } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const query = getQuery(event)
    const secretRealmId = query.secret_realm_id as string | undefined
    const difficulty = query.difficulty ? Number(query.difficulty) : undefined
    const onlyAvailable = query.only_available === 'true' || query.only_available === '1'

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    // 构建查询
    const conditions: string[] = [`tr.status = 'waiting'`]
    const params: any[] = []
    let pi = 1
    if (secretRealmId) {
      conditions.push(`tr.secret_realm_id = $${pi++}`)
      params.push(secretRealmId)
    }
    if (difficulty) {
      conditions.push(`tr.difficulty = $${pi++}`)
      params.push(difficulty)
    }
    if (onlyAvailable) {
      conditions.push(`tr.current_members < tr.max_members`)
    }

    const sql = `
      SELECT tr.id, tr.secret_realm_id, tr.difficulty, tr.status,
             tr.max_members, tr.current_members, tr.created_at,
             c.id AS leader_char_id, c.name AS leader_name,
             c.realm_tier AS leader_realm_tier, c.realm_stage AS leader_realm_stage,
             c.level AS leader_level, c.sect_id AS leader_sect_id,
             s.name AS leader_sect_name
      FROM team_rooms tr
      JOIN characters c ON tr.leader_id = c.id
      LEFT JOIN sects s ON c.sect_id = s.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY tr.created_at DESC
      LIMIT 50
    `
    const { rows } = await pool.query(sql, params)

    const rooms = rows.map(r => {
      const realm = getSecretRealm(r.secret_realm_id)
      const isSameSect = !!char.sect_id && r.leader_sect_id === char.sect_id
      const isEligible = realm
        ? (char.realm_tier || 1) >= realm.reqRealmTier && (char.level || 1) >= realm.reqLevel
        : false
      return {
        room_id: r.id,
        secret_realm_id: r.secret_realm_id,
        secret_realm_name: realm?.name || r.secret_realm_id,
        difficulty: r.difficulty,
        difficulty_name: realm?.difficulties[r.difficulty as 1 | 2 | 3]?.name || '',
        current_members: r.current_members,
        max_members: r.max_members,
        created_at: r.created_at,
        leader: {
          id: r.leader_char_id,
          name: r.leader_name,
          realm_tier: r.leader_realm_tier,
          realm_stage: r.leader_realm_stage,
          level: r.leader_level,
          sect_id: r.leader_sect_id,
          sect_name: r.leader_sect_name,
        },
        is_same_sect: isSameSect,
        is_eligible: isEligible,
      }
    })

    // 排序：同宗门置顶 → 创建时间倒序
    rooms.sort((a, b) => {
      if (a.is_same_sect !== b.is_same_sect) return a.is_same_sect ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return { code: 200, data: { rooms } }
  } catch (e: any) {
    console.error('获取房间列表失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
