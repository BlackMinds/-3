import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'
import {
  rollAwakenEffect,
  canSlotAwaken,
  canRarityAwaken,
  type AwakenEffect,
} from '~/game/awakenData'

/**
 * 装备附灵接口
 *
 * 入参：
 *   - equip_id: 装备 id
 *   - item_id: 'awaken_stone' | 'awaken_reroll'
 *
 * 顺序：
 *   1. rollAwakenEffect（纯内存，失败立即返回，不消耗道具）
 *   2. 事务：条件扣道具 → UPDATE awaken_effect → COMMIT
 */
export default defineEventHandler(async (event) => {
  try {
  const body = await readBody(event)
  const equipId = Number(body?.equip_id)
  const itemId = String(body?.item_id || '')

  if (!equipId) return { code: 400, message: '装备 id 无效' }
  if (itemId !== 'awaken_stone' && itemId !== 'awaken_reroll') {
    return { code: 400, message: '道具 id 无效' }
  }

  const char = await getCharId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const charId = char.id

  const pool = getPool()
  const { rows: eqRows } = await pool.query(
    `SELECT id, base_slot, slot, rarity, awaken_effect
     FROM character_equipment
     WHERE id = $1 AND character_id = $2`,
    [equipId, charId]
  )
  if (eqRows.length === 0) return { code: 400, message: '装备不存在' }
  const eq = eqRows[0]

  const slot = eq.base_slot || eq.slot
  if (!canSlotAwaken(slot)) {
    return { code: 400, message: '该槽位装备不支持附灵（仅兵器/法袍/灵佩）' }
  }
  if (!canRarityAwaken(eq.rarity)) {
    return { code: 400, message: '白/绿品装备无法附灵' }
  }

  // awaken_effect 在 JSONB 列下 pg 通常返回对象；兼容字符串解析防止 pg 驱动差异导致 JSON.parse 错误
  let currentEffect: AwakenEffect | null = null
  if (eq.awaken_effect) {
    currentEffect = typeof eq.awaken_effect === 'string'
      ? JSON.parse(eq.awaken_effect)
      : eq.awaken_effect
  }
  if (itemId === 'awaken_stone') {
    if (currentEffect) return { code: 400, message: '该装备已有附灵，请使用灵枢玉洗练' }
  } else {
    if (!currentEffect) return { code: 400, message: '该装备尚无附灵，请使用附灵石附加' }
  }

  // 步骤 1：先生成新附灵（纯内存，失败立即返回，零副作用）
  const excludeId = itemId === 'awaken_reroll' ? currentEffect?.id : undefined
  const newEffect = rollAwakenEffect(slot, eq.rarity, excludeId)
  if (!newEffect) {
    return { code: 500, message: '附灵生成失败，请联系管理员' }
  }

  // 步骤 2：事务内原子地 消耗道具 + 落库附灵
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 条件扣道具：FOR UPDATE 锁行 + count > 0 校验
    const { rows: pillRows } = await client.query(
      `SELECT id FROM character_pills
       WHERE character_id = $1 AND pill_id = $2 AND count > 0
       LIMIT 1 FOR UPDATE`,
      [charId, itemId]
    )
    if (pillRows.length === 0) {
      await client.query('ROLLBACK')
      const itemName = itemId === 'awaken_stone' ? '附灵石' : '灵枢玉'
      return { code: 400, message: `缺少${itemName}` }
    }
    const { rowCount: consumed } = await client.query(
      'UPDATE character_pills SET count = count - 1 WHERE id = $1 AND count > 0',
      [pillRows[0].id]
    )
    if (!consumed) {
      await client.query('ROLLBACK')
      const itemName = itemId === 'awaken_stone' ? '附灵石' : '灵枢玉'
      return { code: 400, message: `缺少${itemName}` }
    }
    await client.query('DELETE FROM character_pills WHERE id = $1 AND count <= 0', [pillRows[0].id])

    // 装备仍属于该角色 + 附灵状态未被并发改动（avoid 双写覆盖）
    const { rowCount: updated } = await client.query(
      `UPDATE character_equipment SET awaken_effect = $1::jsonb
       WHERE id = $2 AND character_id = $3
         AND ${itemId === 'awaken_stone' ? 'awaken_effect IS NULL' : 'awaken_effect IS NOT NULL'}`,
      [JSON.stringify(newEffect), equipId, charId]
    )
    if (!updated) {
      await client.query('ROLLBACK')
      return { code: 400, message: '装备状态已变化，请刷新后重试' }
    }

    await client.query('COMMIT')

    return {
      code: 200,
      message: itemId === 'awaken_stone' ? '附灵成功' : '洗练成功',
      data: {
        equip_id: equipId,
        old_effect: currentEffect,
        new_effect: newEffect,
      },
    }
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('附灵事务出错:', error)
    return { code: 500, message: '附灵失败：' + (error?.message || '服务器错误') }
  } finally {
    client.release()
  }
  } catch (error: any) {
    console.error('附灵接口出错:', error)
    return { code: 500, message: '附灵失败：' + (error?.message || '服务器错误') }
  }
})
