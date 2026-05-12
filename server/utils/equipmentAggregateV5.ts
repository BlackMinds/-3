/**
 * V5 装备属性聚合（design_only → 现役共用）
 *
 * 把所有 V5 装备的 base_stat_1、强化词条、五行词条（含触发判定）、套装效果、灵根共鸣
 * 聚合成一个 delta 对象，供 battleSnapshot / buildPlayerStats 累加到角色属性上。
 *
 * V4 装备完全不经过这里 —— 调用方先用 equipment_version === 5 过滤。
 */
import {
  computeV5WuxingActivation, computeV5LingenResonance,
  getV5LegendarySetActiveEffects,
  type V5EquippedItem, type WuxingPrefix, type V5BaseSlot,
  type V5LegendarySetEffect,
} from '../../shared/balance-v5'
import { getV5SlotIndexByBaseSlot } from './equipment-v5'

export interface V5EquipmentDelta {
  // flat 累加
  atk: number; def: number; maxHp: number; spd: number; spirit: number
  luck: number; spiritDensity: number
  // 百分比类（小数）
  critRate: number; critDmg: number; lifesteal: number; dodge: number
  armorPen: number; accuracy: number
  // 装备 % 池（×100 整数，与 V4 累加器一致，统一在外层除 100）
  equipAtkPct: number; equipDefPct: number; equipHpPct: number; equipSpdPct: number
  weaponSpiritPct: number
  equipReflectPct: number
  // 五行 dmg（按装备前缀分摊）
  elementDmg: { metal: number; wood: number; water: number; fire: number; earth: number }
  // V5 专属 stat（小数 0.05 = 5%）
  /** DOT 增伤；调用方累加到 equipDotDmgPct */
  dotDmgPct: number
  /** 减伤；调用方累加到 awaken.damageReduction（cap 0.20） */
  dmgReductionPct: number
  /** 全能吸血；调用方累加到 lifesteal（V4 lifesteal 已是普攻+技能通用） */
  lifestealAllPct: number
  /** 通用五行抗性；调用方累加到 5 个 elementResist */
  resistAllPct: number
  // 套装与灵根（外层加到 nonPassive×Pct 池）
  legendarySetEffects: readonly V5LegendarySetEffect[]
  lingenBonusPct: number
}

const ZERO_DELTA = (): V5EquipmentDelta => ({
  atk: 0, def: 0, maxHp: 0, spd: 0, spirit: 0,
  luck: 0, spiritDensity: 0,
  critRate: 0, critDmg: 0, lifesteal: 0, dodge: 0,
  armorPen: 0, accuracy: 0,
  equipAtkPct: 0, equipDefPct: 0, equipHpPct: 0, equipSpdPct: 0,
  weaponSpiritPct: 0,
  equipReflectPct: 0,
  elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
  dotDmgPct: 0, dmgReductionPct: 0, lifestealAllPct: 0, resistAllPct: 0,
  legendarySetEffects: [],
  lingenBonusPct: 0,
})

/**
 * 已装备神通 → 主属（出现次数最多的五行）
 * 平局按 metal/wood/water/fire/earth 顺序取第一个；全 null 返回 null。
 */
export function getDominantSkillWuxing(equippedSkills: any): WuxingPrefix | null {
  if (!equippedSkills) return null
  const elements: (WuxingPrefix | null | undefined)[] = []
  if (equippedSkills.activeSkill?.element) elements.push(equippedSkills.activeSkill.element)
  if (Array.isArray(equippedSkills.divineSkills)) {
    for (const s of equippedSkills.divineSkills) {
      if (s?.skill?.element) elements.push(s.skill.element)
      else if (s?.element) elements.push(s.element)
    }
  }
  if (Array.isArray(equippedSkills.passiveSkills)) {
    for (const s of equippedSkills.passiveSkills) {
      if (s?.skill?.element) elements.push(s.skill.element)
      else if (s?.element) elements.push(s.element)
    }
  }
  const counts: Record<string, number> = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }
  for (const e of elements) if (e && counts[e] !== undefined) counts[e]++
  const order: WuxingPrefix[] = ['metal', 'wood', 'water', 'fire', 'earth']
  let best: WuxingPrefix | null = null
  let bestCount = 0
  for (const w of order) {
    if (counts[w] > bestCount) { bestCount = counts[w]; best = w }
  }
  return best
}

/** V5 小写 stat key → 加到 delta 哪个累加器 */
function applyStat(d: V5EquipmentDelta, stat: string, value: number, prefixes: readonly WuxingPrefix[], dominantSkillWuxing: WuxingPrefix | null): void {
  switch (stat) {
    case 'atk':           d.atk += value; break
    case 'def':           d.def += value; break
    case 'hp':            d.maxHp += value; break
    case 'spd':           d.spd += value; break
    case 'spirit':        d.spirit += value; break
    case 'luck':          d.luck += value; break
    case 'spirit_density': d.spiritDensity += value; break
    case 'crit_rate':     d.critRate += value / 100; break
    case 'crit_dmg':      d.critDmg += value / 100; break
    case 'lifesteal':     d.lifesteal += value / 100; break
    case 'dodge':         d.dodge += value / 100; break
    case 'armor_pen':     d.armorPen += value; break
    case 'accuracy':      d.accuracy += value; break
    case 'atk_pct':       d.equipAtkPct += value; break
    case 'def_pct':       d.equipDefPct += value; break
    case 'hp_pct':        d.equipHpPct += value; break
    case 'spd_pct':       d.equipSpdPct += value; break
    case 'spirit_pct':    d.weaponSpiritPct += value; break
    case 'reflect':       d.equipReflectPct += value / 100; break
    case 'wuxing_dmg':
      // 五行强化按「携带神通主属（最多者）」生效；若无神通，按装备前缀兜底
      if (dominantSkillWuxing) {
        d.elementDmg[dominantSkillWuxing] += value
      } else {
        for (const p of prefixes) d.elementDmg[p] += value
      }
      break
    // V5 专属 stat → 各自累加器（调用方接到 V4 战斗字段）
    case 'dot_dmg':       d.dotDmgPct       += value / 100; break  // 与 V4 DOT_DMG_PCT 同口径（/100）
    case 'dmg_reduction': d.dmgReductionPct += value / 100; break  // awaken.damageReduction 单位是 0~1 小数
    case 'res_pct':       d.resistAllPct    += value / 100; break  // 5 个抗性都加
    case 'lifesteal_all': d.lifestealAllPct += value / 100; break  // lifesteal 单位是 0~1 小数
  }
}

/** 把 DB 字段 wuxing_prefix 标准化成 WuxingPrefix[]（处理 string / string[] / null） */
function normalizePrefix(raw: any): WuxingPrefix[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as WuxingPrefix[]
  if (typeof raw === 'string') return [raw as WuxingPrefix]
  return []
}

/**
 * 聚合所有 V5 装备（已穿戴）的属性增量
 *
 * @param equipRows  character_equipment 全行（V4 + V5 混合，函数内部 filter）
 * @param charLingen 角色灵根（'metal'/'wood'/'water'/'fire'/'earth'，无则 null）
 */
export function computeV5EquipmentDelta(
  equipRows: readonly any[],
  charLingen: WuxingPrefix | null,
  dominantSkillWuxing: WuxingPrefix | null = null,
): V5EquipmentDelta {
  const delta = ZERO_DELTA()
  const v5Rows = equipRows.filter(eq => eq.slot && eq.equipment_version === 5)
  if (v5Rows.length === 0) return delta

  // 1) 收集所有 V5 装备的 slot_index + prefix，算五行触发 map
  const equippedForActivation: V5EquippedItem[] = []
  for (const eq of v5Rows) {
    const prefixes = normalizePrefix(eq.wuxing_prefix)
    if (prefixes.length === 0) continue
    equippedForActivation.push({
      slotIndex: getV5SlotIndexByBaseSlot(eq.base_slot as V5BaseSlot),
      prefix: prefixes.length === 1 ? prefixes[0] : prefixes,
    })
  }
  const activations = computeV5WuxingActivation(equippedForActivation)
  const actMap = new Map<number, typeof activations[number]>()
  for (const a of activations) actMap.set(a.slotIndex, a)

  // 2) 逐件装备累加 base_stat_1 + 强化词条 + 生效的五行词条
  for (const eq of v5Rows) {
    const prefixes = normalizePrefix(eq.wuxing_prefix)
    const slotIndex = getV5SlotIndexByBaseSlot(eq.base_slot as V5BaseSlot)
    const enhLv = eq.enhance_level || 0

    // 基础属性1（受强化：每级 +10%）
    if (eq.primary_stat && typeof eq.primary_value === 'number') {
      const v1 = Math.floor(eq.primary_value * (1 + enhLv * 0.10))
      applyStat(delta, eq.primary_stat, v1, prefixes, dominantSkillWuxing)
    }

    // 强化词条（sub_stats 复用 V4 字段，V5 用小写 stat key；不受强化）
    const enhAffixes = typeof eq.sub_stats === 'string' ? JSON.parse(eq.sub_stats) : (eq.sub_stats || [])
    if (Array.isArray(enhAffixes)) {
      for (const a of enhAffixes) {
        if (a && typeof a.stat === 'string' && typeof a.value === 'number') {
          applyStat(delta, a.stat, a.value, prefixes, dominantSkillWuxing)
        }
      }
    }

    // 五行词条：看激活情况
    const wuxingArr = typeof eq.wuxing_affixes === 'string' ? JSON.parse(eq.wuxing_affixes) : eq.wuxing_affixes
    const act = actMap.get(slotIndex)
    if (act && Array.isArray(wuxingArr) && wuxingArr.length === 3) {
      const flags = [act.affix_1_active, act.affix_2_active, act.affix_3_active]
      for (let i = 0; i < 3; i++) {
        if (!flags[i]) continue
        const a = wuxingArr[i]
        if (a && typeof a.stat === 'string' && typeof a.value === 'number') {
          applyStat(delta, a.stat, a.value, prefixes, dominantSkillWuxing)
        }
      }
    }
  }

  // 3) 元始天尊套装件数 → 1/3/5/7 件效果
  const yuanshiPieces = v5Rows.filter(eq => eq.legendary_set_id === 'yuanshi_tianzun').length
  delta.legendarySetEffects = getV5LegendarySetActiveEffects(yuanshiPieces)

  // 4) 灵根共鸣
  if (charLingen) {
    const resonance = computeV5LingenResonance(equippedForActivation, charLingen)
    delta.lingenBonusPct = resonance.bonus_pct
  }

  return delta
}
