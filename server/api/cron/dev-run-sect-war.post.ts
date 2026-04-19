import { getPool } from '~/server/database/db'
import { generateMatches, runSeasonFights } from '~/server/utils/sectWarEngine'
import { currentSeasonNo, currentSeasonStart, currentSeasonEnd } from '~/server/utils/sectWarOdds'

/**
 * DEV ONLY — 强制完整跑一届宗门战（绕过时间窗口）
 * 仅供测试使用。用法：
 *   POST /api/cron/dev-run-sect-war  Header: Authorization: Bearer $CRON_SECRET
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const pool = getPool()
  const seasonNo = currentSeasonNo()
  const { rows: existing } = await pool.query('SELECT * FROM sect_war_season WHERE season_no = $1', [seasonNo])
  let season: any
  if (existing.length === 0) {
    const { rows: created } = await pool.query(
      `INSERT INTO sect_war_season (season_no, start_date, end_date, status)
       VALUES ($1, $2, $3, 'registering') RETURNING *`,
      [seasonNo, currentSeasonStart(), currentSeasonEnd()]
    )
    season = created[0]
  } else {
    season = existing[0]
  }

  const actions: any[] = []

  // Step 1: 匹配 (强制，不判时间)
  if (season.status === 'registering') {
    const res = await generateMatches(season.id)
    actions.push({ step: 'generateMatches', ...res })
  }

  // Step 2: 开赛 + 结算
  const res2 = await runSeasonFights(season.id)
  actions.push({ step: 'runSeasonFights', ...res2 })

  return { ok: true, seasonNo, actions }
})
