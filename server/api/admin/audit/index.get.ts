import { getPool } from '~/server/database/db'

// 审计日志列表
// ?admin_id=&action=&target_character_id=&page=1&limit=30
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const adminId = Number(q.admin_id) || 0
  const action = String(q.action || '').trim()
  const targetId = Number(q.target_character_id) || 0
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 30))
  const offset = (page - 1) * limit

  const where: string[] = []
  const params: any[] = []
  if (adminId > 0) { params.push(adminId); where.push(`l.admin_id = $${params.length}`) }
  if (action) { params.push(action); where.push(`l.action = $${params.length}`) }
  if (targetId > 0) { params.push(targetId); where.push(`l.target_character_id = $${params.length}`) }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const pool = getPool()
  const [countRes, listRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::text AS c FROM admin_audit_log l ${whereSql}`, params),
    pool.query(
      `SELECT l.id, l.admin_id, l.action, l.target_character_id, l.payload, l.ip, l.created_at,
              a.username AS admin_username,
              c.name AS target_character_name
         FROM admin_audit_log l
         LEFT JOIN admins a ON a.id = l.admin_id
         LEFT JOIN characters c ON c.id = l.target_character_id
         ${whereSql}
         ORDER BY l.created_at DESC
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
