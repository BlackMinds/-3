import { getPool } from '~/server/database/db'
import { currentSeasonNo, currentStage, currentSeasonStart, currentSeasonEnd } from '~/server/utils/sectWarOdds'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const seasonNo = currentSeasonNo()
  const stage = currentStage()
  const start = currentSeasonStart()
  const end = currentSeasonEnd()

  // 确保当前赛季 row 存在（status 推进由 cron 负责，此处不写）
  let season: any
  const { rows } = await pool.query('SELECT * FROM sect_war_season WHERE season_no = $1', [seasonNo])
  if (rows.length === 0) {
    const { rows: created } = await pool.query(
      `INSERT INTO sect_war_season (season_no, start_date, end_date, status)
       VALUES ($1, $2, $3, 'registering')
       ON CONFLICT (season_no) DO NOTHING RETURNING *`,
      [seasonNo, start, end]
    )
    if (created.length > 0) {
      season = created[0]
    } else {
      const { rows: refetch } = await pool.query('SELECT * FROM sect_war_season WHERE season_no = $1', [seasonNo])
      season = refetch[0]
    }
  } else {
    season = rows[0]
  }

  // 报名数 / 对阵数
  const { rows: [{ reg_count }] } = await pool.query(
    `SELECT COUNT(*)::int AS reg_count FROM sect_war_registration WHERE season_id = $1`,
    [season.id]
  )
  const { rows: [{ match_count }] } = await pool.query(
    `SELECT COUNT(*)::int AS match_count FROM sect_war_match WHERE season_id = $1`,
    [season.id]
  )

  return {
    code: 200,
    message: 'ok',
    data: {
      seasonNo,
      stage,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      registrationCount: reg_count,
      matchCount: match_count,
    },
  }
})
