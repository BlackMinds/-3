import { getPool } from '~/server/database/db'
import { getChar, getHerbFieldLevel, getPlotConfig } from '~/server/utils/cave'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id
    const herbFieldLevel = await getHerbFieldLevel(charId)
    const { plotCount, maxQualityIndex } = getPlotConfig(herbFieldLevel)

    const { rows: plots } = await pool.query(
      'SELECT * FROM character_cave_plots WHERE character_id = $1 ORDER BY plot_index',
      [charId]
    )

    // 补全空地块
    const plotMap: any = {}
    for (const p of plots) plotMap[p.plot_index] = p
    const result = []
    for (let i = 0; i < plotCount; i++) {
      if (plotMap[i]) {
        const isMature = plotMap[i].mature_time && new Date(plotMap[i].mature_time).getTime() <= Date.now()
        result.push({ ...plotMap[i], is_mature: isMature })
      } else {
        result.push({ plot_index: i, herb_id: null, herb_quality: null, is_mature: false })
      }
    }

    return {
      code: 200,
      data: {
        plots: result,
        plotCount,
        maxQualityIndex,
        herbFieldLevel,
      },
    }
  } catch (error) {
    console.error('获取地块失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
