/**
 * 使用突破丹 (v3.7 分档覆盖)
 * 支持三种丹药:
 *   - small_breakthrough_pill: +10%
 *   - breakthrough_boost:      +20% (宗门突破丹)
 *   - big_breakthrough_pill:   +25%
 * 规则:
 *   - 共用 characters.breakthrough_boost_pct 字段
 *   - 不叠加，使用时 pct = max(current, incoming)
 *   - 高覆盖低：当前 pct 已 >= 新丹药 pct 则拒绝（防止浪费）
 *   - 低升高：已激活低级丹药后，仍可用高级丹药覆盖（会消耗掉高级丹）
 *   - 突破成败后清零（由 breakthrough.post.ts 处理）
 */
import { getPool } from '~/server/database/db'
import { consumeSpecialItem } from '~/server/utils/equipment'
import { BREAKTHROUGH_PILL_PCT, BREAKTHROUGH_PILL_NAMES } from '~/server/engine/secretShopData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event).catch(() => ({})) as { pill_id?: string }
    // 向后兼容：未传 pill_id 视作宗门突破丹
    const pillId = body?.pill_id || 'breakthrough_boost'

    const incomingPct = BREAKTHROUGH_PILL_PCT[pillId]
    if (!incomingPct) {
      return { code: 400, message: '不支持的突破丹类型' }
    }

    const { rows: charRows } = await pool.query(
      'SELECT id, breakthrough_boost_pct FROM characters WHERE user_id = $1',
      [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const char = charRows[0]
    const currentPct = Number(char.breakthrough_boost_pct || 0)

    // 高覆盖低：若当前激活的 buff 不低于新丹药，拒绝浪费
    if (currentPct >= incomingPct) {
      return {
        code: 400,
        message: `当前已激活 +${currentPct}% 突破加成，使用${BREAKTHROUGH_PILL_NAMES[pillId]}（+${incomingPct}%）不会提升，先去突破一次`,
      }
    }

    // 扣道具
    const used = await consumeSpecialItem(char.id, pillId)
    if (!used) return { code: 400, message: `没有${BREAKTHROUGH_PILL_NAMES[pillId]}` }

    // 更新 buff（仅拉高，保险再套一次 GREATEST 防并发回退）
    await pool.query(
      'UPDATE characters SET breakthrough_boost_pct = GREATEST(breakthrough_boost_pct, $1) WHERE id = $2',
      [incomingPct, char.id]
    )

    return {
      code: 200,
      message: `${BREAKTHROUGH_PILL_NAMES[pillId]}已激活 · 下次突破成功率 +${incomingPct}%`,
      data: { breakthrough_boost_pct: incomingPct },
    }
  } catch (error) {
    console.error('突破丹使用失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
