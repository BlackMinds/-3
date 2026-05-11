// 设助战子女 - POST /api/child/set-battling
// body: { child_id }   （null 表示取消助战）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildById } from '~/server/utils/child'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const childId = body?.child_id ? Number(body.child_id) : null

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    if (childId !== null) {
      const c = await getChildById(pool, childId, char.id)
      if (!c) return { code: 404, message: '子女不存在' }
      if (c.has_left_home) return { code: 400, message: '已离家子女不可助战' }
      if (c.level < 31) return { code: 400, message: '子女需达少年期（Lv.31）才能助战' }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // 1. 重置所有子女 is_battling
      await client.query('UPDATE children SET is_battling = FALSE WHERE character_id = $1', [char.id])
      // 2. 标记新助战
      if (childId !== null) {
        await client.query('UPDATE children SET is_battling = TRUE WHERE id = $1', [childId])
      }
      // 3. 更新 characters.battling_child_id
      await client.query(
        'UPDATE characters SET battling_child_id = $1 WHERE id = $2',
        [childId, char.id]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      message: childId === null ? '已取消助战' : '助战配置成功',
      data: { battlingChildId: childId },
    }
  } catch (error) {
    console.error('设助战失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
