// 炼制礼物 - POST /api/companion/craft-gift
// body: {
//   recipe_id: string,
//   ingredient_qualities: { [itemId: string]: 'white'|'green'|'blue'|'purple'|'gold'|'red' }
// }
// 流程: 校验配方 / 检查原料品质库存 / 扣灵石 + 原料 / 给成品（成品 quality 由原料品质均值映射）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { GIFT_RECIPE_MAP } from '~/server/engine/giftRecipeData'

const QUALITY_FACTOR: Record<string, number> = {
  white: 1.0,
  green: 1.1,
  blue: 1.25,
  purple: 1.5,
  gold: 2.0,
  red: 3.0,
}

// 系数 → 成品 quality 映射（取最近）
function factorToQuality(factor: number): string {
  const tiers: Array<[string, number]> = [
    ['white', 1.0], ['green', 1.1], ['blue', 1.25],
    ['purple', 1.5], ['gold', 2.0], ['red', 3.0],
  ]
  let best = 'white'
  let minDiff = Infinity
  for (const [q, f] of tiers) {
    const diff = Math.abs(factor - f)
    if (diff < minDiff) { minDiff = diff; best = q }
  }
  return best
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const recipeId = body?.recipe_id as string
    const qualities = (body?.ingredient_qualities || {}) as Record<string, string>

    if (!recipeId) return { code: 400, message: '参数错误' }
    const recipe = GIFT_RECIPE_MAP[recipeId]
    if (!recipe) return { code: 400, message: '配方不存在' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    // 检查每个原料品质指定
    for (const ing of recipe.ingredients) {
      const q = qualities[ing.itemId]
      if (!q || !(q in QUALITY_FACTOR)) {
        return { code: 400, message: `${ing.itemId} 未选择品质` }
      }
    }

    // 计算品质系数（均值）
    let factorSum = 0
    let factorCount = 0
    for (const ing of recipe.ingredients) {
      factorSum += QUALITY_FACTOR[qualities[ing.itemId]] * ing.qty
      factorCount += ing.qty
    }
    const factor = factorSum / factorCount
    const outputQuality = factorToQuality(factor)

    // 灵石检查
    if (Number(char.spirit_stone) < recipe.spiritStoneCost) {
      return { code: 400, message: `灵石不足，需 ${recipe.spiritStoneCost}` }
    }

    // 库存检查
    for (const ing of recipe.ingredients) {
      const q = qualities[ing.itemId]
      const { rows } = await pool.query(
        `SELECT count FROM character_materials
          WHERE character_id = $1 AND material_id = $2 AND quality = $3`,
        [char.id, ing.itemId, q]
      )
      if ((rows[0]?.count || 0) < ing.qty) {
        return { code: 400, message: `${ing.itemId}·${q} 不足（需 ${ing.qty}，仅有 ${rows[0]?.count || 0}）` }
      }
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
      // 扣原料
      for (const ing of recipe.ingredients) {
        const q = qualities[ing.itemId]
        await client.query(
          `UPDATE character_materials SET count = count - $1
            WHERE character_id = $2 AND material_id = $3 AND quality = $4`,
          [ing.qty, char.id, ing.itemId, q]
        )
      }
      // 给成品（礼物存 character_materials, material_id=礼物 id, quality=按系数映射）
      await client.query(
        `INSERT INTO character_materials (character_id, material_id, count, quality)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (character_id, material_id, quality)
         DO UPDATE SET count = character_materials.count + 1`,
        [char.id, recipeId, outputQuality]
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
      message: `炼制成功！获得「${recipe.name}」×1（${outputQuality} · 品质系数 ${factor.toFixed(2)}x）`,
      data: {
        recipeId,
        name: recipe.name,
        outputQuality,
        qualityFactor: Number(factor.toFixed(2)),
      },
    }
  } catch (error) {
    console.error('炼制礼物失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
