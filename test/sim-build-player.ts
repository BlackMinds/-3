/**
 * 模拟器: 根据 build 描述构建玩家战斗属性
 * 对应真实逻辑见 server/api/battle/fight.post.ts 的 buildPlayerStats
 *
 * 简化:
 * - 副属性: 按"期望值"算, 而不是实际 roll (期望 = 每件装备 4 条 × 各档概率 × 平均值)
 * - 丹药: 默认按"全部百分比丹药 40% cap 满配"
 * - 功法被动: 选最有代表性的 3 个(swift_step / crit_master / poison_body)
 * - 附灵: 按 weapon/armor/pendant 三槽各配最强组合
 */

import {
  EQUIP_PRIMARY_BASE, RARITY_STAT_MUL, ENHANCE_MUL_PER_LEVEL,
  WEAPON_BONUS, PLAYER_CAPS, PILL_PCT_CAP, PASSIVE_PCT_CAP,
  getRealmBonusAtLevel, getLevelStatGain,
} from '../shared/balance'

export interface PlayerBuild {
  level: number          // 1-200
  realmTier: number      // 1-8
  realmStage: number     // 1-10
  equipTier: number      // 装备 tier 1-10
  equipRarity: 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'red'
  enhanceLevel: number   // 0-10
  weaponType?: 'sword' | 'blade' | 'spear' | 'fan'
  skillLevel: number     // 0-5 (0 = 不装功法, 5 = 满级)
  awakenRarity?: 'blue' | 'purple' | 'gold' | 'red' | null // 附灵品质(三槽统一)
  pillFull?: boolean     // 是否吃满丹药 (40% cap 全配)
}

export interface PlayerStats {
  atk: number; def: number; maxHp: number; spd: number
  critRate: number; critDmg: number
  dodge: number; lifesteal: number
  armorPen: number; accuracy: number
  // debug
  rawBeforeCap: {
    critRate: number; critDmg: number; dodge: number
    lifesteal: number; armorPen: number; accuracy: number
  }
  sources: Record<string, any> // 各来源贡献记录
}

// 品质 idx 映射
const RARITY_IDX: Record<string, number> = {
  white: 0, green: 1, blue: 2, purple: 3, gold: 4, red: 5,
}

// 附灵"最强组合"红品上限数值 (aw_keen + aw_evasion + aw_doom + aw_crit_bonus + aw_bloodlust + aw_pierce + aw_accuracy 等)
// 这里做了个"理想极限 build"的假设,玩家把对应属性的附灵都装上
const AWAKEN_VALUES: Record<string, {
  critRate: number; critDmg: number; dodge: number
  lifesteal: number; armorPen: number; accuracy: number
  atkPct: number; defPct: number; hpPct: number; spdPct: number
}> = {
  blue:   { critRate: 0.03, critDmg: 0.25, dodge: 0.03, lifesteal: 0.03, armorPen: 0.05, accuracy: 5,  atkPct: 0.05, defPct: 0.06, hpPct: 0.06, spdPct: 0.06 },
  purple: { critRate: 0.05, critDmg: 0.43, dodge: 0.05, lifesteal: 0.05, armorPen: 0.08, accuracy: 8,  atkPct: 0.08, defPct: 0.10, hpPct: 0.10, spdPct: 0.10 },
  gold:   { critRate: 0.08, critDmg: 0.68, dodge: 0.07, lifesteal: 0.07, armorPen: 0.12, accuracy: 12, atkPct: 0.12, defPct: 0.15, hpPct: 0.15, spdPct: 0.15 },
  red:    { critRate: 0.12, critDmg: 1.00, dodge: 0.10, lifesteal: 0.10, armorPen: 0.18, accuracy: 18, atkPct: 0.18, defPct: 0.22, hpPct: 0.22, spdPct: 0.22 },
}

// 副属性池每条"期望值" (按 weight 加权抽样后 × qualityMul/tierMul)
// 23 条属性,权重总和 = 7×20 + 10×10 + 5×10 = 290 (v3.0 weight 调整后)
// 每条期望命中率 = weight / total × 有效抽样数
// 简化: 每装备 4 条副属性 × 7 槽 = 28 词条槽, 按期望分布 7 件装备合计贡献:
//   CRIT_RATE:  28 × (10/290) × (平均 2) = 1.9 条 × 平均值 ≈ 4-5% (各档品质单条贡献后)
// 这里直接按"平均出现次数 × 平均数值"计算期望
function getSubStatExpected(rarityIdx: number, tier: number): {
  atk: number; def: number; hp: number; spd: number; spirit: number
  critRate: number; critDmg: number; lifesteal: number; dodge: number
  armorPen: number; accuracy: number
  atkPct: number; defPct: number; hpPct: number; spdPct: number
} {
  const qualityMul = 1 + rarityIdx * 0.15
  const tierMul = 1 + (tier - 1) * 0.1
  // 装备数 = 7, 每件副属性数 (白0/绿1/蓝2/紫3/金4/红4 对应)
  const subsPerEquip = [0, 1, 2, 3, 4, 4][rarityIdx]
  const totalSlots = 7 * subsPerEquip
  // 权重总和 = 7×20 + 10×10 + 5×10 = 290
  const totalWeight = 290

  // 期望某属性出现次数 = totalSlots × (weight / totalWeight)
  // 单条期望数值 = (min+max)/2 × qualityMul [× tierMul 如果是 flat]
  const avgFlat = (min: number, max: number) => (min + max) / 2 * qualityMul * tierMul
  const avgPct  = (min: number, max: number) => (min + max) / 2 * qualityMul
  const countFlatW20 = totalSlots * (20 / totalWeight)
  const countPctW10 = totalSlots * (10 / totalWeight)
  const countPctW10Good = totalSlots * (10 / totalWeight) // 好词条 weight 也是 10 (v3.0)

  return {
    atk:     avgFlat(3, 20)  * countFlatW20,  // w20
    def:     avgFlat(2, 15)  * countFlatW20,
    hp:      avgFlat(15, 100)* countFlatW20,
    spd:     avgFlat(1, 8)   * countFlatW20,
    spirit:  avgFlat(1, 6)   * countFlatW20,
    critRate:  avgPct(1, 3)  * countPctW10Good,
    critDmg:   avgPct(2, 8)  * countPctW10Good, // v3.4: max 10→8
    lifesteal: avgPct(1, 1)  * countPctW10Good, // v3.4: max 2→1
    dodge:     avgPct(1, 1)  * countPctW10Good, // v3.4: max 2→1
    armorPen:  avgPct(1, 5)  * countPctW10Good,
    accuracy:  avgPct(1, 2)  * countPctW10,     // v3.4: max 3→2
    atkPct:    avgPct(1, 3)  * countPctW10,
    defPct:    avgPct(1, 3)  * countPctW10,
    hpPct:     avgPct(1, 4)  * countPctW10,
    spdPct:    avgPct(1, 2)  * countPctW10,
  }
}

export function buildPlayer(build: PlayerBuild): PlayerStats {
  const sources: Record<string, any> = {}

  // ===== 基础属性(假设金灵根) =====
  let atk = 58, def = 30, maxHp = 500, spd = 20
  let critRate = 0.05, critDmg = 1.0, dodge = 0, lifesteal = 0
  let armorPen = 0, accuracy = 0
  sources.base = { atk, def, maxHp, spd, critRate, critDmg }

  // ===== 等级加成(flat) =====
  let lvAtk = 0, lvDef = 0, lvHp = 0, lvSpd = 0
  for (let i = 1; i < build.level; i++) {
    const g = getLevelStatGain(i + 1)
    lvAtk += g.atk; lvDef += g.def; lvHp += g.hp; lvSpd += g.spd
  }
  atk += lvAtk; def += lvDef; maxHp += lvHp; spd += lvSpd
  sources.level = { atk: lvAtk, def: lvDef, hp: lvHp, spd: lvSpd }

  // ===== 境界加成 =====
  const realm = getRealmBonusAtLevel(build.realmTier, build.realmStage)
  atk += realm.atk; def += realm.def; maxHp += realm.hp; spd += realm.spd
  critRate += realm.crit_rate; critDmg += realm.crit_dmg; dodge += realm.dodge
  sources.realm_flat = { atk: realm.atk, def: realm.def, hp: realm.hp, spd: realm.spd }
  sources.realm_pct_added_to_special = { critRate: realm.crit_rate, critDmg: realm.crit_dmg, dodge: realm.dodge }

  // ===== 装备主属性(7 槽,按 slot 分配) =====
  // 槽位主属性: weapon=ATK, armor=DEF, helmet=HP, boots=SPD, treasure=ATK, ring=CRIT_RATE, pendant=SPIRIT
  const rarityIdx = RARITY_IDX[build.equipRarity]
  const rarityMul = RARITY_STAT_MUL[rarityIdx]
  const enhanceMul = 1 + build.enhanceLevel * ENHANCE_MUL_PER_LEVEL
  function primary(stat: string): number {
    return Math.floor((EQUIP_PRIMARY_BASE[stat] || 30) * build.equipTier * rarityMul * enhanceMul)
  }
  const equipAtk1 = primary('ATK')   // weapon
  const equipAtk2 = primary('ATK')   // treasure
  const equipDef  = primary('DEF')   // armor
  const equipHp   = primary('HP')    // helmet
  const equipSpd  = primary('SPD')   // boots
  const equipCrit = primary('CRIT_RATE') / 100  // ring
  atk += equipAtk1 + equipAtk2; def += equipDef; maxHp += equipHp; spd += equipSpd
  critRate += equipCrit
  sources.equip_primary = { atk: equipAtk1 + equipAtk2, def: equipDef, hp: equipHp, spd: equipSpd, critRate: equipCrit }

  // ===== 装备副属性(期望值) =====
  const sub = getSubStatExpected(rarityIdx, build.equipTier)
  atk += sub.atk; def += sub.def; maxHp += sub.hp; spd += sub.spd
  critRate += sub.critRate / 100
  critDmg += sub.critDmg / 100
  lifesteal += sub.lifesteal / 100
  dodge += sub.dodge / 100
  armorPen += sub.armorPen
  accuracy += sub.accuracy
  sources.equip_sub = sub

  // ===== 武器类型加成 =====
  let equipAtkPctTotal = sub.atkPct
  let equipDefPctTotal = sub.defPct
  let equipHpPctTotal = sub.hpPct
  let equipSpdPctTotal = sub.spdPct
  if (build.weaponType && WEAPON_BONUS[build.weaponType]) {
    const wb = WEAPON_BONUS[build.weaponType]
    equipAtkPctTotal += wb.ATK_pct || 0
    equipSpdPctTotal += wb.SPD_pct || 0
    critRate += (wb.CRIT_RATE_flat || 0) / 100
    critDmg += (wb.CRIT_DMG_flat || 0) / 100
    lifesteal += (wb.LIFESTEAL_flat || 0) / 100
    sources.weapon = wb
  }

  // 应用装备百分比
  atk = Math.floor(atk * (1 + equipAtkPctTotal / 100))
  def = Math.floor(def * (1 + equipDefPctTotal / 100))
  maxHp = Math.floor(maxHp * (1 + equipHpPctTotal / 100))
  spd = Math.floor(spd * (1 + equipSpdPctTotal / 100))

  // ===== 境界百分比 =====
  if (realm.hp_pct > 0) maxHp = Math.floor(maxHp * (1 + realm.hp_pct / 100))
  if (realm.atk_pct > 0) atk = Math.floor(atk * (1 + realm.atk_pct / 100))
  if (realm.def_pct > 0) def = Math.floor(def * (1 + realm.def_pct / 100))

  // ===== 功法被动(Lv=build.skillLevel,3 个核心: swift_step + crit_master + poison_body) =====
  if (build.skillLevel > 0) {
    const lvMul = 1 + (build.skillLevel - 1) * 0.15
    // swift_step: dodge 0.06 + critRate 0.05
    dodge += 0.06 * lvMul
    critRate += 0.05 * lvMul
    // crit_master: critRate 0.08 + critDmg 0.22
    critRate += 0.08 * lvMul
    critDmg += 0.22 * lvMul
    // poison_body: lifesteal 0.04
    lifesteal += 0.04 * lvMul
    sources.skills_passive_Lv = build.skillLevel
  }

  // ===== 丹药 (40% cap 满配) =====
  if (build.pillFull) {
    atk = Math.floor(atk * (1 + PILL_PCT_CAP))
    def = Math.floor(def * (1 + PILL_PCT_CAP))
    maxHp = Math.floor(maxHp * (1 + PILL_PCT_CAP))
    critRate += 0.03 // basic_crit_pill 估算
    sources.pill_full = true
  }

  // ===== 附灵 =====
  if (build.awakenRarity) {
    const aw = AWAKEN_VALUES[build.awakenRarity]
    atk = Math.floor(atk * (1 + aw.atkPct))
    def = Math.floor(def * (1 + aw.defPct))
    maxHp = Math.floor(maxHp * (1 + aw.hpPct))
    spd = Math.floor(spd * (1 + aw.spdPct))
    critRate += aw.critRate
    critDmg += aw.critDmg
    dodge += aw.dodge
    lifesteal += aw.lifesteal
    armorPen += aw.armorPen * 100 // 转为 armorPen flat (battleEngine 会除 100)
    accuracy += aw.accuracy
    sources.awaken = build.awakenRarity
  }

  // ===== 记录原始值 + 应用 cap =====
  const rawBeforeCap = {
    critRate, critDmg, dodge, lifesteal, armorPen, accuracy,
  }
  const cappedCritRate  = Math.min(PLAYER_CAPS.critRate, critRate)
  const cappedCritDmg   = Math.min(PLAYER_CAPS.critDmg, critDmg)
  const cappedDodge     = Math.min(PLAYER_CAPS.dodge, dodge)
  const cappedLifesteal = Math.min(PLAYER_CAPS.lifesteal, lifesteal)
  const cappedArmorPen  = Math.min(PLAYER_CAPS.armorPen, armorPen)
  const cappedAccuracy  = Math.min(PLAYER_CAPS.accuracy, accuracy)

  return {
    atk, def, maxHp, spd,
    critRate: cappedCritRate,
    critDmg: cappedCritDmg,
    dodge: cappedDodge,
    lifesteal: cappedLifesteal,
    armorPen: cappedArmorPen,
    accuracy: cappedAccuracy,
    rawBeforeCap,
    sources,
  }
}
