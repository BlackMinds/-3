// 天道造化 · 全服每 30 分钟抽奖接口
// 由 GitHub Actions 调用：.github/workflows/cron.yml 加入 */30 0-15 * * *（UTC）

import { getPool } from '~/server/database/db'
import {
  pickCandidates,
  pickWinner,
  pickEvent,
  applyEventEffects,
  saveEventLogAndBroadcast,
} from '~/server/utils/randomEvent'

export default defineEventHandler(async (event) => {
  // 1. 鉴权
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // 2. 静默时段校验（北京时间 00:00 ~ 08:00 不触发）
  const now = new Date()
  const cnHour = (now.getUTCHours() + 8) % 24
  // 允许通过 ?force=1 绕过静默时段校验（仅供手动触发 / 测试）
  const query = getQuery(event)
  const force = query.force === '1'
  if (!force && cnHour < 8) {
    return { ok: true, skipped: 'silent_hours', cn_hour: cnHour }
  }

  const pool = getPool()

  try {
    // 3. 筛候选池
    const candidates = await pickCandidates(pool)
    if (candidates.length === 0) {
      return { ok: true, skipped: 'no_candidates' }
    }

    // 4. 抽中奖者
    const winner = pickWinner(candidates)
    if (!winner) {
      return { ok: true, skipped: 'pick_failed' }
    }

    // 5. 抽具体事件
    const randomEvent = pickEvent(winner)

    // 6. 落库（修改玩家数据）
    const reward = await applyEventEffects(pool, winner, randomEvent)

    // 7. 写事件日志 + 风云阁广播
    const { logId, broadcastText } = await saveEventLogAndBroadcast(pool, winner, randomEvent, reward)

    return {
      ok: true,
      winner_id: winner.id,
      winner_name: winner.name,
      event_id: randomEvent.id,
      event_name: randomEvent.name,
      rarity: randomEvent.rarity,
      log_id: logId,
      broadcast: broadcastText,
    }
  } catch (err: any) {
    console.error('[random-event-tick] 失败:', err)
    return { ok: false, error: err?.message || String(err) }
  }
})
