import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)

    const fields: string[] = []
    const values: any[] = []
    let paramIdx = 1

    // 仅允许客户端更新地图位置；核心属性由服务端引擎统一计算，不允许客户端直写
    const allowedFields: Record<string, string> = {
      current_map: 'current_map',
    }

    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined && body[key] !== null) {
        fields.push(`${col} = $${paramIdx}`)
        values.push(body[key])
        paramIdx++
      }
    }

    if (fields.length === 0) {
      return { code: 400, message: '无更新字段' }
    }

    fields.push('last_online = NOW()')
    values.push(event.context.userId)

    await pool.query(
      `UPDATE characters SET ${fields.join(', ')} WHERE user_id = $${paramIdx}`,
      values
    )

    // 成就：地图访问（踏遍青山 / 万界行者）
    if (body.current_map) {
      const { rows: charRows } = await pool.query('SELECT id FROM characters WHERE user_id = $1', [event.context.userId])
      if (charRows.length > 0) {
        const charId = charRows[0].id
        await pool.query(
          'INSERT INTO character_map_visits (character_id, map_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [charId, String(body.current_map)]
        )
        const { rows: cntRows } = await pool.query(
          'SELECT COUNT(*) AS cnt FROM character_map_visits WHERE character_id = $1',
          [charId]
        )
        const mapCount = Number(cntRows[0]?.cnt || 0)
        if (mapCount > 0) {
          checkAchievements(charId, 'map_unlocked', mapCount).catch(() => {})
        }
      }
    }

    return { code: 200, message: '角色状态已更新' }
  } catch (error) {
    console.error('更新角色失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
