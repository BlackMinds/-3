// 查询本角色参与过的秘境战斗历史（列表/摘要）
import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getSecretRealm } from '~/server/engine/secretRealmData'

export default defineEventHandler(async (event) => {
  try {
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const q = getQuery(event)
    const limit = Math.min(Math.max(Number(q.limit) || 30, 1), 100)

    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT b.id AS battle_id, b.room_id, b.secret_realm_id, b.difficulty,
              b.result, b.waves_cleared, b.total_turns, b.rating, b.finished_at,
              sc.contribution, sc.damage_dealt, sc.healing_done, sc.damage_taken,
              sr.spirit_stone, sr.exp_gained, sr.realm_points
       FROM secret_realm_contributions sc
       JOIN secret_realm_battles b ON b.id = sc.battle_id
       LEFT JOIN secret_realm_rewards sr ON sr.battle_id = sc.battle_id AND sr.character_id = sc.character_id
       WHERE sc.character_id = $1
       ORDER BY b.id DESC
       LIMIT $2`,
      [char.id, limit]
    )

    const battles = rows.map(r => {
      const realm = getSecretRealm(r.secret_realm_id)
      const diff = realm?.difficulties[r.difficulty as 1 | 2 | 3]
      return {
        battle_id: r.battle_id,
        room_id: r.room_id,
        secret_realm_id: r.secret_realm_id,
        secret_realm_name: realm?.name || r.secret_realm_id,
        difficulty: r.difficulty,
        difficulty_name: diff?.name || '',
        result: r.result,
        waves_cleared: r.waves_cleared,
        total_waves: diff?.waves.length || r.waves_cleared,
        rating: r.rating,
        finished_at: r.finished_at,
        my_contribution: Number(r.contribution),
        my_damage: Number(r.damage_dealt),
        my_healing: Number(r.healing_done),
        my_spirit_stone: r.spirit_stone != null ? Number(r.spirit_stone) : 0,
        my_exp_gained: r.exp_gained != null ? Number(r.exp_gained) : 0,
        my_realm_points: r.realm_points != null ? Number(r.realm_points) : 0,
        no_quota: r.spirit_stone == null, // 带人模式没有奖励记录
      }
    })

    return { code: 200, data: { battles } }
  } catch (e: any) {
    console.error('查询战斗历史失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
