import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query(
      'SELECT * FROM character_equipment WHERE character_id = $1 ORDER BY slot IS NULL, rarity DESC, tier DESC',
      [char.id]
    )

    return { code: 200, data: rows }
  } catch (error) {
    console.error('获取装备失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
