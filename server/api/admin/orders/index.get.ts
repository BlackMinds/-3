import { getPool } from '~/server/database/db'

// 订单列表：?status=&character_id=&page=1&limit=20
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const status = String(q.status || '').trim()
  const characterId = Number(q.character_id) || 0
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20))
  const offset = (page - 1) * limit

  const where: string[] = []
  const params: any[] = []
  if (status) { params.push(status); where.push(`o.status = $${params.length}`) }
  if (characterId > 0) { params.push(characterId); where.push(`o.character_id = $${params.length}`) }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const pool = getPool()
  const [countRes, listRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::text AS c FROM recharge_orders o ${whereSql}`, params),
    pool.query(
      `SELECT
         o.id, o.order_no, o.character_id, o.package_id, o.price_rmb, o.status,
         o.pay_channel, o.paid_at, o.delivered_at, o.notes, o.created_at,
         o.package_snapshot,
         p.name AS package_name, p.code AS package_code,
         c.name AS character_name,
         a.username AS delivered_by_username
       FROM recharge_orders o
       JOIN recharge_packages p ON p.id = o.package_id
       JOIN characters c ON c.id = o.character_id
       LEFT JOIN admins a ON a.id = o.delivered_by
       ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
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
