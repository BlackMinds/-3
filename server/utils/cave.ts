import { getPool } from '~/server/database/db'
import { isGiftIngredient } from '~/game/herbData'

export interface BuildingConfig {
  id: string
  maxLevel: number
  baseCost: number
  costMul: number
  baseTime: number
  output?: { type: 'exp' | 'spirit_stone' | 'herb'; base: number; perLevelMul: number }
  prerequisite?: { buildingId: string; level: number }
}

export const BUILDINGS: Record<string, BuildingConfig> = {
  spirit_array:   { id: 'spirit_array',   maxLevel: 20, baseCost: 1000,  costMul: 1.6, baseTime: 0,   output: { type: 'exp',          base: 144, perLevelMul: 1.17 } },
  herb_field:     { id: 'herb_field',     maxLevel: 15, baseCost: 1500,  costMul: 1.7, baseTime: 0   },
  treasure_pot:   { id: 'treasure_pot',   maxLevel: 20, baseCost: 2000,  costMul: 1.7, baseTime: 0,   output: { type: 'spirit_stone', base: 900, perLevelMul: 1.22 } },
  martial_hall:   { id: 'martial_hall',   maxLevel: 10, baseCost: 3000,  costMul: 2.5, baseTime: 60 },
  sutra_pavilion: { id: 'sutra_pavilion', maxLevel: 10, baseCost: 5000,  costMul: 2.2, baseTime: 120, prerequisite: { buildingId: 'spirit_array', level: 5 } },
  pill_room:      { id: 'pill_room',      maxLevel: 10, baseCost: 8000,  costMul: 2.2, baseTime: 180, prerequisite: { buildingId: 'herb_field', level: 5 } },
  forge_room:     { id: 'forge_room',     maxLevel: 10, baseCost: 10000, costMul: 2.2, baseTime: 300, prerequisite: { buildingId: 'sutra_pavilion', level: 5 } },
}

export const HERBS: Record<string, { id: string; element: string | null; unlockPlotMaxLevel: number }> = {
  common_herb:  { id: 'common_herb',  element: null,    unlockPlotMaxLevel: 1  },
  metal_herb:   { id: 'metal_herb',   element: 'metal', unlockPlotMaxLevel: 1  },
  wood_herb:    { id: 'wood_herb',    element: 'wood',  unlockPlotMaxLevel: 1  },
  water_herb:   { id: 'water_herb',   element: 'water', unlockPlotMaxLevel: 4  },
  fire_herb:    { id: 'fire_herb',    element: 'fire',  unlockPlotMaxLevel: 4  },
  earth_herb:   { id: 'earth_herb',   element: 'earth', unlockPlotMaxLevel: 7  },
  spirit_grass: { id: 'spirit_grass', element: null,    unlockPlotMaxLevel: 10 },
  // 情花系列（道侣礼物原料，design/system-companion.md 3.3.3）
  silk_flower:      { id: 'silk_flower',      element: null, unlockPlotMaxLevel: 3  },
  butterfly_flower: { id: 'butterfly_flower', element: null, unlockPlotMaxLevel: 5  },
  moonlight_orchid: { id: 'moonlight_orchid', element: null, unlockPlotMaxLevel: 7  },
  couple_lotus:     { id: 'couple_lotus',     element: null, unlockPlotMaxLevel: 10 },
  lifelong_grass:   { id: 'lifelong_grass',   element: null, unlockPlotMaxLevel: 13 },
  red_dust_flower:  { id: 'red_dust_flower',  element: null, unlockPlotMaxLevel: 15 },
}

// 种植时间不按品质分档：真实成熟时间由 server/api/cave/plant.post.ts 按灵田等级统一计算
export const QUALITIES: Record<string, { id: string; multiplier: number; baseYield: number; unlockPlotLevel: number }> = {
  white:  { id: 'white',  multiplier: 1.00, baseYield: 9,  unlockPlotLevel: 1  },
  green:  { id: 'green',  multiplier: 1.10, baseYield: 9,  unlockPlotLevel: 1  },
  blue:   { id: 'blue',   multiplier: 1.25, baseYield: 12, unlockPlotLevel: 4  },
  purple: { id: 'purple', multiplier: 1.50, baseYield: 12, unlockPlotLevel: 7  },
  gold:   { id: 'gold',   multiplier: 2.00, baseYield: 15, unlockPlotLevel: 10 },
  red:    { id: 'red',    multiplier: 3.00, baseYield: 15, unlockPlotLevel: 13 },
}

export function getPlotConfig(herbFieldLevel: number): { plotCount: number; maxQualityIndex: number } {
  if (herbFieldLevel <= 0) return { plotCount: 0, maxQualityIndex: -1 }
  const lv = Math.min(herbFieldLevel, 15)
  const qOrder = ['white', 'green', 'blue', 'purple', 'gold', 'red']
  let plotCount = 4, maxQ = 'green'
  if (lv >= 13)      { plotCount = 8; maxQ = 'red'    }
  else if (lv >= 10) { plotCount = 7; maxQ = 'gold'   }
  else if (lv >= 7)  { plotCount = 6; maxQ = 'purple' }
  else if (lv >= 4)  { plotCount = 5; maxQ = 'blue'   }
  return { plotCount, maxQualityIndex: qOrder.indexOf(maxQ) }
}

export async function getHerbFieldLevel(charId: number): Promise<number> {
  const pool = getPool()
  const { rows } = await pool.query(
    "SELECT level FROM character_cave WHERE character_id = $1 AND building_id = 'herb_field'",
    [charId]
  )
  return rows.length > 0 ? rows[0].level : 0
}

export async function getChar(userId: any): Promise<any | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT * FROM characters WHERE user_id = $1',
    [userId]
  )
  return rows.length > 0 ? rows[0] : null
}

export function getUpgradeCost(b: BuildingConfig, level: number): number {
  return Math.floor(b.baseCost * Math.pow(b.costMul, level - 1))
}

export function getUpgradeTime(b: BuildingConfig, level: number): number {
  if (level <= 5) return 0
  return Math.floor(b.baseTime * Math.pow(1.5, level - 6))
}

export function calcOutput(b: BuildingConfig, level: number, lastCollectTime: Date, mul: number = 1): number {
  if (!b.output) return 0
  const now = Date.now()
  const elapsedMs = now - new Date(lastCollectTime).getTime()
  const elapsedHours = Math.min(elapsedMs / 3600000, 24)
  if (elapsedHours <= 0) return 0
  const perHour = Math.floor(b.output.base * Math.pow(b.output.perLevelMul, level - 1))
  return Math.floor(perHour * elapsedHours * mul)
}

/**
 * 赞助产出倍率：读 cave_output_mul；若 sponsor_expire_at 已过期则回退 1.0。
 * 传入 characters 行（SELECT * 或至少包含这两个字段）。
 */
export function getSponsorMul(char: any): number {
  if (!char) return 1
  const mul = Number(char.cave_output_mul || 1)
  if (mul <= 1) return 1
  const expire = char.sponsor_expire_at
  if (expire && new Date(expire).getTime() < Date.now()) return 1
  return mul
}

/**
 * 一键种植月卡是否生效：读 sponsor_oneclick_plant + oneclick_plant_expire_at 双字段。
 */
export function isOneclickPlantActive(char: any): boolean {
  if (!char || !char.sponsor_oneclick_plant) return false
  const expire = char.oneclick_plant_expire_at
  if (expire && new Date(expire).getTime() < Date.now()) return false
  return true
}

/**
 * 当前生效的地块上限 = 基础（按灵田等级）+ 月卡未过期的 bonus_plot_count。
 * 月卡过期后只减「可种植上限」，扩容地块上已有作物可继续收获（收一茬再冻结）。
 */
export function getEffectivePlotCount(char: any, herbFieldLevel: number): number {
  const { plotCount } = getPlotConfig(herbFieldLevel)
  const bonus = Number(char?.bonus_plot_count || 0)
  if (bonus <= 0) return plotCount
  const expire = char?.bonus_plot_expire_at
  if (expire && new Date(expire).getTime() < Date.now()) return plotCount
  return plotCount + bonus
}

export function randomHarvestQuality(herbFieldLevel: number, herbId?: string): { quality: string; count: number } {
  const { maxQualityIndex } = getPlotConfig(herbFieldLevel)
  const qOrder = ['white', 'green', 'blue', 'purple', 'gold', 'red']
  const yields = [9, 9, 12, 12, 15, 15]

  // 2026-05-15：礼物原料统一 white 品质（礼物 craft 与品质无关），产量按当前灵田最大档取，保留地块等级梯度
  if (herbId && isGiftIngredient(herbId)) {
    return { quality: 'white', count: yields[Math.max(0, maxQualityIndex)] }
  }

  let weights: number[]
  if (herbFieldLevel >= 13)      weights = [5, 15, 25, 25, 20, 10]
  else if (herbFieldLevel >= 10) weights = [10, 25, 30, 25, 10, 0]
  else if (herbFieldLevel >= 7)  weights = [25, 35, 25, 15, 0, 0]
  else if (herbFieldLevel >= 4)  weights = [50, 35, 15, 0, 0, 0]
  else                           weights = [80, 20, 0, 0, 0, 0]

  for (let i = maxQualityIndex + 1; i < weights.length; i++) weights[i] = 0

  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let qIdx = 0
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) { qIdx = i; break }
  }

  return { quality: qOrder[qIdx], count: yields[qIdx] }
}
