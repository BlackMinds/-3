import { getPool } from '~/server/database/db'
import { updateSectDailyTask, updateSectWeeklyTaskByCharId } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'
import { getPillById } from '~/game/pillData'

const QUALITY_MUL: Record<string, number> = {
  white: 1.00, green: 1.20, blue: 1.50, purple: 2.00, gold: 3.00, red: 5.00,
}

// 火候系统: 指示器位置 0~100 映射到火候档位
type FireTier = 'explode' | 'gentle' | 'strong' | 'true'
function resolveFireTier(pos: number): FireTier {
  if (pos < 10 || pos >= 90) return 'explode'
  if (pos < 30 || pos >= 70) return 'gentle'
  if (pos < 45 || pos >= 55) return 'strong'
  return 'true'
}
const FIRE_MULTIPLIER: Record<FireTier, number> = {
  explode: 1.0,
  gentle: 1.10,
  strong: 1.20,
  true: 1.35,
}
const FIRE_NAME: Record<FireTier, string> = {
  explode: '炸炉', gentle: '文火', strong: '武火', true: '真火',
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const { pill_id, cost, success_rate, herbs_used, fire_position } = await readBody(event)

    const { rows: charRows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }

    const char = charRows[0]

    if (!Array.isArray(herbs_used) || herbs_used.length === 0) {
      return { code: 400, message: '灵草参数错误' }
    }

    // 校验高级丹方是否已解锁
    const recipe = getPillById(pill_id)
    if (recipe?.requireUnlock) {
      const { rows: unlockRows } = await pool.query(
        'SELECT id FROM character_unlocked_recipes WHERE character_id = $1 AND pill_id = $2',
        [char.id, pill_id]
      )
      if (unlockRows.length === 0) {
        return { code: 400, message: '该丹方尚未解锁,请先在宗门商店购买' }
      }
    }

    // 校验灵草是否够
    for (const h of herbs_used) {
      const { rows } = await pool.query(
        'SELECT count FROM character_materials WHERE character_id = $1 AND material_id = $2 AND quality = $3',
        [char.id, h.herb_id, h.quality]
      )
      const have = rows.length > 0 ? rows[0].count : 0
      if (have < h.count) {
        return { code: 400, message: `${h.herb_id}(${h.quality}) 不足,需要 ${h.count}(当前 ${have})` }
      }
    }

    // 计算品质系数
    let totalCount = 0
    let totalWeight = 0
    for (const h of herbs_used) {
      const mul = QUALITY_MUL[h.quality] || 1.0
      totalCount += h.count
      totalWeight += mul * h.count
    }
    const rawFactor = totalCount > 0 ? totalWeight / totalCount : 1.0

    // 火候裁决
    const firePos = typeof fire_position === 'number' ? Math.max(0, Math.min(100, fire_position)) : 50
    const fireTier = resolveFireTier(firePos)
    const fireMul = FIRE_MULTIPLIER[fireTier]
    const qualityFactor = Math.round(rawFactor * fireMul * 100) / 100

    // 灵石消耗按原始品质系数调整(火候不影响灵石消耗)
    const actualCost = Math.floor(cost * rawFactor)

    if (char.spirit_stone < actualCost) {
      return { code: 400, message: `灵石不足,需要 ${actualCost}(品质加成)` }
    }

    // 扣灵石
    await pool.query(
      'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2',
      [actualCost, char.id]
    )

    // 扣灵草(不管成功失败都扣)
    for (const h of herbs_used) {
      await pool.query(
        'UPDATE character_materials SET count = count - $1 WHERE character_id = $2 AND material_id = $3 AND quality = $4',
        [h.count, char.id, h.herb_id, h.quality]
      )
    }

    // 炸炉 → 强制失败
    let success: boolean
    if (fireTier === 'explode') {
      success = false
    } else {
      success = Math.random() < success_rate
    }

    // 真火档有 15% 概率产双份
    let yieldCount = 1
    let trueFireBonus = false
    if (success && fireTier === 'true' && Math.random() < 0.15) {
      yieldCount = 2
      trueFireBonus = true
    }

    if (success) {
      // 添加丹药(同品质系数合并)
      await pool.query(
        `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + $3`,
        [char.id, pill_id, yieldCount, qualityFactor]
      )
    }

    // 宗门任务
    updateSectDailyTask(char.id, 'pill', 1)
    updateSectWeeklyTaskByCharId(char.id, 'weekly_pill', 1)

    // 成就触发
    if (success) {
      checkAchievements(char.id, 'craft_success', 1).catch(() => {})
    } else {
      checkAchievements(char.id, 'craft_fail', 1).catch(() => {})
    }

    return {
      code: 200,
      data: {
        success,
        quality_factor: qualityFactor,
        raw_quality_factor: Math.round(rawFactor * 100) / 100,
        fire_tier: fireTier,
        fire_tier_name: FIRE_NAME[fireTier],
        fire_multiplier: fireMul,
        yield_count: yieldCount,
        true_fire_bonus: trueFireBonus,
        new_spirit_stone: Number(char.spirit_stone) - actualCost,
      },
    }
  } catch (error) {
    console.error('炼丹失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
