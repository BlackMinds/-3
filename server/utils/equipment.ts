import { getPool } from '~/server/database/db'

import { rand } from '~/server/utils/random'

export async function consumeSpecialItem(charId: number, pillId: string): Promise<boolean> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT id, count FROM character_pills WHERE character_id = $1 AND pill_id = $2 AND count > 0 LIMIT 1',
    [charId, pillId]
  )
  if (rows.length === 0) return false
  await pool.query('UPDATE character_pills SET count = count - 1 WHERE id = $1', [rows[0].id])
  await pool.query('DELETE FROM character_pills WHERE id = $1 AND count <= 0', [rows[0].id])
  return true
}

// 副属性池（掉落/洗练/升品/合成全部走这里）
// 分类：
//   FLAT     — 固定值，跟装备 tier 走（tierMul × qualityMul）；后期贬值，充当"垃圾词条"
//   PERCENT  — 百分比类，只乘 qualityMul，不随 tier 膨胀
// weight — 加权抽取概率（不是概率，是相对权重）
//   20 = 垃圾档（flat 基础属性、资源类）          - 大概率出
//   10 = 中档   （百分比基础、五行、命中）          - 中等概率
//    5 = 好词条 （暴击/暴伤/吸血/闪避/破甲）       - 难出，神器的组成
export const SUB_STAT_POOL = [
  // flat（垃圾/凑数）
  { stat: 'ATK',            min: 3,  max: 20,  weight: 20 },
  { stat: 'DEF',            min: 2,  max: 15,  weight: 20 },
  { stat: 'HP',             min: 15, max: 100, weight: 20 },
  { stat: 'SPD',            min: 1,  max: 8,   weight: 20 },
  { stat: 'SPIRIT',         min: 1,  max: 6,   weight: 20 },
  { stat: 'SPIRIT_DENSITY', min: 1,  max: 4,   weight: 20 },
  { stat: 'LUCK',           min: 1,  max: 4,   weight: 20 },
  // 百分比属性（中档）
  { stat: 'ATK_PCT',        min: 1,  max: 3,   weight: 10 },
  { stat: 'DEF_PCT',        min: 1,  max: 3,   weight: 10 },
  { stat: 'HP_PCT',         min: 1,  max: 4,   weight: 10 },
  { stat: 'SPD_PCT',        min: 1,  max: 2,   weight: 10 },
  { stat: 'ACCURACY',       min: 1,  max: 3,   weight: 10 },
  { stat: 'METAL_DMG',      min: 1,  max: 5,   weight: 10 },
  { stat: 'WOOD_DMG',       min: 1,  max: 5,   weight: 10 },
  { stat: 'WATER_DMG',      min: 1,  max: 5,   weight: 10 },
  { stat: 'FIRE_DMG',       min: 1,  max: 5,   weight: 10 },
  { stat: 'EARTH_DMG',      min: 1,  max: 5,   weight: 10 },
  // 好词条（低概率，神器核心）
  { stat: 'CRIT_RATE',      min: 1,  max: 3,   weight: 5  },
  { stat: 'CRIT_DMG',       min: 2,  max: 10,  weight: 5  },
  { stat: 'LIFESTEAL',      min: 1,  max: 2,   weight: 5  },
  { stat: 'DODGE',          min: 1,  max: 2,   weight: 5  },
  { stat: 'ARMOR_PEN',      min: 1,  max: 5,   weight: 5  },
]

// 固定值类副属性（会按 tier 缩放）
export const SUB_STAT_FLAT = new Set(['ATK', 'DEF', 'HP', 'SPD', 'SPIRIT'])

// 副属性数量按品质
export const RARITY_SUB_COUNT: Record<string, number> = {
  white: 0, green: 1, blue: 2, purple: 3, gold: 4, red: 4,
}

/**
 * 统一副属性数值生成
 * 百分比类（LIFESTEAL / DODGE / ARMOR_PEN / ACCURACY / CRIT_* / 五行 / SPIRIT_DENSITY / LUCK）
 * 不随 tier 缩放，防止后期单条直接超过怪物上限
 */
export function rollSubStatValue(stat: string, min: number, max: number, rarityIdx: number, tier: number): number {
  const qualityMul = 1 + rarityIdx * 0.15
  const tierMul = 1 + (tier - 1) * 0.1
  const base = Math.floor(Math.random() * (max - min + 1)) + min
  const scaled = SUB_STAT_FLAT.has(stat)
    ? base * qualityMul * tierMul
    : base * qualityMul
  return Math.max(1, Math.floor(scaled))
}

/**
 * 按权重抽取一条副属性（从可用列表中）
 */
function weightedPick<T extends { weight: number }>(pool: T[]): T {
  const total = pool.reduce((a, b) => a + b.weight, 0)
  let r = Math.random() * total
  for (const item of pool) {
    r -= item.weight
    if (r <= 0) return item
  }
  return pool[pool.length - 1]
}

/**
 * 生成一组副属性（按品质数量，不重复）
 * 按 weight 加权：垃圾词条(flat/资源)高频出，好词条(暴击/吸血)低频出 — 神器需要多条好词条才能成型
 */
export function rollSubStats(rarityIdx: number, tier: number, count: number): { stat: string; value: number }[] {
  const subs: { stat: string; value: number }[] = []
  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    const available = SUB_STAT_POOL.filter(s => !used.has(s.stat))
    if (available.length === 0) break
    const pick = weightedPick(available)
    used.add(pick.stat)
    subs.push({ stat: pick.stat, value: rollSubStatValue(pick.stat, pick.min, pick.max, rarityIdx, tier) })
  }
  return subs
}

// consumeSpecialItem is exported from server/utils/consumeSpecialItem.ts (Nuxt auto-imports it)

export async function getCharId(userId: any): Promise<{ id: number } | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT id FROM characters WHERE user_id = $1',
    [userId]
  )
  return rows.length > 0 ? rows[0] : null
}
