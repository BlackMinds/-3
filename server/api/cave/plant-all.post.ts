import { getPool } from '~/server/database/db'
import { getChar, HERBS, getHerbFieldLevel, getEffectivePlotCount } from '~/server/utils/cave'
import { checkAchievements } from '~/server/engine/achievementData'

// 2026-05-18: 一键种植下放为全员基础功能（原月卡 sub_oneclick_plant 下架），不再校验订阅。
export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const plotConfigs: Array<{ plot_index: number; herb_id: string }> | undefined =
      Array.isArray(body?.plot_configs) ? body.plot_configs : undefined
    const singleHerbId: string | undefined = body?.herb_id

    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id
    const herbFieldLevel = await getHerbFieldLevel(charId)
    const plotCount = getEffectivePlotCount(char, herbFieldLevel)

    const baseGrowMinutes = Math.max(360, 720 - Math.floor(herbFieldLevel / 3) * 90)
    const matureTime = new Date(Date.now() + baseGrowMinutes * 60 * 1000)

    // 整理意图：plot_index -> herb_id
    const intentMap = new Map<number, string>()
    if (plotConfigs && plotConfigs.length > 0) {
      for (const cfg of plotConfigs) {
        if (typeof cfg?.plot_index !== 'number' || !cfg.herb_id) continue
        if (cfg.plot_index < 0 || cfg.plot_index >= plotCount) continue
        const herb = HERBS[cfg.herb_id]
        if (!herb) continue
        if (herbFieldLevel < herb.unlockPlotMaxLevel) continue
        intentMap.set(cfg.plot_index, cfg.herb_id)
      }
    } else if (singleHerbId) {
      const herb = HERBS[singleHerbId]
      if (!herb) return { code: 400, message: '参数错误' }
      if (herbFieldLevel < herb.unlockPlotMaxLevel) {
        return { code: 400, message: `灵田等级不足,需要${herb.unlockPlotMaxLevel}级` }
      }
      for (let i = 0; i < plotCount; i++) intentMap.set(i, singleHerbId)
    } else {
      return { code: 400, message: '参数错误' }
    }

    if (intentMap.size === 0) {
      return { code: 200, message: '没有可种植的地块', data: { planted: 0 } }
    }

    const { rows: existing } = await pool.query(
      'SELECT plot_index, herb_id FROM character_cave_plots WHERE character_id = $1',
      [charId]
    )
    const occupied = new Map<number, boolean>()
    for (const p of existing) occupied.set(p.plot_index, !!p.herb_id)

    // 按 herb_id 分组：UPDATE 已有空行的、INSERT 完全没行的
    const groupUpdate = new Map<string, number[]>()
    const groupInsert = new Map<string, number[]>()
    for (const [i, herbId] of intentMap) {
      if (occupied.get(i)) continue
      if (occupied.has(i)) {
        const arr = groupUpdate.get(herbId) || []
        arr.push(i)
        groupUpdate.set(herbId, arr)
      } else {
        const arr = groupInsert.get(herbId) || []
        arr.push(i)
        groupInsert.set(herbId, arr)
      }
    }

    let planted = 0
    const plantTime = new Date()
    for (const [herbId, indices] of groupUpdate) {
      await pool.query(
        `UPDATE character_cave_plots SET herb_id = $1, herb_quality = NULL, plant_time = NOW(), mature_time = $2, yield_count = 0 WHERE character_id = $3 AND plot_index = ANY($4::int[])`,
        [herbId, matureTime, charId, indices]
      )
      planted += indices.length
    }
    for (const [herbId, indices] of groupInsert) {
      await pool.query(
        `INSERT INTO character_cave_plots (character_id, plot_index, herb_id, herb_quality, plant_time, mature_time, yield_count)
         SELECT $1, unnest($2::int[]), $3, NULL, $4, $5, 0`,
        [charId, indices, herbId, plantTime, matureTime]
      )
      planted += indices.length
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
