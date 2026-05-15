import { getPool } from '~/server/database/db'
import { getChar, getHerbFieldLevel, getPlotConfig, getEffectivePlotCount } from '~/server/utils/cave'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id
    const herbFieldLevel = await getHerbFieldLevel(charId)
    const { plotCount: basePlotCount, maxQualityIndex } = getPlotConfig(herbFieldLevel)
    // 含「灵田扩容月卡」加成（过期后实时回退到 base，由 getEffectivePlotCount 校验 expire）
    const plotCount = getEffectivePlotCount(char, herbFieldLevel)
    const bonusPlotCount = plotCount - basePlotCount

    const { rows: plots } = await pool.query(
      'SELECT * FROM character_cave_plots WHERE character_id = $1 ORDER BY plot_index',
      [charId]
    )

    // 补全空地块（月卡过期后，扩容地块上仍有作物的会作为「冻结地块」返回，前端可显示）
    const plotMap: any = {}
    for (const p of plots) plotMap[p.plot_index] = p
    const result = []
    const maxIndex = Math.max(plotCount, ...plots.map(p => p.plot_index + 1), 0)
    for (let i = 0; i < maxIndex; i++) {
      if (plotMap[i]) {
        const isMature = plotMap[i].mature_time && new Date(plotMap[i].mature_time).getTime() <= Date.now()
        result.push({ ...plotMap[i], is_mature: isMature, is_frozen: i >= plotCount })
      } else if (i < plotCount) {
        result.push({ plot_index: i, herb_id: null, herb_quality: null, is_mature: false, is_frozen: false })
      }
    }

    return {
      code: 200,
      data: {
        plots: result,
        plotCount,            // 当前生效上限（含月卡）— 前端展示和循环用这个
        basePlotCount,        // 灵田等级带来的基础上限
        bonusPlotCount,       // 月卡加成（过期后为 0）
        maxQualityIndex,
        herbFieldLevel,
      },
    }
  } catch (error) {
    console.error('获取地块失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
