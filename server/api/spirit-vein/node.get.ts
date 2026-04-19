import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const nodeId = Number(query.id)
  if (!Number.isInteger(nodeId) || nodeId < 1 || nodeId > 6) return { code: 400, message: 'id 无效' }
  const pool = getPool()
  const { rows: nodeRows } = await pool.query(
    `SELECT n.*, o.sect_id, o.current_guard_count, o.occupied_at, o.next_surge_at, o.vacuum_until,
            s.name AS sect_name
       FROM spirit_vein_node n
       LEFT JOIN spirit_vein_occupation o ON o.node_id = n.id
       LEFT JOIN sects s ON o.sect_id = s.id
      WHERE n.id = $1`,
    [nodeId]
  )
  if (nodeRows.length === 0) return { code: 400, message: '节点不存在' }

  const { rows: guards } = await pool.query(
    `SELECT g.character_id, g.started_at, g.expires_at, c.name, c.realm_tier, c.realm_stage, c.level, c.title
       FROM spirit_vein_guard g
       JOIN characters c ON g.character_id = c.id
      WHERE g.node_id = $1 AND g.expires_at > NOW()
      ORDER BY g.started_at ASC`,
    [nodeId]
  )

  const { rows: raids } = await pool.query(
    `SELECT r.id, r.attacker_sect_id, r.defender_sect_id, r.winner_side, r.created_at,
            sa.name AS attacker_name, sd.name AS defender_name
       FROM spirit_vein_raid r
       LEFT JOIN sects sa ON r.attacker_sect_id = sa.id
       LEFT JOIN sects sd ON r.defender_sect_id = sd.id
      WHERE r.node_id = $1
      ORDER BY r.created_at DESC LIMIT 20`,
    [nodeId]
  )

  const { rows: surges } = await pool.query(
    `SELECT sl.*, s.name AS sect_name FROM spirit_vein_surge_log sl
       LEFT JOIN sects s ON sl.sect_id = s.id
      WHERE sl.node_id = $1
      ORDER BY sl.surge_at DESC LIMIT 10`,
    [nodeId]
  )

  return {
    code: 200,
    message: 'ok',
    data: { node: nodeRows[0], guards, recentRaids: raids, recentSurges: surges },
  }
})
