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
  { stat: 'ACCURACY',       min: 1,  max: 2,   weight: 10 }, // v3.4: max 3→2 (-33%)
  { stat: 'METAL_DMG',      min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2（配合 ceil 让 tier 分档体感更明显）
  { stat: 'WOOD_DMG',       min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2
  { stat: 'WATER_DMG',      min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2
  { stat: 'FIRE_DMG',       min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2
  { stat: 'EARTH_DMG',      min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2
  // 好词条（v3.0 weight 5→10,神器概率 0.002% → ~0.7%）
  { stat: 'CRIT_RATE',      min: 2,  max: 3,   weight: 10 }, // v3.6: min 1→2
  { stat: 'CRIT_DMG',       min: 2,  max: 6,   weight: 10 }, // v3.6: min 1→2（v3.5 max 8→6）
  { stat: 'LIFESTEAL',      min: 1,  max: 1,   weight: 10 }, // max=1 顶死，靠 ceil 让 t10 自然分档为 2
  { stat: 'DODGE',          min: 1,  max: 1,   weight: 10 }, // 同上
  { stat: 'ARMOR_PEN',      min: 2,  max: 5,   weight: 10 }, // v3.6: min 1→2
]

// 固定值类副属性（会按 tier 高速缩放）
export const SUB_STAT_FLAT = new Set(['ATK', 'DEF', 'HP', 'SPD', 'SPIRIT'])

// 好词条（暴击/暴伤/吸血/闪避/破甲）— tier 浮动最低，防引擎 cap 撞顶
export const SUB_STAT_GOOD = new Set(['CRIT_RATE', 'CRIT_DMG', 'LIFESTEAL', 'DODGE', 'ARMOR_PEN'])

// 副属性数量按品质
export const RARITY_SUB_COUNT: Record<string, number> = {
  white: 0, green: 1, blue: 2, purple: 3, gold: 4, red: 4,
}

/**
 * 副属性 tier 浮动系数（v3.5：让 t 级在副属性上真正分档）
 *   FLAT     — +10%/tier，t10 = 1.9×（已有）
 *   GOOD     — +4%/tier， t10 = 1.36×（暴击/暴伤/吸血/闪避/破甲，防引擎 cap 撞顶）
 *   其余 PCT — +6%/tier， t10 = 1.54×（PCT/五行/命中/SPIRIT_DENSITY/LUCK）
 */
function getTierMul(stat: string, tier: number): number {
  if (SUB_STAT_FLAT.has(stat)) return 1 + (tier - 1) * 0.10
  if (SUB_STAT_GOOD.has(stat)) return 1 + (tier - 1) * 0.04
  return 1 + (tier - 1) * 0.06
}

/**
 * 统一副属性数值生成
 * v3.6: 终值改为 Math.ceil，让 GOOD 类（如 LIFESTEAL/DODGE max=1）的 tier 倍率不再被 floor 截断
 */
export function rollSubStatValue(stat: string, min: number, max: number, rarityIdx: number, tier: number): number {
  const qualityMul = 1 + rarityIdx * 0.15
  const tierMul = getTierMul(stat, tier)
  const base = Math.floor(Math.random() * (max - min + 1)) + min
  return Math.max(1, Math.ceil(base * qualityMul * tierMul))
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
