import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'
import {
  checkAccessGate,
  dispatchSaleMails,
  getOrCreateDailyQuota,
  MARKET_TAX_RATE,
  MARKET_MAX_DAILY_TRADE_COUNT,
  MARKET_MAX_DAILY_TRADE_AMOUNT,
} from '~/server/utils/market'

export default defineEventHandler(async (event) => {
  try {
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const body = await readBody(event)
    const listingId = Number(body?.listing_id)
    const expectedUnit = body?.expected_unit_price != null ? Number(body.expected_unit_price) : null
    if (!listingId || !Number.isInteger(listingId)) {
      return { code: 400, message: '挂单 ID 非法' }
    }

    const gate = await checkAccessGate(char.id)
    if (gate) return { code: 403, message: gate }

    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const { rows: lRows } = await client.query(
        `SELECT * FROM market_listings WHERE id = $1 FOR UPDATE`,
        [listingId]
      )
      if (lRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '挂单不存在' }
      }
      const listing = lRows[0]
      if (listing.status !== 'active') {
        await client.query('ROLLBACK')
        return { code: 400, message: '该挂单已不可购买' }
      }
      if (new Date(listing.expires_at).getTime() < Date.now()) {
        await client.query('ROLLBACK')
        return { code: 400, message: '该挂单已过期' }
      }
      if (listing.seller_id === char.id) {
        await client.query('ROLLBACK')
        return { code: 400, message: '不能购买自己的挂单' }
      }
      if (expectedUnit != null && Number(listing.unit_price) !== expectedUnit) {
        await client.query('ROLLBACK')
        return { code: 400, message: '价格已变动，请刷新后重试' }
      }

      const totalPrice = Number(listing.total_price)
      const taxAmount = Math.ceil(totalPrice * MARKET_TAX_RATE)
      const sellerReceived = totalPrice - taxAmount

      // 买家灵石
      const { rows: buyerRows } = await client.query(
        `SELECT spirit_stone FROM characters WHERE id = $1 FOR UPDATE`,
        [char.id]
      )
      const buyerStone = Number(buyerRows[0].spirit_stone)
      if (buyerStone < totalPrice) {
        await client.query('ROLLBACK')
        return { code: 400, message: `灵石不足，需 ${totalPrice.toLocaleString()}` }
      }

      // 双方限额
      const buyerQuota = await getOrCreateDailyQuota(client, char.id)
      if (buyerQuota.buy_count + buyerQuota.sell_count >= MARKET_MAX_DAILY_TRADE_COUNT) {
        await client.query('ROLLBACK')
        return { code: 400, message: `您今日交易件数（买+卖）已达 ${MARKET_MAX_DAILY_TRADE_COUNT} 件上限，请明日再来` }
      }
      if (buyerQuota.buy_amount + buyerQuota.sell_amount + totalPrice > MARKET_MAX_DAILY_TRADE_AMOUNT) {
        await client.query('ROLLBACK')
        return { code: 400, message: '您今日交易额已达上限，请明日再来' }
      }

      const sellerQuota = await getOrCreateDailyQuota(client, listing.seller_id)
      if (sellerQuota.buy_count + sellerQuota.sell_count >= MARKET_MAX_DAILY_TRADE_COUNT) {
        await client.query('ROLLBACK')
        return { code: 400, message: '卖家今日交易件数已达上限' }
      }
      if (sellerQuota.buy_amount + sellerQuota.sell_amount + totalPrice > MARKET_MAX_DAILY_TRADE_AMOUNT) {
        await client.query('ROLLBACK')
        return { code: 400, message: '卖家今日交易额已达上限' }
      }

      // 扣买家灵石
      await client.query(
        `UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2`,
        [totalPrice, char.id]
      )

      // 写流水
      await client.query(
        `INSERT INTO market_transactions
          (listing_id, seller_id, buyer_id, category, category_key, quantity,
           unit_price, total_price, tax_amount, seller_received)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          listing.id, listing.seller_id, char.id, listing.category, listing.category_key,
          listing.quantity, listing.unit_price, totalPrice, taxAmount, sellerReceived,
        ]
      )

      // 标记挂单成交
      await client.query(
        `UPDATE market_listings
            SET status = 'sold', buyer_id = $1, tax_amount = $2,
                seller_received = $3, closed_at = NOW()
          WHERE id = $4`,
        [char.id, taxAmount, sellerReceived, listing.id]
      )

      // 双方 quota
      await client.query(
        `UPDATE market_daily_quota
            SET buy_count = buy_count + 1, buy_amount = buy_amount + $1
          WHERE character_id = $2 AND quota_date = CURRENT_DATE`,
        [totalPrice, char.id]
      )
      await client.query(
        `UPDATE market_daily_quota
            SET sell_count = sell_count + 1, sell_amount = sell_amount + $1
          WHERE character_id = $2 AND quota_date = CURRENT_DATE`,
        [totalPrice, listing.seller_id]
      )

      // 邮件分发
      await dispatchSaleMails(client, {
        sellerId: listing.seller_id,
        buyerId: char.id,
        snapshot: listing.item_snapshot,
        sellerReceived,
        totalPrice,
        listingId: Number(listing.id),
      })

      await client.query('COMMIT')

      return {
        code: 200,
        message: '购买成功，装备已通过邮件送达',
        data: {
          listing_id: Number(listing.id),
          total_price: totalPrice,
          tax_amount: taxAmount,
          spirit_stone_after: buyerStone - totalPrice,
        },
      }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('坊市购买失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
