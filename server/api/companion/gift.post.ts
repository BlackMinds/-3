// 赠送礼物 - POST /api/companion/gift
// 含每日上限 50、性格匹配反馈、品质系数（MVP 阶段统一为 1.0，Phase 2 接入炼丹品质系数）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import {
  getCompanionById,
  addIntimacy,
  getTodayGiftIntimacyTotal,
  isGiftItem,
  checkReaction,
  calcGiftReward,
} from '~/server/utils/companion'
import { INTIMACY_CONFIG } from '~/server/engine/companionData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const companionId = Number(body?.companion_id)
    const giftId = body?.gift_id as string
    const quantity = Number(body?.quantity) || 1

    if (!companionId || !giftId) return { code: 400, message: '参数错误' }
    if (quantity < 1 || quantity > 10) return { code: 400, message: '一次最多赠送 10 件' }
    if (!isGiftItem(giftId)) return { code: 400, message: '此物品非可赠礼物' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getCompanionById(pool, companionId, char.id)
    if (!c) return { code: 404, message: '道侣不存在' }

    // 检查每日上限（仅适用于"普通增益"，厌恶礼物不计入但仍消耗物品）
    const todayTotal = await getTodayGiftIntimacyTotal(pool, companionId)
    const remaining = INTIMACY_CONFIG.dailyGiftLimit - todayTotal
    if (remaining <= 0) {
      return { code: 400, message: '今日亲密度上限已达' }
    }

    // 检查物品库存（汇总所有品质：游历产出/凡品炼制是 white，炼丹房高品质炼制可能是 green/blue/.../red）
    // 优先消耗高品质（赠送时按所选品质计算亲密度系数 — Phase 2 简化：实际亲密度仍按基础值，品质优先消耗保证不浪费）
    const { rows: invRows } = await pool.query(
      `SELECT quality, count FROM character_materials
        WHERE character_id = $1 AND material_id = $2 AND count > 0
        ORDER BY CASE quality WHEN 'red' THEN 5 WHEN 'gold' THEN 4 WHEN 'purple' THEN 3 WHEN 'blue' THEN 2 WHEN 'green' THEN 1 ELSE 0 END DESC`,
      [char.id, giftId]
    )
    const stock = invRows.reduce((a: number, r: any) => a + (r.count || 0), 0)
    if (stock < quantity) return { code: 400, message: `物品不足，仅有 ${stock} 件` }

    // 反应判断
    const reaction = checkReaction(
      c.personality as any,
      giftId,
      c.preferred_gifts || [],
      c.disliked_gifts || []
    )
    // 单件礼物的亲密度
    const perGiftIntimacy = calcGiftReward(giftId, reaction, 1.0)

    // 总亲密度（按 quantity 累加，但厌恶礼物每件 -3）
    let totalDelta = perGiftIntimacy * quantity
    // 上限抑制（仅正向收益受限）
    if (totalDelta > 0 && totalDelta > remaining) totalDelta = remaining

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 扣物品（按高品质优先扣，保证 quantity 件被消耗）
      let remainingToDeduct = quantity
      for (const row of invRows) {
        if (remainingToDeduct <= 0) break
        const take = Math.min(remainingToDeduct, row.count)
        await client.query(
          `UPDATE character_materials
              SET count = count - $1
            WHERE character_id = $2 AND material_id = $3 AND quality = $4`,
          [take, char.id, giftId, row.quality]
        )
        remainingToDeduct -= take
      }

      // 改亲密度
      await client.query(
        `UPDATE companions
            SET intimacy = GREATEST(0, LEAST(9999, intimacy + $1))
          WHERE id = $2`,
        [totalDelta, companionId]
      )

      // 记录日志
      await client.query(
        `INSERT INTO companion_gifts (companion_id, gift_type, intimacy_gained, reaction)
         VALUES ($1, $2, $3, $4)`,
        [companionId, giftId, totalDelta, reaction]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    const { rows: cur } = await pool.query('SELECT intimacy FROM companions WHERE id = $1', [companionId])
    const newIntimacy = cur[0]?.intimacy || 0

    // 亲密度峰值成就 (intimacy_peak threshold 5000/9999)
    const { checkAchievements } = await import('~/server/engine/achievementData')
    checkAchievements(char.id, 'intimacy_peak', newIntimacy).catch(() => {})

    return {
      code: 200,
      data: {
        reaction,
        intimacyGained: totalDelta,
        intimacyTotal: newIntimacy,
        dailyRemaining: Math.max(0, remaining - Math.max(0, totalDelta)),
      },
      message: reactionMessage(reaction, totalDelta),
    }
  } catch (error) {
    console.error('赠礼失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})

function reactionMessage(r: 'love' | 'normal' | 'dislike', delta: number): string {
  if (r === 'love') return `对方欣然收下：「正合我意」 亲密度 +${delta}`
  if (r === 'dislike') return `对方蹙眉摇头：「拿开吧」 亲密度 ${delta}`
  return `对方略微一笑：「多谢」 亲密度 +${delta}`
}
