import { getPool } from '~/server/database/db'
import { getCharId, consumeSpecialItem } from '~/server/utils/equipment'
import { generateEquipName } from '~/server/engine/equipNameData'
import { EQUIP_SET_MAP } from '~/server/engine/equipSetData'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const equipId = Number(body?.equip_id)
    const setKey = String(body?.set_key || '').trim()
    if (!equipId || !setKey) return { code: 400, message: '参数错误' }

    const targetSet = EQUIP_SET_MAP[setKey]
    if (!targetSet) return { code: 400, message: '目标套装不存在' }

    const pool = getPool()
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    const charId = char.id

    const { rows: eqRows } = await pool.query(
      'SELECT id, name, rarity, primary_stat, set_id, base_slot, weapon_type, tier FROM character_equipment WHERE id = $1 AND character_id = $2',
      [equipId, charId]
    )
    if (eqRows.length === 0) return { code: 400, message: '装备不存在或不属于你' }
    const eq = eqRows[0]
    if (!eq.set_id) return { code: 400, message: '该装备无套装身份，无需重铸' }
    if (eq.set_id === setKey) return { code: 400, message: '该装备已是此套装' }

    const weaponRequired = (targetSet.tiers[0]?.hooks as any)?.weaponRequired
    if (weaponRequired && eq.base_slot === 'weapon' && eq.weapon_type !== weaponRequired) {
      const weaponLabel: Record<string, string> = { sword: '剑', blade: '刀', spear: '枪', fan: '扇' }
      return { code: 400, message: `${targetSet.name} 的武器槽仅可重铸到「${weaponLabel[weaponRequired] || weaponRequired}」类武器` }
    }

    const used = await consumeSpecialItem(charId, 'set_reforge_voucher')
    if (!used) return { code: 400, message: '套装重铸符不足' }

    const newName = generateEquipName(
      eq.rarity,
      eq.base_slot || 'weapon',
      eq.weapon_type,
      eq.tier || 1,
      eq.primary_stat,
      null,
      '重铸',
      setKey,
    )

    await pool.query(
      'UPDATE character_equipment SET set_id = $1, name = $2 WHERE id = $3',
      [setKey, newName, equipId]
    )

    return {
      code: 200,
      message: `重铸成功，已转为【${targetSet.name}】`,
      data: { name: newName, set_id: setKey },
    }
  } catch (error) {
    console.error('套装重铸失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
