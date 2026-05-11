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

    // 检查物品库存
    // 礼物默认 quality='white'（炼制品质系数在 Phase 2 接入）
    const { rows: invRows } = await pool.query(
      `SELECT count FROM character_materials
        WHERE character_id = $1 AND material_id = $2 AND quality = 'white'`,
      [char.id, giftId]
    )
    const stock = invRows[0]?.count || 0
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

      // 扣物品
      await client.query(
        `UPDATE character_materials
            SET count = count - $1
          WHERE character_id = $2 AND material_id = $3 AND quality = 'white'`,
        [quantity, char.id, giftId]
      )

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
