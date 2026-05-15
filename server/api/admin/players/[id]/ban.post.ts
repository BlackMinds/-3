import { getPool } from '~/server/database/db'
import { writeAudit, getClientIp, loadTargetCharacter } from '~/server/utils/adminAudit'

// 封号：users.status = 0
// body: { reason?: string }
export default defineEventHandler(async (event) => {
  const characterId = Number(event.context.params?.id)
  const { reason } = await readBody<{ reason?: string }>(event)

  const target = await loadTargetCharacter(characterId)
  if (!target) return { code: 404, message: '玩家不存在' }

  const pool = getPool()
  await pool.query(`UPDATE users SET status = 0 WHERE id = $1`, [target.user_id])

  await writeAudit({
    adminId: event.context.adminId,
    action: 'ban',
    targetCharacterId: characterId,
    payload: { userId: target.user_id, reason: (reason || '').slice(0, 200), characterName: target.name },
    ip: getClientIp(event),
  })

  return { code: 200, message: `已封号「${target.name}」` }
})
