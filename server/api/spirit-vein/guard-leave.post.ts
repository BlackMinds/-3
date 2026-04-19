import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'
import { refreshGuardCount } from '~/server/utils/spiritVein'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const pool = getPool()
  const { rows } = await pool.query(
    `DELETE FROM spirit_vein_guard WHERE character_id = $1 RETURNING node_id`,
    [char.id]
  )
  for (const r of rows) {
    await refreshGuardCount(r.node_id)
  }
  return { code: 200, message: rows.length ? '已离岗' : '未在驻守', data: { removed: rows.length } }
})
