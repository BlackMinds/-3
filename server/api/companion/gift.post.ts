// 赠送礼物 - POST /api/companion/gift
// 含每日上限 50、性格匹配反馈。礼物无品质机制：收益 = baseIntimacy × 反应系数

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import {
  getCompanionById,
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

    // 反应判断（纯内存计算，与数据无关）
    const c = await getCompanionById(pool, companionId, char.id)
    if (!c) return { code: 404, message: '道侣不存在' }
    const reaction = checkReaction(
      c.personality as any,
      giftId,
      c.preferred_gifts || [],
      c.disliked_gifts || []
    )
    const perGiftIntimacy = calcGiftReward(giftId, reaction)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 防并发：锁道侣行 + 事务内复查每日上限
      await client.query(
        'SELECT id FROM companions WHERE id = $1 FOR UPDATE',
        [companionId]
      )
      const todayTotal = await getTodayGiftIntimacyTotal(client, companionId)
      const remaining = INTIMACY_CONFIG.dailyGiftLimit - todayTotal
      if (remaining <= 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '今日亲密度上限已达' }
      }

      // 事务内读库存（FOR UPDATE 防并发扣负）
      const { rows: invRows } = await client.query(
        `SELECT quality, count FROM character_materials
          WHERE character_id = $1 AND material_id = $2 AND count > 0
          ORDER BY CASE quality
            WHEN 'white' THEN 0 WHEN 'green' THEN 1 WHEN 'blue' THEN 2
            WHEN 'purple' THEN 3 WHEN 'gold' THEN 4 WHEN 'red' THEN 5 ELSE 99 END
          FOR UPDATE`,
        [char.id, giftId]
      )
      const stock = invRows.reduce((a: number, r: any) => a + (r.count || 0), 0)
      if (stock < quantity) {
        await client.query('ROLLBACK')
        return { code: 400, message: `物品不足，仅有 ${stock} 件` }
      }

      // 总亲密度（按 quantity 累加）
      let totalDelta = perGiftIntimacy * quantity
      if (totalDelta > 0 && totalDelta > remaining) totalDelta = remaining

      // 扣物品（低品优先）
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
            SET intimacy = GREATEST(0, LEAST(8000, intimacy + $1))
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

      const { rows: cur } = await pool.query('SELECT intimacy FROM companions WHERE id = $1', [companionId])
      const newIntimacy = cur[0]?.intimacy || 0

      // 亲密度峰值成就
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
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
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
