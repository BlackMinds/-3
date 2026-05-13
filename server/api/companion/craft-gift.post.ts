// 炼制礼物 - POST /api/companion/craft-gift
// body: { recipe_id: string }
// 流程: 校验配方 / 检查原料库存(合并所有品质) / 扣灵石 + 原料(低品优先) / 给成品 (quality='white')
// 礼物无品质机制: 亲密度收益固定 baseIntimacy × 反应系数, 与原料品质无关

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { GIFT_RECIPE_MAP } from '~/server/engine/giftRecipeData'

const QUALITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red']

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

    // 灵石检查
    if (Number(char.spirit_stone) < recipe.spiritStoneCost) {
      return { code: 400, message: `灵石不足，需 ${recipe.spiritStoneCost}` }
    }

    // 库存检查（合并所有品质）
    type Stock = { quality: string; count: number }
    const stockMap: Record<string, Stock[]> = {}
    for (const ing of recipe.ingredients) {
      const { rows } = await pool.query(
        `SELECT quality, count FROM character_materials
          WHERE character_id = $1 AND material_id = $2 AND count > 0
          ORDER BY CASE quality
            WHEN 'white' THEN 0 WHEN 'green' THEN 1 WHEN 'blue' THEN 2
            WHEN 'purple' THEN 3 WHEN 'gold' THEN 4 WHEN 'red' THEN 5 ELSE 99 END`,
        [char.id, ing.itemId]
      )
      const total = rows.reduce((a: number, r: any) => a + Number(r.count || 0), 0)
      if (total < ing.qty) {
        return { code: 400, message: `${ing.itemId} 不足（需 ${ing.qty}，仅有 ${total}）` }
      }
      stockMap[ing.itemId] = rows.map((r: any) => ({ quality: r.quality, count: Number(r.count) }))
    }

    // 事务
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 扣灵石
      await client.query(
        'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2',
        [recipe.spiritStoneCost, char.id]
      )

      // 扣原料（低品优先）
      for (const ing of recipe.ingredients) {
        let remaining = ing.qty
        for (const s of stockMap[ing.itemId]) {
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

      // 给成品（统一 quality='white' 作为占位，避免触发 UNIQUE(character_id, material_id, quality) 的 null 行为）
      await client.query(
        `INSERT INTO character_materials (character_id, material_id, count, quality)
         VALUES ($1, $2, 1, 'white')
         ON CONFLICT (character_id, material_id, quality)
         DO UPDATE SET count = character_materials.count + 1`,
        [char.id, recipeId]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      message: `炼制成功！获得「${recipe.name}」×1`,
      data: { recipeId, name: recipe.name },
    }
  } catch (error) {
    console.error('炼制礼物失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
