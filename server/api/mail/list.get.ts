import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const query = getQuery(event)
  const category = (query.category as string) || null
  const page = Math.max(1, parseInt((query.page as string) || '1', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt((query.pageSize as string) || '20', 10)))
  const offset = (page - 1) * pageSize

  const pool = getPool()
  const whereParams: any[] = [char.id]
  let where = 'character_id = $1 AND expires_at > NOW()'
  if (category) {
    whereParams.push(category)
    where += ` AND category = $${whereParams.length}`
  }

  const listParams = [...whereParams, pageSize, offset]
  const { rows } = await pool.query(
    `SELECT id, category, title, content, attachments, ref_type, ref_id,
            is_read, is_claimed, expires_at, created_at, read_at, claimed_at
       FROM mails WHERE ${where}
       ORDER BY is_read ASC, created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  )
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM mails WHERE ${where}`,
    whereParams
  )
  return {
    code: 200,
    message: 'ok',
    data: { list: rows, total: countRows[0]?.total || 0, page, pageSize },
  }
})
