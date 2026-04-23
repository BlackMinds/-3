import { getPool } from '~/server/database/db'
import { getChar, HERBS, getHerbFieldLevel, getPlotConfig } from '~/server/utils/cave'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { plot_index, herb_id } = await readBody(event)
    const herb = HERBS[herb_id]
    if (!herb) return { code: 400, message: '参数错误' }

    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id
    const herbFieldLevel = await getHerbFieldLevel(charId)
    const { plotCount } = getPlotConfig(herbFieldLevel)

    if (plot_index < 0 || plot_index >= plotCount) {
      return { code: 400, message: '地块未解锁' }
    }

    // 检查种类
    if (herbFieldLevel < herb.unlockPlotMaxLevel) {
      return { code: 400, message: `灵田等级不足,需要${herb.unlockPlotMaxLevel}级` }
    }

    // 检查地块是否为空
    const { rows: exist } = await pool.query(
      'SELECT * FROM character_cave_plots WHERE character_id = $1 AND plot_index = $2',
      [charId, plot_index]
    )

    if (exist.length > 0 && exist[0].herb_id) {
      return { code: 400, message: '地块已占用' }
    }

    // 生长时间：基础 12h，灵田每 3 级 -1.5h，满级（Lv.12+）锁定 6h
    // Lv.0-2: 12h / Lv.3-5: 10.5h / Lv.6-8: 9h / Lv.9-11: 7.5h / Lv.12-15: 6h
    const baseGrowMinutes = Math.max(360, 720 - Math.floor(herbFieldLevel / 3) * 90)
    const matureTime = new Date(Date.now() + baseGrowMinutes * 60 * 1000)

    if (exist.length > 0) {
      await pool.query(
        'UPDATE character_cave_plots SET herb_id = $1, herb_quality = NULL, plant_time = NOW(), mature_time = $2, yield_count = 0 WHERE id = $3',
        [herb_id, matureTime, exist[0].id]
      )
    } else {
      await pool.query(
        'INSERT INTO character_cave_plots (character_id, plot_index, herb_id, herb_quality, plant_time, mature_time, yield_count) VALUES ($1, $2, $3, NULL, NOW(), $4, 0)',
        [charId, plot_index, herb_id, matureTime]
      )
    }

    // 灵田满仓：所有已解锁地块同时种满（包括刚刚种下这棵）
    const { rows: plantedRows } = await pool.query(
      'SELECT COUNT(*) AS cnt FROM character_cave_plots WHERE character_id = $1 AND herb_id IS NOT NULL',
      [charId]
    )
    const plantedCount = Number(plantedRows[0]?.cnt || 0)
    if (plantedCount >= plotCount) {
      checkAchievements(charId, 'plots_all_planted', 1).catch(() => {})
    }

    return { code: 200, message: '种植成功', data: { mature_time: matureTime } }
  } catch (error) {
    console.error('种植失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
