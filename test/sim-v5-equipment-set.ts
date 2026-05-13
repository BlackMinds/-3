/**
 * V5.0.3 一整套装备数值打印（互换规则验证）
 *
 * 生成：
 *   - 普通组：7 件 T15 红 +9，前缀按相生链「木→火→土→金→水→木→火」全身触发
 *   - 元始天尊：7 件 T15 红 +9 套装
 *   - Boss 秘宝：T8/T10/T12/T15 各 1 件
 *
 * 每件装备打印：
 *   主属性1 / 五行词条 ①②③ / 强化词条 4 条
 *
 * 用法：npx tsx test/sim-v5-equipment-set.ts
 */
import { rollEquipmentV5, rollYuanshiTianzunSet } from '../server/utils/equipment-v5'
import {
  V5_BOSS_TREASURES, V5_EQUIPMENT_SLOTS, V5_WUXING_PREFIX_ZH,
  computeV5WuxingActivation, type V5EquippedItem, type WuxingPrefix,
} from '../shared/balance-v5'

const STAT_ZH: Record<string, string> = {
  atk: '攻击', def: '防御', hp: '气血', spd: '身法', spirit: '神识',
  atk_pct: '攻击%', def_pct: '防御%', hp_pct: '气血%', spd_pct: '身法%', spirit_pct: '神识%',
  crit_rate: '会心率', crit_dmg: '会心伤害', armor_pen: '破甲', accuracy: '命中',
  dodge: '闪避', lifesteal: '吸血',
  wuxing_dmg: '五行强化', dot_dmg: 'DOT', reflect: '反伤', res_pct: '五行抗性',
  dmg_reduction: '减伤', lifesteal_all: '全能吸血',
  luck: '福缘', spirit_density: '灵气', luck_pct: '福缘%', spirit_density_pct: '灵气%',
  accuracy_pct: '命中%',
  hp_pct_or_def_pct: '气血/防御 各',
}
function stat(s: string) { return STAT_ZH[s] ?? s }

const PCT_STATS = new Set([
  'atk_pct', 'def_pct', 'hp_pct', 'spd_pct', 'spirit_pct',
  'crit_rate', 'crit_dmg', 'armor_pen', 'accuracy', 'dodge', 'lifesteal',
  'wuxing_dmg', 'dot_dmg', 'reflect', 'res_pct', 'dmg_reduction', 'lifesteal_all',
  'hp_pct_or_def_pct', 'luck_pct', 'spirit_density_pct', 'accuracy_pct',
])
function fmt(s: string, v: number) {
  return PCT_STATS.has(s) ? `${v}%` : String(v)
}

// 模拟 +9 三次 milestone 都在同一条强化词条上 ×1.30
function stack3x(value: number): number {
  let v = value
  for (let i = 0; i < 3; i++) v = Math.max(Math.floor(v * 1.30), v + 1)
  return v
}

function printEquip(label: string, eq: any, activation?: { affix_1_active: boolean; affix_2_active: boolean; affix_3_active: boolean }) {
  const prefixArr = Array.isArray(eq.wuxing_prefix) ? eq.wuxing_prefix : [eq.wuxing_prefix]
  const prefixZh = prefixArr.length === 5 ? '☯️【五行】' : prefixArr.map((p: string) => V5_WUXING_PREFIX_ZH[p as WuxingPrefix] || p).join('/')
  const nameTag = eq.name ? ` ${eq.name}` : ''
  console.log(`\n  ▼ ${label}${nameTag} (${prefixZh}, T${eq.tier} ${eq.rarity}+${eq.enhance_level})`)

  // 主属性1
  console.log(`    主属性 ${stat(eq.base_stat_1.stat).padEnd(8)} +${fmt(eq.base_stat_1.stat, eq.base_stat_1.value)}`)

  // 五行词条 (3 档)
  const flags = activation ? [activation.affix_1_active, activation.affix_2_active, activation.affix_3_active] : [false, false, false]
  for (let i = 0; i < 3; i++) {
    const a = eq.wuxing_affixes[i]
    const tier = ['①', '②', '③'][i]
    const mark = flags[i] ? '亮' : '灰'
    console.log(`    五行${tier} ${stat(a.stat).padEnd(8)} +${fmt(a.stat, a.value).padEnd(8)} [${mark}]`)
  }

  // 强化词条 4 条（含 3 stack 后的预期）
  for (let i = 0; i < eq.enhance_affixes.length; i++) {
    const a = eq.enhance_affixes[i]
    const stacked = stack3x(a.value)
    console.log(`    强化${i+1} ${stat(a.stat).padEnd(8)} +${fmt(a.stat, a.value).padEnd(8)} (3×1.30 → +${fmt(a.stat, stacked)})`)
  }
}

// =====================================================================
console.log('═══════════════════════════════════════════════════════════')
console.log('普通组：T15 红 +9 全身相生触发链 (木→火→土→金→水→木→火)')
console.log('═══════════════════════════════════════════════════════════')

// 顺序：武器→灵戒→法宝→法袍→法冠→灵佩→步云靴
// 相生链: 木→火→土→金→水→木→火（slot7→slot1: 火→木 不生，slot1 affix_1 不触发；其余 6 件触发）
const CHAIN_PREFIXES: WuxingPrefix[] = ['wood', 'fire', 'earth', 'metal', 'water', 'wood', 'fire']
const normalSet = CHAIN_PREFIXES.map((prefix, i) =>
  rollEquipmentV5({ slotIndex: i + 1, rarity: 'red', tier: 15, enhanceLevel: 9, prefix })
)
const normalActivation = computeV5WuxingActivation(
  normalSet.map<V5EquippedItem>((eq, i) => ({ slotIndex: i + 1, prefix: CHAIN_PREFIXES[i] }))
)
const normalActMap = new Map(normalActivation.map(a => [a.slotIndex, a]))

for (let i = 0; i < 7; i++) {
  const slotMeta = V5_EQUIPMENT_SLOTS[i]
  printEquip(slotMeta.slot_v5, normalSet[i], normalActMap.get(i + 1))
}

const triggered = normalActivation.filter(a => a.affix_1_active).length
console.log(`\n  全身已激活 ${triggered}/7 件 · 第二条阈值 3${triggered >= 3 ? ' ✓' : ' ✗'} · 第三条阈值 6${triggered >= 6 ? ' ✓' : ' ✗'}`)

// =====================================================================
console.log('\n\n═══════════════════════════════════════════════════════════')
console.log('元始天尊套装：T15 红 +9，全 7 件【五行】前缀')
console.log('═══════════════════════════════════════════════════════════')

const yuanshi = rollYuanshiTianzunSet({ tier: 15, rarity: 'red', enhanceLevel: 9 })
const yuanshiActivation = computeV5WuxingActivation(
  yuanshi.map<V5EquippedItem>((eq, i) => ({ slotIndex: i + 1, prefix: eq.wuxing_prefix }))
)
const yuanshiActMap = new Map(yuanshiActivation.map(a => [a.slotIndex, a]))

for (let i = 0; i < 7; i++) {
  const slotMeta = V5_EQUIPMENT_SLOTS[i]
  printEquip(slotMeta.slot_v5, yuanshi[i], yuanshiActMap.get(i + 1))
}

const yuanshiTriggered = yuanshiActivation.filter(a => a.affix_1_active).length
console.log(`\n  元始天尊【五行】全身永远 ${yuanshiTriggered}/7 件触发（任何前缀都能相生）`)

// =====================================================================
console.log('\n\n═══════════════════════════════════════════════════════════')
console.log('Boss 秘宝：T8 / T10 / T12 / T15 各 1 件')
console.log('═══════════════════════════════════════════════════════════')

const bossSamples = [8, 10, 12, 15]
for (const tier of bossSamples) {
  const bossTreasure = V5_BOSS_TREASURES.find(b => b.tier === tier)
  if (!bossTreasure) continue
  const eq = rollEquipmentV5({
    slotIndex: V5_EQUIPMENT_SLOTS.findIndex(s => s.base_slot_v4 === bossTreasure.base_slot_v4) + 1,
    rarity: 'red',
    tier,
    enhanceLevel: 9,
    bossTreasure,
  })
  // boss 秘宝触发条件：假设上一件相生（手动 simulate 一个触发场景）
  const fakeAct = { slotIndex: eq.slot_index, affix_1_active: true, affix_2_active: true, affix_3_active: true }
  printEquip(`T${tier} ${bossTreasure.boss_zh}`, eq, fakeAct)
}

// =====================================================================
console.log('\n\n═══════════════════════════════════════════════════════════')
console.log('汇总：单件装备的强化词条 vs 五行词条数值规模对比')
console.log('═══════════════════════════════════════════════════════════')
console.log('（互换规则后：五行词条 = 主贡献者，强化词条 = 辅助）')
console.log()

const ringTest = rollEquipmentV5({ slotIndex: 2, rarity: 'red', tier: 15, enhanceLevel: 9, prefix: 'wood' })
console.log(`  灵戒·木 T15 红 +9 — 五行词条 max ≈ ${ringTest.wuxing_affixes.map(a => fmt(a.stat, a.value)).join(' / ')}`)
console.log(`                    — 强化词条 (4 条 +9 已生效) ≈ ${ringTest.enhance_affixes.map(a => fmt(a.stat, a.value)).join(' / ')}`)
console.log(`                    — 强化词条 3 stack ≈ ${ringTest.enhance_affixes.map(a => fmt(a.stat, stack3x(a.value))).join(' / ')}`)
