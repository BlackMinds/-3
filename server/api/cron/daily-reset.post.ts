import { getPool } from '~/server/database/db'
import { cleanupExpiredMails, sendMail } from '~/server/utils/mail'
import { getWeekNumber } from '~/server/utils/companion'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // Reset daily donation for all sect members
  await pool.query('UPDATE sect_members SET daily_donated = 0')

  // Remove expired buffs
  await pool.query('DELETE FROM character_buffs WHERE expire_time < NOW()')

  // Cleanup expired timed_buffs
  await pool.query('DELETE FROM timed_buffs WHERE expires_at < NOW()')

  // 灵脉偷袭每日计数归档（保留 3 天）
  await pool.query(`DELETE FROM spirit_vein_daily_raid_count WHERE raid_date < CURRENT_DATE - INTERVAL '3 days'`)

  // Cleanup expired mails (auto-grant attachments before deletion)
  const mailStats = await cleanupExpiredMails()

  // ========================================
  // 道侣系统每日重置 (design/system-companion.md Phase 1)
  // ========================================

  // 1. 游历次数 + 付费次数（跨日重置）
  await pool.query(`
    UPDATE characters
       SET expedition_count_today = 0,
           expedition_extra_today = 0,
           expedition_date = CURRENT_DATE
     WHERE expedition_date IS DISTINCT FROM CURRENT_DATE OR expedition_date IS NULL
  `)

  // 2. 跨周重置游历加次符限购
  const currentWeek = getWeekNumber()
  await pool.query(
    `UPDATE characters
        SET expedition_extra_week = 0,
            expedition_week_number = $1
      WHERE expedition_week_number != $1`,
    [currentWeek]
  )

  // 3. 陪伴亲密度自动结算（已结侣每日 +20，离线最多累计 7 天）
  // 一次性给所有正式道侣发放陪伴亲密度，但跳过怀胎中（pregnant_until > NOW()）的
  const companionshipResult = await pool.query(`
    UPDATE companions
       SET intimacy = LEAST(9999, intimacy + 20),
           last_companion_settle = CURRENT_DATE
     WHERE is_official = TRUE
       AND (last_companion_settle IS NULL OR last_companion_settle < CURRENT_DATE)
       AND (pregnant_until IS NULL OR pregnant_until < NOW())
    RETURNING id, character_id
  `)
  // 同步给玩家发 +5 红尘玉
  if (companionshipResult.rowCount && companionshipResult.rowCount > 0) {
    const charIds = companionshipResult.rows.map((r: any) => r.character_id)
    await pool.query(
      `UPDATE characters SET red_jade = red_jade + 5 WHERE id = ANY($1::int[])`,
      [charIds]
    )
  }

  // 4. 怀胎到期邮件提醒（pregnant_until 已到期 + pregnant_count > 0，未走 conceive-claim）
  // 用 ref_id 防重复发邮件：一次怀胎周期只发一次（mails 表幂等通过 ref_type/ref_id + 同 character_id 重发去重）
  const pregnantDoneResult = await pool.query(`
    SELECT c.id AS companion_id, c.character_id, c.name AS companion_name, c.pregnant_count
      FROM companions c
     WHERE c.is_official = TRUE
       AND c.pregnant_until IS NOT NULL
       AND c.pregnant_until <= NOW()
       AND c.pregnant_count > 0
  `)
  let pregnantMailsSent = 0
  for (const r of pregnantDoneResult.rows) {
    // 该 companion + 这次怀胎周期是否已发过提醒
    const { rows: existing } = await pool.query(
      `SELECT id FROM mails
        WHERE character_id = $1 AND ref_type = 'pregnant_due' AND ref_id = $2
        LIMIT 1`,
      [r.character_id, String(r.companion_id)]
    )
    if (existing.length > 0) continue

    const cnt = r.pregnant_count
    const title = cnt === 3 ? `${r.companion_name} 三胎之喜` :
                  cnt === 2 ? `${r.companion_name} 双胎之喜` :
                              `${r.companion_name} 弄璋之喜`
    try {
      await sendMail({
        characterId: r.character_id,
        category: 'system',
        title,
        content: `你的道侣 ${r.companion_name} 已到产期，${cnt === 1 ? '一名新生命' : `${cnt} 名新生儿`}降临！\n请在道侣详情中点击「出生」领取。`,
        refType: 'pregnant_due',
        refId: r.companion_id,
        ttlDays: 30,
      })
      pregnantMailsSent++
    } catch (e) {
      console.error(`[daily-reset] 怀胎到期邮件失败 companion=${r.companion_id}:`, (e as Error).message)
    }
  }

  return {
    ok: true,
    mailStats,
    companionshipSettled: companionshipResult.rowCount || 0,
    pregnantMailsSent,
    weekNumber: currentWeek,
  }
})
