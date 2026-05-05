import { getPool } from '~/server/database/db'
import { getCharId, removeEquipsFromAllLoadouts } from '~/server/utils/equipment'
import {
  buildCategoryKey,
  checkAccessGate,
  getReferencePrice,
  getOrCreateDailyQuota,
  snapshotEquipment,
  MARKET_PRICE_FLOOR_RATIO,
  MARKET_PRICE_CEILING_RATIO,
  MARKET_LISTING_DURATION_HOURS,
  MARKET_MAX_ACTIVE_LISTINGS,
  MARKET_MAX_DAILY_LISTINGS,
  MARKET_ALLOWED_RARITIES,
  MARKET_MIN_TIER,
} from '~/server/utils/market'

export default defineEventHandler(async (event) => {
  try {
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const body = await readBody(event)
    const inventoryId = Number(body?.source?.inventory_id)
    const unitPrice = Number(body?.unit_price)
    if (!inventoryId || !Number.isInteger(inventoryId)) {
      return { code: 400, message: '装备 ID 非法' }
    }
    if (!unitPrice || unitPrice <= 0 || !Number.isInteger(unitPrice)) {
      return { code: 400, message: '价格必须为正整数' }
    }

    const gate = await checkAccessGate(char.id)
    if (gate) return { code: 403, message: gate }

    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 限额：当日上架次数 / 进行中挂单数
      const quota = await getOrCreateDailyQuota(client, char.id)
      if (quota.listing_count >= MARKET_MAX_DAILY_LISTINGS) {
        await client.query('ROLLBACK')
        return { code: 400, message: `今日上架次数已达上限 (${MARKET_MAX_DAILY_LISTINGS})` }
      }
      const { rows: activeRows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM market_listings WHERE seller_id = $1 AND status = 'active'`,
        [char.id]
      )
      if (activeRows[0].n >= MARKET_MAX_ACTIVE_LISTINGS) {
        await client.query('ROLLBACK')
        return { code: 400, message: `当前进行中的挂单已达上限 (${MARKET_MAX_ACTIVE_LISTINGS})，请下架部分商品后再上架` }
      }

      // 装备校验：存在、归属、未穿戴、未绑定
      const { rows: eqRows } = await client.query(
        `SELECT * FROM character_equipment WHERE id = $1 AND character_id = $2 FOR UPDATE`,
        [inventoryId, char.id]
      )
      if (eqRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '装备不存在或不属于你' }
      }
      const eq = eqRows[0]
      if (eq.slot) {
        await client.query('ROLLBACK')
        return { code: 400, message: '请先卸下该装备再挂售' }
      }
      if (eq.is_bound) {
        await client.query('ROLLBACK')
        return { code: 400, message: '绑定装备不可挂售' }
      }
      if (eq.locked) {
        await client.query('ROLLBACK')
        return { code: 400, message: '已锁定的装备不可挂售' }
      }
      // 检查 loadout 引用
      const { rows: refRows } = await client.query(
        `SELECT loadout_id FROM character_equipment_loadouts l, jsonb_each(l.slots) AS s(k, v)
         WHERE l.character_id = $1 AND (v)::text::int = $2`,
        [char.id, inventoryId]
      )
      if (refRows.length > 0) {
        const ids = refRows.map((r: any) => r.loadout_id).join('/')
        await client.query('ROLLBACK')
        return { code: 400, message: `装备已挂在方案 ${ids}，请先在方案中取下` }
      }

      // 品质 / tier 门槛
      if (!MARKET_ALLOWED_RARITIES.has(eq.rarity)) {
        await client.query('ROLLBACK')
        return { code: 400, code_str: 'ITEM_BELOW_MARKET_THRESHOLD', message: '仅紫色及以上品质装备可挂售' }
      }
      if ((eq.tier ?? 1) < MARKET_MIN_TIER) {
        await client.query('ROLLBACK')
        return { code: 400, code_str: 'ITEM_BELOW_MARKET_THRESHOLD', message: `tier 低于 ${MARKET_MIN_TIER}，不可挂售` }
      }

      // 参考价 + 区间校验
      const enhance = eq.enhance_level ?? 0
      const categoryKey = buildCategoryKey({
        base_slot: eq.base_slot,
        slot: eq.slot,
        rarity: eq.rarity,
        tier: eq.tier,
        enhance_level: enhance,
      })
      const ref = await getReferencePrice(categoryKey, { rarity: eq.rarity, tier: eq.tier, enhance }, client)
      const floor = Math.floor(ref.price * MARKET_PRICE_FLOOR_RATIO)
      const ceiling = Math.floor(ref.price * MARKET_PRICE_CEILING_RATIO)
      if (unitPrice < floor || unitPrice > ceiling) {
        await client.query('ROLLBACK')
        return {
          code: 400,
          message: `价格须在 ${floor.toLocaleString()} ~ ${ceiling.toLocaleString()} 灵石之间`,
        }
      }

      // 清 loadout 引用，删装备
      await removeEquipsFromAllLoadouts(char.id, [inventoryId])
      await client.query('DELETE FROM character_equipment WHERE id = $1', [inventoryId])

      // 写挂单
      const snapshot = snapshotEquipment(eq)
      const expiresAt = new Date(Date.now() + MARKET_LISTING_DURATION_HOURS * 3600_000)
      const { rows: insRows } = await client.query(
        `INSERT INTO market_listings
           (seller_id, category, category_key, item_snapshot, quantity, unit_price, expires_at)
         VALUES ($1, 'equipment', $2, $3::jsonb, 1, $4, $5)
         RETURNING id, total_price, expires_at`,
        [char.id, categoryKey, JSON.stringify(snapshot), unitPrice, expiresAt]
      )

      // quota
      await client.query(
        `UPDATE market_daily_quota SET listing_count = listing_count + 1
          WHERE character_id = $1 AND quota_date = CURRENT_DATE`,
        [char.id]
      )

      await client.query('COMMIT')
      return {
        code: 200,
        message: '挂售成功',
        data: {
          id: Number(insRows[0].id),
          unit_price: unitPrice,
          total_price: Number(insRows[0].total_price),
          expires_at: insRows[0].expires_at,
          ref_price: ref.price,
        },
      }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('坊市上架失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
