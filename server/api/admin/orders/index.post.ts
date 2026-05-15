import { getPool } from '~/server/database/db'
import { deliverPackage, generateOrderNo, supportsQuantity } from '~/server/utils/recharge'

// 创建订单 + 立即发货（GM 手工模式）
// body: { character_id, package_id, quantity?: number (默认 1，仅一次性/道具类支持 > 1), notes? }
export default defineEventHandler(async (event) => {
  const body = await readBody<{ character_id: number; package_id: number; quantity?: number; notes?: string }>(event)
  const characterId = Number(body.character_id)
  const packageId = Number(body.package_id)
  const quantity = Math.max(1, Math.trunc(Number(body.quantity) || 1))
  const notes = (body.notes || '').slice(0, 500)

  if (!characterId || !packageId) {
    return { code: 400, message: 'character_id / package_id 必填' }
  }
  if (quantity > 99) {
    return { code: 400, message: 'quantity 最多 99' }
  }

  const adminId = event.context.adminId as number
  const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
          || getRequestHeader(event, 'x-real-ip')
          || event.node.req.socket?.remoteAddress
          || null

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const charRes = await client.query(
      `SELECT id, name FROM characters WHERE id = $1 FOR UPDATE`,
      [characterId]
    )
    if (charRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 404, message: '玩家不存在' }
    }

    const pkgRes = await client.query(
      `SELECT id, code, name, price_rmb, type, payload, enabled
         FROM recharge_packages WHERE id = $1`,
      [packageId]
    )
    if (pkgRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 404, message: '商品不存在' }
    }
    const pkg = pkgRes.rows[0]
    if (!pkg.enabled) {
      await client.query('ROLLBACK')
      return { code: 400, message: '商品已下架' }
    }
    if (quantity > 1 && !supportsQuantity(pkg.type)) {
      await client.query('ROLLBACK')
      return { code: 400, message: '该商品类型（月卡）不支持批量发货，quantity 必须为 1' }
    }

    // 执行发货
    const deliverResult = await deliverPackage(
      client, characterId,
      { id: pkg.id, code: pkg.code, type: pkg.type, payload: pkg.payload },
      quantity
    )

    // 写订单（一步到位 delivered）；price_rmb 为总价 = 单价 × quantity
    const orderNo = generateOrderNo()
    const totalPrice = Number(pkg.price_rmb) * quantity
    const now = new Date()
    const orderRes = await client.query(
      `INSERT INTO recharge_orders
         (order_no, character_id, package_id, package_snapshot, price_rmb,
          status, pay_channel, paid_at, delivered_at, delivered_by, notes)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'delivered', 'manual', $6, $6, $7, $8)
       RETURNING *`,
      [
        orderNo, characterId, packageId,
        JSON.stringify({
          code: pkg.code, name: pkg.name, type: pkg.type, payload: pkg.payload,
          unit_price_rmb: pkg.price_rmb, quantity, total_price_rmb: totalPrice,
        }),
        totalPrice, now, adminId, notes || null,
      ]
    )

    // 审计
    await client.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_character_id, payload, ip)
       VALUES ($1, 'deliver_order', $2, $3::jsonb, $4)`,
      [
        adminId, characterId,
        JSON.stringify({
          orderId: orderRes.rows[0].id, orderNo,
          packageCode: pkg.code, unitPriceRmb: pkg.price_rmb,
          quantity, totalPriceRmb: totalPrice,
          deliverResult,
        }),
        ip,
      ]
    )

    await client.query('COMMIT')
    return {
      code: 200,
      message: `已发货 → ${charRes.rows[0].name}`,
      data: { order: orderRes.rows[0], deliverResult },
    }
  } catch (e: any) {
    await client.query('ROLLBACK')
    console.error('[admin/orders POST]', e)
    return { code: 500, message: e.message || '发货失败' }
  } finally {
    client.release()
  }
})
