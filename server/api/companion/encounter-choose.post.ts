// 邂逅事件 4 选项处理 - POST /api/companion/encounter-choose
// 玩家在游历产出邂逅道侣后，选择 A 上前搭话 / B 远观致意 / C 拂袖离去 / D 战斗试探

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { insertCompanion, countUnmarriedCompanions } from '~/server/utils/companion'
import { EXPEDITION_CONFIG } from '~/server/engine/companionData'
import type { PendingEncounter } from '~/server/utils/companion'

interface ChooseRequest {
  pending: PendingEncounter
  choice: 'A' | 'B' | 'C' | 'D'
  battle_won?: boolean   // D 选项时由前端传回（D 触发的表演战胜负）
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event) as ChooseRequest
    const { pending, choice, battle_won } = body

    if (!pending || !['A', 'B', 'C', 'D'].includes(choice)) {
      return { code: 400, message: '参数错误' }
    }

    // 服务端校验邂逅数据合法性（防客户端伪造品质/灵根）
    if (!pending.name || typeof pending.name !== 'string' || pending.name.length < 2 || pending.name.length > 8) {
      return { code: 400, message: '邂逅数据异常（name）' }
    }
    if (!Number.isInteger(pending.quality) || pending.quality < 1 || pending.quality > 5) {
      return { code: 400, message: '邂逅数据异常（quality）' }
    }
    const VALID_ROOTS = ['metal', 'wood', 'water', 'fire', 'earth', 'mixed']
    if (!VALID_ROOTS.includes(pending.spiritual_root)) {
      return { code: 400, message: '邂逅数据异常（spiritual_root）' }
    }
    const VALID_PERSONALITIES = ['gentle', 'bold', 'cold', 'mystic', 'fiery']
    if (!VALID_PERSONALITIES.includes(pending.personality)) {
      return { code: 400, message: '邂逅数据异常（personality）' }
    }
    if (!Number.isInteger(pending.avatar_id) || pending.avatar_id < 1 || pending.avatar_id > 999) {
      return { code: 400, message: '邂逅数据异常（avatar_id）' }
    }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    // 名册满检查（双重保护）
    const rosterCount = await countUnmarriedCompanions(pool, char.id)
    if (rosterCount >= EXPEDITION_CONFIG.rosterMaxUnmarried && choice !== 'C') {
      return { code: 400, message: '红颜花名册已满，请先婉拒一位' }
    }

    let initialIntimacy = 0
    let recorded = false

    switch (choice) {
      case 'A':
        initialIntimacy = 5
        recorded = true
        break
      case 'B':
        initialIntimacy = 2
        recorded = true
        break
      case 'C':
        // 拂袖离去 - 不录入名册
        return {
          code: 200,
          data: {
            accepted: false,
            message: '你拂袖而去，与这段缘分擦肩而过',
          },
        }
      case 'D':
        // 战斗试探 - 胜利则录入并 +10
        if (battle_won) {
          initialIntimacy = 10
          recorded = true
        } else {
          return {
            code: 200,
            data: {
              accepted: false,
              message: '战斗失利，对方拂袖而去',
            },
          }
        }
        break
    }

    if (!recorded) {
      return { code: 200, data: { accepted: false, message: '未录入名册' } }
    }

    const companion = await insertCompanion(pool, char.id, pending, initialIntimacy)

    // 道侣成就触发（design 10.10）
    const { checkAchievements } = await import('~/server/engine/achievementData')
    checkAchievements(char.id, 'companion_encounter', 1).catch(() => {})
    if (companion.quality === 5) {
      checkAchievements(char.id, 'companion_immortal', 1).catch(() => {})
    }
    // 同时拥有的红颜总数（含已结侣 + 未结侣）
    const { rows: totalRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM companions WHERE character_id = $1', [char.id])
    checkAchievements(char.id, 'companion_total', totalRows[0]?.cnt || 0).catch(() => {})

    return {
      code: 200,
      data: {
        accepted: true,
        companion: {
          id: companion.id,
          name: companion.name,
          quality: companion.quality,
          spiritualRoot: companion.spiritual_root,
          personality: companion.personality,
          avatarId: companion.avatar_id,
          intimacy: companion.intimacy,
        },
        message: `「${companion.name}」录入红颜花名册`,
      },
    }
  } catch (error) {
    console.error('邂逅选择处理失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
