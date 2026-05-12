// 怀胎自动结算 cron - POST /api/cron/companion-conceive-claim
// 每天调用一次：扫所有 pregnant_until 已过期且 pregnant_count > 0 的道侣，自动出生
// 避免玩家忘记手动点「出生」导致新生命卡在 pregnant 状态
// design 10.12 提到「备份手动领取」

import { getPool } from '~/server/database/db'
import { birthChild, type BirthInputs } from '~/server/utils/child'
import { sendMail } from '~/server/utils/mail'
import type { CompanionQuality, SpiritualRoot } from '~/server/engine/companionData'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // 找出所有过期怀胎
  const { rows: pregnantList } = await pool.query(`
    SELECT cmp.id AS companion_id, cmp.character_id, cmp.name AS companion_name,
           cmp.quality AS companion_quality, cmp.spiritual_root AS companion_root,
           cmp.pregnant_count,
           ch.id AS char_id, ch.name AS char_name, ch.aptitude AS player_aptitude,
           ch.spiritual_root AS player_root
      FROM companions cmp
      JOIN characters ch ON ch.id = cmp.character_id
     WHERE cmp.is_official = TRUE
       AND cmp.pregnant_until IS NOT NULL
       AND cmp.pregnant_until <= NOW()
       AND cmp.pregnant_count > 0
  `)

  let totalBirths = 0
  let mailsSent = 0

  for (const r of pregnantList) {
    const inputs: BirthInputs = {
      characterId: r.character_id,
      parentCompanionId: r.companion_id,
      parentSurname: r.char_name?.[0] || '清',
      playerAptitude: r.player_aptitude || 1,
      playerElement: r.player_root as SpiritualRoot,
      companionQuality: r.companion_quality as CompanionQuality,
      companionElement: r.companion_root as SpiritualRoot,
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const childNames: string[] = []
      for (let i = 0; i < (r.pregnant_count || 1); i++) {
        const result = await birthChild(client, inputs)
        childNames.push(result.child.name)
        totalBirths++
      }
      await client.query(
        'UPDATE companions SET pregnant_until = NULL, pregnant_count = 0 WHERE id = $1',
        [r.companion_id]
      )
      await client.query('COMMIT')

      // 发邮件提醒（用 ref 防重发）
      try {
        await sendMail({
          characterId: r.character_id,
          category: 'system',
          title: `${r.companion_name} 弄璋之喜（自动结算）`,
          content: `怀胎到期，已自动出生 ${childNames.length} 名子女：${childNames.join('、')}。可在「红尘 → 子嗣」查看。`,
          refType: 'conceive_auto',
          refId: `${r.companion_id}_${Date.now()}`,
          ttlDays: 30,
        })
        mailsSent++
      } catch (e) {
        console.error(`[conceive-claim cron] 邮件失败 companion=${r.companion_id}:`, (e as Error).message)
      }
    } catch (e) {
      await client.query('ROLLBACK')
      console.error(`[conceive-claim cron] 出生失败 companion=${r.companion_id}:`, (e as Error).message)
    } finally {
      client.release()
    }
  }

  return { ok: true, scanned: pregnantList.length, totalBirths, mailsSent }
})
