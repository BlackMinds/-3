// 启动游历 - POST /api/expedition/start
// 玩家主动调用，触发产出滚卡（6 类产出之一）
// 是道侣邂逅的"唯一触发入口"（设计文档 v1.9）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import {
  getExpeditionStatus,
  ensureExpeditionDailyReset,
  calcRemaining,
  calcExpeditionCost,
  rollExpedition,
  isRosterFull,
  type ExpeditionOutcome,
} from '~/server/utils/expedition'
import { EXPEDITION_LOCATIONS } from '~/server/engine/companionData'

interface PendingEncounterDb {
  id: number
  character_id: number
  script_id: string
  quality: number
  spiritual_root: string
  personality: string
  avatar_id: string
  generated_name: string
  created_at: Date
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const locationId = body?.location_id

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    if (char.realm_tier < 2) return { code: 400, message: '境界不足，筑基期方可游历红尘' }

    const location = EXPEDITION_LOCATIONS.find(l => l.id === locationId)
    if (!location) return { code: 400, message: '游历地点无效' }
    if (location.realmRequired > char.realm_tier) {
      return { code: 400, message: `该地点需 ${location.realmRequired} 阶境界` }
    }

    // 读取「是否首次游历」标志
    const firstFlagRes = await pool.query(
      'SELECT expedition_first_done FROM characters WHERE id = $1',
      [char.id]
    )
    const isFirstExpedition = !firstFlagRes.rows[0]?.expedition_first_done

    // 跨日重置
    await ensureExpeditionDailyReset(pool, char.id)

    const status = await getExpeditionStatus(pool, char.id)
    if (!status) return { code: 400, message: '角色状态读取失败' }

    const isFestival = false
    const remaining = calcRemaining(status, isFestival)
    if (remaining <= 0) return { code: 400, message: '今日游历次数已用完' }

    const cost = calcExpeditionCost(status.realmTier)
    if (status.spiritStone < cost) {
      return { code: 400, message: `灵石不足，本次游历需 ${cost} 灵石` }
    }

    // 名册满判定
    const rosterFull = await isRosterFull(pool, char.id)

    // 滚产出：首次游历且名册未满 → 强制邂逅产出；其余情况按权重随机
    const outcome = rollExpedition({
      characterId: char.id,
      realmTier: status.realmTier,
      location,
      isFestival,
      rosterFull,
      forceType: (isFirstExpedition && !rosterFull) ? 'encounter' : undefined,
    })

    // 事务结算
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. 扣灵石 + 增次数 + 标记首次游历完成
      const finalStoneDelta = -cost + (outcome.spiritStoneBonus || 0)
        + (outcome.rewardOrPenalty?.spiritStone || 0)
      await client.query(
        `UPDATE characters
            SET spirit_stone = GREATEST(0, spirit_stone + $1),
                expedition_count_today = expedition_count_today + 1,
                expedition_first_done = TRUE
          WHERE id = $2`,
        [finalStoneDelta, char.id]
      )

      // 2. 处理产出 - 红尘玉
      let redJadeGain = 0
      if (outcome.type === 'red_jade' && outcome.redJade) redJadeGain += outcome.redJade
      if (outcome.rewardOrPenalty?.redJade) redJadeGain += outcome.rewardOrPenalty.redJade
      if (redJadeGain > 0) {
        await client.query(
          'UPDATE characters SET red_jade = red_jade + $1 WHERE id = $2',
          [redJadeGain, char.id]
        )
      }

      // 3. 处理物品（材料 / 种子 / 装备洗练道具）
      // character_pills 用 count + UNIQUE(character_id, pill_id, quality_factor)
      // character_materials 用 count + UNIQUE(character_id, material_id, quality)
      const QUALITY_NAMES = ['white', 'green', 'blue', 'purple', 'gold', 'red']

      // 装备洗练道具走 character_pills
      const pillItems: Array<{ itemId: string; quantity: number }> = []
      // 灵草（含品质）走 character_materials
      const herbItems: Array<{ itemId: string; quality: number; quantity: number }> = []
      // 其他材料（种子、礼物成品、子女喂养灵草等）默认凡品 → white
      const materialItems: Array<{ itemId: string; quantity: number }> = []

      if (outcome.giftMaterials) {
        for (const m of outcome.giftMaterials) {
          if (['awaken_stone', 'awaken_reroll'].includes(m.itemId)) {
            pillItems.push({ itemId: m.itemId, quantity: m.quantity })
          } else {
            materialItems.push({ itemId: m.itemId, quantity: m.quantity })
          }
        }
      }
      if (outcome.herbs) herbItems.push(...outcome.herbs.map(h => ({ itemId: h.herbId, quality: h.quality, quantity: h.quantity })))
      if (outcome.rewardOrPenalty?.seeds) materialItems.push(...outcome.rewardOrPenalty.seeds)
      if (outcome.rewardOrPenalty?.pills) pillItems.push(...outcome.rewardOrPenalty.pills)

      for (const it of pillItems) {
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
           VALUES ($1, $2, $3, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor)
           DO UPDATE SET count = character_pills.count + EXCLUDED.count`,
          [char.id, it.itemId, it.quantity]
        )
      }
      for (const it of materialItems) {
        await client.query(
          `INSERT INTO character_materials (character_id, material_id, count, quality)
           VALUES ($1, $2, $3, 'white')
           ON CONFLICT (character_id, material_id, quality)
           DO UPDATE SET count = character_materials.count + EXCLUDED.count`,
          [char.id, it.itemId, it.quantity]
        )
      }
      for (const it of herbItems) {
        const qName = QUALITY_NAMES[Math.min(it.quality, QUALITY_NAMES.length - 1)] || 'white'
        await client.query(
          `INSERT INTO character_materials (character_id, material_id, count, quality)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (character_id, material_id, quality)
           DO UPDATE SET count = character_materials.count + EXCLUDED.count`,
          [char.id, it.itemId, it.quantity, qName]
        )
      }

      // 4. 处理邂逅 - 写入 pending 事件（这里复用 character_event_log 暂存，实际可以新表）
      // 简化方案：邂逅事件信息直接随响应返回，不落库；玩家选 A/B/D 时再调 encounter-choose 录入 companions
      // pending 数据通过响应字段传给前端，前端再带回 encounter-choose
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      data: {
        outcome,
        remaining: remaining - 1,
        rosterFull,
      },
    }
  } catch (error) {
    console.error('游历失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
