import { getPool } from '~/server/database/db'
import { writeAudit, getClientIp, loadTargetCharacter } from '~/server/utils/adminAudit'

// 发道具：character_pills 表写入
// body: { pill_id: string, count: number, quality_factor?: number (默认 1.0) }
export default defineEventHandler(async (event) => {
  const characterId = Number(event.context.params?.id)
  const { pill_id, count, quality_factor } = await readBody<{ pill_id: string; count: number; quality_factor?: number }>(event)
  const pillId = String(pill_id || '').trim()
  const n = Math.trunc(Number(count))
  const qf = Number(quality_factor) || 1.0
  if (!pillId) return { code: 400, message: 'pill_id 必填' }
  if (!Number.isFinite(n) || n < 1 || n > 9999) return { code: 400, message: 'count 范围 1-9999' }

  const target = await loadTargetCharacter(characterId)
  if (!target) return { code: 404, message: '玩家不存在' }

  const pool = getPool()
  await pool.query(
    `INSERT INTO character_pills (character_id, pill_id, quality_factor, count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (character_id, pill_id, quality_factor)
     DO UPDATE SET count = character_pills.count + EXCLUDED.count`,
    [characterId, pillId, qf, n]
  )

  await writeAudit({
    adminId: event.context.adminId,
    action: 'grant_item',
    targetCharacterId: characterId,
    payload: { pill_id: pillId, count: n, quality_factor: qf, characterName: target.name },
    ip: getClientIp(event),
  })

  return { code: 200, message: `已发放 ${pillId} ×${n}` }
})
