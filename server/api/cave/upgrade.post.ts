import { getPool } from '~/server/database/db'
import { getChar, BUILDINGS, getUpgradeCost, getUpgradeTime } from '~/server/utils/cave'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { building_id } = await readBody(event)
    const config = BUILDINGS[building_id]
    if (!config) return { code: 400, message: '建筑不存在' }

    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    // 查询当前等级
    const { rows: existRows } = await pool.query(
      'SELECT * FROM character_cave WHERE character_id = $1 AND building_id = $2',
      [char.id, building_id]
    )

    const currentLevel = existRows.length > 0 ? existRows[0].level : 0

    if (currentLevel >= config.maxLevel) {
      return { code: 400, message: '已满级' }
    }

    // 检查是否在升级中
    if (existRows.length > 0 && existRows[0].upgrade_finish_time) {
      const finishTime = new Date(existRows[0].upgrade_finish_time).getTime()
      if (finishTime > Date.now()) {
        return { code: 400, message: '建筑升级中,请稍后' }
      }
    }

    // 检查前置条件
    if (config.prerequisite) {
      const { rows: preRows } = await pool.query(
        'SELECT level FROM character_cave WHERE character_id = $1 AND building_id = $2',
        [char.id, config.prerequisite.buildingId]
      )
      const preLevel = preRows.length > 0 ? preRows[0].level : 0
      if (preLevel < config.prerequisite.level) {
        return { code: 400, message: `需要前置建筑等级 ${config.prerequisite.level}` }
      }
    }

    // 升级到下一级
    const nextLevel = currentLevel + 1
    const cost = getUpgradeCost(config, nextLevel)
    const upgradeTime = getUpgradeTime(config, nextLevel)

    if (char.spirit_stone < cost) {
      return { code: 400, message: '灵石不足' }
    }

    // 扣灵石
    await pool.query('UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2', [cost, char.id])

    // 计算升级完成时间
    const finishTime = upgradeTime > 0 ? new Date(Date.now() + upgradeTime * 1000) : null

    if (existRows.length === 0) {
      // 第一次建造
      await pool.query(
        'INSERT INTO character_cave (character_id, building_id, level, last_collect_time, upgrade_finish_time) VALUES ($1, $2, $3, NOW(), $4)',
        [char.id, building_id, finishTime ? currentLevel : nextLevel, finishTime]
      )
    } else {
      if (finishTime) {
        // 需要建造时间,记录完成时间,等到时间到再升级
        await pool.query(
          'UPDATE character_cave SET upgrade_finish_time = $1 WHERE id = $2',
          [finishTime, existRows[0].id]
        )
      } else {
        // 即时升级
        await pool.query(
          'UPDATE character_cave SET level = $1 WHERE id = $2',
          [nextLevel, existRows[0].id]
        )
      }
    }

    checkAchievements(char.id, 'cave_build', 1).catch(() => {})

    return {
      code: 200,
      message: finishTime ? `升级中,${upgradeTime}秒后完成` : '升级成功',
      data: { newLevel: finishTime ? currentLevel : nextLevel, finishTime, cost },
    }
  } catch (error) {
    console.error('升级建筑失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
