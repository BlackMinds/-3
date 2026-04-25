import { getPool } from '~/server/database/db'
import { sendMail } from '~/server/utils/mail'

/**
 * 斗法榜每日奖励 cron
 * - 每天北京 12:00 (UTC 04:00) 由 GitHub Actions 触发
 * - 取 arena_score 前 10 发奖励
 * - 幂等键: ref_type='arena_daily_reward' + ref_id=YYYY-MM-DD (北京日期)
 *   重复触发不会重复发奖, 同一天 manual workflow_dispatch 也安全
 *
 * 奖励:
 *   第 1   : 25000 灵石 + 1 灵枢玉 + 称号「论道魁首」 + atk/def/hp +3% (3 天)
 *   第 2-3 : 15000 灵石 + 1 灵枢玉 + 称号「斗法翘楚」 + atk/def/hp +1.5% (3 天)
 *   第 4-10: 7500 灵石 + 1 灵枢玉
 */

const REWARD_DURATION_SEC = 3 * 24 * 3600

interface RewardConfig {
  stone: number
  jadeQty: number
  title?: string
  buffPct?: number
}

function getRewardForRank(rank: number): RewardConfig {
  if (rank === 1) return { stone: 25000, jadeQty: 1, title: '论道魁首', buffPct: 3 }
  if (rank <= 3)  return { stone: 15000, jadeQty: 1, title: '斗法翘楚', buffPct: 1.5 }
  return { stone: 7500, jadeQty: 1 }
}

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // 北京日期 (用于幂等键)
  const cnNow = new Date(Date.now() + 8 * 3600 * 1000)
  const today = cnNow.toISOString().slice(0, 10)

  const pool = getPool()

  // 取 top 10 (arena_score > 0 排除从未斗法过且被扣到 0 的)
  const { rows } = await pool.query(
    `SELECT id, name, arena_score
     FROM characters
     WHERE arena_score > 0
     ORDER BY arena_score DESC, realm_tier DESC, realm_stage DESC, level DESC
     LIMIT 10`
  )

  const sent: { rank: number; characterId: number; name: string; score: number }[] = []
  const skipped: { rank: number; characterId: number; reason: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const rank = i + 1
    const row = rows[i]
    const charId = row.id

    // 幂等检查
    const { rowCount } = await pool.query(
      `SELECT 1 FROM mails
       WHERE character_id = $1 AND ref_type = 'arena_daily_reward' AND ref_id = $2
       LIMIT 1`,
      [charId, today]
    )
    if (rowCount && rowCount > 0) {
      skipped.push({ rank, characterId: charId, reason: 'already_sent' })
      continue
    }

    const cfg = getRewardForRank(rank)
    const attachments: any[] = [
      { type: 'spirit_stone', amount: cfg.stone },
      { type: 'pill', pillId: 'awaken_reroll', qty: cfg.jadeQty },
    ]

    let titleLine = ''
    if (cfg.title && cfg.buffPct) {
      attachments.push(
        { type: 'title', titleKey: cfg.title, duration: REWARD_DURATION_SEC },
        // sourceId 固定 'arena_daily': 连续上榜会续期不累加 (升降名次会覆盖最新值)
        { type: 'timed_buff', sourceType: 'arena_daily', sourceId: 'arena_daily', statKey: 'atk_pct', statValue: cfg.buffPct, duration: REWARD_DURATION_SEC },
        { type: 'timed_buff', sourceType: 'arena_daily', sourceId: 'arena_daily', statKey: 'def_pct', statValue: cfg.buffPct, duration: REWARD_DURATION_SEC },
        { type: 'timed_buff', sourceType: 'arena_daily', sourceId: 'arena_daily', statKey: 'hp_pct', statValue: cfg.buffPct, duration: REWARD_DURATION_SEC },
      )
      titleLine = `\n授予「${cfg.title}」称号 3 天 + atk/def/hp +${cfg.buffPct}% 加成。`
    }

    await sendMail({
      characterId: charId,
      category: 'system',
      title: `斗法榜每日奖励 · 第 ${rank} 名`,
      content: `恭喜你今日斗法榜排名第 ${rank} (${row.arena_score} 分)。${titleLine}\n请查收附件奖励。`,
      attachments,
      refType: 'arena_daily_reward',
      refId: today,
      ttlDays: 7,
    })

    sent.push({ rank, characterId: charId, name: row.name, score: Number(row.arena_score) })
  }

  return { code: 200, data: { date: today, sent, skipped, totalRanked: rows.length } }
})
