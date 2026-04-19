import { getPool } from '~/server/database/db'
import { currentSeasonNo } from '~/server/utils/sectWarOdds'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const seasonNo = currentSeasonNo()
  const { rows: seasonRows } = await pool.query('SELECT id FROM sect_war_season WHERE season_no = $1', [seasonNo])
  if (seasonRows.length === 0) return { code: 200, message: 'ok', data: [] }
  const seasonId = seasonRows[0].id
  const { rows } = await pool.query(
    `SELECT m.*, sa.name AS sect_a_name, sb.name AS sect_b_name,
            sa.level AS sect_a_level, sb.level AS sect_b_level
       FROM sect_war_match m
       JOIN sects sa ON m.sect_a_id = sa.id
       JOIN sects sb ON m.sect_b_id = sb.id
      WHERE m.season_id = $1
      ORDER BY m.id ASC`,
    [seasonId]
  )
  return { code: 200, message: 'ok', data: rows }
})
