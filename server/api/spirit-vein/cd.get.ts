import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const pool = getPool()
  const { rows: cds } = await pool.query(
    `SELECT cd_type, target_node_id, expires_at
       FROM spirit_vein_cooldown
      WHERE character_id = $1 AND expires_at > NOW()`,
    [char.id]
  )
  const { rows: guards } = await pool.query(
    `SELECT g.node_id, n.name AS node_name, g.started_at, g.expires_at
       FROM spirit_vein_guard g JOIN spirit_vein_node n ON g.node_id = n.id
      WHERE g.character_id = $1 AND g.expires_at > NOW()`,
    [char.id]
  )
  const { rows: dailyRows } = await pool.query(
    `SELECT count FROM spirit_vein_daily_raid_count
      WHERE character_id = $1 AND raid_date = CURRENT_DATE`,
    [char.id]
  )
  return {
    code: 200,
    message: 'ok',
    data: {
      cooldowns: cds,
      guarding: guards,
      dailyRaidCount: dailyRows[0]?.count || 0,
      dailyRaidLimit: 10,
    },
  }
})
