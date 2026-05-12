// 穿戴子女装备 - POST /api/child/equip
// body: { equipment_id }
// 同槽位旧装备自动卸下

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

    // 校验装备归属 + 拿到 child_id / slot
    const { rows } = await pool.query(
      `SELECT ce.id, ce.child_id, ce.slot, ce.is_equipped, ce.name
         FROM child_equipment ce
         JOIN children c ON c.id = ce.child_id
        WHERE ce.id = $1 AND c.character_id = $2`,
      [equipId, char.id]
    )
    if (rows.length === 0) return { code: 404, message: '装备不存在' }
    const e = rows[0]
    if (e.is_equipped) return { code: 400, message: '已穿戴中' }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // 同槽位旧装备卸下
      await client.query(
        'UPDATE child_equipment SET is_equipped = FALSE WHERE child_id = $1 AND slot = $2 AND is_equipped = TRUE',
        [e.child_id, e.slot]
      )
      // 穿戴新装备
      await client.query(
        'UPDATE child_equipment SET is_equipped = TRUE WHERE id = $1',
        [e.id]
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return { code: 200, message: `已穿戴「${e.name}」` }
  } catch (error) {
    console.error('穿戴装备失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
