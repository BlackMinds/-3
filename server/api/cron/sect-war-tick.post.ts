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
  // 兜底匹配：只要进入 betting 阶段且本届还没有任何对阵，就执行匹配
  // （比单纯依赖 status === 'registering' 更鲁棒，避免被其它接口越权写状态卡死）
  if (stage === 'betting') {
    const { rows: [{ cnt }] } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM sect_war_match WHERE season_id = $1',
      [season.id]
    )
    if (cnt === 0) {
      const res = await generateMatches(season.id)
      actions.push(`generateMatches: ${res.matchesCreated} matches, ${res.byes} byes`)
    }
  }

  if (stage === 'fighting' && (season.status === 'betting' || season.status === 'registering')) {
    const res = await runSeasonFights(season.id)
    actions.push(`runSeasonFights: ${res.processed} matches`)
  }

  if ((stage === 'settled' || stage === 'registering') && season.status === 'fighting') {
    await pool.query(`UPDATE sect_war_season SET status = 'settled' WHERE id = $1`, [season.id])
    actions.push('marked settled')
  }

  // 兜底：错过 fighting 窗口的赛季（cron 没命中 / 失败）
  // - 当届：stage 已经走到 settled 但 status 还没标 settled
  // - 历史届：end_date 已过但 status 仍非 settled
  // runSeasonFights 内部只跑 winner_sect_id IS NULL 的 match，并把 status 标 settled
  const fallbackIds: number[] = []
  if (stage === 'settled' && season.status !== 'settled') {
    fallbackIds.push(season.id)
  }
  const { rows: stale } = await pool.query(
    `SELECT id, season_no FROM sect_war_season
      WHERE status != 'settled' AND end_date <= NOW() AND id != $1`,
    [season.id]
  )
  for (const r of stale) fallbackIds.push(r.id)
  for (const sid of fallbackIds) {
    const res = await runSeasonFights(sid)
    actions.push(`fallback runSeasonFights(season_id=${sid}): ${res.processed} matches`)
  }

  return { ok: true, seasonNo, stage, seasonStatus: season.status, actions }
})
