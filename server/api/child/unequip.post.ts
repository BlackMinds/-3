// 卸下子女装备 - POST /api/child/unequip
// body: { equipment_id }

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const equipId = Number(body?.equipment_id)
    if (!equipId) return { code: 400, message: '参数错误' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query(
      `SELECT ce.id, ce.is_equipped, ce.name
         FROM child_equipment ce
         JOIN children c ON c.id = ce.child_id
        WHERE ce.id = $1 AND c.character_id = $2`,
      [equipId, char.id]
    )
    if (rows.length === 0) return { code: 404, message: '装备不存在' }
    if (!rows[0].is_equipped) return { code: 400, message: '该装备未穿戴' }

    await pool.query('UPDATE child_equipment SET is_equipped = FALSE WHERE id = $1', [equipId])
    return { code: 200, message: `已卸下「${rows[0].name}」` }
  } catch (error) {
    console.error('卸下装备失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
