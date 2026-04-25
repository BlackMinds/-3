import { getPool } from '~/server/database/db'
import { currentSeasonNo, currentStage, currentSeasonStart, currentSeasonEnd } from '~/server/utils/sectWarOdds'
import { generateMatches, runSeasonFights } from '~/server/utils/sectWarEngine'

/**
 * 宗门战周期性任务（压缩节奏 v2）
 * - 周一 00:00: 开赛季（status=registering）
 * - 周一 20:00: 匹配 + 进入 betting
 * - 周二 20:00: 开赛 + 结算（fighting → settled）
 *
 * 通过 GitHub Actions 每小时触发一次，自动判断当前阶段需要做什么
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const pool = getPool()
  const seasonNo = currentSeasonNo()
  const stage = currentStage()
  const start = currentSeasonStart()
  const end = currentSeasonEnd()
  const actions: string[] = []

  // 确保赛季存在
  const { rows: existing } = await pool.query('SELECT * FROM sect_war_season WHERE season_no = $1', [seasonNo])
  let season: any
  if (existing.length === 0) {
    const { rows: created } = await pool.query(
      `INSERT INTO sect_war_season (season_no, start_date, end_date, status)
       VALUES ($1, $2, $3, 'registering') RETURNING *`,
      [seasonNo, start, end]
    )
    season = created[0]
    actions.push(`created season ${seasonNo}`)
  } else {
    season = existing[0]
  }

  // 阶段推进
  if (stage === 'betting' && season.status === 'registering') {
    const res = await generateMatches(season.id)
    actions.push(`generateMatches: ${res.matchesCreated} matches, ${res.byes} byes`)
  }

  if (stage === 'fighting' && (season.status === 'betting' || season.status === 'registering')) {
    const res = await runSeasonFights(season.id)
    actions.push(`runSeasonFights: ${res.processed} matches`)
  }

  if ((stage === 'settled' || stage === 'registering') && season.status === 'fighting') {
    await pool.query(`UPDATE sect_war_season SET status = 'settled' WHERE id = $1`, [season.id])
    actions.push('marked settled')
  }

  return { ok: true, seasonNo, stage, seasonStatus: season.status, actions }
})
