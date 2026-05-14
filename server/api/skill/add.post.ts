import { getPool } from '~/server/database/db'
import { SKILL_MAP } from '~/server/engine/skillData'

export default defineEventHandler(async (event) => {
  try {
    // 仅服务端内部调用（cron / reward 系统），不允许玩家直接刷功法
    const authHeader = getHeader(event, 'authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const pool = getPool()
    const { user_id, skill_id } = await readBody(event)

    if (!skill_id || !SKILL_MAP[skill_id]) {
      return { code: 400, message: '功法不存在' }
    }

    const targetUserId = user_id || event.context.userId
    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [targetUserId]
    )

    if (charRows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }

    await pool.query(
      `INSERT INTO character_skill_inventory (character_id, skill_id, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
      [charRows[0].id, skill_id]
    )

    return { code: 200, message: '功法已添加' }
  } catch (error: any) {
    if (error?.statusCode === 401) throw error
    console.error('添加功法失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
