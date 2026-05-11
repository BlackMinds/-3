// 游历状态 - GET /api/expedition/status
// 返回今日剩余次数 / 灵石消耗 / 名册容量

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import {
  getExpeditionStatus,
  ensureExpeditionDailyReset,
  calcRemaining,
  calcExpeditionCost,
  isRosterFull,
} from '~/server/utils/expedition'
import { EXPEDITION_CONFIG } from '~/server/engine/companionData'
import { countUnmarriedCompanions } from '~/server/utils/companion'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    if (char.realm_tier < 3) {
      return { code: 400, message: '境界不足，金丹期方可游历红尘' }
    }

    // 跨日/跨周懒重置
    await ensureExpeditionDailyReset(pool, char.id)

    const status = await getExpeditionStatus(pool, char.id)
    if (!status) return { code: 400, message: '角色状态读取失败' }

    const isFestival = false  // TODO: 节日活动判定（Phase 5 实施）
    const remaining = calcRemaining(status, isFestival)
    const cost = calcExpeditionCost(status.realmTier)
    const rosterCount = await countUnmarriedCompanions(pool, char.id)

    return {
      code: 200,
      data: {
        countToday: status.countToday,
        remaining,
        dailyMax: status.countToday + remaining,
        hardCap: EXPEDITION_CONFIG.hardCap,
        cost,
        spiritStone: status.spiritStone,
        rosterCount,
        rosterMax: EXPEDITION_CONFIG.rosterMaxUnmarried,
        rosterFull: rosterCount >= EXPEDITION_CONFIG.rosterMaxUnmarried,
        weeklyExtraUsed: status.extraWeek,
        weeklyExtraLimit: EXPEDITION_CONFIG.weeklyExtraLimit,
        isFestival,
      },
    }
  } catch (error) {
    console.error('获取游历状态失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
