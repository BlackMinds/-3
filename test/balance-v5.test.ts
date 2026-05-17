/**
 * V5.0.2 装备系统单元测试
 *
 * 用法：npm test（或 npx vitest run test/balance-v5.test.ts）
 */
import { describe, it, expect } from 'vitest'
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

// =====================================================================
describe('五行相生 v5IsSheng / v5AnySheng', () => {
  it('木生火、火生土、土生金、金生水、水生木', () => {
    expect(v5IsSheng('wood', 'fire')).toBe(true)
    expect(v5IsSheng('fire', 'earth')).toBe(true)
    expect(v5IsSheng('earth', 'metal')).toBe(true)
    expect(v5IsSheng('metal', 'water')).toBe(true)
    expect(v5IsSheng('water', 'wood')).toBe(true)
  })
  it('反向不相生', () => {
    expect(v5IsSheng('fire', 'wood')).toBe(false)
    expect(v5IsSheng('wood', 'earth')).toBe(false)
  })
  it('双前缀任一相生即触发', () => {
    expect(v5AnySheng(['metal', 'fire'], 'earth')).toBe(true) // fire→earth
    expect(v5AnySheng(['metal', 'fire'], 'water')).toBe(true) // metal→water
    expect(v5AnySheng(['metal', 'fire'], 'wood')).toBe(false) // 都不通
  })
})

describe('装备链 v5PrevSlotIndex', () => {
  it('slot 1 的前一件是 slot 7（环形）', () => {
    expect(v5PrevSlotIndex(1)).toBe(7)
    expect(v5PrevSlotIndex(2)).toBe(1)
    expect(v5PrevSlotIndex(7)).toBe(6)
  })
})

// =====================================================================
describe('强化曲线 getV5EnhanceMul', () => {
  it('+0 = 1.0, +9 = 1.9', () => {
    expect(getV5EnhanceMul(0)).toBe(1.0)
    expect(getV5EnhanceMul(9)).toBe(1.9)
  })
  it('超 cap 截断在 +9', () => {
    expect(getV5EnhanceMul(15)).toBe(1.9)
    expect(getV5EnhanceMul(-1)).toBe(1.0)
  })
})

describe('T 级曲线 getV5TierWeight', () => {
  it('T1=1, T10=10, T15=20', () => {
    expect(getV5TierWeight(1)).toBe(1)
    expect(getV5TierWeight(10)).toBe(10)
    expect(getV5TierWeight(15)).toBe(20)
  })
  it('T11+ 加陡', () => {
    expect(getV5TierWeight(11)).toBe(12)
    expect(getV5TierWeight(13)).toBe(16)
  })
})

describe('单条五行词条 getV5PerWuxingAffixValue', () => {
  it('atk T15 = 5556（baseline 100000 / 18 = 5555.56 取整）', () => {
    expect(getV5PerWuxingAffixValue('atk', 15)).toBe(5556)
  })
  it('atk T10 = T15 × 50%', () => {
    expect(getV5PerWuxingAffixValue('atk', 10)).toBe(2778)
  })
  it('crit_dmg_pct T15 = 0.1667（V5.0.3 削弱后 300%/18）', () => {
    expect(getV5PerWuxingAffixValue('crit_dmg_pct', 15)).toBe(0.1667)
  })
  it('lifesteal_pct T15 = 0.0278（削弱后）', () => {
    expect(getV5PerWuxingAffixValue('lifesteal_pct', 15)).toBe(0.0278)
  })
})

describe('baseline 校验', () => {
  it('吸血率/破甲率 T15 上限已削到 0.5', () => {
    expect(V5_T15_BASELINE_CAPS.lifesteal_pct).toBe(0.5)
    expect(V5_T15_BASELINE_CAPS.armor_pen_pct).toBe(0.5)
  })
  it('单条 T15 × 18 ≈ baseline（允许 0.5% 舍入误差）', () => {
    for (const [stat, t15] of Object.entries(V5_PER_WUXING_AFFIX_T15)) {
      const cap = V5_T15_BASELINE_CAPS[stat]
      if (!cap) continue
      const reconstructed = t15 * 18
      const diff = Math.abs(reconstructed - cap) / cap
      expect(diff, `${stat}: 单条×18=${reconstructed} ≠ baseline=${cap}（误差 ${(diff * 100).toFixed(3)}%）`).toBeLessThan(0.005)
    }
  })
})

// =====================================================================
describe('强化词条数 getV5EnhanceAffixCount', () => {
  it('颜色初始词条数 红4/金3/紫2/蓝1', () => {
    expect(getV5EnhanceAffixCount('red', 0)).toBe(4)
    expect(getV5EnhanceAffixCount('gold', 0)).toBe(3)
    expect(getV5EnhanceAffixCount('purple', 0)).toBe(2)
    expect(getV5EnhanceAffixCount('blue', 0)).toBe(1)
  })
  it('蓝装 +3/+6/+9 各加 1 条', () => {
    expect(getV5EnhanceAffixCount('blue', 3)).toBe(2)
    expect(getV5EnhanceAffixCount('blue', 6)).toBe(3)
    expect(getV5EnhanceAffixCount('blue', 9)).toBe(4)
  })
  it('紫装 +6 满 4 条', () => {
    expect(getV5EnhanceAffixCount('purple', 6)).toBe(4)
    expect(getV5EnhanceAffixCount('purple', 9)).toBe(4)
  })
  it('红装恒为 4', () => {
    for (const lv of [0, 3, 6, 9]) expect(getV5EnhanceAffixCount('red', lv)).toBe(4)
  })
})

describe('强化词条池 getV5EnhanceAffixPool', () => {
  it('1/2/3 走 attack 池（含 atk）', () => {
    const pool = getV5EnhanceAffixPool(1)
    expect(pool[0]).toContain('atk')
  })
  it('4/5/6/7 走 defense 池（含 def）', () => {
    const pool = getV5EnhanceAffixPool(4)
    expect(pool[0]).toContain('def')
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
    expect(act[0].affix_1_active).toBe(false)
  })
  it('slot2~7 affix_1 全触发', () => {
    for (let i = 1; i < 7; i++) {
      expect(act[i].affix_1_active, `slot${act[i].slotIndex}`).toBe(true)
    }
  })
  it('全身触发数 6 ≥ 3，触发的 6 件 affix_2 全亮', () => {
    const a2 = act.filter(a => a.affix_2_active).length
    expect(a2).toBe(6)
  })
  it('全身触发数 6 ≥ 6，触发的 6 件 affix_3 全亮', () => {
    const a3 = act.filter(a => a.affix_3_active).length
    expect(a3).toBe(6)
  })
  it('双前缀 boss 秘宝可补全相生链', () => {
    const dual: V5EquippedItem[] = [
      { slotIndex: 1, prefix: 'wood' },
      { slotIndex: 7, prefix: ['water', 'fire'] }, // 双前缀，水生木让 slot1 也触发
    ]
    const r = computeV5WuxingActivation(dual)
    const slot1 = r.find(a => a.slotIndex === 1)!
    expect(slot1.affix_1_active).toBe(true)
  })
})

// =====================================================================
describe('套装效果 getV5LegendarySetActiveEffects', () => {
  it('0 件 → 0 个', () => { expect(getV5LegendarySetActiveEffects(0).length).toBe(0) })
  it('1 件 → 1 个', () => { expect(getV5LegendarySetActiveEffects(1).length).toBe(1) })
  it('3 件 → 2 个', () => { expect(getV5LegendarySetActiveEffects(3).length).toBe(2) })
  it('5 件 → 3 个', () => { expect(getV5LegendarySetActiveEffects(5).length).toBe(3) })
  it('7 件 → 4 个(含眩晕全体)', () => {
    const effects = getV5LegendarySetActiveEffects(7)
    expect(effects.length).toBe(4)
    expect(effects[3].pieces).toBe(7)
    expect(effects[3].effect.stun_all_chance).toBe(0.10)
  })
})

describe('灵根共鸣 computeV5LingenResonance', () => {
  it('< 3 件无加成', () => {
    const r = computeV5LingenResonance([
      { slotIndex: 1, prefix: 'wood' },
      { slotIndex: 2, prefix: 'wood' },
    ], 'wood')
    expect(r.matched_pieces).toBe(2)
    expect(r.bonus_pct).toBe(0)
  })
  it('3/5/7 件分档 +5%/+10%/+20%', () => {
    expect(getV5LingenResonanceBonus(3)).toBe(0.05)
    expect(getV5LingenResonanceBonus(5)).toBe(0.10)
    expect(getV5LingenResonanceBonus(7)).toBe(0.20)
  })
  it('双前缀 [wood,fire] 包含 wood 算 1 件', () => {
    const r = computeV5LingenResonance([
      { slotIndex: 1, prefix: 'wood' },
      { slotIndex: 2, prefix: 'wood' },
      { slotIndex: 3, prefix: ['wood', 'fire'] },
    ], 'wood')
    expect(r.matched_pieces).toBe(3)
    expect(r.bonus_pct).toBe(0.05)
  })
  it('元始天尊【五行】7 件 → 任意角色灵根 +20%', () => {
    const equipped: V5EquippedItem[] = Array.from({ length: 7 }, (_, i) => ({
      slotIndex: i + 1,
      prefix: ['metal', 'wood', 'water', 'fire', 'earth'] as const,
    }))
    for (const lin of ['metal', 'wood', 'water', 'fire', 'earth'] as const) {
      expect(computeV5LingenResonance(equipped, lin).bonus_pct).toBe(0.20)
    }
  })
})

// =====================================================================
describe('装备生成 rollEquipmentV5（普通）', () => {
  it('武器 T15 红 +9 → 基础属性1=atk、值=base×weight×rarity×1.9', () => {
    const eq = rollEquipmentV5({ slotIndex: 1, rarity: 'red', tier: 15, enhanceLevel: 9, prefix: 'wood' })
    expect(eq.slot_index).toBe(1)
    expect(eq.base_slot_v4).toBe('weapon')
    expect(eq.base_stat_1.stat).toBe('atk')
    // EQUIP_PRIMARY_BASE.ATK=30, T15_weight=20, RARITY_STAT_MUL[red=5]=2.5, enhance +9 mul=1.9
    // 30 × 20 × 2.5 × 1.9 = 2850
    expect(eq.base_stat_1.value).toBe(2850)
    expect(eq.wuxing_prefix).toBe('wood')
    expect(eq.wuxing_affixes.length).toBe(3)
    // 武器·木：spirit_pct / wuxing_dmg / atk_pct（V5_WUXING_AFFIX_TABLE）
    expect(eq.wuxing_affixes.map(a => a.stat)).toEqual(['spirit_pct', 'wuxing_dmg', 'atk_pct'])
    expect(eq.enhance_affixes.length).toBe(4)
  })
  it('蓝装 +0 只有 1 条强化词条', () => {
    const eq = rollEquipmentV5({ slotIndex: 4, rarity: 'blue', tier: 5, prefix: 'water' })
    expect(eq.enhance_affixes.length).toBe(1)
  })
  it('蓝装 +9 满 4 条强化词条', () => {
    const eq = rollEquipmentV5({ slotIndex: 4, rarity: 'blue', tier: 5, enhanceLevel: 9, prefix: 'water' })
    expect(eq.enhance_affixes.length).toBe(4)
  })
  it('未指定前缀 → 随机五行', () => {
    const eq = rollEquipmentV5({ slotIndex: 3, rarity: 'gold', tier: 8 })
    const valid = ['metal', 'wood', 'water', 'fire', 'earth']
    expect(valid).toContain(eq.wuxing_prefix as string)
  })
})

describe('装备生成 rollEquipmentV5（元始天尊）', () => {
  it('legendary=yuanshi_tianzun → 前缀五连、名字=盘古幡、base×1.5', () => {
    const eq = rollEquipmentV5({ slotIndex: 1, rarity: 'red', tier: 15, enhanceLevel: 9, legendary: 'yuanshi_tianzun' })
    expect(eq.wuxing_prefix as readonly string[]).toEqual(['metal', 'wood', 'water', 'fire', 'earth'])
    expect(eq.name).toBe('盘古幡')
    expect(eq.legendary_set_id).toBe('yuanshi_tianzun')
    // 2850 × 1.5 = 4275
    expect(eq.base_stat_1.value).toBe(4275)
  })
})

describe('装备生成 rollYuanshiTianzunSet（套装）', () => {
  it('返回 7 件、依次盘古幡/三宝玉如意/...', () => {
    const set = rollYuanshiTianzunSet({ tier: 15, rarity: 'red', enhanceLevel: 9 })
    expect(set.length).toBe(7)
    const expectedNames = ['盘古幡', '三宝玉如意', '封神榜', '诸天庆云', '戊己杏黄旗', '玲珑宝塔', '九龙沉香辇']
    expect(set.map(p => p.name)).toEqual(expectedNames)
  })
})

describe('装备生成 rollEquipmentV5（boss 秘宝）', () => {
  it('T8 天帝降魔伏鬼枪 → 三档同 stat=armor_pen', () => {
    const tianDi = V5_BOSS_TREASURES.find(b => b.tier === 8)!
    const eq = rollEquipmentV5({ slotIndex: 1, rarity: 'red', tier: 8, bossTreasure: tianDi })
    expect(eq.name).toBe('降魔伏鬼枪')
    expect(eq.is_boss_treasure).toBe(true)
    expect(eq.wuxing_affixes.map(a => a.stat)).toEqual(['armor_pen', 'armor_pen', 'armor_pen'])
    expect(eq.wuxing_prefix as readonly string[]).toEqual(['metal'])
  })
  it('T14 时空之主 → 双前缀 [metal, fire]', () => {
    const shikong = V5_BOSS_TREASURES.find(b => b.tier === 14)!
    const eq = rollEquipmentV5({ slotIndex: 2, rarity: 'red', tier: 14, bossTreasure: shikong })
    expect(eq.wuxing_prefix as readonly string[]).toEqual(['metal', 'fire'])
  })
})
