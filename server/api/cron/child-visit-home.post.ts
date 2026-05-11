// 离家子女回家 cron - POST /api/cron/child-visit-home
// 每天调用一次：扫所有 has_left_home=TRUE 且 last_visit_at < NOW() - 10 天 的子女
// → permanent_buff_pct += 0.005（上限 0.20 = 40 次回家）
// → 更新 last_visit_at = NOW()
// → 发邮件提醒父母
// 设计文档 5.8

import { getPool } from '~/server/database/db'
import { sendMail } from '~/server/utils/mail'

const VISIT_INTERVAL_DAYS = 10
const BUFF_PER_VISIT = 0.005
const BUFF_CAP = 0.20

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // 1. 找到符合条件的子女
  const { rows } = await pool.query(
    `UPDATE children
        SET permanent_buff_pct = LEAST($1::numeric, permanent_buff_pct + $2::numeric),
            last_visit_at = NOW()
      WHERE has_left_home = TRUE
        AND (last_visit_at IS NULL OR last_visit_at < NOW() - INTERVAL '${VISIT_INTERVAL_DAYS} days')
        AND permanent_buff_pct < $1::numeric
      RETURNING id, character_id, name, permanent_buff_pct`,
    [BUFF_CAP, BUFF_PER_VISIT]
  )

  // 2. 发邮件提醒父母（每个被加成的子女各一封）
  let mailsSent = 0
  for (const r of rows) {
    const pct = Number(r.permanent_buff_pct)
    const pctStr = (pct * 100).toFixed(1)
    try {
      await sendMail({
        characterId: r.character_id,
        category: 'system',
        title: `${r.name} 归家探望`,
        content: `你的孩子 ${r.name} 从外历练归来探望，给予父母永久属性 +${(BUFF_PER_VISIT * 100).toFixed(1)}%。\n当前累计 +${pctStr}%（上限 +${(BUFF_CAP * 100).toFixed(0)}%）。`,
        refType: 'child_visit',
        refId: r.id,
        ttlDays: 14,
      })
      mailsSent++
    } catch (e) {
      console.error(`[child-visit-home] 发邮件失败 child_id=${r.id}:`, (e as Error).message)
    }
  }

  return {
    ok: true,
    visited: rows.length,
    mailsSent,
    details: rows.map((r: any) => ({
      childId: r.id,
      characterId: r.character_id,
      name: r.name,
      newBuffPct: Number(r.permanent_buff_pct),
    })),
  }
})
