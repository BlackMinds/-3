import { getPool } from '~/server/database/db'

// 商品列表
export default defineEventHandler(async () => {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT id, code, name, price_rmb, type, payload, enabled, sort_order,
            created_at, updated_at
       FROM recharge_packages
       ORDER BY sort_order, id`
  )
  return { code: 200, data: { items: rows } }
})
