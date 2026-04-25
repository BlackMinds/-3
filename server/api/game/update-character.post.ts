import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)

    const fields: string[] = []
    const values: any[] = []
    let paramIdx = 1

    const allowedFields: Record<string, string> = {
      realm_tier: 'realm_tier', realm_stage: 'realm_stage',
      cultivation_exp: 'cultivation_exp',
      max_hp: 'max_hp', atk: 'atk', def: 'def', spd: 'spd',
      level: 'level', level_exp: 'level_exp',
      current_map: 'current_map',
      crit_rate: 'crit_rate', crit_dmg: 'crit_dmg',
      dodge: 'dodge', lifesteal: 'lifesteal', spirit: 'spirit',
    }

    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined && body[key] !== null) {
        fields.push(`${col} = $${paramIdx}`)
        values.push(body[key])
        paramIdx++
      }
    }

    // 战斗主动停止时清服务端守卫，避免切图/离开后立即重开被 DB battle_end_at 残值拦下
    if (body.clear_battle_end === true) {
      fields.push('battle_end_at = NULL')
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

    // 成就：境界突破
    if (body.realm_tier !== undefined) {
      const { rows: charRows } = await pool.query('SELECT id FROM characters WHERE user_id = $1', [event.context.userId])
      if (charRows.length > 0) {
        checkAchievements(charRows[0].id, 'realm_tier', body.realm_tier).catch(() => {})
        // 练气阶段成就（realm_tier=1时，用stage判断练气九层）
        if (body.realm_tier === 1 && body.realm_stage !== undefined) {
          checkAchievements(charRows[0].id, 'qi_stage', body.realm_stage).catch(() => {})
        }
      }
    }

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
