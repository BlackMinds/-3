import { getPool } from '~/server/database/db'
import { getChar, BUILDINGS, calcOutput, getSponsorMul } from '~/server/utils/cave'
import { updateSectDailyTask } from '~/server/utils/sect'
import { applyCultivationExp } from '~/server/utils/realm'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { building_id } = await readBody(event)
  const config = BUILDINGS[building_id]
  if (!config || !config.output) return { code: 400, message: '建筑无产出' }

  const char = await getChar(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const charId = char.id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁建筑行：并发两次领取只有一次能算到产出
    const { rows } = await client.query(
      'SELECT * FROM character_cave WHERE character_id = $1 AND building_id = $2 FOR UPDATE',
      [charId, building_id]
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '建筑未建造' }
    }

    const row = rows[0]
    const amount = calcOutput(config, row.level, row.last_collect_time, getSponsorMul(char))
    if (amount <= 0) {
      await client.query('ROLLBACK')
      return { code: 200, data: { amount: 0, type: config.output.type } }
    }

    if (config.output.type === 'exp') {
      // 事务内 FOR UPDATE 读最新修为/境界，避免覆盖并发的闭关/战斗写入
      const { rows: fresh } = await client.query(
        'SELECT cultivation_exp, realm_tier, realm_stage FROM characters WHERE id = $1 FOR UPDATE',
        [charId]
      )
      const newExpTotal = Number(fresh[0]?.cultivation_exp || 0) + amount
      const br = applyCultivationExp(newExpTotal, fresh[0]?.realm_tier || 1, fresh[0]?.realm_stage || 1)
      await client.query(
        'UPDATE characters SET cultivation_exp = $1, realm_tier = $2, realm_stage = $3 WHERE id = $4',
        [br.cultivation_exp, br.realm_tier, br.realm_stage, charId]
      )
    } else if (config.output.type === 'spirit_stone') {
      await client.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [amount, charId])
    }

    await client.query(
      'UPDATE character_cave SET last_collect_time = NOW() WHERE id = $1',
      [row.id]
    )

    await client.query('COMMIT')

    // 事务外执行旁路任务
    await updateSectDailyTask(charId, 'cave', 1)

    // 日进斗金：聚宝盆累计领取灵石
    if (building_id === 'treasure_pot' && config.output.type === 'spirit_stone') {
      checkAchievements(charId, 'pot_collect_total', amount).catch(() => {})
    }

    const { rows: updated } = await pool.query('SELECT * FROM characters WHERE id = $1', [charId])
    return { code: 200, data: { amount, type: config.output.type, character: updated[0] } }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('领取产出失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
