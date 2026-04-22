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

export function buildMonster(m: MonsterBuild): MonsterStats {
  const r = ROLE_COEF[m.role] || ROLE_COEF.balanced
  const power = m.power

  let maxHp = Math.floor(power * r.hp * 10)     // ← ×10 是真实公式
  let atk = Math.floor(power * r.atk)
  let def = Math.floor(power * r.def * 0.6)
  let spd = Math.floor(power * r.spd * 0.5)

  // 暴击/闪避/吸血/破甲/命中 (按 role 和 tier 叠加)
  let critRate = 0.05
  let critDmg = 1.5
  if (m.role === 'dps') { critRate += 0.05; critDmg += 0.2 }
  if (m.role === 'boss') { critRate += 0.03; critDmg += 0.3 }

  let dodge = 0
  if (m.role === 'speed') dodge = 0.05 + m.tier * 0.02
  if (m.role === 'dps') dodge = m.tier * 0.01
  if (m.role === 'boss') dodge = 0.02 + m.tier * 0.005

  let lifesteal = 0
  if (m.role === 'boss' && m.tier >= 3) lifesteal = 0.03 + m.tier * 0.005
  if (m.role === 'dps' && m.tier >= 5) lifesteal = 0.02

  let armorPen = 0
  if (m.role === 'dps') armorPen = m.tier * 1.5
  if (m.role === 'boss') armorPen = m.tier * 2

  let accuracy = m.tier * 1
  if (m.role === 'boss') accuracy = m.tier * 2

  return {
    maxHp, atk, def, spd,
    critRate: Math.min(0.50, critRate),
    critDmg: Math.min(3.0, critDmg),
    dodge: Math.min(0.30, dodge),
    lifesteal: Math.min(0.15, lifesteal),
    armorPen: Math.min(30, armorPen),
    accuracy: Math.min(25, accuracy),
    element: m.element || null,
  }
}

// 各 tier 典型 Boss power (从 fight.post.ts 的 ALL_MAPS 抽取)
export const TIER_BOSS_POWER: Record<number, number> = {
  1: 300,
  2: 4000,
  3: 18000,
  4: 70000,
  5: 380000,
  6: 1550000,
  7: 7500000,
  8: 40000000,
  9: 180000000,
  10: 650000000,
}

export function getTierBoss(tier: number, element: string | null = null): MonsterBuild {
  return {
    tier,
    role: 'boss',
    power: TIER_BOSS_POWER[tier] || 300,
    element,
  }
}
