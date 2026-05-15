import { getPool } from '~/server/database/db'
import { getChar, getHerbFieldLevel, randomHarvestQuality } from '~/server/utils/cave'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getChar(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id
    const herbFieldLevel = await getHerbFieldLevel(charId)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // FOR UPDATE 锁所有地块行，防并发重复收获
      const { rows } = await client.query(
        'SELECT * FROM character_cave_plots WHERE character_id = $1 AND herb_id IS NOT NULL FOR UPDATE',
        [charId]
      )

      const harvested: any[] = []
      for (const plot of rows) {
        if (new Date(plot.mature_time).getTime() > Date.now()) continue
        const { quality, count } = randomHarvestQuality(herbFieldLevel, plot.herb_id)
        await client.query(
          `INSERT INTO character_materials (character_id, material_id, quality, count)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (character_id, material_id, quality) DO UPDATE SET count = character_materials.count + $5`,
          [charId, plot.herb_id, quality, count, count]
        )
        await client.query(
          'UPDATE character_cave_plots SET herb_id = NULL, herb_quality = NULL, plant_time = NULL, mature_time = NULL, yield_count = 0 WHERE id = $1',
          [plot.id]
        )
        harvested.push({ herb_id: plot.herb_id, quality, count })
      }

      await client.query('COMMIT')

      return { code: 200, data: { harvested } }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('一键收获失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
