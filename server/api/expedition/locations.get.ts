// 游历地点列表 - GET /api/expedition/locations
// 按当前境界过滤可用地点

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { listAvailableLocations } from '~/server/utils/expedition'
import { EXPEDITION_LOCATIONS } from '~/server/engine/companionData'

export default defineEventHandler(async (event) => {
  try {
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    if (char.realm_tier < 3) {
      return { code: 400, message: '境界不足，金丹期方可游历红尘' }
    }

    const eligible = listAvailableLocations(char.realm_tier)
    const eligibleIds = new Set(eligible.map(l => l.id))

    // 返回所有地点 + 标记是否可用
    const all = EXPEDITION_LOCATIONS.map(loc => ({
      ...loc,
      eligible: eligibleIds.has(loc.id),
    }))

    return { code: 200, data: { locations: all } }
  } catch (error) {
    console.error('获取游历地点失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
