import { getPool } from '~/server/database/db'
import { getChar, getHerbFieldLevel, randomHarvestQuality } from '~/server/utils/cave'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { plot_index } = await readBody(event)
    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id
    const herbFieldLevel = await getHerbFieldLevel(charId)

    const { rows } = await pool.query(
      'SELECT * FROM character_cave_plots WHERE character_id = $1 AND plot_index = $2',
      [charId, plot_index]
    )

    if (rows.length === 0 || !rows[0].herb_id) {
      return { code: 400, message: '地块为空' }
    }

    const plot = rows[0]
    if (new Date(plot.mature_time).getTime() > Date.now()) {
      return { code: 400, message: '尚未成熟' }
    }

    // 收获时随机品质和产量
    const { quality, count } = randomHarvestQuality(herbFieldLevel)

    // 加到材料
    await pool.query(
      `INSERT INTO character_materials (character_id, material_id, quality, count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (character_id, material_id, quality) DO UPDATE SET count = character_materials.count + $5`,
      [charId, plot.herb_id, quality, count, count]
    )

    // 清空地块
    await pool.query(
      'UPDATE character_cave_plots SET herb_id = NULL, herb_quality = NULL, plant_time = NULL, mature_time = NULL, yield_count = 0 WHERE id = $1',
      [plot.id]
    )

    checkAchievements(charId, 'herb_harvest', 1).catch(() => {})

    return {
      code: 200,
      data: { herb_id: plot.herb_id, quality, count },
    }
  } catch (error) {
    console.error('收获失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
