// 离家子女回家 cron - POST /api/cron/child-visit-home
// 每天调用一次：扫所有 has_left_home=TRUE 且 last_visit_at < NOW() - 1 天 的子女
// → permanent_buff_pct += 0.005（上限按资质：凡14/下16/中18/上20/极21/仙21.5/圣22%）
// → 更新 last_visit_at = NOW()
// → 发邮件提醒父母
// 设计文档 5.8
// 2026-05-18: 间隔 3→1 天，单次 buff 不变，达上限速度 ×3

import { getPool } from '~/server/database/db'
import { sendMail } from '~/server/utils/mail'
import { APTITUDE_VISIT_CAP } from '~/server/utils/child'

const VISIT_INTERVAL_DAYS = 1
const BUFF_PER_VISIT = 0.005

// SQL CASE 表达式：按 aptitude 取上限（与 APTITUDE_VISIT_CAP 同步）
const CAP_CASE = `CASE aptitude
  WHEN 0 THEN ${APTITUDE_VISIT_CAP[0]}
  WHEN 1 THEN ${APTITUDE_VISIT_CAP[1]}
  WHEN 2 THEN ${APTITUDE_VISIT_CAP[2]}
  WHEN 3 THEN ${APTITUDE_VISIT_CAP[3]}
  WHEN 4 THEN ${APTITUDE_VISIT_CAP[4]}
  WHEN 5 THEN ${APTITUDE_VISIT_CAP[5]}
  WHEN 6 THEN ${APTITUDE_VISIT_CAP[6]}
  ELSE 0.20
END`

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // 1. 找到符合条件的子女
  const { rows } = await pool.query(
    `UPDATE children
        SET permanent_buff_pct = LEAST((${CAP_CASE})::numeric, permanent_buff_pct + $1::numeric),
            last_visit_at = NOW()
      WHERE has_left_home = TRUE
        AND (last_visit_at IS NULL OR last_visit_at < NOW() - INTERVAL '${VISIT_INTERVAL_DAYS} days')
        AND permanent_buff_pct < (${CAP_CASE})::numeric
      RETURNING id, character_id, name, aptitude, permanent_buff_pct`,
    [BUFF_PER_VISIT]
  )

  // 2. 发邮件提醒父母（每个被加成的子女各一封）
  let mailsSent = 0
  for (const r of rows) {
    const pct = Number(r.permanent_buff_pct)
    const pctStr = (pct * 100).toFixed(1)
    const cap = APTITUDE_VISIT_CAP[r.aptitude] ?? 0.20
    const capStr = (cap * 100).toFixed(cap * 100 % 1 === 0 ? 0 : 1)
    try {
      await sendMail({
        characterId: r.character_id,
        category: 'system',
        title: `${r.name} 归家探望`,
        content: `你的孩子 ${r.name} 从外历练归来探望，给予父母永久属性 +${(BUFF_PER_VISIT * 100).toFixed(1)}%。\n当前累计 +${pctStr}%（资质上限 +${capStr}%）。`,
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
