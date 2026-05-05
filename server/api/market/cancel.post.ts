import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'
import { dispatchReturnMail, MARKET_CANCEL_FEE_RATIO } from '~/server/utils/market'

export default defineEventHandler(async (event) => {
  try {
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const body = await readBody(event)
    const listingId = Number(body?.listing_id)
    if (!listingId || !Number.isInteger(listingId)) {
      return { code: 400, message: '挂单 ID 非法' }
    }

    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const { rows } = await client.query(
        `SELECT * FROM market_listings WHERE id = $1 FOR UPDATE`,
        [listingId]
      )
      if (rows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '挂单不存在' }
      }
      const listing = rows[0]
      if (listing.seller_id !== char.id) {
        await client.query('ROLLBACK')
        return { code: 403, message: '无权操作他人挂单' }
      }
      if (listing.status !== 'active') {
        await client.query('ROLLBACK')
        return { code: 400, message: '该挂单已不可下架' }
      }

      const fee = Math.floor(Number(listing.total_price) * MARKET_CANCEL_FEE_RATIO)

      // 校验灵石
      const { rows: charRows } = await client.query(
        `SELECT spirit_stone FROM characters WHERE id = $1 FOR UPDATE`,
        [char.id]
      )
      const stone = Number(charRows[0].spirit_stone)
      if (stone < fee) {
        await client.query('ROLLBACK')
        return { code: 400, message: `灵石不足以支付下架费 ${fee.toLocaleString()}` }
      }

      // 扣下架费
      if (fee > 0) {
        await client.query(
          `UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2`,
          [fee, char.id]
        )
      }

      // 状态置 cancelled
      await client.query(
        `UPDATE market_listings SET status = 'cancelled', closed_at = NOW() WHERE id = $1`,
        [listing.id]
      )

      // 装备退回
      await dispatchReturnMail(client, {
        characterId: char.id,
        snapshot: listing.item_snapshot,
        reason: 'cancelled',
        listingId: Number(listing.id),
      })

      await client.query('COMMIT')
      return {
        code: 200,
        message: `已下架，扣除下架费 ${fee.toLocaleString()} 灵石`,
        data: { fee, spirit_stone_after: stone - fee },
      }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('坊市下架失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
