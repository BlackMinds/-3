import { getPool } from '~/server/database/db'
import { writeAudit, getClientIp, loadTargetCharacter } from '~/server/utils/adminAudit'

// 发/扣货币：灵石 / 修为
// body: { kind: 'spirit_stone' | 'cultivation_exp', amount: number (可负) }
const FIELDS: Record<string, string> = {
  spirit_stone: 'spirit_stone',
  cultivation_exp: 'cultivation_exp',
}

export default defineEventHandler(async (event) => {
  const characterId = Number(event.context.params?.id)
  const { kind, amount } = await readBody<{ kind: string; amount: number }>(event)
  const amt = Math.trunc(Number(amount))
  if (!Number.isFinite(amt) || amt === 0) return { code: 400, message: 'amount 非法或为 0' }
  const field = FIELDS[kind]
  if (!field) return { code: 400, message: 'kind 必须是 spirit_stone / cultivation_exp' }

  const target = await loadTargetCharacter(characterId)
  if (!target) return { code: 404, message: '玩家不存在' }

  const pool = getPool()
  const { rows } = await pool.query(
    `UPDATE characters SET ${field} = GREATEST(0, ${field} + $2) WHERE id = $1 RETURNING ${field} AS v`,
    [characterId, amt]
  )

  await writeAudit({
    adminId: event.context.adminId,
    action: 'grant_currency',
    targetCharacterId: characterId,
    payload: { kind, amount: amt, after: rows[0].v, characterName: target.name },
    ip: getClientIp(event),
  })

  return { code: 200, message: `已${amt > 0 ? '发放' : '扣除'} ${kind}`, data: { after: rows[0].v } }
})
