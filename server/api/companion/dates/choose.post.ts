// 选择约会选项 - POST /api/companion/dates/choose
// body: { event_id: 'DT-001', choice_index: 0 }
// 同时记录约会日志（消耗每日次数）+ 发放亲密度+奖励

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getOfficialCompanion } from '~/server/utils/companion'
import { DATE_EVENT_MAP } from '~/server/engine/dateEventData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const eventId = body?.event_id as string
    const choiceIndex = Number(body?.choice_index)

    if (!eventId || isNaN(choiceIndex)) return { code: 400, message: '参数错误' }

    const dateEvent = DATE_EVENT_MAP[eventId]
    if (!dateEvent) return { code: 400, message: '事件不存在' }
    if (choiceIndex < 0 || choiceIndex >= dateEvent.choices.length) {
      return { code: 400, message: '选项无效' }
    }
    const choice = dateEvent.choices[choiceIndex]

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getOfficialCompanion(pool, char.id)
    if (!c) return { code: 400, message: '无正式道侣' }

    // 二次校验今日次数
    const { rows: chk } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM companion_dates
        WHERE companion_id = $1 AND occurred_at::date = CURRENT_DATE`,
      [c.id]
    )
    if ((chk[0]?.cnt || 0) >= 3) return { code: 400, message: '今日约会次数已用完' }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. 加亲密度
      await client.query(
        `UPDATE companions SET intimacy = LEAST(9999, GREATEST(0, intimacy + $1)) WHERE id = $2`,
        [choice.intimacy, c.id]
      )

      // 2. 奖励发放
      const reward = choice.reward || {}
      if (reward.spiritStone) {
        await client.query(
          'UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2',
          [reward.spiritStone, char.id]
        )
      }
      if (reward.redJade) {
        await client.query(
          'UPDATE characters SET red_jade = red_jade + $1 WHERE id = $2',
          [reward.redJade, char.id]
        )
      }
      if (reward.cultExp) {
        // 直接累加修为（applyCultivationExp 是纯函数，这里只做累加）
        await client.query(
          'UPDATE characters SET cultivation_exp = cultivation_exp + $1 WHERE id = $2',
          [reward.cultExp, char.id]
        )
      }
      if (reward.item) {
        const isPill = ['awaken_stone', 'awaken_reroll'].includes(reward.item.id)
        if (isPill) {
          await client.query(
            `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
             VALUES ($1, $2, $3, 1.0)
             ON CONFLICT (character_id, pill_id, quality_factor)
             DO UPDATE SET count = character_pills.count + EXCLUDED.count`,
            [char.id, reward.item.id, reward.item.quantity]
          )
        } else {
          await client.query(
            `INSERT INTO character_materials (character_id, material_id, count, quality)
             VALUES ($1, $2, $3, 'white')
             ON CONFLICT (character_id, material_id, quality)
             DO UPDATE SET count = character_materials.count + EXCLUDED.count`,
            [char.id, reward.item.id, reward.item.quantity]
          )
        }
      }

      // 3. 记录日志（消耗次数）
      await client.query(
        `INSERT INTO companion_dates (companion_id, event_id, choice, intimacy_gained, reward)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [c.id, eventId, String(choiceIndex), choice.intimacy, JSON.stringify(reward)]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    // 亲密度峰值成就
    const { rows: ipRows } = await pool.query('SELECT intimacy FROM companions WHERE id = $1', [c.id])
    const { checkAchievements } = await import('~/server/engine/achievementData')
    checkAchievements(char.id, 'intimacy_peak', ipRows[0]?.intimacy || 0).catch(() => {})

    return {
      code: 200,
      data: {
        intimacyGained: choice.intimacy,
        reward: choice.reward || {},
      },
      message: `亲密度 +${choice.intimacy}`,
    }
  } catch (error) {
    console.error('约会选择失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
