import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { currentSeasonNo, currentStage } from '~/server/utils/sectWarOdds'
import { buildCharacterSnapshot } from '~/server/utils/battleSnapshot'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const membership = await getMembership(char.id)
  if (!membership) return { code: 400, message: '未加入宗门' }
  if (membership.role !== 'leader' && membership.role !== 'vice_leader') {
    return { code: 403, message: '仅宗主/副宗主可提交阵容' }
  }
  const stage = currentStage()
  if (stage !== 'registering') return { code: 400, message: '当前不在报名期（周一 00:00 ~ 周一 20:00）' }

  const body = await readBody(event)
  const duel: number[] = Array.isArray(body?.rosterDuel) ? body.rosterDuel.map(Number) : []
  const teamA: number[] = Array.isArray(body?.rosterTeamA) ? body.rosterTeamA.map(Number) : []
  const teamB: number[] = Array.isArray(body?.rosterTeamB) ? body.rosterTeamB.map(Number) : []

  if (duel.length !== 3) return { code: 400, message: '单挑组必须 3 人' }
  if (teamA.length !== 3 || teamB.length !== 3) return { code: 400, message: '每个团战队必须 3 人' }

  const all = [...duel, ...teamA, ...teamB]
  if (new Set(all).size !== 9) return { code: 400, message: '9 名弟子必须互不相同' }

  const pool = getPool()
  const seasonNo = currentSeasonNo()
  const { rows: seasonRows } = await pool.query('SELECT * FROM sect_war_season WHERE season_no = $1', [seasonNo])
  if (seasonRows.length === 0) return { code: 400, message: '赛季尚未创建，请先拉取 season 接口' }
  const season = seasonRows[0]

  // 校验每个弟子：在本宗门 + 境界 ≥ 筑基 (realm_tier >= 2) + 职位 >= 内门弟子
  const { rows: memberRows } = await pool.query(
    `SELECT c.id, c.realm_tier, c.name, sm.role
       FROM characters c
       JOIN sect_members sm ON sm.character_id = c.id
      WHERE c.id = ANY($1::int[]) AND sm.sect_id = $2`,
    [all, membership.sect_id]
  )
  if (memberRows.length !== 9) return { code: 400, message: '存在非本宗门成员或角色不存在' }
  for (const m of memberRows) {
    if (m.realm_tier < 2) return { code: 400, message: `${m.name} 境界低于筑基，不可参战` }
    if (!['leader', 'vice_leader', 'elder', 'inner'].includes(m.role)) {
      return { code: 400, message: `${m.name} 职位过低（需内门弟子及以上）` }
    }
  }

  // 计算 9 人总战力
  let totalPower = 0
  for (const cid of all) {
    const snap = await buildCharacterSnapshot(cid, { forbidPills: true, includeTimedBuffs: false })
    if (snap) totalPower += snap.powerScore
  }

  await pool.query(
    `INSERT INTO sect_war_registration
      (season_id, sect_id, roster_duel, roster_team_a, roster_team_b, total_power)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6)
     ON CONFLICT (season_id, sect_id)
     DO UPDATE SET roster_duel = EXCLUDED.roster_duel,
                   roster_team_a = EXCLUDED.roster_team_a,
                   roster_team_b = EXCLUDED.roster_team_b,
                   total_power = EXCLUDED.total_power,
                   registered_at = NOW()`,
    [season.id, membership.sect_id, JSON.stringify(duel), JSON.stringify(teamA), JSON.stringify(teamB), totalPower]
  )

  return { code: 200, message: '阵容已提交', data: { totalPower } }
})
