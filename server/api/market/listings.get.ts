import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'
import { getReferencePrice } from '~/server/utils/market'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const q = getQuery(event)
    const page = Math.max(1, Number(q.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 20))
    const offset = (page - 1) * pageSize
    const sort = String(q.sort || 'time_desc')

    const where: string[] = [`status = 'active'`, `expires_at > NOW()`]
    const args: any[] = []

    if (q.rarity) { args.push(String(q.rarity)); where.push(`item_snapshot->>'rarity' = $${args.length}`) }
    if (q.tier)   { args.push(Number(q.tier));    where.push(`(item_snapshot->>'tier')::int = $${args.length}`) }
    if (q.slot)   { args.push(String(q.slot));    where.push(`item_snapshot->>'base_slot' = $${args.length}`) }
    if (q.weapon_type) { args.push(String(q.weapon_type)); where.push(`item_snapshot->>'weapon_type' = $${args.length}`) }
    if (q.set_id) {
      const setVal = String(q.set_id)
      if (setVal === 'none') {
        where.push(`(item_snapshot->>'set_id' IS NULL OR item_snapshot->>'set_id' = '')`)
      } else {
        args.push(setVal); where.push(`item_snapshot->>'set_id' = $${args.length}`)
      }
    }
    if (q.enhance_min != null) { args.push(Number(q.enhance_min)); where.push(`(item_snapshot->>'enhance_level')::int >= $${args.length}`) }
    if (q.enhance_max != null) { args.push(Number(q.enhance_max)); where.push(`(item_snapshot->>'enhance_level')::int <= $${args.length}`) }

    let orderBy = 'created_at DESC'
    if (sort === 'price_asc')  orderBy = 'unit_price ASC, created_at DESC'
    if (sort === 'price_desc') orderBy = 'unit_price DESC, created_at DESC'

    const whereSql = where.join(' AND ')

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM market_listings WHERE ${whereSql}`,
      args
    )
    const total = countRows[0].total

    args.push(pageSize); args.push(offset)
    const { rows } = await pool.query(
      `SELECT l.id, l.seller_id, c.name AS seller_name,
              l.category, l.category_key, l.item_snapshot, l.quantity,
              l.unit_price, l.total_price, l.created_at, l.expires_at
         FROM market_listings l
         JOIN characters c ON c.id = l.seller_id
        WHERE ${whereSql}
        ORDER BY ${orderBy}
        LIMIT $${args.length - 1} OFFSET $${args.length}`,
      args
    )

    // 批量计算参考价（去重 key）
    const keyMap = new Map<string, { price: number; method: string }>()
    for (const r of rows) {
      if (keyMap.has(r.category_key)) continue
      const snap = r.item_snapshot
      const ref = await getReferencePrice(r.category_key, {
        rarity: snap.rarity,
        tier: snap.tier ?? 1,
        enhance: snap.enhance_level ?? 0,
      })
      keyMap.set(r.category_key, ref)
    }

    let items = rows.map((r: any) => {
      const ref = keyMap.get(r.category_key)!
      const refPrice = ref.price
      const unitPrice = Number(r.unit_price)
      const diff = refPrice > 0 ? (unitPrice - refPrice) / refPrice : 0
      return {
        id: Number(r.id),
        seller_id: r.seller_id,
        seller_name: r.seller_name,
        item_snapshot: r.item_snapshot,
        quantity: r.quantity,
        unit_price: unitPrice,
        total_price: Number(r.total_price),
        ref_price: refPrice,
        ref_method: ref.method,
        price_diff_pct: diff,
        created_at: r.created_at,
        expires_at: r.expires_at,
        is_self: r.seller_id === char.id,
      }
    })

    if (sort === 'cost_performance') {
      items = items.sort((a, b) => a.price_diff_pct - b.price_diff_pct)
    }

    return { code: 200, data: { items, total, page, pageSize } }
  } catch (error) {
    console.error('坊市浏览失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
