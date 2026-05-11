// 喂养 - POST /api/child/feed
// body: { child_id, herb_id, herb_quality }

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { feedChild } from '~/server/utils/child'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const childId = Number(body?.child_id)
    const herbId = body?.herb_id as string
    const herbQuality = (body?.herb_quality || 'white') as string

    if (!childId || !herbId) return { code: 400, message: '参数错误' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const result = await feedChild(pool, childId, char.id, herbId, herbQuality)
    if (!result.ok) return { code: 400, message: result.message }

    return { code: 200, data: result.data, message: result.message }
  } catch (error) {
    console.error('喂养失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
