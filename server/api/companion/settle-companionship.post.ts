// 陪伴亲密度结算 - POST /api/companion/settle-companionship
// 已结侣后每日自动 +20，玩家上线时调用（也作为 cron 备份）
// 离线累计上限 7 天 = 140

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getOfficialCompanion } from '~/server/utils/companion'
import { INTIMACY_CONFIG } from '~/server/engine/companionData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getOfficialCompanion(pool, char.id)
    if (!c) return { code: 200, data: { settled: false, reason: '无正式道侣' } }

    // 计算应得天数（自上次结算到今天，最多 7 天）
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let lastSettled: Date
    if (c.last_companion_settle) {
      lastSettled = new Date(c.last_companion_settle)
    } else {
      // 从结侣日开始
      lastSettled = c.married_at ? new Date(c.married_at) : new Date(c.encountered_at)
      lastSettled.setHours(0, 0, 0, 0)
    }

    const dayMs = 24 * 60 * 60 * 1000
    const dayDiff = Math.floor((today.getTime() - lastSettled.getTime()) / dayMs)

    if (dayDiff <= 0) {
      return { code: 200, data: { settled: false, reason: '今日已结算' } }
    }

    const cappedDays = Math.min(dayDiff, INTIMACY_CONFIG.companionshipOfflineCapDays)
    const intimacyDelta = cappedDays * INTIMACY_CONFIG.companionshipDaily
    const redJadeDelta = cappedDays * 5  // 已结侣每日陪伴自动 +5 红尘玉

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE companions
            SET intimacy = LEAST(8000, intimacy + $1),
                last_companion_settle = $2::date
          WHERE id = $3`,
        [intimacyDelta, today.toISOString().slice(0, 10), c.id]
      )
      await client.query(
        'UPDATE characters SET red_jade = red_jade + $1 WHERE id = $2',
        [redJadeDelta, char.id]
      )
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
        settled: true,
        days: cappedDays,
        cappedAtMax: dayDiff > INTIMACY_CONFIG.companionshipOfflineCapDays,
        intimacyGained: intimacyDelta,
        redJadeGained: redJadeDelta,
      },
      message: cappedDays > 1
        ? `陪伴 ${cappedDays} 天累计结算：亲密度 +${intimacyDelta}、红尘玉 +${redJadeDelta}`
        : `今日陪伴：亲密度 +${intimacyDelta}、红尘玉 +${redJadeDelta}`,
    }
  } catch (error) {
    console.error('陪伴结算失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
