import type { PoolClient } from 'pg'
import { getPool } from '~/server/database/db'

// 强化石合成：5 个 T(n) 合成 1 个 T(n+1)
// 概率：基础 1 个，5% 双倍，1% 五倍（互斥，先 roll 五倍再 roll 双倍）
// 范围：from_tier ∈ [4, 17]，目标 tier = from_tier + 1（最高 T18）
const MIN_FROM_TIER = 4
const MAX_FROM_TIER = 17
const COST_PER_CRAFT = 5
const DOUBLE_RATE = 0.05
const QUINTUPLE_RATE = 0.01
const MAX_BATCH = 9999

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const userId = event.context.userId
  const body = await readBody(event)
  const fromTier = Number(body?.from_tier)
  const craftCount = Math.floor(Number(body?.craft_count) || 0)

  if (!Number.isInteger(fromTier) || fromTier < MIN_FROM_TIER || fromTier > MAX_FROM_TIER) {
    return { code: 400, message: `源 tier 必须在 T${MIN_FROM_TIER} ~ T${MAX_FROM_TIER}` }
  }
  if (!Number.isFinite(craftCount) || craftCount <= 0 || craftCount > MAX_BATCH) {
    return { code: 400, message: '合成次数非法' }
  }

  const toTier = fromTier + 1
  const fromId = `enhance_stone_t${fromTier}`
  const toId = `enhance_stone_t${toTier}`
  const need = craftCount * COST_PER_CRAFT

  let client: PoolClient
  try {
    client = await pool.connect()
  } catch (e) {
    console.error('强化石合成取连接失败:', e)
    return { code: 503, message: '服务器繁忙,请稍后再试' }
  }

  try {
    const { rows: charRows } = await client.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const charId = charRows[0].id

    await client.query('BEGIN')

    // 条件扣减源强化石：quality_factor=1.0（强化石全部存在 1.0）；CTE 求和后判断库存
    const { rowCount: deducted } = await client.query(
      `UPDATE character_pills
         SET count = count - $3
       WHERE character_id = $1 AND pill_id = $2 AND quality_factor = 1.0 AND count >= $3`,
      [charId, fromId, need]
    )
    if (!deducted) {
      await client.query('ROLLBACK')
      return { code: 400, message: `强化石·T${fromTier} 不足,需要 ${need}` }
    }

    // 累计产出
    let total = 0
    let doubles = 0
    let quintuples = 0
    for (let i = 0; i < craftCount; i++) {
      const r = Math.random()
      if (r < QUINTUPLE_RATE) {
        total += 5
        quintuples += 1
      } else if (r < QUINTUPLE_RATE + DOUBLE_RATE) {
        total += 2
        doubles += 1
      } else {
        total += 1
      }
    }

    await client.query(
      `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
       VALUES ($1, $2, $3, 1.0)
       ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + $3`,
      [charId, toId, total]
    )

    // 清理可能 count<=0 的记录
    await client.query(
      `DELETE FROM character_pills WHERE character_id = $1 AND pill_id = $2 AND count <= 0`,
      [charId, fromId]
    )

    await client.query('COMMIT')

    return {
      code: 200,
      data: {
        from_tier: fromTier,
        to_tier: toTier,
        craft_count: craftCount,
        consumed: need,
        produced: total,
        doubles,
        quintuples,
      },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('强化石合成失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
