import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const { pill_id, quality_factor, pill_type, exp_gain, buff_duration } = await readBody(event)

    const { rows: charRows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }

    const char = charRows[0]
    const qf = Number(quality_factor) || 1.0

    // 检查是否有该品质的丹药
    const { rows: pillRows } = await pool.query(
      'SELECT * FROM character_pills WHERE character_id = $1 AND pill_id = $2 AND quality_factor = $3 AND count > 0',
      [char.id, pill_id, qf]
    )

    if (pillRows.length === 0) {
      return { code: 400, message: '丹药不足' }
    }

    // 扣丹药
    await pool.query(
      'UPDATE character_pills SET count = count - 1 WHERE character_id = $1 AND pill_id = $2 AND quality_factor = $3',
      [char.id, pill_id, qf]
    )

    // 突破丹药: 加修为(按品质系数)
    if (pill_type === 'breakthrough' && exp_gain) {
      const finalExp = Math.floor(exp_gain * qf)
      await pool.query(
        'UPDATE characters SET cultivation_exp = cultivation_exp + $1 WHERE id = $2',
        [finalExp, char.id]
      )
    }

    // 战斗丹药: 按品质系数决定持续时间(小时)
    if (pill_type === 'battle') {
      // 品质→小时: 1.0→1h, 1.2→2h, 1.5→2h, 2.0→3h, 3.0→5h, 5.0→8h
      const hours = Math.min(8, Math.max(1, Math.round(qf * 1.6)))
      const expireTime = new Date(Date.now() + hours * 3600 * 1000)
      await pool.query(
        'DELETE FROM character_buffs WHERE character_id = $1 AND pill_id = $2',
        [char.id, pill_id]
      )
      await pool.query(
        'INSERT INTO character_buffs (character_id, pill_id, remaining_fights, quality_factor, expire_time) VALUES ($1, $2, 0, $3, $4)',
        [char.id, pill_id, qf, expireTime]
      )
    }

    checkAchievements(char.id, 'pill_use', 1).catch(() => {})

    return { code: 200, message: '使用成功', data: { quality_factor: qf } }
  } catch (error) {
    console.error('使用丹药失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
