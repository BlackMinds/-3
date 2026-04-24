import { getPool } from '~/server/database/db'
import { getChar, BUILDINGS, calcOutput, getSponsorMul } from '~/server/utils/cave'
import { applyCultivationExp } from '~/server/utils/realm'
import { updateSectDailyTask } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const char = await getChar(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const charId = char.id

  const client = await pool.connect()
  let collectedCount = 0
  try {
    await client.query('BEGIN')

    // 锁该角色所有建筑行，并发一键领取只有一次能结算
    const { rows } = await client.query(
      'SELECT * FROM character_cave WHERE character_id = $1 FOR UPDATE',
      [charId]
    )

    let totalExp = 0, totalStone = 0
    const mul = getSponsorMul(char)

    for (const row of rows) {
      const config = BUILDINGS[row.building_id]
      if (!config || !config.output) continue
      const amount = calcOutput(config, row.level, row.last_collect_time, mul)
      if (amount <= 0) continue

      if (config.output.type === 'exp') totalExp += amount
      else if (config.output.type === 'spirit_stone') totalStone += amount
      collectedCount++

      await client.query('UPDATE character_cave SET last_collect_time = NOW() WHERE id = $1', [row.id])
    }

    if (totalExp > 0) {
      // 事务内 FOR UPDATE 读最新修为/境界，避免覆盖并发写入
      const { rows: fresh } = await client.query(
        'SELECT cultivation_exp, realm_tier, realm_stage FROM characters WHERE id = $1 FOR UPDATE',
        [charId]
      )
      const newExpTotal = Number(fresh[0]?.cultivation_exp || 0) + totalExp
      const br = applyCultivationExp(newExpTotal, fresh[0]?.realm_tier || 1, fresh[0]?.realm_stage || 1)
      await client.query(
        'UPDATE characters SET cultivation_exp = $1, realm_tier = $2, realm_stage = $3 WHERE id = $4',
        [br.cultivation_exp, br.realm_tier, br.realm_stage, charId]
      )
    }
    if (totalStone > 0) {
      await client.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [totalStone, charId])
    }

    await client.query('COMMIT')

    // 宗门任务:每个实际领到产出的建筑算 1 次（与 /api/cave/collect 单次行为一致）
    if (collectedCount > 0) {
      await updateSectDailyTask(charId, 'cave', collectedCount)
    }

    const { rows: updated } = await pool.query('SELECT * FROM characters WHERE id = $1', [charId])
    return { code: 200, data: { totalExp, totalStone, totalHerb: 0, character: updated[0] } }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('一键领取失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
