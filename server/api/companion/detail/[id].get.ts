// 道侣详情 - GET /api/companion/detail/:id

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getCompanionById, getTodayGiftIntimacyTotal } from '~/server/utils/companion'
import {
  QUALITY_NAMES, QUALITY_COLORS, ROOT_NAMES,
  getIntimacyStage, INTIMACY_STAGES, INTIMACY_CONFIG,
  QUALITY_TRAITS,
} from '~/server/engine/companionData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const id = Number(event.context.params?.id)
    if (!id) return { code: 400, message: '参数错误' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getCompanionById(pool, id, char.id)
    if (!c) return { code: 404, message: '道侣不存在' }

    const stage = getIntimacyStage(c.intimacy)
    const traits = QUALITY_TRAITS[c.quality as 0|1|2|3|4|5]
    const todayGiftIntimacy = await getTodayGiftIntimacyTotal(pool, c.id)
    const dailyRemaining = Math.max(0, INTIMACY_CONFIG.dailyGiftLimit - todayGiftIntimacy)

    return {
      code: 200,
      data: {
        id: c.id,
        name: c.name,
        quality: c.quality,
        qualityName: QUALITY_NAMES[c.quality],
        qualityColor: QUALITY_COLORS[c.quality],
        spiritualRoot: c.spiritual_root,
        rootName: ROOT_NAMES[c.spiritual_root as keyof typeof ROOT_NAMES] || '',
        personality: c.personality,
        avatarId: c.avatar_id,
        customAvatarUrl: c.custom_avatar_url,
        backgroundStory: c.background_story,
        preferredGifts: c.preferred_gifts,
        dislikedGifts: c.disliked_gifts,
        intimacy: c.intimacy,
        isOfficial: c.is_official,
        sealLevel: c.seal_level,
        pregnantUntil: c.pregnant_until,
        pregnantCount: c.pregnant_count,
        encounteredAt: c.encountered_at,
        marriedAt: c.married_at,
        stage: stage.stageName,
        unlockedStages: INTIMACY_STAGES.map(s => ({
          threshold: s.threshold,
          name: s.stageName,
          description: s.description,
          unlocked: c.intimacy >= s.threshold,
        })),
        traits: {
          baseStatPct: traits.baseStatPct,
          cultBonusMaxPct: traits.cultBonusMaxPct,
          childAptitudeCap: traits.childAptitudeCap,
          twinChance: traits.twinChance,
          tripletChance: traits.tripletChance,
        },
        todayGiftIntimacyGained: todayGiftIntimacy,
        dailyGiftRemaining: dailyRemaining,
      },
    }
  } catch (error) {
    console.error('获取道侣详情失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
