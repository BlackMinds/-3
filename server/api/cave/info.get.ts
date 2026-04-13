import { getPool } from '~/server/database/db'
import { getChar } from '~/server/utils/cave'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows: buildings } = await pool.query(
      'SELECT * FROM character_cave WHERE character_id = $1',
      [char.id]
    )

    return { code: 200, data: buildings }
  } catch (error) {
    console.error('获取洞府失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
