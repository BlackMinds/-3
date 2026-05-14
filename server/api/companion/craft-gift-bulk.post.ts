// 一键炼制礼物 - POST /api/companion/craft-gift-bulk
// body: { recipe_id: string }
// 流程: 事务内读库存 + 算 N → 事务一次扣 N 份原料/灵石 + 加 N 份礼物
// 与 craft-gift 同口径：礼物无品质机制，原料按低品优先扣

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { GIFT_RECIPE_MAP } from '~/server/engine/giftRecipeData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const recipeId = body?.recipe_id as string

    if (!recipeId) return { code: 400, message: '参数错误' }
    const recipe = GIFT_RECIPE_MAP[recipeId]
    if (!recipe) return { code: 400, message: '配方不存在' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 事务内读库存 + 灵石（防并发扣负）
      type Stock = { quality: string; count: number }
      const stockMap: Record<string, Stock[]> = {}
      const totalsMap: Record<string, number> = {}

      for (const ing of recipe.ingredients) {
        const { rows } = await client.query(
          `SELECT quality, count FROM character_materials
            WHERE character_id = $1 AND material_id = $2 AND count > 0
            ORDER BY CASE quality
              WHEN 'white' THEN 0 WHEN 'green' THEN 1 WHEN 'blue' THEN 2
              WHEN 'purple' THEN 3 WHEN 'gold' THEN 4 WHEN 'red' THEN 5 ELSE 99 END
            FOR UPDATE`,
          [char.id, ing.itemId]
        )
        const total = rows.reduce((a: number, r: any) => a + Number(r.count || 0), 0)
        totalsMap[ing.itemId] = total
        stockMap[ing.itemId] = rows.map((r: any) => ({ quality: r.quality, count: Number(r.count) }))
      }

      const { rows: charRows } = await client.query(
        'SELECT spirit_stone FROM characters WHERE id = $1 FOR UPDATE',
        [char.id]
      )
      const currentStone = Number(charRows[0]?.spirit_stone || 0)

      // 取 min 作为可炼次数（原料 + 灵石）
      let maxByHerb = Infinity
      for (const ing of recipe.ingredients) {
        maxByHerb = Math.min(maxByHerb, Math.floor((totalsMap[ing.itemId] ?? 0) / ing.qty))
      }
      const stoneCost = recipe.spiritStoneCost
      const maxByStone = stoneCost > 0 ? Math.floor(currentStone / stoneCost) : Infinity
      const N = Math.min(maxByHerb, maxByStone)

      if (!Number.isFinite(N) || N <= 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '原料或灵石不足，无法炼制' }
      }

      // 扣灵石（条件防扣负）
      const totalStone = stoneCost * N
      if (totalStone > 0) {
        const { rowCount: stoneOk } = await client.query(
          'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2 AND spirit_stone >= $1',
          [totalStone, char.id]
        )
        if (!stoneOk) {
          await client.query('ROLLBACK')
          return { code: 400, message: '灵石不足' }
        }
      }

      // 扣原料（低品优先，每种原料按 ing.qty × N）
      for (const ing of recipe.ingredients) {
        let remaining = ing.qty * N
        for (const s of (stockMap[ing.itemId] ?? [])) {
          if (remaining <= 0) break
          const take = Math.min(remaining, s.count)
          await client.query(
            `UPDATE character_materials SET count = count - $1
              WHERE character_id = $2 AND material_id = $3 AND quality = $4`,
            [take, char.id, ing.itemId, s.quality]
          )
          remaining -= take
        }
      }

      // 给成品 ×N（统一 quality='white' 占位，与 craft-gift 同口径）
      await client.query(
        `INSERT INTO character_materials (character_id, material_id, count, quality)
         VALUES ($1, $2, $3, 'white')
         ON CONFLICT (character_id, material_id, quality)
         DO UPDATE SET count = character_materials.count + $3`,
        [char.id, recipeId, N]
      )

      await client.query('COMMIT')

      return {
        code: 200,
        message: `炼制成功！获得「${recipe.name}」×${N}`,
        data: { recipeId, name: recipe.name, count: N, totalStone: stoneCost * N },
      }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('一键炼制礼物失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
