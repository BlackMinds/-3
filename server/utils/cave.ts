import { getPool } from '~/server/database/db'

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
  spirit_array:   { id: 'spirit_array',   maxLevel: 20, baseCost: 1000,  costMul: 1.6, baseTime: 0,   output: { type: 'exp',          base: 50,  perLevelMul: 1.15 } },
  herb_field:     { id: 'herb_field',     maxLevel: 15, baseCost: 1500,  costMul: 1.7, baseTime: 0   },
  treasure_pot:   { id: 'treasure_pot',   maxLevel: 20, baseCost: 2000,  costMul: 1.8, baseTime: 0,   output: { type: 'spirit_stone', base: 800, perLevelMul: 1.22 } },
  martial_hall:   { id: 'martial_hall',   maxLevel: 10, baseCost: 3000,  costMul: 2.5, baseTime: 60 },
  sutra_pavilion: { id: 'sutra_pavilion', maxLevel: 10, baseCost: 5000,  costMul: 2.5, baseTime: 120, prerequisite: { buildingId: 'spirit_array', level: 5 } },
  pill_room:      { id: 'pill_room',      maxLevel: 10, baseCost: 8000,  costMul: 2.5, baseTime: 180, prerequisite: { buildingId: 'herb_field', level: 5 } },
  forge_room:     { id: 'forge_room',     maxLevel: 10, baseCost: 10000, costMul: 2.5, baseTime: 300, prerequisite: { buildingId: 'sutra_pavilion', level: 5 } },
}

export const HERBS: Record<string, { id: string; element: string | null; unlockPlotMaxLevel: number }> = {
  common_herb:  { id: 'common_herb',  element: null,    unlockPlotMaxLevel: 1  },
  metal_herb:   { id: 'metal_herb',   element: 'metal', unlockPlotMaxLevel: 1  },
  wood_herb:    { id: 'wood_herb',    element: 'wood',  unlockPlotMaxLevel: 1  },
  water_herb:   { id: 'water_herb',   element: 'water', unlockPlotMaxLevel: 4  },
  fire_herb:    { id: 'fire_herb',    element: 'fire',  unlockPlotMaxLevel: 4  },
  earth_herb:   { id: 'earth_herb',   element: 'earth', unlockPlotMaxLevel: 7  },
  spirit_grass: { id: 'spirit_grass', element: null,    unlockPlotMaxLevel: 10 },
}

export const QUALITIES: Record<string, { id: string; multiplier: number; growMinutes: number; baseYield: number; unlockPlotLevel: number }> = {
  white:  { id: 'white',  multiplier: 1.00, growMinutes: 30,  baseYield: 3, unlockPlotLevel: 1  },
  green:  { id: 'green',  multiplier: 1.10, growMinutes: 60,  baseYield: 3, unlockPlotLevel: 1  },
  blue:   { id: 'blue',   multiplier: 1.25, growMinutes: 120, baseYield: 4, unlockPlotLevel: 4  },
  purple: { id: 'purple', multiplier: 1.50, growMinutes: 240, baseYield: 4, unlockPlotLevel: 7  },
  gold:   { id: 'gold',   multiplier: 2.00, growMinutes: 480, baseYield: 5, unlockPlotLevel: 10 },
  red:    { id: 'red',    multiplier: 3.00, growMinutes: 960, baseYield: 5, unlockPlotLevel: 13 },
}

export function getPlotConfig(herbFieldLevel: number): { plotCount: number; maxQualityIndex: number } {
  if (herbFieldLevel <= 0) return { plotCount: 0, maxQualityIndex: -1 }
  const lv = Math.min(herbFieldLevel, 15)
  const qOrder = ['white', 'green', 'blue', 'purple', 'gold', 'red']
  let plotCount = 2, maxQ = 'green'
  if (lv >= 13)      { plotCount = 6; maxQ = 'red'    }
  else if (lv >= 10) { plotCount = 5; maxQ = 'gold'   }
  else if (lv >= 7)  { plotCount = 4; maxQ = 'purple' }
  else if (lv >= 4)  { plotCount = 3; maxQ = 'blue'   }
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

export function calcOutput(b: BuildingConfig, level: number, lastCollectTime: Date): number {
  if (!b.output) return 0
  const now = Date.now()
  const elapsedMs = now - new Date(lastCollectTime).getTime()
  const elapsedHours = Math.min(elapsedMs / 3600000, 24)
  if (elapsedHours <= 0) return 0
  const perHour = Math.floor(b.output.base * Math.pow(b.output.perLevelMul, level - 1))
  return Math.floor(perHour * elapsedHours)
}

export function randomHarvestQuality(herbFieldLevel: number): { quality: string; count: number } {
  const { maxQualityIndex } = getPlotConfig(herbFieldLevel)
  const qOrder = ['white', 'green', 'blue', 'purple', 'gold', 'red']

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

  const yields = [3, 3, 4, 4, 5, 5]
  return { quality: qOrder[qIdx], count: yields[qIdx] }
}
