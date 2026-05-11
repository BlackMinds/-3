// 放弃未结侣道侣 - POST /api/companion/abandon
// 仅适用于未结侣对象（is_official = false），无代价

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getCompanionById } from '~/server/utils/companion'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const id = Number(body?.companion_id)
    if (!id) return { code: 400, message: '参数错误' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getCompanionById(pool, id, char.id)
    if (!c) return { code: 404, message: '道侣不存在' }
    if (c.is_official) return { code: 400, message: '正式道侣不可放弃，需走和离流程' }

    await pool.query('DELETE FROM companions WHERE id = $1', [id])

    return {
      code: 200,
      message: `已婉拒「${c.name}」`,
    }
  } catch (error) {
    console.error('放弃道侣失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
