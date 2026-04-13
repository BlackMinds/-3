import { getPool } from '~/server/database/db'
import { getChar } from '~/server/utils/cave'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { building_id } = await readBody(event)
    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query(
      'SELECT * FROM character_cave WHERE character_id = $1 AND building_id = $2',
      [char.id, building_id]
    )

    if (rows.length === 0) return { code: 400, message: '建筑不存在' }

    const row = rows[0]
    if (!row.upgrade_finish_time) return { code: 400, message: '没有正在进行的升级' }

    const finishTime = new Date(row.upgrade_finish_time).getTime()
    if (finishTime > Date.now()) return { code: 400, message: '尚未完成' }

    await pool.query(
      'UPDATE character_cave SET level = level + 1, upgrade_finish_time = NULL WHERE id = $1',
      [row.id]
    )

    return { code: 200, message: '升级完成', data: { newLevel: row.level + 1 } }
  } catch (error) {
    console.error('完成升级失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
