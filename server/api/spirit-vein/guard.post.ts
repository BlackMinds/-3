import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { getActiveCd, refreshGuardCount } from '~/server/utils/spiritVein'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const membership = await getMembership(char.id)
  if (!membership) return { code: 400, message: '未加入宗门' }
  if (!['leader', 'vice_leader', 'elder', 'inner'].includes(membership.role)) {
    return { code: 400, message: '需内门弟子及以上职位' }
  }
  if (char.realm_tier < 2) return { code: 400, message: '境界需 ≥ 筑基期' }

  const body = await readBody(event)
  const nodeId = Number(body?.nodeId)
  if (!Number.isInteger(nodeId) || nodeId < 1 || nodeId > 6) return { code: 400, message: 'nodeId 无效' }

  // CD 校验
  const cd = await getActiveCd(char.id, 'defend_injured')
  if (cd.active) return { code: 400, message: '你正处于闭关疗伤状态' }

  const pool = getPool()
  const { rows: nodeRows } = await pool.query(
    `SELECT n.*, o.sect_id AS occupying_sect_id, o.current_guard_count, o.vacuum_until
       FROM spirit_vein_node n
       LEFT JOIN spirit_vein_occupation o ON o.node_id = n.id
      WHERE n.id = $1`,
    [nodeId]
  )
  if (nodeRows.length === 0) return { code: 400, message: '节点不存在' }
  const node = nodeRows[0]

  // 等级门槛
  const { rows: sectRows } = await pool.query('SELECT level FROM sects WHERE id = $1', [membership.sect_id])
  const sectLevel = sectRows[0]?.level || 0
  if (sectLevel < node.min_sect_level) {
    return { code: 400, message: `宗门等级需 ≥ ${node.min_sect_level}` }
  }

  // 节点必须是本宗门占领（或无主 → 先偷袭打下来才能驻守）
  if (node.occupying_sect_id !== membership.sect_id) {
    return { code: 400, message: '节点非本宗门占领，请先发起偷袭攻占' }
  }
  // 偷袭刚赢下节点后存在 10 分钟真空期（给其他宗门再抢的窗口），
  // 但本宗门人员可以直接驻守（这是战利品）

  // 该玩家是否已在其他节点守？
  const { rows: exist } = await pool.query(
    `SELECT node_id FROM spirit_vein_guard WHERE character_id = $1 AND expires_at > NOW()`,
    [char.id]
  )
  if (exist.length > 0) {
    return { code: 400, message: '你已在其他节点驻守，先离岗再重新选择' }
  }

  // 人数上限
  if (node.current_guard_count >= node.guard_limit) {
    return { code: 400, message: '该节点守卫已满员' }
  }

  const expires = new Date(Date.now() + 24 * 3600 * 1000)
  await pool.query(
    `INSERT INTO spirit_vein_guard (node_id, character_id, sect_id, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (node_id, character_id) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [nodeId, char.id, membership.sect_id, expires]
  )
  await refreshGuardCount(nodeId)
  return { code: 200, message: '已驻守', data: { expiresAt: expires.toISOString() } }
})
