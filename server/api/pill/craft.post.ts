import { getPool } from '~/server/database/db'
import { updateSectDailyTask, updateSectWeeklyTaskByCharId } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'

const QUALITY_MUL: Record<string, number> = {
  white: 1.00, green: 1.20, blue: 1.50, purple: 2.00, gold: 3.00, red: 5.00,
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const { pill_id, cost, success_rate, herbs_used } = await readBody(event)

    const { rows: charRows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }

    const char = charRows[0]

    if (!Array.isArray(herbs_used) || herbs_used.length === 0) {
      return { code: 400, message: '灵草参数错误' }
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
    const qualityFactor = totalCount > 0 ? Math.round((totalWeight / totalCount) * 100) / 100 : 1.0

    // 灵石消耗按品质系数调整
    const actualCost = Math.floor(cost * qualityFactor)

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

    // 判断成功
    const success = Math.random() < success_rate

    if (success) {
      // 添加丹药(同品质系数合并)
      await pool.query(
        `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
        [char.id, pill_id, qualityFactor]
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
        new_spirit_stone: Number(char.spirit_stone) - actualCost,
      },
    }
  } catch (error) {
    console.error('炼丹失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
