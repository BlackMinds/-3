import { getPool } from '~/server/database/db'
import { grantAttachment, type MailAttachment } from '~/server/utils/mail'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const body = await readBody(event)
  const code = String(body?.code || '').trim().toUpperCase()
  if (!code) return { code: 400, message: '请输入兑换码' }
  if (code.length > 32) return { code: 400, message: '兑换码格式错误' }

  const { rows: charRows } = await pool.query(
    'SELECT id FROM characters WHERE user_id = $1',
    [event.context.userId]
  )
  if (charRows.length === 0) return { code: 400, message: '角色不存在' }
  const charId = charRows[0].id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: codeRows } = await client.query(
      `SELECT code, attachments, expires_at, enabled
         FROM redeem_codes WHERE code = $1`,
      [code]
    )
    if (codeRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '兑换码不存在' }
    }
    const def = codeRows[0]
    if (!def.enabled) {
      await client.query('ROLLBACK')
      return { code: 400, message: '该兑换码已停用' }
    }
    if (def.expires_at && new Date(def.expires_at).getTime() < Date.now()) {
      await client.query('ROLLBACK')
      return { code: 400, message: '兑换码已过期' }
    }

    // 幂等占坑：UNIQUE(code, character_id) 触发冲突 = 已领过
    const { rowCount: claimed } = await client.query(
      `INSERT INTO redeem_code_claims (code, character_id)
         VALUES ($1, $2)
         ON CONFLICT (code, character_id) DO NOTHING`,
      [code, charId]
    )
    if (!claimed) {
      await client.query('ROLLBACK')
      return { code: 400, message: '该兑换码你已领取过' }
    }

    const attachments: MailAttachment[] = def.attachments || []
    for (const att of attachments) {
      await grantAttachment(client, charId, att)
    }

    await client.query('COMMIT')

    return {
      code: 200,
      message: '兑换成功',
      data: { rewards: attachments },
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('兑换码领取失败:', e)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
