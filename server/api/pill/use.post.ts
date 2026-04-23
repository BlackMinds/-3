import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const userId = event.context.userId
  const { pill_id, quality_factor, pill_type, exp_gain } = await readBody(event)

  const { rows: charRows } = await pool.query(
    'SELECT id FROM characters WHERE user_id = $1',
    [userId]
  )
  if (charRows.length === 0) return { code: 400, message: '角色不存在' }
  const charId = charRows[0].id

  const qf = Number(quality_factor) || 1.0
  // DB 存 DECIMAL(3,1) 精度, 查询时容忍 ±0.05 误差
  const qfMin = qf - 0.05, qfMax = qf + 0.05

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁丹药行 + count > 0 校验，防并发重复使用扣成负数
    const { rows: pillRows } = await client.query(
      `SELECT id, quality_factor FROM character_pills
       WHERE character_id = $1 AND pill_id = $2 AND quality_factor BETWEEN $3 AND $4 AND count > 0
       ORDER BY quality_factor DESC LIMIT 1 FOR UPDATE`,
      [charId, pill_id, qfMin, qfMax]
    )
    if (pillRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '丹药不足' }
    }

    const actualQf = Number(pillRows[0].quality_factor)

    // 条件扣丹药：WHERE count >= 1 双重保险
    const { rowCount: consumed } = await client.query(
      'UPDATE character_pills SET count = count - 1 WHERE id = $1 AND count >= 1',
      [pillRows[0].id]
    )
    if (!consumed) {
      await client.query('ROLLBACK')
      return { code: 400, message: '丹药不足' }
    }
    await client.query('DELETE FROM character_pills WHERE id = $1 AND count <= 0', [pillRows[0].id])

    // 突破丹药: 加修为（按品质系数）
    if (pill_type === 'breakthrough' && exp_gain) {
      const finalExp = Math.floor(exp_gain * actualQf)
      await client.query(
        'UPDATE characters SET cultivation_exp = cultivation_exp + $1 WHERE id = $2',
        [finalExp, charId]
      )
    }

    // 战斗丹药: 按品质系数决定持续时间（小时）
    if (pill_type === 'battle') {
      const hours = Math.min(8, Math.max(1, Math.round(actualQf * 1.6)))
      const expireTime = new Date(Date.now() + hours * 3600 * 1000)
      await client.query(
        'DELETE FROM character_buffs WHERE character_id = $1 AND pill_id = $2',
        [charId, pill_id]
      )
      await client.query(
        'INSERT INTO character_buffs (character_id, pill_id, remaining_fights, quality_factor, expire_time) VALUES ($1, $2, 0, $3, $4)',
        [charId, pill_id, actualQf, expireTime]
      )
    }

    await client.query('COMMIT')

    checkAchievements(charId, 'pill_use', 1).catch(() => {})

    // 药不能停：同时未过期 buff 种类数
    const { rows: buffRows } = await pool.query(
      'SELECT COUNT(DISTINCT pill_id) AS cnt FROM character_buffs WHERE character_id = $1 AND expire_time > NOW()',
      [charId]
    )
    const buffCount = Number(buffRows[0]?.cnt || 0)
    if (buffCount > 0) {
      checkAchievements(charId, 'buff_count', buffCount).catch(() => {})
    }

    return { code: 200, message: '使用成功', data: { quality_factor: actualQf } }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('使用丹药失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
