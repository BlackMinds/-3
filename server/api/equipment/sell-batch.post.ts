import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'
import { updateSectDailyTask } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'

const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red']
const SELL_PRICES: Record<string, number> = { white: 3, green: 15, blue: 60, purple: 300, gold: 1500, red: 6000 } // v3.4.2: -70%

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { rarity, tier } = await readBody(event)
  const maxIdx = RARITY_ORDER.indexOf(rarity)
  if (maxIdx < 0) return { code: 400, message: '品质参数错误' }

  // tier 过滤：'all' / undefined / 非法值都视为不限；1-10 才过滤
  const tierNum = Number(tier)
  const useTierFilter = tier !== undefined && tier !== null && tier !== 'all' && Number.isFinite(tierNum) && tierNum >= 1 && tierNum <= 10

  const char = await getCharId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const charId = char.id
  const allowed = RARITY_ORDER.slice(0, maxIdx + 1)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = useTierFilter
      ? await client.query(
          `SELECT id, rarity, tier, enhance_level FROM character_equipment
           WHERE character_id = $1 AND slot IS NULL AND rarity = ANY($2) AND tier = $3
           FOR UPDATE`,
          [charId, allowed, tierNum]
        )
      : await client.query(
          `SELECT id, rarity, tier, enhance_level FROM character_equipment
           WHERE character_id = $1 AND slot IS NULL AND rarity = ANY($2)
           FOR UPDATE`,
          [charId, allowed]
        )

    if (rows.length === 0) {
      await client.query('COMMIT')
      return { code: 200, message: '没有可出售的装备', data: { price: 0, count: 0, soldIds: [], newSpiritStone: null } }
    }

    let total = 0
    const ids: number[] = []
    for (const eq of rows) {
      const enhLv = eq.enhance_level || 0
      total += Math.floor((SELL_PRICES[eq.rarity] || 10) * eq.tier * (1 + enhLv * 0.1))
      ids.push(eq.id)
    }

    await client.query('DELETE FROM character_equipment WHERE id = ANY($1)', [ids])
    const { rows: updRows } = await client.query(
      'UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2 RETURNING spirit_stone',
      [total, charId]
    )
    const newSpiritStone = updRows[0]?.spirit_stone

    await client.query('COMMIT')

    // 任务 / 成就累加 — 失败不回滚主流程
    updateSectDailyTask(charId, 'sell', ids.length).catch(() => {})
    checkAchievements(charId, 'equip_sell', ids.length).catch(() => {})

    return {
      code: 200,
      message: `出售 ${ids.length} 件，获得 ${total} 灵石`,
      data: { price: total, count: ids.length, soldIds: ids, newSpiritStone },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('批量出售装备失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
