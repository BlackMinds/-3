import { getPool } from '~/server/database/db'
import type { PoolClient } from 'pg'

export type MailCategory =
  | 'sect_war'
  | 'sect_war_bet'
  | 'spirit_vein_surge'
  | 'spirit_vein_raid'
  | 'spirit_vein_jackpot'
  | 'system'

export type MailAttachment =
  | { type: 'spirit_stone'; amount: number }
  | { type: 'contribution'; amount: number }
  | { type: 'exp'; amount: number }
  | { type: 'material'; itemId: string; quality?: 'white' | 'green' | 'blue' | 'purple' | 'gold'; qty: number }
  | { type: 'pill'; pillId: string; qualityFactor?: number; qty: number }
  | { type: 'recipe'; recipeId: string }
  | { type: 'title'; titleKey: string; duration: number }
  | { type: 'timed_buff'; sourceType: string; sourceId?: string; statKey: string; statValue: number; duration: number }

export interface SendMailParams {
  characterId: number
  category: MailCategory
  title: string
  content: string
  attachments?: MailAttachment[]
  refType?: string
  refId?: string | number
  ttlDays?: number
}

function computeExpiresAt(ttlDays = 30): Date {
  return new Date(Date.now() + ttlDays * 24 * 3600 * 1000)
}

export async function sendMail(params: SendMailParams, client?: PoolClient): Promise<number> {
  const pool = getPool()
  const runner = client || pool
  const attachments = params.attachments || []
  const isClaimed = attachments.length === 0
  const expiresAt = computeExpiresAt(params.ttlDays)
  const refId = params.refId != null ? String(params.refId) : null

  const { rows } = await runner.query(
    `INSERT INTO mails
      (character_id, category, title, content, attachments, ref_type, ref_id,
       is_claimed, expires_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
     RETURNING id`,
    [
      params.characterId,
      params.category,
      params.title,
      params.content,
      JSON.stringify(attachments),
      params.refType || null,
      refId,
      isClaimed,
      expiresAt,
    ]
  )
  return rows[0].id
}

export async function sendMailBatch(items: SendMailParams[], client?: PoolClient): Promise<void> {
  if (items.length === 0) return
  const pool = getPool()
  const ownClient = !client
  const runner = client || (await pool.connect())
  try {
    if (ownClient) await runner.query('BEGIN')
    for (const item of items) {
      await sendMail(item, runner)
    }
    if (ownClient) await runner.query('COMMIT')
  } catch (e) {
    if (ownClient) await runner.query('ROLLBACK')
    throw e
  } finally {
    if (ownClient) (runner as PoolClient).release()
  }
}

export async function upsertTimedBuff(
  characterId: number,
  sourceType: string,
  sourceId: string,
  statKey: string,
  statValue: number,
  durationSec: number,
  client?: PoolClient
): Promise<void> {
  const pool = getPool()
  const runner = client || pool
  const expiresAt = new Date(Date.now() + durationSec * 1000)
  await runner.query(
    `INSERT INTO timed_buffs
      (character_id, source_type, source_id, stat_key, stat_value, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (character_id, source_type, source_id, stat_key)
     DO UPDATE SET
       stat_value = EXCLUDED.stat_value,
       expires_at = GREATEST(timed_buffs.expires_at, EXCLUDED.expires_at)`,
    [characterId, sourceType, sourceId, statKey, statValue, expiresAt]
  )
}

/**
 * 领取邮件附件，事务内将附件转化为真实资产
 */
export async function claimMailAttachments(
  characterId: number,
  mailId: number
): Promise<{ ok: boolean; message: string; granted?: MailAttachment[] }> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT * FROM mails WHERE id = $1 AND character_id = $2 FOR UPDATE`,
      [mailId, characterId]
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return { ok: false, message: '邮件不存在' }
    }
    const mail = rows[0]
    if (mail.is_claimed) {
      await client.query('ROLLBACK')
      return { ok: false, message: '附件已领取' }
    }
    const attachments: MailAttachment[] = mail.attachments || []
    for (const att of attachments) {
      await grantAttachment(client, characterId, att)
    }
    await client.query(
      `UPDATE mails SET is_claimed = TRUE, is_read = TRUE,
         claimed_at = NOW(), read_at = COALESCE(read_at, NOW())
       WHERE id = $1`,
      [mailId]
    )
    await client.query('COMMIT')
    return { ok: true, message: '领取成功', granted: attachments }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export async function grantAttachment(client: PoolClient, characterId: number, att: MailAttachment): Promise<void> {
  switch (att.type) {
    case 'spirit_stone':
      await client.query(
        `UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2`,
        [att.amount, characterId]
      )
      break
    case 'exp':
      await client.query(
        `UPDATE characters SET cultivation_exp = cultivation_exp + $1 WHERE id = $2`,
        [att.amount, characterId]
      )
      break
    case 'contribution':
      await client.query(
        `UPDATE sect_members SET contribution = contribution + $1,
            total_contribution = total_contribution + $1,
            weekly_contribution = weekly_contribution + $1
          WHERE character_id = $2`,
        [att.amount, characterId]
      )
      break
    case 'material':
      await client.query(
        `INSERT INTO character_materials (character_id, material_id, quality, count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (character_id, material_id, quality)
         DO UPDATE SET count = character_materials.count + EXCLUDED.count`,
        [characterId, att.itemId, att.quality || 'blue', att.qty]
      )
      break
    case 'pill':
      await client.query(
        `INSERT INTO character_pills (character_id, pill_id, quality_factor, count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (character_id, pill_id, quality_factor)
         DO UPDATE SET count = character_pills.count + EXCLUDED.count`,
        [characterId, att.pillId, att.qualityFactor ?? 1.0, att.qty]
      )
      break
    case 'recipe':
      await client.query(
        `INSERT INTO character_unlocked_recipes (character_id, pill_id)
         VALUES ($1, $2)
         ON CONFLICT (character_id, pill_id) DO NOTHING`,
        [characterId, att.recipeId]
      )
      break
    case 'title':
      await client.query(
        `UPDATE characters SET title = $1 WHERE id = $2`,
        [att.titleKey, characterId]
      )
      await upsertTimedBuff(
        characterId,
        'title_' + att.titleKey,
        String(att.titleKey),
        'title_expires',
        0,
        att.duration,
        client
      )
      break
    case 'timed_buff':
      await upsertTimedBuff(
        characterId,
        att.sourceType,
        att.sourceId || '',
        att.statKey,
        att.statValue,
        att.duration,
        client
      )
      break
  }
}

/**
 * 清理过期邮件：对仍有未领取附件的，自动发放后删除。
 */
export async function cleanupExpiredMails(): Promise<{ autoGranted: number; deleted: number }> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: expiredUnclaimed } = await client.query(
      `SELECT id, character_id, attachments FROM mails
        WHERE expires_at < NOW() AND is_claimed = FALSE`
    )
    let autoGranted = 0
    for (const m of expiredUnclaimed) {
      const atts: MailAttachment[] = m.attachments || []
      for (const att of atts) {
        try {
          await grantAttachment(client, m.character_id, att)
        } catch (e) {
          console.error('[mail auto-grant] failed', m.id, e)
        }
      }
      autoGranted++
    }
    const { rowCount } = await client.query(`DELETE FROM mails WHERE expires_at < NOW()`)
    await client.query('COMMIT')
    return { autoGranted, deleted: rowCount || 0 }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
