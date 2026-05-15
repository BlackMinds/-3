import { getPool } from '~/server/database/db'

// 编辑商品：仅允许改 name / price_rmb / enabled / sort_order
// type 和 payload 涉及发货逻辑，不能在线改（要改请直接编辑 seed 重跑）
export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    return { code: 400, message: '商品 ID 非法' }
  }
  const body = await readBody<{ name?: string; price_rmb?: number; enabled?: boolean; sort_order?: number }>(event)

  const fields: string[] = []
  const params: any[] = []
  if (typeof body.name === 'string') { params.push(body.name); fields.push(`name = $${params.length}`) }
  if (typeof body.price_rmb === 'number') {
    if (body.price_rmb < 0) return { code: 400, message: '价格不能为负' }
    params.push(body.price_rmb); fields.push(`price_rmb = $${params.length}`)
  }
  if (typeof body.enabled === 'boolean') { params.push(body.enabled); fields.push(`enabled = $${params.length}`) }
  if (typeof body.sort_order === 'number') { params.push(body.sort_order); fields.push(`sort_order = $${params.length}`) }
  if (fields.length === 0) return { code: 400, message: '无可更新字段' }

  fields.push('updated_at = NOW()')
  params.push(id)

  const pool = getPool()
  const { rows } = await pool.query(
    `UPDATE recharge_packages SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  )
  if (rows.length === 0) return { code: 404, message: '商品不存在' }

  // 审计
  await pool.query(
    `INSERT INTO admin_audit_log (admin_id, action, payload) VALUES ($1, 'edit_package', $2::jsonb)`,
    [event.context.adminId, JSON.stringify({ packageId: id, changes: body })]
  )

  return { code: 200, data: rows[0] }
})
