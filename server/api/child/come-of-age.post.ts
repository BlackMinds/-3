// 子女成年选择 - POST /api/child/come-of-age
// body: { child_id, choice: 'stay' | 'leave' }
// stay: 啥也不做, 仍可助战
// leave: has_left_home=true, last_visit_at=NOW(), 强制取消助战

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildById } from '~/server/utils/child'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const childId = Number(body?.child_id)
    const choice = body?.choice as 'stay' | 'leave'

    if (!childId || !['stay', 'leave'].includes(choice)) {
      return { code: 400, message: '参数错误' }
    }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getChildById(pool, childId, char.id)
    if (!c) return { code: 404, message: '子女不存在' }
    if (c.has_left_home) return { code: 400, message: '该子女已离家' }
    if (c.level < 100) return { code: 400, message: '子女尚未成年（需 Lv.100）' }

    if (choice === 'stay') {
      // 2026-05-16: stay 也落库 come_of_age_decided=TRUE，避免每次打开详情都弹「成年选择」
      await pool.query(
        'UPDATE children SET come_of_age_decided = TRUE WHERE id = $1',
        [childId]
      )
      return {
        code: 200,
        message: `「${c.name}」留在家中助战`,
        data: { childId, hasLeftHome: false, comeOfAgeDecided: true },
      }
    }

    // choice === 'leave'
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. 设离家 + 标记已做决定
      await client.query(
        `UPDATE children
            SET has_left_home = TRUE,
                come_of_age_decided = TRUE,
                last_visit_at = NOW(),
                is_battling = FALSE
          WHERE id = $1`,
        [childId]
      )

      // 2. 若正在助战 → 清掉 characters.battling_child_id
      await client.query(
        `UPDATE characters SET battling_child_id = NULL
          WHERE id = $1 AND battling_child_id = $2`,
        [char.id, childId]
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
      message: `「${c.name}」外出历练，每天回家一次给予永久属性加成`,
      data: { childId, hasLeftHome: true, comeOfAgeDecided: true },
    }
  } catch (error) {
    console.error('成年选择失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
