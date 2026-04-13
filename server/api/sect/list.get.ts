import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.level, s.member_count, s.announcement, s.join_mode, c.name as leader_name
       FROM sects s JOIN characters c ON s.leader_id = c.id
       ORDER BY s.level DESC, s.member_count DESC LIMIT 50`
    )
    return { code: 200, data: rows }
  } catch (error) {
    console.error('宗门列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
