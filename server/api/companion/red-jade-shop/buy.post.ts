// 红尘玉商店购买 - POST /api/companion/red-jade-shop/buy
// body: { item_id }
// 校验限购 + 扣红尘玉 + 发物品（material → character_materials, pill → character_pills）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { RED_JADE_SHOP_MAP, getPeriodKey } from '~/server/engine/redJadeShopData'
import { rollChildEquipFromBox, type ChildRarity } from '~/server/engine/childEquipData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const itemId = String(body?.item_id || '')
    if (!itemId) return { code: 400, message: '参数错误' }

    const item = RED_JADE_SHOP_MAP[itemId]
    if (!item) return { code: 400, message: '商品不存在' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    // 限购检查
    const periodKey = getPeriodKey(item.limit.type)
    const { rows: pRows } = await pool.query(
      `SELECT count FROM character_red_jade_purchases
        WHERE character_id = $1 AND item_id = $2 AND period_type = $3 AND period_key = $4`,
      [char.id, item.id, item.limit.type, periodKey]
    )
    const bought = pRows[0]?.count || 0
    if (bought >= item.limit.count) {
      return { code: 400, message: `本${item.limit.type === 'week' ? '周' : '月'}限购已达 ${item.limit.count}` }
    }

    // 红尘玉检查
    if ((char.red_jade || 0) < item.price) {
      return { code: 400, message: `红尘玉不足，需 ${item.price}` }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 扣红尘玉
      await client.query(
        'UPDATE characters SET red_jade = red_jade - $1 WHERE id = $2',
        [item.price, char.id]
      )

      // 累加限购计数（UPSERT）
      await client.query(
        `INSERT INTO character_red_jade_purchases
           (character_id, item_id, period_type, period_key, count)
         VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT (character_id, item_id, period_type, period_key)
         DO UPDATE SET count = character_red_jade_purchases.count + 1`,
        [char.id, item.id, item.limit.type, periodKey]
      )

      // 发物品
      if (item.give.kind === 'material') {
        const quality = item.give.quality || 'white'
        await client.query(
          `INSERT INTO character_materials (character_id, material_id, count, quality)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (character_id, material_id, quality)
           DO UPDATE SET count = character_materials.count + EXCLUDED.count`,
          [char.id, item.give.itemId, item.give.qty, quality]
        )
      } else if (item.give.kind === 'child_box') {
        // 子女装备宝箱：必须传 child_id，立即开成装备入 child_equipment
        const childId = Number(body?.child_id)
        if (!childId) throw new Error('购买子女宝箱需要指定 child_id')
        const { rows: childRows } = await client.query(
          'SELECT id, level FROM children WHERE id = $1 AND character_id = $2',
          [childId, char.id]
        )
        if (childRows.length === 0) throw new Error('指定的子女不存在')
        // boxRarity 从 itemId 解析：child_box_green → green
        const boxRarity = item.give.itemId.replace('child_box_', '') as ChildRarity
        const equip = rollChildEquipFromBox(boxRarity, childRows[0].level || 1)
        await client.query(
          `INSERT INTO child_equipment (child_id, slot, name, rarity, tier, primary_stat, sub_stats)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
          [childId, equip.slot, equip.name, equip.rarity, equip.tier,
           JSON.stringify(equip.primary_stat),
           equip.sub_stats ? JSON.stringify(equip.sub_stats) : null]
        )
      } else {
        // pill
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
           VALUES ($1, $2, $3, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor)
           DO UPDATE SET count = character_pills.count + EXCLUDED.count`,
          [char.id, item.give.itemId, item.give.qty]
        )
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      message: `购买成功：${item.name}`,
      data: {
        itemId: item.id,
        priceDeducted: item.price,
        remaining: item.limit.count - bought - 1,
      },
    }
  } catch (error) {
    console.error('红尘玉商店购买失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
