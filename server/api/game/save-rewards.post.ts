import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    // 历史端点：客户端不再调用，只允许服务端内部使用（cron / 离线结算）
    // 防止客户端反复上报刷修为/等级经验/任意功法残页
    const authHeader = getHeader(event, 'authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const pool = getPool()
    const { exp_gained, spirit_stone_gained, level_exp_gained, current_map, skills_gained } = await readBody(event)

    if (typeof exp_gained !== 'number' || typeof spirit_stone_gained !== 'number') {
      return { code: 400, message: '参数错误' }
    }

    // 防作弊：单次上报限制
    const maxExp = 10000000
    const safeExp = Math.min(Math.max(0, Math.floor(exp_gained)), maxExp)
    // 怪物掉落灵石已停发；前端上报的 spirit_stone_gained 一律忽略
    void spirit_stone_gained
    const safeStone = 0
    const safeLevelExp = Math.min(Math.max(0, Math.floor(level_exp_gained || 0)), maxExp)

    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [event.context.userId]
    )

    if (charRows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }

    await pool.query(
      `UPDATE characters
       SET cultivation_exp = cultivation_exp + $1,
           spirit_stone = LEAST(70000000000, spirit_stone + $2),
           level_exp = level_exp + $3,
           current_map = $4,
           last_online = NOW()
       WHERE user_id = $5`,
      [safeExp, safeStone, safeLevelExp, current_map || 'qingfeng_valley', event.context.userId]
    )

    // 保存掉落的功法
    if (Array.isArray(skills_gained) && skills_gained.length > 0) {
      for (const skillId of skills_gained) {
        await pool.query(
          `INSERT INTO character_skill_inventory (character_id, skill_id, count)
           VALUES ($1, $2, 1)
           ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
          [charRows[0].id, skillId]
        )
      }
    }

    return { code: 200, message: '保存成功' }
  } catch (error: any) {
    if (error?.statusCode === 401) throw error
    console.error('保存奖励失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
