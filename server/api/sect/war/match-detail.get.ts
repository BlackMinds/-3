import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const matchId = Number(query.id)
  if (!Number.isInteger(matchId) || matchId <= 0) return { code: 400, message: 'id 无效' }
  const pool = getPool()
  const { rows: matchRows } = await pool.query(
    `SELECT m.*, sa.name AS sect_a_name, sb.name AS sect_b_name
       FROM sect_war_match m
       JOIN sects sa ON m.sect_a_id = sa.id
       JOIN sects sb ON m.sect_b_id = sb.id
      WHERE m.id = $1`,
    [matchId]
  )
  if (matchRows.length === 0) return { code: 400, message: '对阵不存在' }
  const match = matchRows[0]
  const { rows: battles } = await pool.query(
    `SELECT * FROM sect_war_battle WHERE match_id = $1 ORDER BY round_no ASC`,
    [matchId]
  )
  // 丰富 MVP 名字
  let mvp = null
  if (match.mvp_character_id) {
    const { rows: mvpRows } = await pool.query('SELECT id, name, title FROM characters WHERE id = $1', [match.mvp_character_id])
    mvp = mvpRows[0] || null
  }
  return { code: 200, message: 'ok', data: { match, battles, mvp } }
})
