import { getPool } from '~/server/database/db'
import { getChar, BUILDINGS, calcOutput } from '~/server/utils/cave'
import { updateSectDailyTask } from '~/server/utils/sect'
import { applyCultivationExp } from '~/server/utils/realm'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { building_id } = await readBody(event)
    const config = BUILDINGS[building_id]
    if (!config || !config.output) return { code: 400, message: '建筑无产出' }

    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id

    const { rows } = await pool.query(
      'SELECT * FROM character_cave WHERE character_id = $1 AND building_id = $2',
      [charId, building_id]
    )

    if (rows.length === 0) return { code: 400, message: '建筑未建造' }

    const row = rows[0]
    const amount = calcOutput(config, row.level, row.last_collect_time)

    if (amount <= 0) return { code: 200, data: { amount: 0, type: config.output.type } }

    // 加到对应资源
    if (config.output.type === 'exp') {
      const newExpTotal = Number(char.cultivation_exp || 0) + amount
      const br = applyCultivationExp(newExpTotal, char.realm_tier || 1, char.realm_stage || 1)
      await pool.query(
        'UPDATE characters SET cultivation_exp = $1, realm_tier = $2, realm_stage = $3 WHERE id = $4',
        [br.cultivation_exp, br.realm_tier, br.realm_stage, charId]
      )
    } else if (config.output.type === 'spirit_stone') {
      await pool.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [amount, charId])
    }

    // 更新领取时间
    await pool.query(
      'UPDATE character_cave SET last_collect_time = NOW() WHERE id = $1',
      [row.id]
    )

    // 宗门任务
    await updateSectDailyTask(charId, 'cave', 1)

    // 返回最新 character（避免前端显示跳跃）
    const { rows: updated } = await pool.query('SELECT * FROM characters WHERE id = $1', [charId])
    return { code: 200, data: { amount, type: config.output.type, character: updated[0] } }
  } catch (error) {
    console.error('领取产出失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
