/**
 * v4.0 装备数值校准验证（神兵锻造总纲）
 *
 * 目标：模拟 T14 红+10 满 7 件装备 → 单一五行强化（如金）总值 ≈ 95%
 *      以及饰品主属性单件 30~50%、属性2 数值 ≈ 30 等 PDF 数值带
 *
 * 用法：npx tsx test/sim-equip-v4.ts
 */

import {
  EQUIP_PRIMARY_BASE, EQUIP_PRIMARY_BASE_2, EQUIP_PRIMARY_V4, EQUIP_SUB_POOL_V4,
  RARITY_STAT_MUL, ENHANCE_MUL_PER_LEVEL, RARITY_SUB_COUNT_V4,
  getEquipTierWeight, getEquipPrimaryValue2, getSubStatAxisWeight,
} from '../shared/balance'
import {
  decideEquipPrimariesV4, rollSubStatsV4,
} from '../server/utils/equipment'

const TIER = 14
const RARITY = 'red'
const ENH_LV = 10

const TARGET_ELEMENT = 'METAL_DMG' // 测金属性堆叠

// ===== 单件主属性数值（饰品 / 兵器属性2 / 法宝属性2）=====
console.log('\n[1] 单件主属性数值（T14 红+10）')
const enhanceMul = 1 + ENH_LV * ENHANCE_MUL_PER_LEVEL
const tierWeight = getEquipTierWeight(TIER)
const rarityMul = RARITY_STAT_MUL[5] // red

for (const stat of ['METAL_DMG', 'WOOD_DMG', 'ATK', 'HP', 'DEF', 'SPD']) {
  const base = (EQUIP_PRIMARY_BASE as any)[stat] ?? 0
  const value = Math.floor(base * tierWeight * rarityMul * enhanceMul)
  console.log(`  ${stat.padEnd(12)} 属性1 (受强化) = ${value}`)
}
for (const stat of ['ATK_PCT', 'ARMOR_PEN', 'SPIRIT', 'SPIRIT_PCT']) {
  const value = getEquipPrimaryValue2(stat, TIER, 5)
  console.log(`  ${stat.padEnd(12)} 属性2 (不强化) = ${value}`)
}

// ===== 7 件装备模拟单种五行强化总值 =====
console.log(`\n[2] 单种五行（${TARGET_ELEMENT}）总值 — 7 件 T14 红+10`)
const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
const SAMPLES = 1000

const results: Record<string, { totalElem: number; primaryElem: number; subElem: number }> = {}
let aggMin = Infinity, aggMax = 0, aggSum = 0

for (let i = 0; i < SAMPLES; i++) {
  let totalElem = 0
  let primaryElem = 0
  let subElem = 0

  for (const slot of slots) {
    let slotKey: string, subType: string
    switch (slot) {
      case 'weapon':   slotKey = 'weapon'; subType = ['blade','sword','spear','fan'][Math.floor(Math.random()*4)]; break
      case 'armor':    slotKey = 'armor'; subType = '_'; break
      case 'helmet':   slotKey = 'helmet'; subType = '_'; break
      case 'boots':    slotKey = 'boots'; subType = '_'; break
      case 'treasure': slotKey = 'treasure'; subType = Math.random() < 0.5 ? 'phys' : 'magic'; break
      case 'ring':     slotKey = 'ring'; subType = ['metal','wood','water','fire','earth'][Math.floor(Math.random()*5)]; break
      case 'pendant':  slotKey = 'pendant'; subType = Math.random() < 0.5 ? 'crit_rate' : 'crit_dmg'; break
      default: slotKey = 'weapon'; subType = 'sword'
    }
    const primaries = decideEquipPrimariesV4(slotKey, subType, RARITY, TIER)
    // 主属性命中目标五行（属性1 才被强化乘子）
    if (primaries.primary_stat === TARGET_ELEMENT) {
      const v = Math.floor(primaries.primary_value * enhanceMul)
      totalElem += v
      primaryElem += v
    }
    if (primaries.primary_stat_2 === TARGET_ELEMENT && primaries.primary_value_2) {
      totalElem += primaries.primary_value_2
      primaryElem += primaries.primary_value_2
    }
    // 副词条
    const subs = rollSubStatsV4(slotKey, RARITY, TIER)
    for (const s of subs) {
      if (s.stat === TARGET_ELEMENT) {
        totalElem += s.value
        subElem += s.value
      }
    }
  }
  aggSum += totalElem
  if (totalElem < aggMin) aggMin = totalElem
  if (totalElem > aggMax) aggMax = totalElem
}
const aggAvg = aggSum / SAMPLES
console.log(`  样本 ${SAMPLES} 次平均：${aggAvg.toFixed(1)}%  (min=${aggMin}, max=${aggMax})`)

// ===== 单件 ring 主属性数值带（饰品五行强化按 PDF）=====
console.log('\n[3] 单件饰品主属性数值带（ring 槽五行强化）')
for (const t of [10, 11, 12, 13, 14]) {
  const w = getEquipTierWeight(t)
  const v = Math.floor(0.4 * w * 2.5 * 2.0)
  console.log(`  T${t} 红+10 = ${v}%`)
}

// ===== 一件红装副词条平均数 + 双轴权重示例 =====
console.log('\n[4] 红装一件 ring 副词条样本（4 条）')
for (let i = 0; i < 5; i++) {
  const subs = rollSubStatsV4('ring', RARITY, TIER)
  console.log(`  [${i+1}] ${subs.map(s => `${s.stat}+${s.value}`).join(', ')}`)
}

// ===== 双轴权重输出（前 8 条）=====
console.log('\n[5] 双轴权重示例（PDF 4:6 × 4:6）')
for (const stat of ['ATK','ATK_PCT','HP','HP_PCT','CRIT_RATE','METAL_DMG','METAL_RES','LUCK']) {
  console.log(`  ${stat.padEnd(12)} weight = ${getSubStatAxisWeight(stat).toFixed(3)}`)
}
