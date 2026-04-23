import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'
import { updateSectDailyTask, updateSectWeeklyTaskByCharId } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { equip_id } = await readBody(event)
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id

    const { rows: eqRows } = await pool.query(
      'SELECT * FROM character_equipment WHERE id = $1 AND character_id = $2',
      [equip_id, charId]
    )

    if (eqRows.length === 0) return { code: 400, message: '装备不存在' }

    const eq = eqRows[0]

    const currentLevel = eq.enhance_level || 0

    if (currentLevel >= 10) {
      return { code: 400, message: '已达最大强化等级' }
    }

    // 消耗计算
    const baseCosts: Record<string, number> = {
      white: 50, green: 100, blue: 300, purple: 800, gold: 2000, red: 5000,
    }
    const baseCost = baseCosts[eq.rarity] || 300
    const cost = Math.floor(baseCost * Math.pow(currentLevel + 2, 1.4))

    // 检查灵石
    const { rows: charData } = await pool.query(
      'SELECT spirit_stone FROM characters WHERE id = $1',
      [charId]
    )
    const currentStone = Number(charData[0].spirit_stone)
    if (currentStone < cost) {
      return { code: 400, message: `灵石不足,需要 ${cost}` }
    }

    // T4+ 装备需消耗对应 tier 的强化石（成败都扣，先扣石再扣灵石）
    const eqTier = Number(eq.tier) || 1
    const stoneId = eqTier >= 4 ? `enhance_stone_t${eqTier}` : null
    if (stoneId) {
      const { rowCount: stoneDeducted } = await pool.query(
        `UPDATE character_pills SET count = count - 1
         WHERE character_id = $1 AND pill_id = $2 AND quality_factor = 1.0 AND count > 0`,
        [charId, stoneId]
      )
      if (!stoneDeducted) {
        return { code: 400, message: `缺少【强化石·T${eqTier}】，地图/秘境低概率掉落` }
      }
      await pool.query(
        `DELETE FROM character_pills WHERE character_id = $1 AND pill_id = $2 AND quality_factor = 1.0 AND count <= 0`,
        [charId, stoneId]
      )
    }

    // 扣灵石
    await pool.query(
      'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2',
      [cost, charId]
    )

    // 宗门任务: 强化次数+1
    await updateSectDailyTask(charId, 'enhance', 1)
    await updateSectWeeklyTaskByCharId(charId, 'weekly_enhance', 1)

    // 成功率: +1~+6 必成功, +7起有失败率（与 equipData.ts:getEnhanceSuccessRate 保持同步）
    const nextLevel = currentLevel + 1
    let successRate = 1.0
    if (nextLevel === 7) successRate = 0.75
    else if (nextLevel === 8) successRate = 0.55
    else if (nextLevel === 9) successRate = 0.40
    else if (nextLevel === 10) successRate = 0.25

    // 强化大师符: +7以下强化必成（仅 +7 触发，+6 已默认必成）
    let usedMaster = false
    if (nextLevel === 7 && successRate < 1.0) {
      const { rows: masterRows } = await pool.query(
        "SELECT id, count FROM character_pills WHERE character_id = $1 AND pill_id = 'enhance_guarantee' AND count > 0 LIMIT 1",
        [charId]
      )
      if (masterRows.length > 0) {
        successRate = 1.0
        await pool.query("UPDATE character_pills SET count = count - 1 WHERE id = $1", [masterRows[0].id])
        await pool.query("DELETE FROM character_pills WHERE id = $1 AND count <= 0", [masterRows[0].id])
        usedMaster = true
      }
    }

    const success = Math.random() < successRate

    if (!success) {
      // 强化保护符: 失败不退级
      let usedProtect = false
      const { rows: protectRows } = await pool.query(
        "SELECT id, count FROM character_pills WHERE character_id = $1 AND pill_id = 'enhance_protect' AND count > 0 LIMIT 1",
        [charId]
      )
      if (protectRows.length > 0) {
        await pool.query("UPDATE character_pills SET count = count - 1 WHERE id = $1", [protectRows[0].id])
        await pool.query("DELETE FROM character_pills WHERE id = $1 AND count <= 0", [protectRows[0].id])
        usedProtect = true
      }

      // 失败退一级 (不会低于 +6)，使用保护符则不退级
      const fallLevel = usedProtect ? currentLevel : Math.max(6, currentLevel - 1)
      await pool.query(
        'UPDATE character_equipment SET enhance_level = $1, enhance_ever_failed = TRUE WHERE id = $2',
        [fallLevel, equip_id]
      )

      // 非酋附体：连续失败累计，达到 10 次触发成就；注意：RETURNING 拿到递增后的值
      const { rows: streakRows } = await pool.query(
        'UPDATE characters SET enhance_fail_streak = enhance_fail_streak + 1 WHERE id = $1 RETURNING enhance_fail_streak',
        [charId]
      )
      const newStreak = Number(streakRows[0]?.enhance_fail_streak || 0)
      if (newStreak >= 10) {
        checkAchievements(charId, 'enhance_unlucky', 1).catch(() => {})
      }

      return {
        code: 200,
        data: {
          success: false,
          cost,
          newLevel: fallLevel,
          oldLevel: currentLevel,
          newSpiritStone: currentStone - cost,
          usedProtect,
        },
      }
    }

    // 强化成功: 等级+1；大师符保过也视为"不干净"，欧皇成就不给
    await pool.query(
      'UPDATE character_equipment SET enhance_level = $1, enhance_ever_failed = CASE WHEN $2::boolean THEN TRUE ELSE enhance_ever_failed END WHERE id = $3',
      [nextLevel, usedMaster, equip_id]
    )

    // 连续失败中断归零
    await pool.query('UPDATE characters SET enhance_fail_streak = 0 WHERE id = $1', [charId])

    // 欧皇降临：强化到 +8 成功且本件装备全程未失败/未用符
    if (nextLevel === 8) {
      const { rows: cleanRows } = await pool.query(
        'SELECT enhance_ever_failed FROM character_equipment WHERE id = $1',
        [equip_id]
      )
      if (cleanRows[0] && cleanRows[0].enhance_ever_failed === false) {
        checkAchievements(charId, 'enhance_lucky', 1).catch(() => {})
      }
    }

    // 副属性突破 (+5 和 +10 时)
    let breakthroughStat: string | null = null
    let breakthroughOldVal = 0
    let breakthroughNewVal = 0

    if (nextLevel === 5 || nextLevel === 10) {
      let subStats = eq.sub_stats
      if (typeof subStats === 'string') subStats = JSON.parse(subStats)
      if (Array.isArray(subStats) && subStats.length > 0) {
        const idx = Math.floor(Math.random() * subStats.length)
        breakthroughStat = subStats[idx].stat
        breakthroughOldVal = subStats[idx].value
        // 至少 +1,防止小数值 floor 后不变
        const boosted = Math.floor(subStats[idx].value * 1.3)
        subStats[idx].value = Math.max(boosted, subStats[idx].value + 1)
        breakthroughNewVal = subStats[idx].value
        await pool.query(
          'UPDATE character_equipment SET sub_stats = $1 WHERE id = $2',
          [JSON.stringify(subStats), equip_id]
        )
      }
    }

    // 成就：强化
    checkAchievements(charId, 'enhance_count', 1).catch(() => {})
    checkAchievements(charId, 'enhance_success', 1).catch(() => {})
    checkAchievements(charId, 'enhance_max_level', nextLevel).catch(() => {})

    return {
      code: 200,
      data: {
        success: true,
        cost,
        newLevel: nextLevel,
        newSpiritStone: currentStone - cost,
        usedMaster,
        breakthrough: breakthroughStat ? {
          stat: breakthroughStat,
          oldValue: breakthroughOldVal,
          newValue: breakthroughNewVal,
        } : null,
      },
    }
  } catch (error) {
    console.error('强化失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
