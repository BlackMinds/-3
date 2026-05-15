import { getPool } from '~/server/database/db'
import { writeAudit, getClientIp, loadTargetCharacter } from '~/server/utils/adminAudit'

// 降级：level -= levels（保底 1）；level_exp 归 0
// body: { levels: number }
export default defineEventHandler(async (event) => {
  const characterId = Number(event.context.params?.id)
  const { levels } = await readBody<{ levels: number }>(event)
  const n = Math.trunc(Number(levels))
  if (!Number.isFinite(n) || n < 1 || n > 200) return { code: 400, message: 'levels 范围 1-200' }

  const target = await loadTargetCharacter(characterId)
  if (!target) return { code: 404, message: '玩家不存在' }

  const pool = getPool()
  const { rows: before } = await pool.query(`SELECT level FROM characters WHERE id = $1`, [characterId])
  const { rows } = await pool.query(
    `UPDATE characters SET level = GREATEST(1, level - $2), level_exp = 0 WHERE id = $1 RETURNING level`,
    [characterId, n]
  )

  await writeAudit({
    adminId: event.context.adminId,
    action: 'level_down',
    targetCharacterId: characterId,
    payload: { levels: n, before: before[0].level, after: rows[0].level, characterName: target.name },
    ip: getClientIp(event),
  })

  return { code: 200, message: `已降级 Lv.${before[0].level} → Lv.${rows[0].level}`, data: { before: before[0].level, after: rows[0].level } }
})
