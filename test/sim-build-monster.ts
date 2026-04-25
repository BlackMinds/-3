/**
 * 模拟器: 构建怪物战斗属性
 * 对应真实逻辑见 server/engine/battleEngine.ts 的 generateMonsterStats
 */

export interface MonsterBuild {
  tier: number        // 1-10
  role: 'balanced' | 'tank' | 'dps' | 'speed' | 'boss'
  power: number       // 怪物基础 power (从 ALL_MAPS 数据拿)
  element?: string | null
}

export interface MonsterStats {
  maxHp: number
  atk: number
  def: number
  spd: number
  critRate: number
  critDmg: number
  dodge: number
  lifesteal: number
  armorPen: number
  accuracy: number
  element: string | null
}

// 各 role 系数 (严格复刻 battleEngine.ts:341-347)
// maxHp = power × r.hp × 10, atk = power × r.atk, def = power × r.def × 0.6, spd = power × r.spd × 0.5
const ROLE_COEF: Record<string, { hp: number; atk: number; def: number; spd: number }> = {
  balanced: { hp: 0.30, atk: 0.30, def: 0.25, spd: 0.15 },
  tank:     { hp: 0.40, atk: 0.15, def: 0.35, spd: 0.10 },
  dps:      { hp: 0.20, atk: 0.45, def: 0.15, spd: 0.20 },
  speed:    { hp: 0.20, atk: 0.25, def: 0.15, spd: 0.40 },
  boss:     { hp: 0.35, atk: 0.30, def: 0.25, spd: 0.10 },
}

// v3.5 削弱: HP_SCALE × 0.60 联动玩家 DPS 下降, 保持 TTK
const HP_SCALE_BY_TIER: Record<number, number> = {
  1: 1.14, 2: 1.14, 3: 1.14, 4: 1.14,
  5: 1.40, 6: 1.51, 7: 1.63, 8: 1.73, 9: 1.73, 10: 1.73,
}
const ATK_SCALE = 0.665

export function buildMonster(m: MonsterBuild): MonsterStats {
  const r = ROLE_COEF[m.role] || ROLE_COEF.balanced
  const power = m.power
  const hpScale = HP_SCALE_BY_TIER[m.tier] ?? 0.95

  let maxHp = Math.floor(power * r.hp * 10 * hpScale)
  let atk = Math.floor(power * r.atk * ATK_SCALE)
  let def = Math.floor(power * r.def * 0.6)
  let spd = Math.floor(power * r.spd * 0.5)

  // 暴击/闪避/吸血/破甲/命中 (按 role 和 tier 叠加)
  let critRate = 0.05 + m.tier * 0.01
  let critDmg = 1.5 + m.tier * 0.05
  if (m.role === 'dps') { critRate += 0.05; critDmg += 0.2 }
  if (m.role === 'boss') { critRate += 0.03; critDmg += 0.3 }

  // v3.4: 怪物闪避/命中拉满
  let dodge = 0
  if (m.role === 'speed') dodge = 0.08 + m.tier * 0.03
  if (m.role === 'dps') dodge = m.tier * 0.015
  if (m.role === 'boss') dodge = 0.05 + m.tier * 0.015

  let lifesteal = 0
  if (m.role === 'boss' && m.tier >= 3) lifesteal = 0.03 + m.tier * 0.005
  if (m.role === 'dps' && m.tier >= 5) lifesteal = 0.02

  let armorPen = 0
  if (m.role === 'dps') armorPen = m.tier * 1.5
  if (m.role === 'boss') armorPen = m.tier * 2

  let accuracy = m.tier * 1
  if (m.role === 'boss') accuracy = m.tier * 3

  return {
    maxHp, atk, def, spd,
    critRate: Math.min(0.50, critRate),
    critDmg: Math.min(2.5, critDmg), // v3.4: 3.0→2.5
    dodge: Math.min(0.30, dodge),
    lifesteal: Math.min(0.15, lifesteal),
    armorPen: Math.min(30, armorPen),
    accuracy: Math.min(25, accuracy),
    element: m.element || null,
  }
}

// 各 tier 典型 Boss power (v3.1: 从 ALL_MAPS 抽取的平均值)
export const TIER_BOSS_POWER: Record<number, number> = {
  1: 450,     // 狼王 300 / 沼泽蛟 600
  2: 2800,    // T2 三 Boss 均值
  3: 5500,    // T3 三 Boss 均值
  4: 17000,   // T4 三 Boss 均值
  5: 39000,   // T5 三 Boss 均值
  6: 93000,   // T6 两 Boss 均值
  7: 150000,  // T7 两 Boss 均值
  8: 400000,  // T8 两 Boss 均值
  9: 700000,  // T9 三 Boss 均值
  10: 975000, // T10 两 Boss 均值
}

export function getTierBoss(tier: number, element: string | null = null): MonsterBuild {
  return {
    tier,
    role: 'boss',
    power: TIER_BOSS_POWER[tier] || 300,
    element,
  }
}
