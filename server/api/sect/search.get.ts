import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const query = getQuery(event)
    const keyword = (String(query.name || '')).trim()
    if (!keyword) return { code: 400, message: '请输入搜索关键词' }

    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.level, s.member_count, s.announcement, s.join_mode, c.name as leader_name
       FROM sects s JOIN characters c ON s.leader_id = c.id
       WHERE s.name LIKE $1 LIMIT 20`,
      [`%${keyword}%`]
    )

    return { code: 200, data: rows }
  } catch (error) {
    console.error('搜索宗门失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
