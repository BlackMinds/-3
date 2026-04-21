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

  const expires = new Date(Date.now() + 24 * 3600 * 1000)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁 occupation 行，事务内读最新守卫数，防并发驻守超员
    const { rows: occRows } = await client.query(
      `SELECT sect_id, current_guard_count FROM spirit_vein_occupation
       WHERE node_id = $1 FOR UPDATE`,
      [nodeId]
    )
    if (occRows.length === 0 || occRows[0].sect_id !== membership.sect_id) {
      await client.query('ROLLBACK')
      return { code: 400, message: '节点非本宗门占领，请先发起偷袭攻占' }
    }
    if (Number(occRows[0].current_guard_count) >= node.guard_limit) {
      await client.query('ROLLBACK')
      return { code: 400, message: '该节点守卫已满员' }
    }

    // 事务内复查：该玩家是否已在其他节点守
    const { rows: exist } = await client.query(
      `SELECT node_id FROM spirit_vein_guard WHERE character_id = $1 AND expires_at > NOW() FOR UPDATE`,
      [char.id]
    )
    if (exist.length > 0 && !exist.some((r: any) => r.node_id === nodeId)) {
      await client.query('ROLLBACK')
      return { code: 400, message: '你已在其他节点驻守，先离岗再重新选择' }
    }

    await client.query(
      `INSERT INTO spirit_vein_guard (node_id, character_id, sect_id, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (node_id, character_id) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [nodeId, char.id, membership.sect_id, expires]
    )
    // 在同一事务内刷新计数（refreshGuardCount 接受可选 client）
    await refreshGuardCount(nodeId, client)

    await client.query('COMMIT')
    return { code: 200, message: '已驻守', data: { expiresAt: expires.toISOString() } }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('驻守失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
