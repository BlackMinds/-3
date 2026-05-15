import { getPool } from '~/server/database/db'
import { getChar, HERBS, getHerbFieldLevel, getEffectivePlotCount, isOneclickPlantActive } from '~/server/utils/cave'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { herb_id } = await readBody(event)
    const herb = HERBS[herb_id]
    if (!herb) return { code: 400, message: '参数错误' }

    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    if (!isOneclickPlantActive(char)) return { code: 403, message: '一键种植月卡未开通或已过期' }

    const charId = char.id
    const herbFieldLevel = await getHerbFieldLevel(charId)
    const plotCount = getEffectivePlotCount(char, herbFieldLevel)

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

    // 收集需要 UPDATE 和 INSERT 的地块，批量执行
    const updateIndices: number[] = []
    const insertIndices: number[] = []
    for (let i = 0; i < plotCount; i++) {
      if (occupied.get(i)) continue          // 已有生长中的灵草 → 跳过
      if (occupied.has(i)) updateIndices.push(i)   // 有空行 → UPDATE
      else insertIndices.push(i)                   // 无行 → INSERT
    }

    const planted = updateIndices.length + insertIndices.length
    if (planted === 0) return { code: 200, message: '没有空地块', data: { planted: 0 } }

    const plantTime = new Date()
    // 批量 UPDATE：单条 SQL 更新所有空行
    if (updateIndices.length > 0) {
      await pool.query(
        `UPDATE character_cave_plots SET herb_id = $1, herb_quality = NULL, plant_time = NOW(), mature_time = $2, yield_count = 0 WHERE character_id = $3 AND plot_index = ANY($4::int[])`,
        [herb_id, matureTime, charId, updateIndices]
      )
    }
    // 批量 INSERT：UNNEST 一次性写入所有缺失地块
    if (insertIndices.length > 0) {
      await pool.query(
        `INSERT INTO character_cave_plots (character_id, plot_index, herb_id, herb_quality, plant_time, mature_time, yield_count)
         SELECT $1, unnest($2::int[]), $3, NULL, $4, $5, 0`,
        [charId, insertIndices, herb_id, plantTime, matureTime]
      )
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
