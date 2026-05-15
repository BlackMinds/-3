import { getPool } from '~/server/database/db'
import { writeAudit, getClientIp, loadTargetCharacter } from '~/server/utils/adminAudit'

// 重置每日次数：秘境 / 通天塔 / 游历
// body: { kind: 'sr_daily' | 'tower_daily' | 'expedition_today' }
const RESET_SQL: Record<string, string> = {
  sr_daily: `UPDATE characters SET sr_daily_count = 0, sr_daily_fail = 0, sr_daily_date = CURRENT_DATE WHERE id = $1`,
  tower_daily: `UPDATE characters SET tower_daily_fail = 0 WHERE id = $1`,
  expedition_today: `UPDATE characters SET expedition_count_today = 0 WHERE id = $1`,
}
const LABELS: Record<string, string> = {
  sr_daily: '秘境每日次数',
  tower_daily: '通天塔每日次数',
  expedition_today: '游历今日次数',
}

export default defineEventHandler(async (event) => {
  const characterId = Number(event.context.params?.id)
  const { kind } = await readBody<{ kind: string }>(event)
  const sql = RESET_SQL[kind]
  if (!sql) return { code: 400, message: 'kind 必须是 sr_daily / tower_daily / expedition_today' }

  const target = await loadTargetCharacter(characterId)
  if (!target) return { code: 404, message: '玩家不存在' }

  await getPool().query(sql, [characterId])

  await writeAudit({
    adminId: event.context.adminId,
    action: 'reset_daily',
    targetCharacterId: characterId,
    payload: { kind, characterName: target.name },
    ip: getClientIp(event),
  })

  return { code: 200, message: `已重置「${LABELS[kind]}」` }
})
