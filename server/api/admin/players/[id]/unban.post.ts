import { getPool } from '~/server/database/db'
import { writeAudit, getClientIp, loadTargetCharacter } from '~/server/utils/adminAudit'

// 解封：users.status = 1
export default defineEventHandler(async (event) => {
  const characterId = Number(event.context.params?.id)

  const target = await loadTargetCharacter(characterId)
  if (!target) return { code: 404, message: '玩家不存在' }

  const pool = getPool()
  await pool.query(`UPDATE users SET status = 1 WHERE id = $1`, [target.user_id])

  await writeAudit({
    adminId: event.context.adminId,
    action: 'unban',
    targetCharacterId: characterId,
    payload: { userId: target.user_id, characterName: target.name },
    ip: getClientIp(event),
  })

  return { code: 200, message: `已解封「${target.name}」` }
})
