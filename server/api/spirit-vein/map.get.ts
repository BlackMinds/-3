import { getPool } from '~/server/database/db'

export default defineEventHandler(async () => {
  const pool = getPool()
  const { rows: nodes } = await pool.query(
    `SELECT n.id, n.name, n.tier, n.stone_reward, n.exp_reward, n.guard_limit, n.min_sect_level,
            o.sect_id, o.current_guard_count, o.occupied_at, o.next_surge_at, o.vacuum_until,
            s.name AS sect_name, s.level AS sect_level
       FROM spirit_vein_node n
       LEFT JOIN spirit_vein_occupation o ON o.node_id = n.id
       LEFT JOIN sects s ON o.sect_id = s.id
      ORDER BY n.id ASC`
  )
  // 附加：各宗门占领节点数（用于前端显示"众矢之敌"标签）
  const { rows: tallies } = await pool.query(
    `SELECT sect_id, COUNT(*)::int AS cnt FROM spirit_vein_occupation
      WHERE sect_id IS NOT NULL GROUP BY sect_id`
  )
  const sectOccupyMap = Object.fromEntries(tallies.map((t: any) => [t.sect_id, t.cnt]))
  return {
    code: 200,
    message: 'ok',
    data: {
      nodes,
      sectOccupyMap,
      serverNow: new Date().toISOString(),
    },
  }
})
