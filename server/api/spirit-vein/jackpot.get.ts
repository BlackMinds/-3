import { getPool } from '~/server/database/db'

export default defineEventHandler(async () => {
  const pool = getPool()

  // 本周
  const { rows: current } = await pool.query(
    `SELECT * FROM spirit_vein_jackpot
      WHERE week_start = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int - 1 + 7) % 7)`
  )

  // 上周结算结果（简化版 — 实际排行等周日结算后写入 extra JSONB，这里仅返回最近 4 周的奖池历史）
  const { rows: history } = await pool.query(
    `SELECT * FROM spirit_vein_jackpot ORDER BY week_start DESC LIMIT 8`
  )

  // 当周综合贡献 TOP
  const { rows: topSects } = await pool.query(
    `SELECT sl.sect_id, s.name AS sect_name, COUNT(*)::int AS surge_count,
            (SELECT COUNT(*)::int FROM spirit_vein_occupation o WHERE o.sect_id = sl.sect_id) AS occupy_count
       FROM spirit_vein_surge_log sl JOIN sects s ON sl.sect_id = s.id
      WHERE sl.surge_at >= CURRENT_DATE - INTERVAL '7 days' AND sl.sect_id IS NOT NULL
      GROUP BY sl.sect_id, s.name
      ORDER BY surge_count DESC LIMIT 10`
  )

  return {
    code: 200,
    message: 'ok',
    data: {
      current: current[0] || null,
      history,
      topSects,
    },
  }
})
