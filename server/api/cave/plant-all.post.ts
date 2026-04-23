import { getPool } from '~/server/database/db'
import { getChar, HERBS, getHerbFieldLevel, getPlotConfig } from '~/server/utils/cave'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { herb_id } = await readBody(event)
    const herb = HERBS[herb_id]
    if (!herb) return { code: 400, message: '参数错误' }

    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    if (!char.sponsor_oneclick_plant) return { code: 403, message: '未开通一键种植特权' }

    const charId = char.id
    const herbFieldLevel = await getHerbFieldLevel(charId)
    const { plotCount } = getPlotConfig(herbFieldLevel)

    if (herbFieldLevel < herb.unlockPlotMaxLevel) {
      return { code: 400, message: `灵田等级不足,需要${herb.unlockPlotMaxLevel}级` }
    }

    const baseGrowMinutes = Math.max(360, 720 - Math.floor(herbFieldLevel / 3) * 90)
    const matureTime = new Date(Date.now() + baseGrowMinutes * 60 * 1000)

    const { rows: existing } = await pool.query(
      'SELECT plot_index, herb_id FROM character_cave_plots WHERE character_id = $1',
      [charId]
    )
    const occupied = new Map<number, boolean>()
    for (const p of existing) occupied.set(p.plot_index, !!p.herb_id)

    let planted = 0
    for (let i = 0; i < plotCount; i++) {
      if (occupied.get(i)) continue
      if (occupied.has(i)) {
        await pool.query(
          'UPDATE character_cave_plots SET herb_id = $1, herb_quality = NULL, plant_time = NOW(), mature_time = $2, yield_count = 0 WHERE character_id = $3 AND plot_index = $4',
          [herb_id, matureTime, charId, i]
        )
      } else {
        await pool.query(
          'INSERT INTO character_cave_plots (character_id, plot_index, herb_id, herb_quality, plant_time, mature_time, yield_count) VALUES ($1, $2, $3, NULL, $4, $5, 0)',
          [charId, i, herb_id, new Date(), matureTime]
        )
      }
      planted++
    }

    if (planted === 0) return { code: 200, message: '没有空地块', data: { planted: 0 } }

    const { rows: plantedRows } = await pool.query(
      'SELECT COUNT(*) AS cnt FROM character_cave_plots WHERE character_id = $1 AND herb_id IS NOT NULL',
      [charId]
    )
    if (Number(plantedRows[0]?.cnt || 0) >= plotCount) {
      checkAchievements(charId, 'plots_all_planted', 1).catch(() => {})
    }

    return { code: 200, message: '种植成功', data: { planted, mature_time: matureTime } }
  } catch (error) {
    console.error('一键种植失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
