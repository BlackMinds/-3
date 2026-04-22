import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [event.context.userId])
    if (rows.length === 0) return { code: 400, message: '角色不存在' }
    const char = rows[0]
    if (char.offline_start) return { code: 400, message: '已在离线挂机中' }
    // 快照开始时的地图，防止离线期间切到高阶图白嫖结算（WHERE offline_start IS NULL 保证并发幂等）
    const result = await pool.query(
      'UPDATE characters SET offline_start = NOW(), offline_map = $1 WHERE id = $2 AND offline_start IS NULL',
      [char.current_map || 'qingfeng_valley', char.id]
    )
    if (result.rowCount === 0) return { code: 400, message: '已在离线挂机中' }
    return { code: 200, message: '开始离线挂机', data: { startTime: new Date().toISOString() } }
  } catch (error) {
    console.error('开始离线失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
