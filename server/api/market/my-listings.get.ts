import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const q = getQuery(event)
    const status = String(q.status || 'active')
    const allowed = new Set(['active', 'sold', 'cancelled', 'expired', 'all'])
    if (!allowed.has(status)) return { code: 400, message: 'status 参数非法' }

    const where: string[] = ['seller_id = $1']
    const args: any[] = [char.id]
    if (status !== 'all') {
      args.push(status)
      where.push(`status = $${args.length}`)
    }
    // 仅展示最近 30 天
    where.push(`created_at > NOW() - INTERVAL '30 days'`)

    const { rows } = await pool.query(
      `SELECT id, category, category_key, item_snapshot, quantity,
              unit_price, total_price, status, created_at, expires_at,
              closed_at, buyer_id, tax_amount, seller_received
         FROM market_listings
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT 100`,
      args
    )

    return {
      code: 200,
      data: rows.map((r: any) => ({
        id: Number(r.id),
        item_snapshot: r.item_snapshot,
        quantity: r.quantity,
        unit_price: Number(r.unit_price),
        total_price: Number(r.total_price),
        status: r.status,
        created_at: r.created_at,
        expires_at: r.expires_at,
        closed_at: r.closed_at,
        buyer_id: r.buyer_id,
        tax_amount: Number(r.tax_amount || 0),
        seller_received: Number(r.seller_received || 0),
      })),
    }
  } catch (error) {
    console.error('查询我的挂单失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
