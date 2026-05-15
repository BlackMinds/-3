import { getPool } from '~/server/database/db'

// 玩家搜索分页：?q=道号或账号 &page=1 &limit=20
export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q || '').trim()
  const page = Math.max(1, Number(getQuery(event).page) || 1)
  const limit = Math.min(100, Math.max(1, Number(getQuery(event).limit) || 20))
  const offset = (page - 1) * limit

  const pool = getPool()

  let where = ''
  const params: any[] = []
  if (q) {
    params.push(`%${q}%`)
    where = `WHERE c.name ILIKE $1 OR u.username ILIKE $1`
  }

  const countSql = `SELECT COUNT(*)::text AS c FROM characters c JOIN users u ON u.id = c.user_id ${where}`
  const listSql = `
    SELECT
      c.id, c.name, c.level, c.realm_tier, c.realm_stage,
      c.spirit_stone,
      c.last_active_at, c.created_at,
      u.id AS user_id, u.username, u.status AS user_status,
      (
        COALESCE(c.sponsor_expire_at > NOW(), FALSE) OR
        COALESCE(c.oneclick_plant_expire_at > NOW(), FALSE) OR
        COALESCE(c.bonus_plot_expire_at > NOW(), FALSE) OR
        COALESCE(c.sr_bonus_expire_at > NOW(), FALSE) OR
        COALESCE(c.expedition_bonus_expire_at > NOW(), FALSE)
      ) AS has_active_sub
    FROM characters c
    JOIN users u ON u.id = c.user_id
    ${where}
    ORDER BY c.last_active_at DESC NULLS LAST, c.id DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `

  const [countRes, listRes] = await Promise.all([
    pool.query(countSql, params),
    pool.query(listSql, [...params, limit, offset]),
  ])

  return {
    code: 200,
    data: {
      total: Number(countRes.rows[0].c),
      page,
      limit,
      items: listRes.rows,
    },
  }
})
