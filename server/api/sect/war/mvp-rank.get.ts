import { getPool } from '~/server/database/db'

export default defineEventHandler(async () => {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT ca.character_id, ca.progress AS mvp_count, c.name, c.title,
            c.realm_tier, c.realm_stage, c.sect_id, s.name AS sect_name
       FROM character_achievements ca
       JOIN characters c ON ca.character_id = c.id
       LEFT JOIN sects s ON c.sect_id = s.id
      WHERE ca.achievement_id = 'sect_war_mvp_1' AND ca.progress > 0
      ORDER BY ca.progress DESC, ca.completed_at ASC
      LIMIT 50`
  )
  return { code: 200, message: 'ok', data: rows }
})
