import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'
import { currentSeasonNo } from '~/server/utils/sectWarOdds'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const pool = getPool()
  const seasonNo = currentSeasonNo()
  const { rows: seasonRows } = await pool.query('SELECT id FROM sect_war_season WHERE season_no = $1', [seasonNo])
  if (seasonRows.length === 0) return { code: 200, message: 'ok', data: [] }
  const { rows } = await pool.query(
    `SELECT b.*, m.sect_a_id, m.sect_b_id, m.winner_sect_id, m.score_a, m.score_b,
            sa.name AS sect_a_name, sb.name AS sect_b_name
       FROM sect_war_bet b
       JOIN sect_war_match m ON b.match_id = m.id
       JOIN sects sa ON m.sect_a_id = sa.id
       JOIN sects sb ON m.sect_b_id = sb.id
      WHERE b.character_id = $1 AND m.season_id = $2
      ORDER BY b.placed_at DESC`,
    [char.id, seasonRows[0].id]
  )
  return { code: 200, message: 'ok', data: rows }
})
