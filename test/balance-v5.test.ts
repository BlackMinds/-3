/**
 * V5.0.2 装备系统单元测试
 *
 * 用法：npx tsx test/balance-v5.test.ts
 * 退出码：测试失败 = 1，全部通过 = 0
 *
 * 项目没装 vitest；这是 node:assert 驱动的轻量 runner。
 * 后续装 vitest 后，把 it() / describe() 替换成 vitest API 即可。
 */
import assert from 'node:assert/strict'
import {
  v5IsSheng, v5AnySheng, v5PrevSlotIndex,
  computeV5WuxingActivation, computeV5LingenResonance,
  getV5LegendarySetActiveEffects,
  getV5EnhanceMul, getV5TierWeight, getV5PerWuxingAffixValue,
  getV5EnhanceAffixCount, getV5EnhanceAffixPool, getV5LingenResonanceBonus,
  V5_WUXING_AFFIX_TABLE, V5_LEGENDARY_SET_YUANSHI, V5_BOSS_TREASURES,
  V5_T15_BASELINE_CAPS, V5_PER_WUXING_AFFIX_T15,
  type V5EquippedItem,
} from '../shared/balance-v5'
import { rollEquipmentV5, rollYuanshiTianzunSet } from '../server/utils/equipment-v5'

let pass = 0
let fail = 0
const failures: string[] = []

function it(name: string, body: () => void) {
  try {
    body()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    fail++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${name}: ${msg}`)
    console.log(`  ✗ ${name}`)
    console.log(`      ${msg.split('\n').join('\n      ')}`)
  }
}

function describe(group: string, body: () => void) {
  console.log(`\n${group}`)
  body()
}

// =====================================================================
describe('五行相生 v5IsSheng / v5AnySheng', () => {
  it('木生火、火生土、土生金、金生水、水生木', () => {
    assert.equal(v5IsSheng('wood', 'fire'), true)
    assert.equal(v5IsSheng('fire', 'earth'), true)
    assert.equal(v5IsSheng('earth', 'metal'), true)
    assert.equal(v5IsSheng('metal', 'water'), true)
    assert.equal(v5IsSheng('water', 'wood'), true)
  })
  it('反向不相生', () => {
    assert.equal(v5IsSheng('fire', 'wood'), false)
    assert.equal(v5IsSheng('wood', 'earth'), false)
  })
  it('双前缀任一相生即触发', () => {
    assert.equal(v5AnySheng(['metal', 'fire'], 'earth'), true) // fire→earth
    assert.equal(v5AnySheng(['metal', 'fire'], 'water'), true) // metal→water
    assert.equal(v5AnySheng(['metal', 'fire'], 'wood'), false) // 都不通
  })
})

describe('装备链 v5PrevSlotIndex', () => {
  it('slot 1 的前一件是 slot 7（环形）', () => {
    assert.equal(v5PrevSlotIndex(1), 7)
    assert.equal(v5PrevSlotIndex(2), 1)
    assert.equal(v5PrevSlotIndex(7), 6)
  })
})

// =====================================================================
describe('强化曲线 getV5EnhanceMul', () => {
  it('+0 = 1.0, +9 = 1.9', () => {
    assert.equal(getV5EnhanceMul(0), 1.0)
    assert.equal(getV5EnhanceMul(9), 1.9)
  })
  it('超 cap 截断在 +9', () => {
    assert.equal(getV5EnhanceMul(15), 1.9)
    assert.equal(getV5EnhanceMul(-1), 1.0)
  })
})

describe('T 级曲线 getV5TierWeight', () => {
  it('T1=1, T10=10, T15=20', () => {
    assert.equal(getV5TierWeight(1), 1)
    assert.equal(getV5TierWeight(10), 10)
    assert.equal(getV5TierWeight(15), 20)
  })
  it('T11+ 加陡', () => {
    assert.equal(getV5TierWeight(11), 12)
    assert.equal(getV5TierWeight(13), 16)
  })
})

describe('单条五行词条 getV5PerWuxingAffixValue', () => {
  it('atk T15 = 5556（baseline 100000 / 18 = 5555.56 取整）', () => {
    assert.equal(getV5PerWuxingAffixValue('atk', 15), 5556)
  })
  it('atk T10 = T15 × 50%', () => {
    assert.equal(getV5PerWuxingAffixValue('atk', 10), 2778)
  })
  it('crit_dmg_pct T15 = 0.20', () => {
    assert.equal(getV5PerWuxingAffixValue('crit_dmg_pct', 15), 0.20)
  })
  it('lifesteal_pct T15 = 0.0278（削弱后）', () => {
    assert.equal(getV5PerWuxingAffixValue('lifesteal_pct', 15), 0.0278)
  })
})

describe('baseline 校验', () => {
  it('吸血率/破甲率 T15 上限已削到 0.5', () => {
    assert.equal(V5_T15_BASELINE_CAPS.lifesteal_pct, 0.5)
    assert.equal(V5_T15_BASELINE_CAPS.armor_pen_pct, 0.5)
  })
  it('单条 T15 × 18 ≈ baseline（允许 0.5% 舍入误差）', () => {
    for (const [stat, t15] of Object.entries(V5_PER_WUXING_AFFIX_T15)) {
      const cap = V5_T15_BASELINE_CAPS[stat]
      if (!cap) continue
      const reconstructed = t15 * 18
      const diff = Math.abs(reconstructed - cap) / cap
      assert.ok(diff < 0.005, `${stat}: 单条×18=${reconstructed} ≠ baseline=${cap}（误差 ${(diff * 100).toFixed(3)}%）`)
    }
  })
})

// =====================================================================
describe('强化词条数 getV5EnhanceAffixCount', () => {
  it('颜色初始词条数 红4/金3/紫2/蓝1', () => {
    assert.equal(getV5EnhanceAffixCount('red', 0), 4)
    assert.equal(getV5EnhanceAffixCount('gold', 0), 3)
    assert.equal(getV5EnhanceAffixCount('purple', 0), 2)
    assert.equal(getV5EnhanceAffixCount('blue', 0), 1)
  })
  it('蓝装 +3/+6/+9 各加 1 条', () => {
    assert.equal(getV5EnhanceAffixCount('blue', 3), 2)
    assert.equal(getV5EnhanceAffixCount('blue', 6), 3)
    assert.equal(getV5EnhanceAffixCount('blue', 9), 4)
  })
  it('紫装 +6 满 4 条', () => {
    assert.equal(getV5EnhanceAffixCount('purple', 6), 4)
    assert.equal(getV5EnhanceAffixCount('purple', 9), 4)
  })
  it('红装恒为 4', () => {
    for (const lv of [0, 3, 6, 9]) assert.equal(getV5EnhanceAffixCount('red', lv), 4)
  })
})

describe('强化词条池 getV5EnhanceAffixPool', () => {
  it('1/2/3 走 attack 池（含 atk）', () => {
    const pool = getV5EnhanceAffixPool(1)
    assert.ok(pool[0].includes('atk'))
  })
  it('4/5/6/7 走 defense 池（含 def）', () => {
    const pool = getV5EnhanceAffixPool(4)
    assert.ok(pool[0].includes('def'))
  })
})

// =====================================================================
describe('五行触发 computeV5WuxingActivation', () => {
  const equipped: V5EquippedItem[] = [
    { slotIndex: 1, prefix: 'wood' },
    { slotIndex: 2, prefix: 'fire' },   // wood→fire ✓
    { slotIndex: 3, prefix: 'earth' },  // fire→earth ✓
    { slotIndex: 4, prefix: 'metal' },  // earth→metal ✓
    { slotIndex: 5, prefix: 'water' },  // metal→water ✓
    { slotIndex: 6, prefix: 'wood' },   // water→wood ✓
    { slotIndex: 7, prefix: 'fire' },   // wood→fire ✓
    // 闭环 slot7(fire)→slot1(wood) ✗
  ]
  const act = computeV5WuxingActivation(equipped)

  it('slot1 affix_1 不触发（前一件 fire 不生 wood）', () => {
    assert.equal(act[0].affix_1_active, false)
  })
  it('slot2~7 affix_1 全触发', () => {
    for (let i = 1; i < 7; i++) assert.equal(act[i].affix_1_active, true, `slot${act[i].slotIndex}`)
  })
  it('全身触发数 6 ≥ 3，触发的 6 件 affix_2 全亮', () => {
    const a2 = act.filter(a => a.affix_2_active).length
    assert.equal(a2, 6)
  })
  it('全身触发数 6 ≥ 6，触发的 6 件 affix_3 全亮', () => {
    const a3 = act.filter(a => a.affix_3_active).length
    assert.equal(a3, 6)
  })
  it('双前缀 boss 秘宝可补全相生链', () => {
    const dual: V5EquippedItem[] = [
      { slotIndex: 1, prefix: 'wood' },
      { slotIndex: 7, prefix: ['water', 'fire'] }, // 双前缀，水生木让 slot1 也触发
    ]
    const r = computeV5WuxingActivation(dual)
    const slot1 = r.find(a => a.slotIndex === 1)!
    assert.equal(slot1.affix_1_active, true)
  })
})

// =====================================================================
describe('套装效果 getV5LegendarySetActiveEffects', () => {
  it('0 件 → 0 个', () => assert.equal(getV5LegendarySetActiveEffects(0).length, 0))
  it('1 件 → 1 个', () => assert.equal(getV5LegendarySetActiveEffects(1).length, 1))
  it('3 件 → 2 个', () => assert.equal(getV5LegendarySetActiveEffects(3).length, 2))
  it('5 件 → 3 个', () => assert.equal(getV5LegendarySetActiveEffects(5).length, 3))
  it('7 件 → 4 个（含眩晕全体）', () => {
    const effects = getV5LegendarySetActiveEffects(7)
    assert.equal(effects.length, 4)
    assert.equal(effects[3].pieces, 7)
    assert.equal(effects[3].effect.stun_all_chance, 0.10)
  })
})

describe('灵根共鸣 computeV5LingenResonance', () => {
  it('< 3 件无加成', () => {
    const r = computeV5LingenResonance([
      { slotIndex: 1, prefix: 'wood' },
      { slotIndex: 2, prefix: 'wood' },
    ], 'wood')
    assert.equal(r.matched_pieces, 2)
    assert.equal(r.bonus_pct, 0)
  })
  it('3/5/7 件分档 +5%/+10%/+20%', () => {
    assert.equal(getV5LingenResonanceBonus(3), 0.05)
    assert.equal(getV5LingenResonanceBonus(5), 0.10)
    assert.equal(getV5LingenResonanceBonus(7), 0.20)
  })
  it('双前缀 [wood,fire] 包含 wood 算 1 件', () => {
    const r = computeV5LingenResonance([
      { slotIndex: 1, prefix: 'wood' },
      { slotIndex: 2, prefix: 'wood' },
      { slotIndex: 3, prefix: ['wood', 'fire'] },
    ], 'wood')
    assert.equal(r.matched_pieces, 3)
    assert.equal(r.bonus_pct, 0.05)
  })
  it('元始天尊【五行】7 件 → 任意角色灵根 +20%', () => {
    const equipped: V5EquippedItem[] = Array.from({ length: 7 }, (_, i) => ({
      slotIndex: i + 1,
      prefix: ['metal', 'wood', 'water', 'fire', 'earth'] as const,
    }))
    for (const lin of ['metal', 'wood', 'water', 'fire', 'earth'] as const) {
      assert.equal(computeV5LingenResonance(equipped, lin).bonus_pct, 0.20)
    }
  })
})

// =====================================================================
describe('装备生成 rollEquipmentV5（普通）', () => {
  it('武器 T15 红 +9 → 基础属性1=atk、值=base×weight×rarity×1.9', () => {
    const eq = rollEquipmentV5({ slotIndex: 1, rarity: 'red', tier: 15, enhanceLevel: 9, prefix: 'wood' })
    assert.equal(eq.slot_index, 1)
    assert.equal(eq.base_slot_v4, 'weapon')
    assert.equal(eq.base_stat_1.stat, 'atk')
    // EQUIP_PRIMARY_BASE.ATK=30, T15_weight=20, RARITY_STAT_MUL[red=5]=2.5, enhance +9 mul=1.9
    // 30 × 20 × 2.5 × 1.9 = 2850
    assert.equal(eq.base_stat_1.value, 2850)
    assert.equal(eq.wuxing_prefix, 'wood')
    assert.equal(eq.wuxing_affixes.length, 3)
    // 武器·木：spirit_pct / wuxing_dmg / atk_pct（V5_WUXING_AFFIX_TABLE）
    assert.deepEqual(eq.wuxing_affixes.map(a => a.stat), ['spirit_pct', 'wuxing_dmg', 'atk_pct'])
    assert.equal(eq.enhance_affixes.length, 4)
  })
  it('蓝装 +0 只有 1 条强化词条', () => {
    const eq = rollEquipmentV5({ slotIndex: 4, rarity: 'blue', tier: 5, prefix: 'water' })
    assert.equal(eq.enhance_affixes.length, 1)
  })
  it('蓝装 +9 满 4 条强化词条', () => {
    const eq = rollEquipmentV5({ slotIndex: 4, rarity: 'blue', tier: 5, enhanceLevel: 9, prefix: 'water' })
    assert.equal(eq.enhance_affixes.length, 4)
  })
  it('未指定前缀 → 随机五行', () => {
    const eq = rollEquipmentV5({ slotIndex: 3, rarity: 'gold', tier: 8 })
    const valid = ['metal', 'wood', 'water', 'fire', 'earth']
    assert.ok(valid.includes(eq.wuxing_prefix as string))
  })
})

describe('装备生成 rollEquipmentV5（元始天尊）', () => {
  it('legendary=yuanshi_tianzun → 前缀五连、名字=盘古幡、base×1.5', () => {
    const eq = rollEquipmentV5({ slotIndex: 1, rarity: 'red', tier: 15, enhanceLevel: 9, legendary: 'yuanshi_tianzun' })
    assert.deepEqual(eq.wuxing_prefix as readonly string[], ['metal', 'wood', 'water', 'fire', 'earth'])
    assert.equal(eq.name, '盘古幡')
    assert.equal(eq.legendary_set_id, 'yuanshi_tianzun')
    // 2850 × 1.5 = 4275
    assert.equal(eq.base_stat_1.value, 4275)
  })
})

describe('装备生成 rollYuanshiTianzunSet（套装）', () => {
  it('返回 7 件、依次盘古幡/三宝玉如意/...', () => {
    const set = rollYuanshiTianzunSet({ tier: 15, rarity: 'red', enhanceLevel: 9 })
    assert.equal(set.length, 7)
    const expectedNames = ['盘古幡', '三宝玉如意', '封神榜', '诸天庆云', '戊己杏黄旗', '玲珑宝塔', '九龙沉香辇']
    assert.deepEqual(set.map(p => p.name), expectedNames)
  })
})

describe('装备生成 rollEquipmentV5（boss 秘宝）', () => {
  it('T8 天帝降魔伏鬼枪 → 三档同 stat=armor_pen', () => {
    const tianDi = V5_BOSS_TREASURES.find(b => b.tier === 8)!
    const eq = rollEquipmentV5({ slotIndex: 1, rarity: 'red', tier: 8, bossTreasure: tianDi })
    assert.equal(eq.name, '降魔伏鬼枪')
    assert.equal(eq.is_boss_treasure, true)
    assert.deepEqual(eq.wuxing_affixes.map(a => a.stat), ['armor_pen', 'armor_pen', 'armor_pen'])
    assert.deepEqual(eq.wuxing_prefix as readonly string[], ['fire'])
  })
  it('T14 时空之主 → 双前缀 [metal, fire]', () => {
    const shikong = V5_BOSS_TREASURES.find(b => b.tier === 14)!
    const eq = rollEquipmentV5({ slotIndex: 2, rarity: 'red', tier: 14, bossTreasure: shikong })
    assert.deepEqual(eq.wuxing_prefix as readonly string[], ['metal', 'fire'])
  })
})

// =====================================================================
console.log('\n' + '='.repeat(60))
console.log(`通过 ${pass} / 失败 ${fail} / 总计 ${pass + fail}`)
if (fail > 0) {
  console.log('\n失败用例：')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('全部通过 ✓')
