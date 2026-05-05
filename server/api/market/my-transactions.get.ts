import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const q = getQuery(event)
    const role = String(q.role || 'all') // 'buy' / 'sell' / 'all'

    const where: string[] = ['(t.seller_id = $1 OR t.buyer_id = $1)']
    const args: any[] = [char.id]
    if (role === 'buy') where[0] = 't.buyer_id = $1'
    else if (role === 'sell') where[0] = 't.seller_id = $1'
    where.push(`t.created_at > NOW() - INTERVAL '30 days'`)

    const { rows } = await pool.query(
      `SELECT t.id, t.listing_id, t.seller_id, t.buyer_id,
              t.category, t.category_key, t.quantity,
              t.unit_price, t.total_price, t.tax_amount, t.seller_received,
              t.created_at,
              cs.name AS seller_name, cb.name AS buyer_name,
              l.item_snapshot
         FROM market_transactions t
         JOIN characters cs ON cs.id = t.seller_id
         JOIN characters cb ON cb.id = t.buyer_id
         JOIN market_listings l ON l.id = t.listing_id
        WHERE ${where.join(' AND ')}
        ORDER BY t.created_at DESC
        LIMIT 100`,
      args
    )

    return {
      code: 200,
      data: rows.map((r: any) => ({
        id: Number(r.id),
        listing_id: Number(r.listing_id),
        role: r.seller_id === char.id ? 'sell' : 'buy',
        seller_id: r.seller_id,
        buyer_id: r.buyer_id,
        seller_name: r.seller_name,
        buyer_name: r.buyer_name,
        item_snapshot: r.item_snapshot,
        quantity: r.quantity,
        unit_price: Number(r.unit_price),
        total_price: Number(r.total_price),
        tax_amount: Number(r.tax_amount),
        seller_received: Number(r.seller_received),
        created_at: r.created_at,
      })),
    }
  } catch (error) {
    console.error('查询坊市流水失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
