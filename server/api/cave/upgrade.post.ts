import { getPool } from '~/server/database/db'
import { getChar, BUILDINGS, getUpgradeCost, getUpgradeTime } from '~/server/utils/cave'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { building_id } = await readBody(event)
  const config = BUILDINGS[building_id]
  if (!config) return { code: 400, message: '建筑不存在' }

  const char = await getChar(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁建筑行，防并发重复升级
    const { rows: existRows } = await client.query(
      'SELECT * FROM character_cave WHERE character_id = $1 AND building_id = $2 FOR UPDATE',
      [char.id, building_id]
    )
    const currentLevel = existRows.length > 0 ? existRows[0].level : 0

    if (currentLevel >= config.maxLevel) {
      await client.query('ROLLBACK')
      return { code: 400, message: '已满级' }
    }

    if (existRows.length > 0 && existRows[0].upgrade_finish_time) {
      const finishTime = new Date(existRows[0].upgrade_finish_time).getTime()
      if (finishTime > Date.now()) {
        await client.query('ROLLBACK')
        return { code: 400, message: '建筑升级中,请稍后' }
      }
    }

    // 前置条件
    if (config.prerequisite) {
      const { rows: preRows } = await client.query(
        'SELECT level FROM character_cave WHERE character_id = $1 AND building_id = $2',
        [char.id, config.prerequisite.buildingId]
      )
      const preLevel = preRows.length > 0 ? preRows[0].level : 0
      if (preLevel < config.prerequisite.level) {
        await client.query('ROLLBACK')
        return { code: 400, message: `需要前置建筑等级 ${config.prerequisite.level}` }
      }
    }

    const nextLevel = currentLevel + 1
    const cost = getUpgradeCost(config, nextLevel)
    const upgradeTime = getUpgradeTime(config, nextLevel)

    // 条件扣灵石：WHERE spirit_stone >= $1 防扣负
    const { rowCount: paid } = await client.query(
      'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2 AND spirit_stone >= $1',
      [cost, char.id]
    )
    if (!paid) {
      await client.query('ROLLBACK')
      return { code: 400, message: '灵石不足' }
    }

    const finishTime = upgradeTime > 0 ? new Date(Date.now() + upgradeTime * 1000) : null

    if (existRows.length === 0) {
      await client.query(
        'INSERT INTO character_cave (character_id, building_id, level, last_collect_time, upgrade_finish_time) VALUES ($1, $2, $3, NOW(), $4)',
        [char.id, building_id, finishTime ? currentLevel : nextLevel, finishTime]
      )
    } else if (finishTime) {
      await client.query(
        'UPDATE character_cave SET upgrade_finish_time = $1 WHERE id = $2',
        [finishTime, existRows[0].id]
      )
    } else {
      await client.query(
        'UPDATE character_cave SET level = $1 WHERE id = $2',
        [nextLevel, existRows[0].id]
      )
    }

    await client.query('COMMIT')

    checkAchievements(char.id, 'cave_build', 1).catch(() => {})

    return {
      code: 200,
      message: finishTime ? `升级中,${upgradeTime}秒后完成` : '升级成功',
      data: { newLevel: finishTime ? currentLevel : nextLevel, finishTime, cost },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('升级建筑失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
