// =====================================================================
// 装备系统 V5.0.2（design_only，未接入装备生成器）
// =====================================================================
// 数据来源：design/system-equipment-v5-0-2.json
// 状态：与 V4 并存。仅作为常量基础，未来接入装备生成器/UI 时使用。
// 命名规约：全部 V5_ 前缀避免与 V4 冲突；stat key 保持 JSON 内 snake_case
// （V4 用大写 SCREAMING_CASE，接入时由生成器层做映射或重命名）。
//
// V5 vs V4 主要差异：
// - V5 引入「五行词条（暗词条）」独立体系：装备前缀 = 五行，按相生链触发 3 档
// - V5 强化 cap = +9（V4 = +15）
// - V5 颜色 → 强化词条数：红4/金3/紫2/蓝1（V4 是 红4/金3/紫2/蓝2/绿1/白0）
// - V5 新增灵根共鸣、元始天尊套装、boss 秘宝
//
// 数值缩放规则（关键）：
// - 装备强化（+0~+9）：影响 base_stat_1 + 强化词条
// - T 级（T1~T15）：    影响 base_stat_1 + 五行词条
// - base_stat_1 是交集，两者都加；强化词条只受强化影响，五行词条只受 T 级影响
// =====================================================================

// --------------------------- Feature Flag ---------------------------

/**
 * V5 装备掉落开关（2026-05-12 默认开启）
 *
 * - true（默认）：掉落入口走 V5 rollEquipmentV5，DB 写入 V5 字段
 * - 显式关闭：环境变量 V5_DROP_ENABLED=false
 *
 * V5 与 V4 装备并存：老装备完全不动，仅新掉落走 V5。
 * 开启前提：`npm run migrate` 已执行（V5 字段就位）— 已在 commit f4976ea 合入。
 */
export const V5_DROP_FLAG: boolean = process.env.V5_DROP_ENABLED !== 'false'

// --------------------------------- 类型 ---------------------------------

export type WuxingPrefix = 'metal' | 'wood' | 'water' | 'fire' | 'earth'
export type V5BaseSlot = 'weapon' | 'ring' | 'treasure' | 'armor' | 'helmet' | 'pendant' | 'boots'
export type V5Rarity = 'red' | 'gold' | 'purple' | 'blue'

export interface V5EquipmentSlot {
  /** 1~7，xlsx 装备序号；决定五行相生链上的相邻关系 */
  index: number
  /** V5 设计文档中的中文名 */
  slot_v5: string
  /** 对应 V4 现役 base_slot，用于未来与 V4 槽位映射 */
  base_slot_v4: V5BaseSlot
  /** 基础属性 1 的 stat key（V5 命名） */
  base_stat_1: string
  /** 基础属性 1 的中文显示名 */
  base_stat_1_zh: string
}

/** [属性1, 属性2, 属性3] —— 属性1 相生触发；属性2 累计 3 条触发；属性3 累计 6 条触发 */
export type V5WuxingAffixSet = readonly [string, string, string]

/** 4 个词条位的候选 stat 池（按位独立抽） */
export type V5EnhanceAffixPositions = readonly [
  readonly string[],
  readonly string[],
  readonly string[],
  readonly string[],
]

// --------------------------- 装备槽位（7 个） ---------------------------

export const V5_EQUIPMENT_SLOTS: readonly V5EquipmentSlot[] = [
  { index: 1, slot_v5: '武器',    base_slot_v4: 'weapon',   base_stat_1: 'atk',                base_stat_1_zh: '攻击力' },
  { index: 2, slot_v5: '灵戒',    base_slot_v4: 'ring',     base_stat_1: 'wuxing_dmg',         base_stat_1_zh: '五行强化' },
  { index: 3, slot_v5: '法宝',    base_slot_v4: 'treasure', base_stat_1: 'spirit',             base_stat_1_zh: '神识' },
  { index: 4, slot_v5: '法袍',    base_slot_v4: 'armor',    base_stat_1: 'def',                base_stat_1_zh: '防御力' },
  { index: 5, slot_v5: '法冠',    base_slot_v4: 'helmet',   base_stat_1: 'hp',                 base_stat_1_zh: '气血' },
  { index: 6, slot_v5: '灵佩',    base_slot_v4: 'pendant',  base_stat_1: 'hp_pct_or_def_pct',  base_stat_1_zh: '气血% / 防御力%' },
  { index: 7, slot_v5: '步云靴',  base_slot_v4: 'boots',    base_stat_1: 'spd',                base_stat_1_zh: '身法' },
] as const

// --------------------------- 五行：相生与触发 ---------------------------

export const V5_WUXING_PREFIX_ORDER: readonly WuxingPrefix[] = ['metal', 'wood', 'water', 'fire', 'earth']

export const V5_WUXING_PREFIX_ZH: Record<WuxingPrefix, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
}

/** 五行相生：from → to（木生火/火生土/土生金/金生水/水生木） */
export const V5_WUXING_SHENG_CHAIN: Record<WuxingPrefix, WuxingPrefix> = {
  wood:  'fire',
  fire:  'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood',
}

export function v5IsSheng(from: WuxingPrefix, to: WuxingPrefix): boolean {
  return V5_WUXING_SHENG_CHAIN[from] === to
}

/** 装备序号链：1→2→…→7→1（计算 affix_1 触发用） */
export function v5PrevSlotIndex(slotIndex: number): number {
  return slotIndex === 1 ? 7 : slotIndex - 1
}

/** 前缀归一：单前缀和双前缀（数组）统一成 readonly 数组 */
function toPrefixArray(p: WuxingPrefix | readonly WuxingPrefix[]): readonly WuxingPrefix[] {
  return Array.isArray(p) ? p : [p as WuxingPrefix]
}

/** 任一前缀「相生」任一前缀；用于处理单/双前缀混合判定 */
export function v5AnySheng(
  from: WuxingPrefix | readonly WuxingPrefix[],
  to: WuxingPrefix | readonly WuxingPrefix[],
): boolean {
  for (const f of toPrefixArray(from)) {
    for (const t of toPrefixArray(to)) {
      if (v5IsSheng(f, t)) return true
    }
  }
  return false
}

// --------------------------- 五行触发计算 ---------------------------

export interface V5EquippedItem {
  /** 1~7，xlsx 装备序号 */
  slotIndex: number
  /** 单前缀或双前缀（dual_prefix 的 boss 秘宝、元始天尊【五行】） */
  prefix: WuxingPrefix | readonly WuxingPrefix[]
}

export interface V5WuxingActivation {
  slotIndex: number
  /** 当前装备的属性1 是否生效（上一件相生） */
  affix_1_active: boolean
  /** 属性2 是否生效（在 affix_1 生效前提下，全身 affix_1 触发数 ≥ 3） */
  affix_2_active: boolean
  /** 属性3 是否生效（在 affix_1 生效前提下，全身 affix_1 触发数 ≥ 6） */
  affix_3_active: boolean
}

/**
 * 计算全套装备的五行词条触发状态
 *
 * 规则：
 * - affix_1：上一件装备前缀 → 当前装备前缀 满足五行相生
 * - affix_2：本件 affix_1 已触发，且全身 affix_1 触发数 ≥ 3
 * - affix_3：本件 affix_1 已触发，且全身 affix_1 触发数 ≥ 6
 * - 双前缀按 v5AnySheng 处理（任一组合相生即触发）
 *
 * @param equipped 当前穿戴的装备（slotIndex 不重复，可不满 7 件；空位视为无相生）
 */
export function computeV5WuxingActivation(equipped: readonly V5EquippedItem[]): V5WuxingActivation[] {
  // 按 slotIndex 索引
  const bySlot = new Map<number, V5EquippedItem>()
  for (const e of equipped) bySlot.set(e.slotIndex, e)

  // 第一遍：算每件装备的 affix_1_active
  const phase1: { slotIndex: number; affix_1_active: boolean }[] = []
  for (const e of equipped) {
    const prev = bySlot.get(v5PrevSlotIndex(e.slotIndex))
    const affix1 = prev ? v5AnySheng(prev.prefix, e.prefix) : false
    phase1.push({ slotIndex: e.slotIndex, affix_1_active: affix1 })
  }

  const total1 = phase1.filter(p => p.affix_1_active).length

  // 第二遍：算 affix_2 / affix_3
  return phase1.map(p => ({
    slotIndex: p.slotIndex,
    affix_1_active: p.affix_1_active,
    affix_2_active: p.affix_1_active && total1 >= 3,
    affix_3_active: p.affix_1_active && total1 >= 6,
  }))
}

// --------------------------- 五行词条表（35 条） ---------------------------

export const V5_WUXING_AFFIX_TABLE: Record<V5BaseSlot, Record<WuxingPrefix, V5WuxingAffixSet>> = {
  weapon: {
    metal: ['atk_pct',    'crit_rate',  'spirit_pct'],
    wood:  ['spirit_pct', 'wuxing_dmg', 'atk_pct'],
    water: ['spirit_pct', 'atk_pct',    'wuxing_dmg'],
    fire:  ['crit_dmg',   'crit_dmg',   'wuxing_dmg'],
    earth: ['lifesteal',  'reflect',    'wuxing_dmg'],
  },
  ring: {
    metal: ['armor_pen',  'crit_rate',  'crit_dmg'],
    wood:  ['lifesteal',  'atk_pct',    'lifesteal_all'],
    water: ['accuracy',   'spirit_pct', 'crit_rate'],
    fire:  ['wuxing_dmg', 'spirit_pct', 'crit_dmg'],
    earth: ['res_pct',    'reflect',    'atk_pct'],
  },
  treasure: {
    metal: ['atk_pct',    'wuxing_dmg', 'armor_pen'],
    wood:  ['spirit_pct', 'wuxing_dmg', 'crit_dmg'],
    water: ['spirit_pct', 'wuxing_dmg', 'crit_rate'],
    fire:  ['atk_pct',    'wuxing_dmg', 'armor_pen'],
    earth: ['lifesteal',  'wuxing_dmg', 'crit_rate'],
  },
  armor: {
    metal: ['def_pct',    'lifesteal',  'wuxing_dmg'],
    wood:  ['hp_pct',     'lifesteal',  'spirit_pct'],
    water: ['hp_pct',     'def_pct',    'spirit_pct'],
    fire:  ['def_pct',    'lifesteal',  'wuxing_dmg'],
    earth: ['hp_pct',     'def_pct',    'spirit_pct'],
  },
  helmet: {
    metal: ['def_pct',    'armor_pen',  'crit_dmg'],
    wood:  ['hp_pct',     'wuxing_dmg', 'crit_rate'],
    water: ['hp_pct',     'wuxing_dmg', 'crit_rate'],
    fire:  ['def_pct',    'armor_pen',  'crit_dmg'],
    earth: ['hp_pct',     'wuxing_dmg', 'crit_dmg'],
  },
  pendant: {
    metal: ['spirit_pct', 'accuracy',   'armor_pen'],
    wood:  ['atk_pct',    'dodge',      'lifesteal'],
    water: ['atk_pct',    'dodge',      'lifesteal'],
    fire:  ['spirit_pct', 'accuracy',   'armor_pen'],
    earth: ['atk_pct',    'dodge',      'lifesteal'],
  },
  boots: {
    metal: ['crit_dmg',   'wuxing_dmg', 'dodge'],
    wood:  ['crit_rate',  'wuxing_dmg', 'accuracy'],
    water: ['crit_rate',  'wuxing_dmg', 'accuracy'],
    fire:  ['crit_dmg',   'wuxing_dmg', 'dodge'],
    earth: ['crit_rate',  'wuxing_dmg', 'accuracy'],
  },
}

// --------------------------- 强化词条：共享两组池 ---------------------------

/** 1/2/3（武器/灵戒/法宝）共用 */
export const V5_ENHANCE_AFFIX_POOL_ATTACK: V5EnhanceAffixPositions = [
  ['atk', 'atk_pct', 'spirit', 'spirit_pct'],
  ['atk_pct', 'spirit_pct', 'crit_rate', 'crit_dmg', 'armor_pen', 'lifesteal', 'wuxing_dmg'],
  ['atk_pct', 'spirit_pct', 'crit_rate', 'crit_dmg', 'armor_pen', 'lifesteal', 'wuxing_dmg'],
  ['crit_rate', 'crit_dmg', 'armor_pen', 'lifesteal', 'wuxing_dmg', 'dot_dmg'],
] as const

/** 4/5/6/7（法袍/法冠/灵佩/步云靴）共用 */
export const V5_ENHANCE_AFFIX_POOL_DEFENSE: V5EnhanceAffixPositions = [
  ['def', 'def_pct', 'hp', 'hp_pct'],
  ['def_pct', 'hp_pct', 'dmg_reduction', 'res_pct', 'crit_rate', 'crit_dmg'],
  ['dmg_reduction', 'res_pct', 'crit_rate', 'crit_dmg', 'dodge', 'accuracy', 'lifesteal'],
  ['crit_rate', 'crit_dmg', 'dodge', 'accuracy', 'lifesteal', 'wuxing_dmg'],
] as const

/** 槽位序号 → 该装备走哪个强化词条池 */
export function getV5EnhanceAffixPool(slotIndex: number): V5EnhanceAffixPositions {
  return slotIndex <= 3 ? V5_ENHANCE_AFFIX_POOL_ATTACK : V5_ENHANCE_AFFIX_POOL_DEFENSE
}

// --------------------- 强化词条数：颜色 + 强化等级 ---------------------

/** 初始（+0）强化词条数 */
export const V5_RARITY_TO_ENHANCE_AFFIX_COUNT: Record<V5Rarity, number> = {
  red: 4, gold: 3, purple: 2, blue: 1,
}

/** 强化里程碑（解锁/加值时机） */
export const V5_ENHANCE_MILESTONES = [3, 6, 9] as const

/**
 * 任意颜色 + 强化等级下的实际强化词条数（封顶 4 条）
 * +3/+6/+9 各加 1 条，若已满 4 条则不再加
 */
export function getV5EnhanceAffixCount(rarity: V5Rarity, level: number): number {
  const initial = V5_RARITY_TO_ENHANCE_AFFIX_COUNT[rarity] ?? 1
  let count = initial
  for (const m of V5_ENHANCE_MILESTONES) {
    if (level >= m && count < 4) count++
  }
  return count
}

// --------------------- 基础属性 1：强化曲线 ---------------------

export const V5_ENHANCE_CAP = 9
export const V5_ENHANCE_MUL_PER_LEVEL = 0.10

export function getV5EnhanceMul(level: number): number {
  const lv = Math.max(0, Math.min(level, V5_ENHANCE_CAP))
  return 1 + lv * V5_ENHANCE_MUL_PER_LEVEL
}

// --------------------- T 级：权重曲线 ---------------------

export const V5_T_CAP = 15
export const V5_T15_WEIGHT = 20

/** T 级权重：T1~T10 线性；T11~T15 每级 +2（加陡），与 V4 现役 getEquipTierWeight 一致 */
export function getV5TierWeight(tier: number): number {
  const t = Math.max(1, Math.min(tier, V5_T_CAP))
  return t <= 10 ? t : 10 + (t - 10) * 2
}

// --------------------- T15 满堆贡献参考表（baseline 校验用，非生成器使用） ---------------------

/**
 * V5_T15_STAT_CONTRIBUTION_PER_PIECE：T15 baseline 下，单条五行词条对**最终面板**的等效贡献
 *
 * ⚠️ 这只是 baseline 校验参考，不是生成器实际生成的数值！
 *
 * key 是「最终面板属性」（atk / hp / dodge_pct 等），不是 V5_WUXING_AFFIX_TABLE 里的「词条 stat」
 * （atk_pct / crit_rate / wuxing_dmg 等）。两套语义不通用：
 *   - V5_WUXING_AFFIX_TABLE.weapon.metal = ['atk_pct', 'crit_rate', 'spirit_pct']  ← 词条 stat
 *   - V5_T15_STAT_CONTRIBUTION_PER_PIECE.atk = 5556                                ← 面板贡献
 *
 * 例如「atk = 5556」意思是「假设 18 条五行词条都堆 atk_pct，单条平均贡献 5556 点面板 atk」。
 *
 * 历史：曾名 V5_PER_WUXING_AFFIX_T15，2026-05-12 重命名（命名误导导致生成器查表返回 0）
 * 削弱记录（2026-05-12）：吸血率/破甲率 原 100% → 50%
 *
 * 生成器实际数值见 server/utils/equipment-v5.ts:calcWuxingAffixValue（沿用 V4 SUB_STAT_RANGE_V4 + tier 缩放）
 */
export const V5_T15_STAT_CONTRIBUTION_PER_PIECE: Record<string, number> = {
  atk:           5556,
  def:           4444,
  hp:            138889,
  spirit:        83,
  spd:           278,
  accuracy:      27778,
  dodge_pct:     0.0278,
  lifesteal_pct: 0.0278,
  armor_pen_pct: 0.0278,
  crit_rate_pct: 0.0444,
  crit_dmg_pct:  0.20,
  wuxing_dmg:    0.0333,
  dot_dmg:       0.05,
}

/** @deprecated 用 V5_T15_STAT_CONTRIBUTION_PER_PIECE，命名更清晰 */
export const V5_PER_WUXING_AFFIX_T15 = V5_T15_STAT_CONTRIBUTION_PER_PIECE

/** @deprecated 仅作 baseline 参考；生成器实际数值用 server/utils/equipment-v5.ts:calcWuxingAffixValue */
export function getV5PerWuxingAffixValue(stat: string, tier: number): number {
  const t15 = V5_T15_STAT_CONTRIBUTION_PER_PIECE[stat] ?? 0
  return t15 * getV5TierWeight(tier) / V5_T15_WEIGHT
}

/** 属性 1 / 2 / 3 三档分配比例（默认同值，差异化时改这里） */
export const V5_AFFIX_TIER_DISTRIBUTION: readonly [number, number, number] = [1, 1, 1] as const

// --------------------- 灵根共鸣 ---------------------

/** 身上「灵根属性 = 角色灵根」的件数到达 3/5/7 件时的攻防血神识加成 */
export const V5_LINGEN_RESONANCE = [
  { pieces: 3, bonus_pct: 0.05 },
  { pieces: 5, bonus_pct: 0.10 },
  { pieces: 7, bonus_pct: 0.20 },
] as const

export function getV5LingenResonanceBonus(matchedPieces: number): number {
  if (matchedPieces >= 7) return 0.20
  if (matchedPieces >= 5) return 0.10
  if (matchedPieces >= 3) return 0.05
  return 0
}

// --------------------- 元始天尊套装 ---------------------

export interface V5LegendarySetPiece {
  slot_v5: string
  base_slot_v4: V5BaseSlot
  name: string
  base_stat_1: string
}

export interface V5LegendarySetEffect {
  pieces: number
  description_zh: string
  /** 数值化的效果，键为 stat key 或 effect key */
  effect: Record<string, number | boolean>
}

export const V5_LEGENDARY_SET_YUANSHI = {
  name: '元始天尊',
  color: '炫金',
  color_hex: '#FFD700',
  realm_requirement: '真仙',
  /** 基础属性 1 相比同 T 红装的倍率 */
  base_stat_1_multiplier: 1.5,
  /** 前缀【五行】：包含金木水火土全部，可触发任意相生 */
  prefix_zh: '【五行】',
  prefix_wuxing: V5_WUXING_PREFIX_ORDER,
  min_tier: 8,
  drop_rates: {
    normal_boss:           0.00001,
    secret_realm_wave5:    0.0001,
    secret_realm_wave7:    0.0005,
  },
  pieces: [
    { slot_v5: '武器',    base_slot_v4: 'weapon',   name: '盘古幡',         base_stat_1: 'atk' },
    { slot_v5: '灵戒',    base_slot_v4: 'ring',     name: '三宝玉如意',     base_stat_1: 'wuxing_dmg' },
    { slot_v5: '法宝',    base_slot_v4: 'treasure', name: '封神榜',         base_stat_1: 'spirit' },
    { slot_v5: '法袍',    base_slot_v4: 'armor',    name: '诸天庆云',       base_stat_1: 'def' },
    { slot_v5: '法冠',    base_slot_v4: 'helmet',   name: '戊己杏黄旗',     base_stat_1: 'hp' },
    { slot_v5: '灵佩',    base_slot_v4: 'pendant',  name: '玲珑宝塔',       base_stat_1: 'hp_pct_or_def_pct' },
    { slot_v5: '步云靴',  base_slot_v4: 'boots',    name: '九龙沉香辇',     base_stat_1: 'spd' },
  ] as readonly V5LegendarySetPiece[],
  set_effects: [
    { pieces: 1, description_zh: '攻/防/血/神识/身法 +10%',
      effect: { atk_pct: 0.10, def_pct: 0.10, hp_pct: 0.10, spirit_pct: 0.10, spd_pct: 0.10 } },
    { pieces: 3, description_zh: '神通伤害 +10%',
      effect: { skill_dmg_pct: 0.10 } },
    { pieces: 5, description_zh: '全神通 cd -1；释放神通时 30% 概率刷新 cd 最短的神通',
      effect: { skill_cd_minus: 1, refresh_shortest_cd_chance: 0.30 } },
    { pieces: 7, description_zh: '行动时 10% 概率触发「天尊气场」，全体震慑 1 回合（眩晕，无视免控必中）',
      effect: { stun_all_chance: 0.10, stun_turns: 1, ignore_immune: true, guaranteed_hit: true } },
  ] as readonly V5LegendarySetEffect[],
} as const

// --------------------- Boss 秘宝（T8~T15） ---------------------

export interface V5BossTreasure {
  tier: number
  boss_zh: string
  /** 前缀（双前缀如 ['metal','fire'] 同时算两种） */
  prefix: readonly WuxingPrefix[]
  slot_v5: string
  base_slot_v4: V5BaseSlot
  name: string
  base_stat_1: string
  /** 三档五行词条都用同一个 stat（粉色秘宝特征） */
  wuxing_affixes: readonly [string, string, string]
  dual_prefix?: boolean
}

export const V5_BOSS_TREASURES: readonly V5BossTreasure[] = [
  { tier: 8,  boss_zh: '天帝',     prefix: ['fire'],          slot_v5: '武器',   base_slot_v4: 'weapon',   name: '降魔伏鬼枪', base_stat_1: 'atk',        wuxing_affixes: ['armor_pen', 'armor_pen', 'armor_pen'] },
  { tier: 9,  boss_zh: '鸿蒙道尊', prefix: ['wood'],          slot_v5: '武器',   base_slot_v4: 'weapon',   name: '道尊拂尘',   base_stat_1: 'atk',        wuxing_affixes: ['atk_pct', 'atk_pct', 'atk_pct'] },
  { tier: 10, boss_zh: '万界战神', prefix: ['fire'],          slot_v5: '法袍',   base_slot_v4: 'armor',    name: '不朽战铠',   base_stat_1: 'def',        wuxing_affixes: ['lifesteal', 'lifesteal', 'lifesteal'] },
  { tier: 11, boss_zh: '九霄玉帝', prefix: ['earth'],         slot_v5: '法宝',   base_slot_v4: 'treasure', name: '封天印',     base_stat_1: 'spirit',     wuxing_affixes: ['spirit_pct', 'spirit_pct', 'spirit_pct'] },
  { tier: 12, boss_zh: '虚空之主', prefix: ['water'],         slot_v5: '灵佩',   base_slot_v4: 'pendant',  name: '虚空虫卵',   base_stat_1: 'spirit_pct', wuxing_affixes: ['crit_dmg', 'crit_dmg', 'crit_dmg'] },
  { tier: 13, boss_zh: '天宇道君', prefix: ['wood'],          slot_v5: '步云靴', base_slot_v4: 'boots',    name: '道君云履',   base_stat_1: 'spd',        wuxing_affixes: ['spd_pct', 'spd_pct', 'spd_pct'] },
  { tier: 14, boss_zh: '时空之主', prefix: ['metal', 'fire'], slot_v5: '灵戒',   base_slot_v4: 'ring',     name: '寰宇',       base_stat_1: 'wuxing_dmg', wuxing_affixes: ['wuxing_dmg', 'wuxing_dmg', 'wuxing_dmg'], dual_prefix: true },
  { tier: 15, boss_zh: '终焉道祖', prefix: ['wood', 'earth'], slot_v5: '法宝',   base_slot_v4: 'treasure', name: '万道终焉',   base_stat_1: 'crit_dmg',   wuxing_affixes: ['crit_dmg', 'crit_dmg', 'crit_dmg'], dual_prefix: true },
] as const

export const V5_BOSS_TREASURE_DROP_RATE = {
  normal_map:    0.001,
  secret_realm:  0.005,
} as const

// --------------------- 满堆基线（T15 + 9 红装，校验用） ---------------------

/** T15 + 9 红装、6 件触发 3 个五行词条 + 1 件不触发时的 13 项上限（用于上限校验，不是单件公式） */
export const V5_T15_BASELINE_CAPS: Record<string, number> = {
  atk:           100000,
  def:           80000,
  hp:            2500000,
  spirit:        1500,
  spd:           5000,
  accuracy:      500000,
  dodge_pct:     0.50,
  lifesteal_pct: 0.50,
  armor_pen_pct: 0.50,
  crit_rate_pct: 0.80,
  crit_dmg_pct:  3.60,
  wuxing_dmg:    0.60,
  dot_dmg:       0.90,
}

// --------------------------- 套装效果激活 ---------------------------

/**
 * 元始天尊套装：根据穿戴件数，返回激活的所有效果（pieces >= 1/3/5/7 各档累加）
 */
export function getV5LegendarySetActiveEffects(pieces: number): readonly V5LegendarySetEffect[] {
  return V5_LEGENDARY_SET_YUANSHI.set_effects.filter(e => pieces >= e.pieces)
}

// --------------------------- 灵根共鸣计算 ---------------------------

export interface V5LingenResonanceResult {
  matched_pieces: number
  bonus_pct: number
}

/**
 * 灵根共鸣：装备前缀（含双前缀）与角色灵根匹配的件数 → 3/5/7 件分档加成
 * 双前缀装备：任一前缀匹配角色灵根即算 1 件
 */
export function computeV5LingenResonance(
  equipped: readonly V5EquippedItem[],
  charLingen: WuxingPrefix,
): V5LingenResonanceResult {
  let matched = 0
  for (const e of equipped) {
    const prefixes = Array.isArray(e.prefix) ? e.prefix : [e.prefix as WuxingPrefix]
    if (prefixes.includes(charLingen)) matched++
  }
  return {
    matched_pieces: matched,
    bonus_pct: getV5LingenResonanceBonus(matched),
  }
}
