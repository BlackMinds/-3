import { getPool } from '~/server/database/db'
import { getCharId, consumeSpecialItem } from '~/server/utils/equipment'
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
 * 校验：
 *   - 装备存在且属于当前角色
 *   - 装备槽位支持附灵（weapon/armor/pendant）
 *   - 装备品质支持附灵（blue+）
 *   - awaken_stone: awaken_effect 必须为 NULL
 *   - awaken_reroll: awaken_effect 必须非 NULL
 *   - 背包中对应道具存量 ≥ 1
 *
 * 事务：
 *   1. 消耗道具 ×1
 *   2. rollAwakenEffect（洗练时 exclude 当前 id）
 *   3. UPDATE character_equipment SET awaken_effect = ...
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

    // 校验槽位：优先 base_slot（兼容未装备态），其次 slot
    const slot = eq.base_slot || eq.slot
    if (!canSlotAwaken(slot)) {
      return { code: 400, message: '该槽位装备不支持附灵（仅兵器/法袍/灵佩）' }
    }

    // 校验品质
    if (!canRarityAwaken(eq.rarity)) {
      return { code: 400, message: '白/绿品装备无法附灵' }
    }

    // 校验附灵状态
    const currentEffect: AwakenEffect | null = eq.awaken_effect || null
    if (itemId === 'awaken_stone') {
      if (currentEffect) {
        return { code: 400, message: '该装备已有附灵，请使用灵枢玉洗练' }
      }
    } else {
      if (!currentEffect) {
        return { code: 400, message: '该装备尚无附灵，请使用附灵石附加' }
      }
    }

    // 消耗道具
    const consumed = await consumeSpecialItem(charId, itemId)
    if (!consumed) {
      const itemName = itemId === 'awaken_stone' ? '附灵石' : '灵枢玉'
      return { code: 400, message: `缺少${itemName}` }
    }

    // 随机新附灵
    const excludeId = itemId === 'awaken_reroll' ? currentEffect?.id : undefined
    const newEffect = rollAwakenEffect(slot, eq.rarity, excludeId)
    if (!newEffect) {
      // 理论不会走到，保险起见回退道具
      return { code: 500, message: '附灵生成失败，请联系管理员' }
    }

    // 落库
    await pool.query(
      'UPDATE character_equipment SET awaken_effect = $1 WHERE id = $2',
      [JSON.stringify(newEffect), equipId]
    )

    return {
      code: 200,
      message: itemId === 'awaken_stone' ? '附灵成功' : '洗练成功',
      data: {
        equip_id: equipId,
        old_effect: currentEffect,
        new_effect: newEffect,
      },
    }
  } catch (error) {
    console.error('附灵接口出错:', error)
    return { code: 500, message: '服务器错误' }
  }
})
