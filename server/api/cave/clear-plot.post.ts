import { getPool } from '~/server/database/db'
import { getChar } from '~/server/utils/cave'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { plot_index } = await readBody(event)
    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    await pool.query(
      'UPDATE character_cave_plots SET herb_id = NULL, herb_quality = NULL, plant_time = NULL, mature_time = NULL, yield_count = 0 WHERE character_id = $1 AND plot_index = $2',
      [char.id, plot_index]
    )

    return { code: 200, message: '清理成功' }
  } catch (error) {
    console.error('清理失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
