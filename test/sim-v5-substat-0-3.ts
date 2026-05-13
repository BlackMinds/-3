/**
 * V5.0.3 副词条数值仿真验证
 *
 * 验证目标：T15 红装 +9，3 次副词条强化均落在同一条上时，副词条数值是否达到
 * V5.0.3 设计目标（攻击力% 45 / 会心伤害% 84 / 福缘% 80 / dot 增伤% 60 等）
 *
 * 用法：npx tsx test/sim-v5-substat-0-3.ts
 */
import { rollEquipmentV5, applyV5EnhanceMilestone } from '../server/utils/equipment-v5'
import type { V5StatValue } from '../server/utils/equipment-v5'

interface SimResult {
  stat: string
  target: number
  observedMax: number
  observedMean: number
  pass: boolean
}

// V5.0.3 文档目标值（T15+9 红装、3 次同条强化后期望上限）
const TARGETS: Record<string, number> = {
  atk_pct:            45,
  spirit_pct:         45,
  def_pct:            40,
  hp_pct:             40,
  dmg_reduction:      40,
  luck_pct:           80,
  spirit_density_pct: 80,
  dodge:              32,
  accuracy_pct:       32,
  armor_pen:          45,
  lifesteal:          40,
  wuxing_dmg:         39,
  crit_rate:          42,
  crit_dmg:           84,
  dot_dmg:            60,  // V5.0.3 未明示，估算
}

// 跑多次掉落生成 → 强化 3 次 → 记录每条副词条 3 stack 后的数值
function runSim(slotIndex: number, rarity: 'red', tier: 15, iterations: number) {
  // stat → 收集所有 3 stack 后的数值
  const collected: Record<string, number[]> = {}

  for (let i = 0; i < iterations; i++) {
    // 1) 滚红装 +0（4 条初始副词条）
    const eq = rollEquipmentV5({ slotIndex, rarity, tier, enhanceLevel: 0 })
    let subs: V5StatValue[] = [...eq.enhance_affixes]

    // 2) 3 次 milestone（红装：每次都走「随机 ×1.30」分支）
    //    为模拟「3 次都在同一条」，对每条副词条独立跑 3 次 ×1.30
    for (const sub of subs) {
      let v = sub.value
      v = Math.max(Math.floor(v * 1.30), v + 1)
      v = Math.max(Math.floor(v * 1.30), v + 1)
      v = Math.max(Math.floor(v * 1.30), v + 1)
      if (!collected[sub.stat]) collected[sub.stat] = []
      collected[sub.stat].push(v)
    }
  }

  const results: SimResult[] = []
  for (const [stat, target] of Object.entries(TARGETS)) {
    const arr = collected[stat]
    if (!arr || arr.length === 0) continue
    const max = Math.max(...arr)
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    // 目标：max 在 target 的 ±20% 内（保留方差余地）
    const pass = max >= target * 0.85 && max <= target * 1.20
    results.push({ stat, target, observedMax: max, observedMean: Math.round(mean * 10) / 10, pass })
  }
  return results
}

console.log('================ V5.0.3 副词条数值仿真（T15 红装 +9，3 次同条强化）================\n')

console.log('▼ 武器 (slot=1, attack 池)')
const attackResults = runSim(1, 'red', 15, 5000)
printTable(attackResults)

console.log('\n▼ 法袍 (slot=4, defense 池)')
const defResults = runSim(4, 'red', 15, 5000)
printTable(defResults)

// flat 类验证（atk/def/hp/spirit）
console.log('\n▼ Flat 类副词条（T15 红，副词条 base = 主属性面板 × 0.1）')
const flatTargets: Record<string, number> = {
  atk:    150,    // 30 × 20 × 2.5 × 0.1 = 150 → 3 stack ≈ 329
  def:    100,    // 20 × 20 × 2.5 × 0.1
  hp:     3000,   // 600 × 20 × 2.5 × 0.1
  spirit: 40,     // 8 × 20 × 2.5 × 0.1
  spd:    75,     // 15 × 20 × 2.5 × 0.1
}
const flatStacked: Record<string, number> = {}
for (const [stat, base] of Object.entries(flatTargets)) {
  let v = base
  v = Math.max(Math.floor(v * 1.30), v + 1)
  v = Math.max(Math.floor(v * 1.30), v + 1)
  v = Math.max(Math.floor(v * 1.30), v + 1)
  flatStacked[stat] = v
  console.log(`  ${stat.padEnd(10)} base=${String(base).padStart(5)} → 3 stack = ${v}`)
}

console.log('\n================ 报告 ================')
const allResults = [...attackResults, ...defResults]
const failed = allResults.filter(r => !r.pass)
if (failed.length === 0) {
  console.log('✓ 所有副词条数值都在 V5.0.3 目标 ±20% 范围内')
} else {
  console.log(`⚠ ${failed.length} 项偏离目标:`)
  for (const r of failed) {
    console.log(`  ${r.stat}: target=${r.target} observed_max=${r.observedMax} (偏离 ${(((r.observedMax - r.target) / r.target) * 100).toFixed(1)}%)`)
  }
}

function printTable(results: SimResult[]) {
  console.log(`  ${'stat'.padEnd(20)} ${'目标'.padStart(6)} ${'实测max'.padStart(8)} ${'实测均'.padStart(8)}  pass`)
  for (const r of results) {
    const mark = r.pass ? '✓' : '✗'
    console.log(`  ${r.stat.padEnd(20)} ${String(r.target).padStart(6)} ${String(r.observedMax).padStart(8)} ${String(r.observedMean).padStart(8)}  ${mark}`)
  }
}
