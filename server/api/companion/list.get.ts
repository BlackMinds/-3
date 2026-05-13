// 道侣花名册 - GET /api/companion/list
// 返回该角色所有道侣（含未结侣 + 已结侣）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getCompanionsByCharacter } from '~/server/utils/companion'
import { QUALITY_NAMES, QUALITY_COLORS, ROOT_NAMES, getIntimacyStage, INTIMACY_CONFIG } from '~/server/engine/companionData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const companions = await getCompanionsByCharacter(pool, char.id)

    const list = companions.map(c => {
      const stage = getIntimacyStage(c.intimacy)
      const nextThreshold = c.is_official
        ? (c.intimacy < INTIMACY_CONFIG.conceiveThreshold ? INTIMACY_CONFIG.conceiveThreshold : 8000)
        : INTIMACY_CONFIG.marryThreshold
      return {
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
        intimacy: c.intimacy,
        nextThreshold,
        stage: stage.stageName,
        isOfficial: c.is_official,
        sealLevel: c.seal_level,
        encounteredAt: c.encountered_at,
        marriedAt: c.married_at,
      }
    })

    return {
      code: 200,
      data: {
        companions: list,
        divorceCooldownUntil: char.divorce_cooldown || null,
      },
    }
  } catch (error) {
    console.error('获取道侣列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
