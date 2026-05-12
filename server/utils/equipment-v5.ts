// =====================================================================
// 装备 V5.0.2 生成器（design_only，未挂载到任何 API/Cron）
// =====================================================================
// 与 V4 server/utils/equipment.ts 并存；不接管任何掉落入口。
// 未来接入掉落时，调用方传入 (slotIndex, rarity, tier, [prefix]) 即可拿到 V5EquipmentInstance。
//
// V5 数值生成的两套规则：
//   - base_stat_1：    EQUIP_PRIMARY_BASE × tier_weight × rarity_mul × enhance_mul   （受强化）
//   - wuxing_affix：   V5_PER_WUXING_AFFIX_T15[stat] × (tier_weight / 20)            （只受 T 级）
//   - enhance_affix：  V4 SUB_STAT_RANGE_V4 随机 × rarity_mul                        （只受强化，不受 T 级）
//
// 强化词条数值生成沿用 V4 SUB_STAT_RANGE_V4，做了 V5 snake_case ↔ V4 SCREAMING_CASE 映射；
// 不受 T 级影响（V5 设计规则：T 级只影响 base_stat_1 与 wuxing_affix）。
// =====================================================================

import {
  // V5 常量与工具
  V5_EQUIPMENT_SLOTS,
  V5_WUXING_PREFIX_ORDER,
  V5_WUXING_AFFIX_TABLE,
  V5_PER_WUXING_AFFIX_T15,
  V5_RARITY_TO_ENHANCE_AFFIX_COUNT,
  V5_LEGENDARY_SET_YUANSHI,
  V5_BOSS_TREASURES,
  V5_DROP_FLAG,
  getV5EnhanceMul,
  getV5TierWeight,
  getV5EnhanceAffixCount,
  getV5EnhanceAffixPool,
  type V5Rarity,
  type V5BaseSlot,
  type WuxingPrefix,
  type V5BossTreasure,
} from '../../shared/balance-v5'
import {
  EQUIP_PRIMARY_BASE,
  RARITY_STAT_MUL,
} from '../../shared/balance'
import { SUB_STAT_RANGE_V4, RARITY_IDX_MAP } from './equipment'

// --------------------------- 类型 ---------------------------

export interface V5StatValue {
  stat: string
  value: number
}

export interface V5EquipmentInstance {
  /** 1~7，xlsx 装备序号 */
  slot_index: number
  /** 对应 V4 现役 base_slot，便于 DB 兼容 */
  base_slot_v4: V5BaseSlot
  rarity: V5Rarity
  /** T1~T15 */
  tier: number
  /** 强化等级 0~9 */
  enhance_level: number
  /** 单前缀或双前缀（boss 秘宝 T14/T15、元始天尊【五行】） */
  wuxing_prefix: WuxingPrefix | readonly WuxingPrefix[]
  /** 基础属性 1（受强化 + T 级影响） */
  base_stat_1: V5StatValue
  /** 五行词条 [属性1, 属性2, 属性3]（只受 T 级影响） */
  wuxing_affixes: readonly [V5StatValue, V5StatValue, V5StatValue]
  /** 强化词条数组（只受强化影响，长度 = getV5EnhanceAffixCount） */
  enhance_affixes: V5StatValue[]
  /** 装备名（boss 秘宝 / 元始天尊有命名；普通装备可由调用方拼装） */
  name?: string
  /** 元始天尊套装件标识 */
  legendary_set_id?: 'yuanshi_tianzun'
  /** boss 秘宝标识（true 时 wuxing_affixes 三档同 stat） */
  is_boss_treasure?: boolean
}

export interface RollEquipmentV5Options {
  slotIndex: number
  rarity: V5Rarity
  tier: number
  enhanceLevel?: number
  /** 不指定则随机金木水火土 */
  prefix?: WuxingPrefix | readonly WuxingPrefix[]
  /** 元始天尊套装件：自动覆盖 prefix=['metal','wood','water','fire','earth']、base_stat_1 ×1.5、name */
  legendary?: 'yuanshi_tianzun'
  /** boss 秘宝：自动覆盖 prefix、wuxing_affixes（三档同 stat）、name */
  bossTreasure?: V5BossTreasure
}

// --------------------------- V5 ↔ V4 stat key 映射 ---------------------------

/**
 * V5 snake_case → V4 SCREAMING_CASE 映射（用于查 SUB_STAT_RANGE_V4）
 * V5 独有的 stat（dot_dmg / dmg_reduction / res_pct / reflect / lifesteal_all）
 * 没有 V4 对应 range，由 V5_FALLBACK_ENHANCE_RANGE 提供
 */
const V5_TO_V4_STAT: Record<string, string> = {
  atk: 'ATK', def: 'DEF', hp: 'HP', spd: 'SPD', spirit: 'SPIRIT',
  atk_pct: 'ATK_PCT', def_pct: 'DEF_PCT', hp_pct: 'HP_PCT', spd_pct: 'SPD_PCT', spirit_pct: 'SPIRIT_PCT',
  accuracy: 'ACCURACY', dodge: 'DODGE',
  lifesteal: 'LIFESTEAL', armor_pen: 'ARMOR_PEN',
  crit_rate: 'CRIT_RATE', crit_dmg: 'CRIT_DMG',
  luck: 'LUCK', spirit_density: 'SPIRIT_DENSITY',
  // V5 wuxing_dmg 是「装备前缀对应的某个具体五行 dmg」，强化词条里默认映射到 METAL_DMG range 取值
  wuxing_dmg: 'METAL_DMG',
}

/** V4 没有对应 range 的 V5 stat，给一个保守 fallback range（{min, max}） */
const V5_FALLBACK_ENHANCE_RANGE: Record<string, [number, number]> = {
  dot_dmg:        [1, 3],   // %类
  dmg_reduction:  [1, 3],   // %类
  res_pct:        [2, 4],   // 沿用 V4 抗性范围
  reflect:        [1, 3],   // %类
  lifesteal_all:  [1, 1],   // 顶配类
}

function v5StatRange(stat: string): [number, number] {
  const v4Key = V5_TO_V4_STAT[stat]
  if (v4Key && SUB_STAT_RANGE_V4[v4Key]) return SUB_STAT_RANGE_V4[v4Key]
  if (V5_FALLBACK_ENHANCE_RANGE[stat]) return V5_FALLBACK_ENHANCE_RANGE[stat]
  return [1, 3]
}

// --------------------------- 基础属性 1 数值 ---------------------------

/**
 * 算单件装备的 base_stat_1 数值
 * V4 公式：base × tier_weight × rarity_mul × enhance_mul
 * V5 加成（元始天尊 × 1.5）由调用方在外层加
 */
function calcBaseStat1Value(stat: string, tier: number, rarity: V5Rarity, level: number): number {
  // V5 stat → V4 EQUIP_PRIMARY_BASE 查（V5 用小写，V4 用大写）
  const v4Stat = V5_TO_V4_STAT[stat] || stat.toUpperCase()
  const base = (EQUIP_PRIMARY_BASE as Record<string, number>)[v4Stat]
  if (!base) {
    // 灵佩 hp_pct_or_def_pct：单条主词条产出后在 pages/index.vue addV5 里拆 50/50 进 HP_PCT / DEF_PCT
    // base = 0.16 → T11 红 +0 = 4.8 → 4（拆后单属性 +2%），T15 红 +9 ≈ 15（拆后单属性 +7%），与副词条 HP_PCT [2,8] 一档对齐
    if (stat === 'hp_pct_or_def_pct') return Math.max(1, Math.floor(0.16 * getV5TierWeight(tier) * RARITY_STAT_MUL[RARITY_IDX_MAP[rarity]] * getV5EnhanceMul(level)))
    return 1
  }
  const value = base * getV5TierWeight(tier) * RARITY_STAT_MUL[RARITY_IDX_MAP[rarity]] * getV5EnhanceMul(level)
  return Math.max(1, Math.floor(value))
}

// --------------------------- 五行词条数值（修复版，2026-05-12）---------------------------

// 旧版查 V5_PER_WUXING_AFFIX_T15 表，但表 key 是 atk/spirit 等「面板数值」，
// 与 V5_WUXING_AFFIX_TABLE 用的 atk_pct/spirit_pct 等「百分比词条」对不上 → 返回 0。
// (Y) 方案：沿用 V4 SUB_STAT_RANGE_V4 + 品质乘子，单条 random 落在 [min,max] × qualityMul × tier_mul。
// tier_mul 用 V5_TIER_WEIGHT / 20：T15 = 1.0、T10 = 0.5、T1 = 0.05；与 base_stat_1 的 tier 缩放一致。

function calcWuxingAffixValue(stat: string, tier: number, rarity: V5Rarity = 'red'): number {
  const [min, max] = v5StatRange(stat)
  const rarityIdx = RARITY_IDX_MAP[rarity] ?? 0
  const qualityMul = 1 + rarityIdx * 0.15
  const tierMul = getV5TierWeight(tier) / 20
  const base = Math.floor(Math.random() * (max - min + 1)) + min
  return Math.max(1, Math.ceil(base * qualityMul * tierMul))
}

// --------------------------- 强化词条数值（不受 T 级） ---------------------------

function calcEnhanceAffixValue(stat: string, rarity: V5Rarity): number {
  const [min, max] = v5StatRange(stat)
  const rarityIdx = RARITY_IDX_MAP[rarity] ?? 0
  const qualityMul = 1 + rarityIdx * 0.15
  const base = Math.floor(Math.random() * (max - min + 1)) + min
  return Math.max(1, Math.ceil(base * qualityMul))
}

// --------------------------- 强化词条抽取 ---------------------------

/** res_pct 抽到时 50/50 替换为 luck 或 spirit_density（保留 design 文档 res_pct 占位） */
function resolveResPctReplacement(stat: string): string {
  if (stat !== 'res_pct') return stat
  return Math.random() < 0.5 ? 'luck' : 'spirit_density'
}

function rollEnhanceAffixes(slotIndex: number, rarity: V5Rarity, level: number): V5StatValue[] {
  const count = getV5EnhanceAffixCount(rarity, level)
  if (count <= 0) return []
  const pool = getV5EnhanceAffixPool(slotIndex)
  const out: V5StatValue[] = []
  for (let pos = 0; pos < count; pos++) {
    const candidates = pool[pos]
    if (!candidates || candidates.length === 0) continue
    const rawStat = candidates[Math.floor(Math.random() * candidates.length)]
    const stat = resolveResPctReplacement(rawStat)
    out.push({ stat, value: calcEnhanceAffixValue(stat, rarity) })
  }
  return out
}

/**
 * V5 强化 +3/+6/+9 milestone 触发的副词条变化
 *   - 从现有副词条随机选一条 ×1.30（最少 +1），不新增词条
 *   - 允许多个 milestone 重复加到同一条
 *   - 词条数永远保持初始（按品质 V5_RARITY_TO_ENHANCE_AFFIX_COUNT 给定）
 */
export function applyV5EnhanceMilestone(
  currentSubStats: V5StatValue[],
  _slotIndex: number,
  _rarity: V5Rarity,
  _newLevel: number,
): {
  newSubStats: V5StatValue[]
  added?: V5StatValue
  boosted?: { stat: string; oldValue: number; newValue: number }
} {
  if (currentSubStats.length === 0) return { newSubStats: currentSubStats }
  const idx = Math.floor(Math.random() * currentSubStats.length)
  const old = currentSubStats[idx]
  const newValue = Math.max(Math.floor(old.value * 1.30), old.value + 1)
  const boosted = { stat: old.stat, oldValue: old.value, newValue }
  const newSubStats = currentSubStats.map((s, i) => (i === idx ? { stat: s.stat, value: newValue } : s))
  return { newSubStats, boosted }
}

// --------------------------- 主入口 ---------------------------

export function rollEquipmentV5(opts: RollEquipmentV5Options): V5EquipmentInstance {
  const { slotIndex, rarity, tier, enhanceLevel = 0, prefix, legendary, bossTreasure } = opts
  if (slotIndex < 1 || slotIndex > 7) throw new Error(`rollEquipmentV5: invalid slotIndex ${slotIndex}`)
  // 元始天尊套装：最低 T8（design：T8 以下副本不掉传说装备）
  if (legendary === 'yuanshi_tianzun' && tier < V5_LEGENDARY_SET_YUANSHI.min_tier) {
    throw new Error(`rollEquipmentV5: 元始天尊套装最低 T${V5_LEGENDARY_SET_YUANSHI.min_tier}, 传入 T${tier}`)
  }
  // boss 秘宝：tier 必须匹配 V5_BOSS_TREASURES 表里的具体 tier（避免低 tier 错误生成）
  if (bossTreasure && bossTreasure.tier !== tier) {
    throw new Error(`rollEquipmentV5: boss 秘宝 ${bossTreasure.name} 固定 T${bossTreasure.tier}, 传入 T${tier}`)
  }

  const slotMeta = V5_EQUIPMENT_SLOTS[slotIndex - 1]
  if (!slotMeta) throw new Error(`rollEquipmentV5: no slot meta for ${slotIndex}`)

  // 1) 决定前缀
  let actualPrefix: WuxingPrefix | readonly WuxingPrefix[]
  if (legendary === 'yuanshi_tianzun') {
    actualPrefix = V5_WUXING_PREFIX_ORDER
  } else if (bossTreasure) {
    actualPrefix = bossTreasure.prefix
  } else if (prefix) {
    actualPrefix = prefix
  } else {
    actualPrefix = V5_WUXING_PREFIX_ORDER[Math.floor(Math.random() * V5_WUXING_PREFIX_ORDER.length)]
  }

  // 2) base_stat_1
  const baseStat1Key = slotMeta.base_stat_1
  let baseStat1Value = calcBaseStat1Value(baseStat1Key, tier, rarity, enhanceLevel)
  if (legendary === 'yuanshi_tianzun') {
    baseStat1Value = Math.floor(baseStat1Value * V5_LEGENDARY_SET_YUANSHI.base_stat_1_multiplier)
  }

  // 3) wuxing_affixes（属性1/2/3 stat）
  let wuxingAffixes: readonly [V5StatValue, V5StatValue, V5StatValue]
  if (bossTreasure) {
    // boss 秘宝：三档同 stat
    wuxingAffixes = [
      { stat: bossTreasure.wuxing_affixes[0], value: calcWuxingAffixValue(bossTreasure.wuxing_affixes[0], tier, rarity) },
      { stat: bossTreasure.wuxing_affixes[1], value: calcWuxingAffixValue(bossTreasure.wuxing_affixes[1], tier, rarity) },
      { stat: bossTreasure.wuxing_affixes[2], value: calcWuxingAffixValue(bossTreasure.wuxing_affixes[2], tier, rarity) },
    ]
  } else {
    // 普通 / 元始天尊：查 wuxing_affix_table
    // 双前缀的元始天尊【五行】：默认取第一个前缀（金）的词条；如需差异化交由 UI/逻辑层处理
    const lookupPrefix: WuxingPrefix = Array.isArray(actualPrefix) ? actualPrefix[0] : (actualPrefix as WuxingPrefix)
    const triple = V5_WUXING_AFFIX_TABLE[slotMeta.base_slot_v4][lookupPrefix]
    const s0 = resolveResPctReplacement(triple[0])
    const s1 = resolveResPctReplacement(triple[1])
    const s2 = resolveResPctReplacement(triple[2])
    wuxingAffixes = [
      { stat: s0, value: calcWuxingAffixValue(s0, tier, rarity) },
      { stat: s1, value: calcWuxingAffixValue(s1, tier, rarity) },
      { stat: s2, value: calcWuxingAffixValue(s2, tier, rarity) },
    ]
  }

  // 4) enhance_affixes
  const enhanceAffixes = rollEnhanceAffixes(slotIndex, rarity, enhanceLevel)

  // 5) name / 套装标识
  let name: string | undefined
  let legendarySetId: V5EquipmentInstance['legendary_set_id']
  if (legendary === 'yuanshi_tianzun') {
    name = V5_LEGENDARY_SET_YUANSHI.pieces[slotIndex - 1]?.name
    legendarySetId = 'yuanshi_tianzun'
  } else if (bossTreasure) {
    name = bossTreasure.name
  }

  return {
    slot_index: slotIndex,
    base_slot_v4: slotMeta.base_slot_v4,
    rarity,
    tier,
    enhance_level: enhanceLevel,
    wuxing_prefix: actualPrefix,
    base_stat_1: { stat: baseStat1Key, value: baseStat1Value },
    wuxing_affixes: wuxingAffixes,
    enhance_affixes: enhanceAffixes,
    name,
    legendary_set_id: legendarySetId,
    is_boss_treasure: bossTreasure ? true : undefined,
  }
}

// --------------------------- 批量便捷生成 ---------------------------

/** 批量：穿一套元始天尊（7 件，最低 T8） */
export function rollYuanshiTianzunSet(opts: { tier: number; rarity?: V5Rarity; enhanceLevel?: number }): V5EquipmentInstance[] {
  if (opts.tier < V5_LEGENDARY_SET_YUANSHI.min_tier) {
    throw new Error(`rollYuanshiTianzunSet: 元始天尊套装最低 T${V5_LEGENDARY_SET_YUANSHI.min_tier}, 传入 T${opts.tier}`)
  }
  const rarity = opts.rarity ?? 'red'
  return Array.from({ length: 7 }, (_, i) =>
    rollEquipmentV5({
      slotIndex: i + 1,
      rarity,
      tier: opts.tier,
      enhanceLevel: opts.enhanceLevel ?? 0,
      legendary: 'yuanshi_tianzun',
    }),
  )
}

// --------------------------- DB INSERT 字段 helper ---------------------------

/** V5 装备 INSERT 字段（对应 character_equipment 表的全部 V5 相关列） */
export interface V5DbInsertFields {
  name: string
  rarity: V5Rarity
  primary_stat: string
  primary_value: number
  /** 强化词条以 JSON 字符串形式存入 sub_stats 字段（与 V4 兼容） */
  sub_stats: string
  tier: number
  weapon_type: string | null
  base_slot: V5BaseSlot
  req_level: number
  enhance_level: number
  /** V5 专属字段 */
  equipment_version: 5
  wuxing_prefix: string[]
  wuxing_affixes: string
  legendary_set_id: string | null
  is_boss_treasure: boolean
}

/** T 级 → 装备需求等级（沿用 V4 fight.post.ts:294 的表） */
const TIER_REQ_LEVELS: Record<number, number> = {
  1: 1, 2: 15, 3: 35, 4: 55, 5: 80, 6: 110, 7: 140, 8: 170,
  9: 185, 10: 195, 11: 215, 12: 240, 13: 260, 14: 285, 15: 310,
}

/** V5 装备默认命名（普通装备没有 inst.name 时用） */
function defaultV5Name(inst: V5EquipmentInstance): string {
  const slotMeta = V5_EQUIPMENT_SLOTS[inst.slot_index - 1]
  const prefixes = Array.isArray(inst.wuxing_prefix) ? inst.wuxing_prefix : [inst.wuxing_prefix]
  const prefixZh = prefixes.map(p => {
    return { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }[p as string] ?? p
  }).join('')
  return `${prefixZh}·${slotMeta.slot_v5}`
}

/** 反查：V4 base_slot → V5 slot_index（1~7） */
export function getV5SlotIndexByBaseSlot(baseSlot: V5BaseSlot): number {
  const meta = V5_EQUIPMENT_SLOTS.find(s => s.base_slot_v4 === baseSlot)
  return meta?.index ?? 1
}

/** V5 装备实例 → V4 兼容 drop spec（共享 helper） */
function instanceToDropSpec(inst: V5EquipmentInstance, weaponType: string | null): V5CompatibleDropSpec {
  const fields = v5InstanceToDbInsert(inst, weaponType)
  return {
    name: fields.name,
    rarity: fields.rarity,
    primary_stat: fields.primary_stat,
    primary_value: fields.primary_value,
    primary_stat_2: null,
    primary_value_2: null,
    sub_stats: fields.sub_stats,
    set_id: null,
    tier: fields.tier,
    weapon_type: fields.weapon_type,
    base_slot: fields.base_slot,
    req_level: fields.req_level,
    enhance_level: fields.enhance_level,
    equipment_version: 5,
    wuxing_prefix: fields.wuxing_prefix,
    wuxing_affixes: fields.wuxing_affixes,
    legendary_set_id: fields.legendary_set_id,
    is_boss_treasure: fields.is_boss_treasure,
  }
}

/** 与 V4 drop spec 兼容的 V5 装备 drop 对象（含 V5 字段，让 INSERT 句子可统一处理） */
export interface V5CompatibleDropSpec {
  name: string
  rarity: V5Rarity
  primary_stat: string
  primary_value: number
  /** V5 不用属性2，恒为 null */
  primary_stat_2: null
  primary_value_2: null
  sub_stats: string
  /** V5 用 legendary_set_id；旧 set_id 字段恒为 null */
  set_id: null
  tier: number
  weapon_type: string | null
  base_slot: V5BaseSlot
  req_level: number
  enhance_level: number
  // V5 字段
  equipment_version: 5
  wuxing_prefix: string[]
  wuxing_affixes: string
  legendary_set_id: string | null
  is_boss_treasure: boolean
}

/**
 * 灰度入口：根据 V5_DROP_FLAG + rarity 决定是否走 V5 生成
 *
 * 调用方应优先调本函数；若返回 null 表示「该走 V4」，调用方继续原逻辑
 * 返回 V5CompatibleDropSpec 时，调用方可直接套用扩展 INSERT 句子
 */
export function tryRollEquipmentV5DropSpec(opts: {
  baseSlot: V5BaseSlot
  rarity: string
  tier: number
  weaponType?: string | null
}): V5CompatibleDropSpec | null {
  if (!V5_DROP_FLAG) return null
  // V5 仅覆盖 blue/purple/gold/red（白绿仍走 V4）
  if (opts.rarity !== 'blue' && opts.rarity !== 'purple' && opts.rarity !== 'gold' && opts.rarity !== 'red') return null

  const slotIndex = getV5SlotIndexByBaseSlot(opts.baseSlot)
  const inst = rollEquipmentV5({
    slotIndex,
    rarity: opts.rarity as V5Rarity,
    tier: opts.tier,
  })
  return instanceToDropSpec(inst, opts.weaponType ?? null)
}

/**
 * 传奇 / Boss 秘宝 极低概率掉落（按 xlsx 设计）
 *
 * 调用顺序应是：tryRollV5SpecialDrop → tryRollEquipmentV5DropSpec → V4 路径。
 * 只在 boss 战且 tier ≥ 8 时尝试 roll。
 *
 * 概率（V5_LEGENDARY_SET_YUANSHI.drop_rates）：
 *   - 元始天尊：正常图 boss 0.001% / 秘境 boss 0.05%（按 wave7 计）
 *   - Boss 秘宝：正常图 0.1% / 秘境 0.5%，按当前 tier 匹配 V5_BOSS_TREASURES
 */
export function tryRollV5SpecialDrop(opts: {
  tier: number
  isBoss: boolean
  source: 'normal' | 'secret_realm'
}): V5CompatibleDropSpec | null {
  if (!V5_DROP_FLAG) return null
  if (opts.tier < V5_LEGENDARY_SET_YUANSHI.min_tier) return null
  if (!opts.isBoss) return null

  // 1) 元始天尊
  const yuanshiRate = opts.source === 'secret_realm'
    ? V5_LEGENDARY_SET_YUANSHI.drop_rates.secret_realm_wave7
    : V5_LEGENDARY_SET_YUANSHI.drop_rates.normal_boss
  if (Math.random() < yuanshiRate) {
    const slotIndex = Math.floor(Math.random() * 7) + 1
    const inst = rollEquipmentV5({
      slotIndex,
      rarity: 'red',
      tier: opts.tier,
      legendary: 'yuanshi_tianzun',
    })
    const meta = V5_EQUIPMENT_SLOTS[slotIndex - 1]
    return instanceToDropSpec(inst, meta.base_slot_v4 === 'weapon' ? 'sword' : null)
  }

  // 2) Boss 秘宝（按 tier 匹配；T8~T15 共 8 个固定 boss）
  const bossTreasure = V5_BOSS_TREASURES.find(b => b.tier === opts.tier)
  if (bossTreasure) {
    const treasureRate = opts.source === 'secret_realm' ? 0.005 : 0.001
    if (Math.random() < treasureRate) {
      const inst = rollEquipmentV5({
        slotIndex: getV5SlotIndexByBaseSlot(bossTreasure.base_slot_v4),
        rarity: 'red',
        tier: opts.tier,
        bossTreasure,
      })
      return instanceToDropSpec(inst, bossTreasure.base_slot_v4 === 'weapon' ? 'sword' : null)
    }
  }
  return null
}

/**
 * 把 V5EquipmentInstance 转成可直接写入 character_equipment 表的字段
 *
 * @param inst        V5 装备实例
 * @param weaponType  武器子类（仅 slot_index=1 武器需要；其他槽位传 null）
 */
export function v5InstanceToDbInsert(
  inst: V5EquipmentInstance,
  weaponType: string | null = null,
): V5DbInsertFields {
  const prefixArr = Array.isArray(inst.wuxing_prefix)
    ? [...inst.wuxing_prefix]
    : [inst.wuxing_prefix as string]
  return {
    name: inst.name ?? defaultV5Name(inst),
    rarity: inst.rarity,
    primary_stat: inst.base_stat_1.stat,
    primary_value: inst.base_stat_1.value,
    sub_stats: JSON.stringify(inst.enhance_affixes),
    tier: inst.tier,
    weapon_type: inst.slot_index === 1 ? weaponType : null,
    base_slot: inst.base_slot_v4,
    req_level: TIER_REQ_LEVELS[inst.tier] ?? 1,
    enhance_level: inst.enhance_level,
    equipment_version: 5,
    wuxing_prefix: prefixArr,
    wuxing_affixes: JSON.stringify(inst.wuxing_affixes),
    legendary_set_id: inst.legendary_set_id ?? null,
    is_boss_treasure: inst.is_boss_treasure === true,
  }
}
