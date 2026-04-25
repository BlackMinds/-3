import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [event.context.userId])
    if (rows.length === 0) return { code: 200, data: null }
    const char = rows[0]
    if (!char.offline_start) return { code: 200, data: null }

    const startTime = new Date(char.offline_start).getTime()
    const now = Date.now()
    const MAX_OFFLINE_MIN = 600 // 上限 10 小时（与 offline-claim 保持一致）
    const MIN_OFFLINE_MIN = 10  // 至少 10 分钟才能领取
    const offlineMin = Math.min((now - startTime) / 60000, MAX_OFFLINE_MIN)
    const mapId = char.offline_map || char.current_map || 'qingfeng_valley'
    const efficiency = 1.0 // 与 offline-claim.post.ts 保持一致：100%

    return {
      code: 200,
      data: {
        offlineMinutes: Math.floor(offlineMin),
        mapName: mapId,
        efficiency: Math.round(efficiency * 100),
        maxHours: MAX_OFFLINE_MIN / 60,
        minMinutes: MIN_OFFLINE_MIN,
        canClaim: offlineMin >= MIN_OFFLINE_MIN,
        startTime: char.offline_start,
      },
    }
  } catch (error) {
    console.error('离线状态查询失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
