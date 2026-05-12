/**
 * V5.0.2 装备生成数值气验收
 *
 * 用法：npx tsx test/sim-equip-v5.ts
 *
 * 跑 4 段：
 *   A) 单件主属性数值（T15 红+9 7 槽位）
 *   B) 强化词条 stat 池分布（1000 次抽样，验证池子均匀）
 *   C) 随机 7 件五行触发件数分布（1000 套）
 *   D) 理想 6 件相生套 + 累计生效 wuxing_affix 数值，对比 V5_T15_BASELINE_CAPS
 */
import {
  V5_EQUIPMENT_SLOTS, V5_WUXING_PREFIX_ORDER,
  V5_PER_WUXING_AFFIX_T15, V5_T15_BASELINE_CAPS,
  V5_WUXING_AFFIX_TABLE,
  computeV5WuxingActivation,
  getV5PerWuxingAffixValue,
  type V5EquippedItem, type WuxingPrefix,
} from '../shared/balance-v5'
import { rollEquipmentV5 } from '../server/utils/equipment-v5'

const SAMPLES = 1000

// ============ A) 单件主属性数值 ============
console.log('\n[A] T15 红+9 单件 base_stat_1 数值（公式：base × 20 × 2.5 × 1.9）')
for (const slot of V5_EQUIPMENT_SLOTS) {
  const eq = rollEquipmentV5({ slotIndex: slot.index, rarity: 'red', tier: 15, enhanceLevel: 9, prefix: 'wood' })
  console.log(`  slot${slot.index} ${slot.slot_v5.padEnd(6)} ${eq.base_stat_1.stat.padEnd(20)} = ${eq.base_stat_1.value}`)
}

// ============ B) 强化词条 stat 池分布 ============
console.log(`\n[B] 强化词条 stat 池分布（武器/法袍各 ${SAMPLES} 次 红+9）`)
function statDist(slotIndex: number, label: string) {
  const counter = new Map<string, number>()
  let total = 0
  for (let i = 0; i < SAMPLES; i++) {
    const eq = rollEquipmentV5({ slotIndex, rarity: 'red', tier: 15, enhanceLevel: 9, prefix: 'wood' })
    for (const a of eq.enhance_affixes) {
      counter.set(a.stat, (counter.get(a.stat) ?? 0) + 1)
      total++
    }
  }
  console.log(`  ${label}（${total} 条强化词条）:`)
  const sorted = [...counter.entries()].sort((a, b) => b[1] - a[1])
  for (const [stat, n] of sorted) {
    const pct = ((n / total) * 100).toFixed(1)
    const bar = '█'.repeat(Math.round((n / total) * 50))
    console.log(`    ${stat.padEnd(16)} ${pct.padStart(5)}%  ${bar} (${n})`)
  }
}
statDist(1, '武器')
statDist(4, '法袍')

// ============ C) 随机 7 件五行触发件数分布 ============
console.log(`\n[C] ${SAMPLES} 套随机 7 件装备的五行 affix_1 触发件数分布`)
const buckets = new Array(8).fill(0) // 0~7 件
for (let i = 0; i < SAMPLES; i++) {
  const equipped: V5EquippedItem[] = Array.from({ length: 7 }, (_, idx) => ({
    slotIndex: idx + 1,
    prefix: V5_WUXING_PREFIX_ORDER[Math.floor(Math.random() * V5_WUXING_PREFIX_ORDER.length)],
  }))
  const act = computeV5WuxingActivation(equipped)
  const n1 = act.filter(a => a.affix_1_active).length
  buckets[n1]++
}
console.log('  触发数 | 套数 | 占比')
for (let i = 0; i <= 7; i++) {
  const pct = ((buckets[i] / SAMPLES) * 100).toFixed(1)
  const bar = '█'.repeat(Math.round((buckets[i] / SAMPLES) * 50))
  console.log(`    ${i}    | ${String(buckets[i]).padStart(4)} | ${pct.padStart(5)}%  ${bar}`)
}
const ge3 = buckets.slice(3).reduce((a, b) => a + b, 0)
const ge6 = buckets.slice(6).reduce((a, b) => a + b, 0)
console.log(`  affix_2 解锁率（≥3 件触发）: ${((ge3 / SAMPLES) * 100).toFixed(1)}%`)
console.log(`  affix_3 解锁率（≥6 件触发）: ${((ge6 / SAMPLES) * 100).toFixed(1)}%`)

// ============ D) 理想满堆 baseline 校验 ============
// 构造 baseline 设定：「6 件触发 3 个五行词条 + 1 件不触发」
// 用木→火→土→金→水→木→火 这套链：slot1 不触发，slot2~7 全触发（共 6 件）
const baselineChain: WuxingPrefix[] = ['wood', 'fire', 'earth', 'metal', 'water', 'wood', 'fire']
const baselineEquipped: V5EquippedItem[] = baselineChain.map((p, i) => ({ slotIndex: i + 1, prefix: p }))
const baselineAct = computeV5WuxingActivation(baselineEquipped)

console.log('\n[D] baseline 链验证: slot 1 不触发，2~7 全触发')
let n1 = 0, n2 = 0, n3 = 0
for (const a of baselineAct) {
  if (a.affix_1_active) n1++
  if (a.affix_2_active) n2++
  if (a.affix_3_active) n3++
}
console.log(`  affix_1 触发: ${n1}/7  affix_2: ${n2}/7  affix_3: ${n3}/7  (预期 6/6/6)`)

// 累加每件装备「实际生效的」wuxing_affix 数值（按 stat key 汇总）
console.log('\n[D] T15 红+9 baseline 套累计生效 wuxing_affix 数值 vs baseline 上限')
const TIER = 15
const summed = new Map<string, number>()
for (let i = 0; i < 7; i++) {
  const slot = V5_EQUIPMENT_SLOTS[i]
  const prefix = baselineChain[i]
  const triple = V5_WUXING_AFFIX_TABLE[slot.base_slot_v4][prefix]
  const a = baselineAct[i]
  const flags = [a.affix_1_active, a.affix_2_active, a.affix_3_active]
  for (let j = 0; j < 3; j++) {
    if (!flags[j]) continue
    const stat = triple[j]
    const value = getV5PerWuxingAffixValue(stat, TIER)
    summed.set(stat, (summed.get(stat) ?? 0) + value)
  }
}
const allStats = new Set([...Object.keys(V5_PER_WUXING_AFFIX_T15), ...summed.keys()])
console.log('  stat                 累计      baseline     占比     说明')
for (const stat of allStats) {
  const sum = summed.get(stat) ?? 0
  const cap = V5_T15_BASELINE_CAPS[stat] ?? 0
  const pctOfCap = cap > 0 ? `${((sum / cap) * 100).toFixed(1)}%` : 'n/a'
  const note =
    sum === 0 ? '本套未抽到' :
    cap === 0 ? '(无 baseline 项)' :
    sum >= cap * 0.9 ? '已接近上限' : '部分堆叠'
  const sumStr = stat.endsWith('_pct') || stat === 'wuxing_dmg' || stat === 'dot_dmg' || stat === 'crit_rate' || stat === 'crit_dmg'
    ? sum.toFixed(4) : String(sum)
  const capStr = stat.endsWith('_pct') || stat === 'wuxing_dmg' || stat === 'dot_dmg' || stat === 'crit_rate' || stat === 'crit_dmg'
    ? cap.toFixed(4) : String(cap)
  console.log(`  ${stat.padEnd(20)} ${sumStr.padStart(10)} ${capStr.padStart(10)}   ${pctOfCap.padStart(6)}  ${note}`)
}

console.log('\nsim done.')
