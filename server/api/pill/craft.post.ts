import { getPool } from '~/server/database/db'
import { updateSectDailyTask, updateSectWeeklyTaskByCharId } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'
import { getPillById } from '~/game/pillData'

const QUALITY_MUL: Record<string, number> = {
  white: 1.00, green: 1.10, blue: 1.25, purple: 1.50, gold: 2.00, red: 3.00,
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
  const pool = getPool()
  const userId = event.context.userId
  const { pill_id, cost, success_rate, herbs_used, fire_position } = await readBody(event)

  if (!Array.isArray(herbs_used) || herbs_used.length === 0) {
    return { code: 400, message: '灵草参数错误' }
  }

  const { rows: charRows } = await pool.query(
    'SELECT id FROM characters WHERE user_id = $1',
    [userId]
  )
  if (charRows.length === 0) return { code: 400, message: '角色不存在' }
  const charId = charRows[0].id

  // 校验高级丹方是否已解锁
  const recipe = getPillById(pill_id)
  if (recipe?.requireUnlock) {
    const { rows: unlockRows } = await pool.query(
      'SELECT id FROM character_unlocked_recipes WHERE character_id = $1 AND pill_id = $2',
      [charId, pill_id]
    )
    if (unlockRows.length === 0) {
      return { code: 400, message: '该丹方尚未解锁,请先在宗门商店购买' }
    }
  }

  // 计算品质系数（纯内存）
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

  // 成功裁决（提前 roll，事务内统一落库）
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

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 条件扣灵石：WHERE spirit_stone >= $1 防止扣负
    const { rowCount: stoneOk } = await client.query(
      'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2 AND spirit_stone >= $1',
      [actualCost, charId]
    )
    if (!stoneOk) {
      await client.query('ROLLBACK')
      return { code: 400, message: `灵石不足,需要 ${actualCost}(品质加成)` }
    }

    // 条件扣灵草：每一味都带 WHERE count >= $1 校验
    for (const h of herbs_used) {
      const { rowCount: herbOk } = await client.query(
        'UPDATE character_materials SET count = count - $1 WHERE character_id = $2 AND material_id = $3 AND quality = $4 AND count >= $1',
        [h.count, charId, h.herb_id, h.quality]
      )
      if (!herbOk) {
        await client.query('ROLLBACK')
        return { code: 400, message: `${h.herb_id}(${h.quality}) 不足` }
      }
    }

    // 成功则添加丹药
    if (success) {
      await client.query(
        `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + $3`,
        [charId, pill_id, yieldCount, qualityFactor]
      )
    }

    // 取更新后的灵石余额（供前端显示）
    const { rows: updated } = await client.query(
      'SELECT spirit_stone FROM characters WHERE id = $1',
      [charId]
    )

    await client.query('COMMIT')

    // 旁路（任务/成就）事务外触发
    await updateSectDailyTask(charId, 'pill', 1)
    await updateSectWeeklyTaskByCharId(charId, 'weekly_pill', 1)
    if (success) {
      checkAchievements(charId, 'craft_success', 1).catch(() => {})
    } else {
      checkAchievements(charId, 'craft_fail', 1).catch(() => {})
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
        new_spirit_stone: Number(updated[0]?.spirit_stone || 0),
      },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('炼丹失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
