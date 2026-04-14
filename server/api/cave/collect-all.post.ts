import { getPool } from '~/server/database/db'
import { getChar, BUILDINGS, calcOutput } from '~/server/utils/cave'
import { applyCultivationExp } from '~/server/utils/realm'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id
    const { rows } = await pool.query(
      'SELECT * FROM character_cave WHERE character_id = $1',
      [charId]
    )

    let totalExp = 0, totalStone = 0

    for (const row of rows) {
      const config = BUILDINGS[row.building_id]
      if (!config || !config.output) continue
      const amount = calcOutput(config, row.level, row.last_collect_time)
      if (amount <= 0) continue

      if (config.output.type === 'exp') totalExp += amount
      else if (config.output.type === 'spirit_stone') totalStone += amount

      await pool.query('UPDATE character_cave SET last_collect_time = NOW() WHERE id = $1', [row.id])
    }

    if (totalExp > 0) {
      const newExpTotal = Number(char.cultivation_exp || 0) + totalExp
      const br = applyCultivationExp(newExpTotal, char.realm_tier || 1, char.realm_stage || 1)
      await pool.query(
        'UPDATE characters SET cultivation_exp = $1, realm_tier = $2, realm_stage = $3 WHERE id = $4',
        [br.cultivation_exp, br.realm_tier, br.realm_stage, charId]
      )
    }
    if (totalStone > 0) {
      await pool.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [totalStone, charId])
    }
    // 返回最新 character（避免前端显示跳跃）
    const { rows: updated } = await pool.query('SELECT * FROM characters WHERE id = $1', [charId])
    return { code: 200, data: { totalExp, totalStone, totalHerb: 0, character: updated[0] } }
  } catch (error) {
    console.error('一键领取失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
