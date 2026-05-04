import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'
import { updateSectDailyTask } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'

const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red']
const SELL_PRICES: Record<string, number> = { white: 3, green: 15, blue: 60, purple: 300, gold: 1500, red: 6000 } // v3.4.2: -70%
const VALID_BASE_SLOTS = new Set(['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant'])

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { rarity, tier, baseSlot, rarityEq, setKey, attr } = await readBody(event)
  const maxIdx = RARITY_ORDER.indexOf(rarity)
  if (maxIdx < 0) return { code: 400, message: '品质参数错误' }

  // tier 过滤：'all' / undefined / 非法值都视为不限；1-12 才过滤
  const tierNum = Number(tier)
  const useTierFilter = tier !== undefined && tier !== null && tier !== 'all' && Number.isFinite(tierNum) && tierNum >= 1 && tierNum <= 12

  // baseSlot 过滤（兵器/法袍/...）
  const useBaseSlot = typeof baseSlot === 'string' && VALID_BASE_SLOTS.has(baseSlot)

  // 品质单选过滤：必须在 allowed 范围内才生效（与"品质上限"求交集）
  const allowed = RARITY_ORDER.slice(0, maxIdx + 1)
  let allowedFinal = allowed
  if (typeof rarityEq === 'string' && RARITY_ORDER.includes(rarityEq)) {
    allowedFinal = allowed.includes(rarityEq) ? [rarityEq] : []
  }
  if (allowedFinal.length === 0) {
    return { code: 200, message: '没有可出售的装备', data: { price: 0, count: 0, soldIds: [], newSpiritStone: null } }
  }

  // setKey 过滤：'none' = 无套装；其他字符串 = 指定套装
  const useSetNone = setKey === 'none'
  const useSetEq = typeof setKey === 'string' && setKey !== 'none' && setKey.length > 0

  // attr 过滤（主属性或副属性命中）后置在 JS 里做，避免复杂 JSON SQL
  const useAttr = typeof attr === 'string' && attr.length > 0

  const char = await getCharId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const charId = char.id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 拼装 SQL：基础条件 + 可选过滤
    const where: string[] = [
      'character_id = $1',
      'slot IS NULL',
      'rarity = ANY($2)',
      'COALESCE(locked, FALSE) = FALSE',
    ]
    const params: any[] = [charId, allowedFinal]

    if (useTierFilter) {
      params.push(tierNum)
      where.push(`tier = $${params.length}`)
    }
    if (useBaseSlot) {
      params.push(baseSlot)
      where.push(`base_slot = $${params.length}`)
    }
    if (useSetNone) {
      where.push(`set_id IS NULL`)
    } else if (useSetEq) {
      params.push(setKey)
      where.push(`set_id = $${params.length}`)
    }

    const sql = `SELECT id, rarity, tier, enhance_level, primary_stat, sub_stats
                 FROM character_equipment
                 WHERE ${where.join(' AND ')}
                 FOR UPDATE`
    const { rows } = await client.query(sql, params)

    // 内存里再做 attr 过滤（主属性 / 副属性命中）
    let filteredRows = rows
    if (useAttr) {
      filteredRows = rows.filter(eq => {
        if (eq.primary_stat === attr) return true
        let subs: any = eq.sub_stats
        if (typeof subs === 'string') {
          try { subs = JSON.parse(subs) } catch { subs = [] }
        }
        return Array.isArray(subs) && subs.some((s: any) => s?.stat === attr)
      })
    }

    if (filteredRows.length === 0) {
      await client.query('COMMIT')
      return { code: 200, message: '没有可出售的装备', data: { price: 0, count: 0, soldIds: [], newSpiritStone: null } }
    }

    let total = 0
    const ids: number[] = []
    for (const eq of filteredRows) {
      const enhLv = eq.enhance_level || 0
      total += Math.floor((SELL_PRICES[eq.rarity] || 10) * eq.tier * (1 + enhLv * 0.1))
      ids.push(eq.id)
    }

    // 清掉所有装备方案中对这批装备的引用（slot IS NULL 的装备理论上不会被任何方案引用，
    // 但仍幂等清一次防御历史脏数据 / 后续放宽筛选导致的误占）
    await client.query(
      `UPDATE character_equipment_loadouts
       SET slots = COALESCE((
         SELECT jsonb_object_agg(k, v)
         FROM jsonb_each(slots) AS s(k, v)
         WHERE NOT ((v)::text::int = ANY($2::int[]))
       ), '{}'::jsonb), updated_at = NOW()
       WHERE character_id = $1`,
      [charId, ids]
    )
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
