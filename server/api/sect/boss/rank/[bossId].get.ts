import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const bossId = parseInt(String(getRouterParam(event, 'bossId')))
    const { rows } = await pool.query(
      `SELECT sbd.character_id, sbd.total_damage, sbd.lives_used, c.name, c.level
       FROM sect_boss_damage sbd JOIN characters c ON sbd.character_id = c.id
       WHERE sbd.boss_id = $1 ORDER BY sbd.total_damage DESC`,
      [bossId]
    )
    return { code: 200, data: rows }
  } catch (error) {
    console.error('Boss排名失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
