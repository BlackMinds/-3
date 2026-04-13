import { getPool } from '~/server/database/db'
import { OFFLINE_MAP_DATA } from '~/server/utils/offlineMapData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [event.context.userId])
    if (rows.length === 0) return { code: 200, data: null }
    const char = rows[0]
    if (!char.offline_start) return { code: 200, data: null }

    const startTime = new Date(char.offline_start).getTime()
    const now = Date.now()
    const offlineMin = Math.min((now - startTime) / 60000, 720)
    const mapId = char.current_map || 'qingfeng_valley'
    const mapData = OFFLINE_MAP_DATA[mapId]
    if (!mapData) return { code: 200, data: null }

    const battlesPerMin = 12
    const monstersPerBattle = 3
    const totalBattles = Math.floor(offlineMin * battlesPerMin)
    const totalKills = totalBattles * monstersPerBattle
    const efficiency = 0.70

    return {
      code: 200,
      data: {
        offlineMinutes: Math.floor(offlineMin),
        mapName: mapId,
        totalBattles,
        totalKills,
        expGained: Math.floor(totalKills * mapData.avgExp * efficiency),
        stoneGained: Math.floor(totalKills * mapData.avgStone * efficiency),
        equipCount: Math.min(Math.floor(totalKills * 0.08 * efficiency), 25),
        skillCount: Math.min(Math.floor(totalKills * 0.05 * efficiency), 10),
        herbCount: Math.min(Math.floor(totalKills * 0.10 * efficiency), 20),
        efficiency: Math.round(efficiency * 100),
        startTime: char.offline_start,
      },
    }
  } catch (error) {
    console.error('离线状态查询失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
