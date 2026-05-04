import { getPool } from '~/server/database/db'
import { getCharId, getActiveLoadoutId, syncLoadoutSlot } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { equip_id } = await readBody(event)
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    // 先读出当前 slot，用于同步清掉激活方案对应 key
    const { rows: slotRows } = await pool.query(
      'SELECT slot FROM character_equipment WHERE id = $1 AND character_id = $2',
      [equip_id, char.id]
    )
    const oldSlot: string | null = slotRows[0]?.slot || null

    await pool.query(
      'UPDATE character_equipment SET slot = NULL WHERE id = $1 AND character_id = $2',
      [equip_id, char.id]
    )

    if (oldSlot) {
      const activeLoadout = await getActiveLoadoutId(char.id)
      await syncLoadoutSlot(char.id, activeLoadout, oldSlot, null)
    }

    return { code: 200, message: '已卸下' }
  } catch (error) {
    console.error('卸下装备失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
