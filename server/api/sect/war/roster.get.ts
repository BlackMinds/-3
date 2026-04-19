import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { currentSeasonNo } from '~/server/utils/sectWarOdds'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const membership = await getMembership(char.id)
  if (!membership) return { code: 400, message: '未加入宗门' }
  const pool = getPool()
  const seasonNo = currentSeasonNo()
  const { rows: seasonRows } = await pool.query('SELECT id FROM sect_war_season WHERE season_no = $1', [seasonNo])
  if (seasonRows.length === 0) return { code: 200, message: 'ok', data: null }
  const { rows } = await pool.query(
    `SELECT * FROM sect_war_registration WHERE season_id = $1 AND sect_id = $2`,
    [seasonRows[0].id, membership.sect_id]
  )
  if (rows.length === 0) return { code: 200, message: 'ok', data: null }

  // 丰富角色信息
  const reg = rows[0]
  const allIds = [...reg.roster_duel, ...reg.roster_team_a, ...reg.roster_team_b]
  const { rows: charRows } = await pool.query(
    `SELECT id, name, realm_tier, realm_stage, level FROM characters WHERE id = ANY($1::int[])`,
    [allIds]
  )
  const charMap = Object.fromEntries(charRows.map((c: any) => [c.id, c]))
  return {
    code: 200,
    message: 'ok',
    data: {
      id: reg.id,
      sect_id: reg.sect_id,
      total_power: reg.total_power,
      registered_at: reg.registered_at,
      rosterDuel: reg.roster_duel.map((id: number) => ({ id, ...(charMap[id] || {}) })),
      rosterTeamA: reg.roster_team_a.map((id: number) => ({ id, ...(charMap[id] || {}) })),
      rosterTeamB: reg.roster_team_b.map((id: number) => ({ id, ...(charMap[id] || {}) })),
    },
  }
})
