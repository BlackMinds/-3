/**
 * 完整版多人战斗引擎 · PvP 专用 (N vs N)
 *
 * 支持：
 *  - 主修/神通技能 + CD 管理
 *  - 被动技能加成（ATK%/HP%/DEF% + 元素抗性 + 回血 + 反伤 + 连击 + 暴击减伤等）
 *  - 附灵效果（焚魂/淬毒/裂魂/洗髓/回春/斩杀/不屈等）
 *  - 五行相克（金木水火土相生相克 ×1.3 / ×0.7）
 *  - 元素伤害加成 / 破甲 / 抗性 / 命中闪避
 *  - Debuff（灼烧/中毒/流血/冻结/眩晕/束缚/脆弱/降攻/封印/减速）
 *  - Buff（atk_up / def_up）
 *  - 吸血 / 反伤 / 被动触发型 DOT
 *  - 灵根共鸣（主修元素匹配灵根 ×1.2）
 *  - 神识加成（神通伤害每点 +0.1%）
 *  - 集火选敌（目标血量最低）
 *  - 击杀奖励（战意沸腾叠攻）
 *
 * 不做：
 *  - 不灭金身复活（简化 NvN 战报）
 *  - 灵脉偷袭 NPC 守卫的复杂技能池
 */

import {
  calculateDamage,
  type BattlerStats,
  type EquippedSkillInfo,
  type SkillRefInfo,
  type BattleLogEntry,
} from './battleEngine'
import type { DebuffType, BuffType } from './skillData'

// ========== 类型 ==========

interface ActiveDebuff {
  type: DebuffType
  remaining: number
  damagePerTurn: number
  value?: number
}

interface ActiveBuff {
  type: BuffType
  remaining: number
  value?: number
  valuePercent?: number
}

export interface PvpFighterInput {
  characterId: number
  sectId?: number
  stats: BattlerStats          // 完整属性（含 awaken 字段）
  equippedSkills: EquippedSkillInfo
}

// ========== PvP 平衡系数 ==========
// PvE 的属性公式在玩家 vs 怪物下是平衡的，直接搬到 PvP 会让:
// - 暴击 / AoE 神通一击制胜
// - 战斗 1-2 回合结束,玩不出技能/debuff/buff 的博弈
// 因此 PvP 引入两套独立系数,让角色更耐打、伤害更克制

export type PvpMode = '1v1' | 'team'

export interface PvpBalanceConfig {
  hpMultiplier: number       // 战斗前 HP/maxHp 放大倍数
  damageMultiplier: number   // 最终伤害缩放倍数
  dotMultiplier: number      // DOT（中毒/灼烧/流血）伤害缩放
  critDmgReduction: number   // 暴击伤害削减（0.2 = 少 20%）
}

export const PVP_BALANCE: Record<PvpMode, PvpBalanceConfig> = {
  // 单挑：保留较强的操作空间（神通 CD 博弈），战斗约 4~8 回合
  '1v1':  { hpMultiplier: 1.8, damageMultiplier: 0.6, dotMultiplier: 0.5, critDmgReduction: 0.35 },
  // 团战/偷袭：3 人 AoE 叠加在对方身上,需要更强缓冲,战斗约 5~10 回合
  'team': { hpMultiplier: 1.5, damageMultiplier: 0.5, dotMultiplier: 0.5, critDmgReduction: 0.20 },
}

export interface PvpFighter {
  characterId: number
  sectId?: number
  name: string
  element: string | null
  spiritualRoot: string | null

  // 可变属性
  maxHp: number
  hp: number
  baseAtk: number
  baseDef: number
  atk: number
  def: number
  spd: number
  crit_rate: number
  crit_dmg: number
  dodge: number
  lifesteal: number
  resists: { metal: number; wood: number; water: number; fire: number; earth: number; ctrl: number }
  elementDmg: { metal: number; wood: number; water: number; fire: number; earth: number }
  armorPen: number
  accuracy: number
  spirit: number

  // 技能
  activeSkill: SkillRefInfo
  divineSkills: SkillRefInfo[]
  divineCds: number[]
  passiveEffects: EquippedSkillInfo['passiveEffects']

  // 附灵运行时状态
  awakenState: any

  // 运行时
  alive: boolean
  debuffs: ActiveDebuff[]
  buffs: ActiveBuff[]
  frozenTurns: number
  awakenTurnCounter: number

  // 统计
  totalDmgDealt: number
  totalDmgTaken: number
  kills: number
  killStacks: number
}

export interface MultiBattleLogEntry extends BattleLogEntry {
  side?: 'a' | 'b'
  actorId?: number
  sideA_hps?: number[]
  sideB_hps?: number[]
}

export interface MultiBattleResult {
  winnerSide: 'a' | 'b'
  logs: MultiBattleLogEntry[]
  sideA: PvpFighter[]
  sideB: PvpFighter[]
  totalTurns: number
}

// ========== 常量 ==========

const DEBUFF_NAMES: Record<string, string> = {
  burn: '灼烧', poison: '中毒', bleed: '流血', freeze: '冻结',
  stun: '眩晕', slow: '减速', brittle: '脆弱', atk_down: '降攻',
  root: '束缚', silence: '封印',
}

function calcDotDamage(type: DebuffType, targetMaxHp: number, attackerAtk: number): number {
  if (type === 'poison') return Math.max(1, Math.floor(targetMaxHp * 0.03))
  if (type === 'burn') return Math.max(1, Math.floor(attackerAtk * 0.15))
  if (type === 'bleed') return Math.max(1, Math.floor(attackerAtk * 0.10))
  return 0
}

// ========== Fighter 构建 ==========

export function buildPvpFighter(input: PvpFighterInput, balance?: PvpBalanceConfig): PvpFighter {
  const s = input.stats
  const eq = input.equippedSkills
  const hpMul = balance?.hpMultiplier || 1

  // 应用被动技能加成
  const pe = eq.passiveEffects || ({} as any)
  const atkPct = Number(pe.atkPercent || 0)
  const defPct = Number(pe.defPercent || 0)
  const hpPct = Number(pe.hpPercent || 0)
  const spdPct = Number(pe.spdPercent || 0)

  const maxHp = Math.max(1, Math.floor(s.maxHp * (1 + hpPct / 100) * hpMul))
  const atk = Math.max(1, Math.floor(s.atk * (1 + atkPct / 100)))
  const def = Math.max(0, Math.floor(s.def * (1 + defPct / 100)))
  const spd = Math.max(1, Math.floor(s.spd * (1 + spdPct / 100)))

  // 抗性合并（基础 + 被动）
  const resists = {
    metal: (s.resists?.metal || 0) + (pe.resistMetal || 0) / 100,
    wood:  (s.resists?.wood  || 0) + (pe.resistWood  || 0) / 100,
    water: (s.resists?.water || 0) + (pe.resistWater || 0) / 100,
    fire:  (s.resists?.fire  || 0) + (pe.resistFire  || 0) / 100,
    earth: (s.resists?.earth || 0) + (pe.resistEarth || 0) / 100,
    ctrl:  (s.resists?.ctrl  || 0) + (pe.resistCtrl  || 0) / 100,
  }

  const fighter: PvpFighter = {
    characterId: input.characterId,
    sectId: input.sectId,
    name: s.name,
    element: s.element,
    spiritualRoot: s.spiritualRoot || s.element,

    maxHp, hp: maxHp,
    baseAtk: atk, baseDef: def, atk, def, spd,
    crit_rate: Math.max(0, Math.min(1, s.crit_rate + (pe.critRate || 0) / 100)),
    crit_dmg: Math.max(1, s.crit_dmg + (pe.critDmg || 0) / 100),
    dodge: Math.max(0, Math.min(0.6, s.dodge + (pe.dodge || 0) / 100)),
    lifesteal: Math.max(0, s.lifesteal + (pe.lifesteal || 0) / 100),
    resists,
    elementDmg: s.elementDmg || { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    armorPen: s.armorPen || 0,
    accuracy: s.accuracy || 0,
    spirit: s.spirit || 10,

    activeSkill: eq.activeSkill || { name: '基础剑法', multiplier: 1.0, element: null },
    divineSkills: eq.divineSkills || [],
    divineCds: (eq.divineSkills || []).map(() => 0),
    passiveEffects: pe,

    awakenState: {
      burnOnHitChance: s.awaken?.burnOnHitChance || 0,
      poisonOnHitChance: s.awaken?.poisonOnHitChance || 0,
      bleedOnHitChance: s.awaken?.bleedOnHitChance || 0,
      chainAttackChance: s.awaken?.chainAttackChance || 0,
      armorPenPct: s.awaken?.armorPenPct || 0,
      executeBonus: s.awaken?.executeBonus || 0,
      lowHpAtkBonus: s.awaken?.lowHpAtkBonus || 0,
      lowHpDefBonus: s.awaken?.lowHpDefBonus || 0,
      damageReduction: s.awaken?.damageReduction || 0,
      critTakenReduction: s.awaken?.critTakenReduction || 0,
      regenPerTurn: s.awaken?.regenPerTurn || 0,
      cleanseInterval: s.awaken?.cleanseInterval || 0,
      vsBossBonus: s.awaken?.vsBossBonus || 0,
      vsEliteBonus: s.awaken?.vsEliteBonus || 0,
      debuffDurationBonus: s.awaken?.debuffDurationBonus || 0,
    },

    alive: true,
    debuffs: [],
    buffs: [],
    frozenTurns: 0,
    awakenTurnCounter: 0,
    totalDmgDealt: 0,
    totalDmgTaken: 0,
    kills: 0,
    killStacks: 0,
  }

  // 开场狂怒 buff（附灵）
  if (s.awaken?.frenzyOpening && s.awaken.frenzyOpening > 0) {
    fighter.buffs.push({ type: 'atk_up' as BuffType, remaining: 4, value: s.awaken.frenzyOpening })
  }

  return fighter
}

// ========== 辅助 ==========

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

function fighterToBattlerStats(f: PvpFighter): BattlerStats {
  return {
    name: f.name,
    maxHp: f.maxHp, hp: f.hp,
    atk: f.atk, def: f.def, spd: f.spd,
    crit_rate: f.crit_rate, crit_dmg: f.crit_dmg,
    dodge: f.dodge, lifesteal: f.lifesteal,
    element: f.element,
    resists: f.resists,
    spiritualRoot: f.spiritualRoot,
    armorPen: f.armorPen,
    accuracy: f.accuracy,
    elementDmg: f.elementDmg,
    spirit: f.spirit,
    awaken: f.awakenState,
  } as any
}

function pickTarget(enemies: PvpFighter[]): PvpFighter | null {
  const alive = enemies.filter(f => f.alive)
  if (alive.length === 0) return null
  return alive.reduce((a, b) => a.hp < b.hp ? a : b)
}

function getBrittleBonus(f: PvpFighter): number {
  const b = f.debuffs.find(d => d.type === 'brittle')
  return b ? (b.value || 0.15) : 0
}

function getAtkDownMul(f: PvpFighter): number {
  const d = f.debuffs.find(d => d.type === 'atk_down')
  return d ? (1 - (d.value || 0.15)) : 1
}

function hasSilence(f: PvpFighter): boolean {
  return f.debuffs.some(d => d.type === 'silence')
}

function hasSlow(f: PvpFighter): boolean {
  return f.debuffs.some(d => d.type === 'slow')
}

// ========== 主引擎 ==========

export function runPvpBattle(
  sideAInput: PvpFighterInput[],
  sideBInput: PvpFighterInput[],
  opts: { maxTurns?: number; sideAName?: string; sideBName?: string; pvpMode?: PvpMode } = {}
): MultiBattleResult {
  // 自动判定模式：1 人 vs 1 人 → 1v1；其他 → team
  const pvpMode: PvpMode = opts.pvpMode || (sideAInput.length === 1 && sideBInput.length === 1 ? '1v1' : 'team')
  const balance = PVP_BALANCE[pvpMode]

  const sideA = sideAInput.map(f => buildPvpFighter(f, balance))
  const sideB = sideBInput.map(f => buildPvpFighter(f, balance))
  const logs: MultiBattleLogEntry[] = []
  const maxTurns = opts.maxTurns || 40
  const sideAName = opts.sideAName || 'A 方'
  const sideBName = opts.sideBName || 'B 方'

  function snap(): Pick<MultiBattleLogEntry, 'sideA_hps' | 'sideB_hps'> {
    return {
      sideA_hps: sideA.map(f => Math.max(0, f.hp)),
      sideB_hps: sideB.map(f => Math.max(0, f.hp)),
    }
  }

  function log(entry: Omit<MultiBattleLogEntry, 'sideA_hps' | 'sideB_hps'>) {
    logs.push({ ...entry, ...snap() })
  }

  log({
    turn: 0, type: 'system',
    text: `【战斗开始】${sideAName} ${sideA.length} 人 vs ${sideBName} ${sideB.length} 人`,
  })

  // === 施加 debuff ===
  function tryApplyDebuff(
    target: PvpFighter, targetName: string,
    debuff: { type: DebuffType; chance: number; duration: number; value?: number },
    attackerAtk: number, turn: number
  ): boolean {
    if (Math.random() >= debuff.chance) return false
    const isCtrl = ['freeze', 'stun', 'root', 'silence'].includes(debuff.type)
    let duration = debuff.duration
    if (isCtrl) {
      const r = Math.min(0.7, target.resists.ctrl || 0)
      if (r > 0 && Math.random() < r) {
        log({ turn, type: 'normal', text: `  ${targetName}抵抗了${DEBUFF_NAMES[debuff.type]}` })
        return false
      }
    }
    if (debuff.type === 'freeze' || debuff.type === 'stun' || debuff.type === 'root') {
      target.frozenTurns = Math.max(target.frozenTurns, duration)
      log({ turn, type: 'normal', text: `  ${targetName}被${DEBUFF_NAMES[debuff.type]} ${duration} 回合` })
      return true
    }
    // PvP DOT 缩放
    const rawDot = calcDotDamage(debuff.type, target.maxHp, attackerAtk)
    const dmg = Math.max(1, Math.floor(rawDot * balance.dotMultiplier))
    const exists = target.debuffs.find(d => d.type === debuff.type)
    if (exists) {
      exists.remaining = duration
      exists.value = debuff.value
      exists.damagePerTurn = dmg
    } else {
      target.debuffs.push({ type: debuff.type, remaining: duration, damagePerTurn: dmg, value: debuff.value })
    }
    let text = `${targetName}陷入${DEBUFF_NAMES[debuff.type]} ${duration} 回合`
    if (debuff.type === 'poison') text += ` (每回合 ${dmg} 毒伤)`
    else if (debuff.type === 'burn') text += ` (每回合 ${dmg} 火伤)`
    else if (debuff.type === 'bleed') text += ` (每回合 ${dmg} 流血)`
    else if (debuff.type === 'brittle') text += ` (受伤+${((debuff.value || 0.15) * 100).toFixed(0)}%)`
    else if (debuff.type === 'atk_down') text += ` (攻击-${((debuff.value || 0.15) * 100).toFixed(0)}%)`
    else if (debuff.type === 'slow') text += ` (必定后攻)`
    else if (debuff.type === 'silence') text += ` (无法使用神通)`
    log({ turn, type: 'normal', text: `  ${text}` })
    return true
  }

  // === tick DOT ===
  function tickDebuffs(f: PvpFighter, turn: number): number {
    let dot = 0
    for (const d of f.debuffs) {
      if (d.damagePerTurn > 0) {
        dot += d.damagePerTurn
        log({ turn, type: 'normal', text: `  ${f.name}受到${DEBUFF_NAMES[d.type]} ${d.damagePerTurn} 点伤害` })
      }
    }
    for (let i = f.debuffs.length - 1; i >= 0; i--) {
      f.debuffs[i].remaining--
      if (f.debuffs[i].remaining <= 0) {
        log({ turn, type: 'normal', text: `  ${f.name}的${DEBUFF_NAMES[f.debuffs[i].type]}效果结束` })
        f.debuffs.splice(i, 1)
      }
    }
    return dot
  }

  // === 回合开始：回春 + 洗髓 + 被动回血 ===
  function turnStartEffects(f: PvpFighter, turn: number) {
    f.awakenTurnCounter++
    const st = f.awakenState
    // 回春
    if (st.regenPerTurn > 0 && f.hp > 0 && f.hp < f.maxHp) {
      const heal = Math.max(1, Math.floor(f.maxHp * st.regenPerTurn))
      const before = f.hp
      f.hp = Math.min(f.maxHp, f.hp + heal)
      if (f.hp > before) {
        log({ turn, type: 'buff', text: `  ✦【回春】${f.name}回复 ${f.hp - before} 点气血` })
      }
    }
    // 洗髓
    if (st.cleanseInterval > 0 && f.awakenTurnCounter % st.cleanseInterval === 0) {
      if (f.frozenTurns > 0) {
        f.frozenTurns = 0
        log({ turn, type: 'buff', text: `  ✦【洗髓】${f.name}解除了控制状态` })
      } else if (f.debuffs.length > 0) {
        const silenceIdx = f.debuffs.findIndex(d => d.type === 'silence')
        const removed = silenceIdx >= 0 ? f.debuffs.splice(silenceIdx, 1)[0] : f.debuffs.shift()!
        log({ turn, type: 'buff', text: `  ✦【洗髓】${f.name}清除了 ${DEBUFF_NAMES[removed.type] || removed.type}` })
      }
    }
    // 被动回血
    if (f.passiveEffects?.regenPerTurn && f.passiveEffects.regenPerTurn > 0) {
      const heal = Math.floor(f.maxHp * f.passiveEffects.regenPerTurn)
      if (heal > 0 && f.hp < f.maxHp) {
        const actualHeal = Math.min(heal, f.maxHp - f.hp)
        f.hp += actualHeal
        log({ turn, type: 'buff', text: `  【被动回血】${f.name}回复 ${actualHeal} 点气血` })
      }
    }
  }

  // === 计算实际 atk/def（含 buff/atk_down）===
  function applyFighterBuffs(f: PvpFighter) {
    let atk = f.baseAtk
    let def = f.baseDef
    for (let i = f.buffs.length - 1; i >= 0; i--) {
      f.buffs[i].remaining--
      if (f.buffs[i].remaining <= 0) { f.buffs.splice(i, 1); continue }
    }
    for (const b of f.buffs) {
      if (b.type === 'atk_up' && b.value) atk = Math.floor(atk * (1 + b.value))
      if (b.type === 'def_up' && b.value) def = Math.floor(def * (1 + b.value))
    }
    atk = Math.floor(atk * getAtkDownMul(f))
    f.atk = atk
    f.def = def
  }

  // === 受伤处理 ===
  function applyIncomingDamage(target: PvpFighter, rawDmg: number, isCrit: boolean): number {
    let dmg = rawDmg
    // PvP 全局伤害缩放（基于 pvpMode）
    dmg = dmg * balance.damageMultiplier
    // 暴击额外削减（避免单次暴击直接秒杀）
    if (isCrit && balance.critDmgReduction > 0) {
      dmg = dmg * (1 - balance.critDmgReduction)
    }
    const brittle = getBrittleBonus(target)
    if (brittle > 0) dmg = Math.floor(dmg * (1 + brittle))
    if (target.passiveEffects?.damageReductionFlat) {
      dmg = Math.floor(dmg * (1 - target.passiveEffects.damageReductionFlat))
    }
    const st = target.awakenState
    if (st?.damageReduction > 0) dmg = Math.floor(dmg * (1 - st.damageReduction))
    if (isCrit && st?.critTakenReduction > 0) dmg = Math.floor(dmg * (1 - st.critTakenReduction))
    if (st?.lowHpDefBonus > 0 && target.maxHp > 0 && target.hp / target.maxHp < 0.30) {
      dmg = Math.floor(dmg * (1 / (1 + st.lowHpDefBonus)))
    }
    dmg = Math.max(1, Math.floor(dmg))
    target.hp -= dmg
    target.totalDmgTaken += dmg
    return dmg
  }

  // === 反伤 / 被动触发（受伤后）===
  function triggerRetaliate(attacker: PvpFighter, victim: PvpFighter, dmg: number, isCrit: boolean, turn: number) {
    const pe = victim.passiveEffects
    if (!pe) return
    if (pe.reflectPercent && pe.reflectPercent > 0) {
      const rf = Math.floor(dmg * pe.reflectPercent)
      if (rf > 0) {
        attacker.hp -= rf
        log({ turn, type: 'normal', text: `  【反伤】${victim.name} 反弹 ${rf} 点伤害给 ${attacker.name}` })
      }
    }
    if (pe.poisonOnHitTaken && Math.random() < pe.poisonOnHitTaken) {
      tryApplyDebuff(attacker, attacker.name, { type: 'poison', chance: 1, duration: 2 }, victim.atk, turn)
    }
    if (pe.burnOnHitTaken && Math.random() < pe.burnOnHitTaken) {
      tryApplyDebuff(attacker, attacker.name, { type: 'burn', chance: 1, duration: 2 }, victim.atk, turn)
    }
    if (isCrit && pe.reflectOnCrit && Math.random() < pe.reflectOnCrit) {
      const rfc = Math.floor(dmg * 0.5)
      attacker.hp -= rfc
      log({ turn, type: 'normal', text: `  【暴击反弹】${attacker.name} 受到 ${rfc} 点反震` })
    }
  }

  // === 附灵命中触发（DOT）===
  function triggerAwakenOnHit(attacker: PvpFighter, target: PvpFighter, turn: number) {
    const st = attacker.awakenState
    if (!st) return
    const durBonus = st.debuffDurationBonus || 0
    if (st.burnOnHitChance > 0 && Math.random() < st.burnOnHitChance) {
      if (tryApplyDebuff(target, target.name, { type: 'burn', chance: 1.0, duration: 2 + durBonus }, attacker.atk, turn)) {
        log({ turn, type: 'buff', text: `  ✦【焚魂】${target.name}被烈焰灼烧` })
      }
    }
    if (st.poisonOnHitChance > 0 && Math.random() < st.poisonOnHitChance) {
      if (tryApplyDebuff(target, target.name, { type: 'poison', chance: 1.0, duration: 2 + durBonus }, attacker.atk, turn)) {
        log({ turn, type: 'buff', text: `  ✦【淬毒】${target.name}中毒` })
      }
    }
    if (st.bleedOnHitChance > 0 && Math.random() < st.bleedOnHitChance) {
      if (tryApplyDebuff(target, target.name, { type: 'bleed', chance: 1.0, duration: 2 + durBonus }, attacker.atk, turn)) {
        log({ turn, type: 'buff', text: `  ✦【裂魂】${target.name}流血不止` })
      }
    }
  }

  // === 单个攻击者行动 ===
  function executeAction(attacker: PvpFighter, enemies: PvpFighter[], turn: number) {
    if (!attacker.alive || attacker.hp <= 0) return

    // 回合开始效果
    turnStartEffects(attacker, turn)
    if (!attacker.alive || attacker.hp <= 0) return

    // DOT 结算
    const dot = tickDebuffs(attacker, turn)
    if (dot > 0) {
      attacker.hp -= dot
      if (attacker.hp <= 0) {
        attacker.alive = false
        log({ turn, type: 'death', text: `  ${attacker.name} 死于持续伤害` })
        return
      }
    }

    // 应用 buff 刷新 atk/def
    applyFighterBuffs(attacker)

    // 控制检查
    if (attacker.frozenTurns > 0) {
      attacker.frozenTurns--
      log({ turn, type: 'normal', text: `[第${turn}回合] ${attacker.name} 被控制，无法行动` })
      return
    }

    // 选目标
    const target = pickTarget(enemies)
    if (!target) return

    // 选技能（神通 CD > 主修）
    let usedSkill: SkillRefInfo = attacker.activeSkill
    let isDivine = false
    const silenced = hasSilence(attacker)
    if (silenced) {
      log({ turn, type: 'normal', text: `  ${attacker.name} 被封印，无法使用神通` })
    }
    const divines = silenced ? [] : attacker.divineSkills
    const cdReduction = attacker.passiveEffects?.skillCdReduction || 0

    for (let i = 0; i < divines.length; i++) {
      if (attacker.divineCds[i] <= 0) {
        usedSkill = divines[i]
        attacker.divineCds[i] = Math.max(1, (divines[i].cdTurns || 5) - cdReduction)
        isDivine = true
        break
      }
    }
    // 所有 CD 递减
    for (let i = 0; i < attacker.divineCds.length; i++) {
      if (attacker.divineCds[i] > 0) attacker.divineCds[i]--
    }

    let mul = usedSkill.multiplier
    let rootMatched = false
    if (usedSkill.element && attacker.spiritualRoot && usedSkill.element === attacker.spiritualRoot) {
      mul *= 1.2
      rootMatched = true
    }
    if (isDivine && attacker.spirit > 0) {
      mul *= 1 + attacker.spirit * 0.001
    }

    const prefix = isDivine ? '神通发动！' : (rootMatched ? '灵根共鸣！' : '')

    // 纯 buff/治疗技能（mul = 0）
    if (mul === 0) {
      if (usedSkill.healAtkRatio) {
        const heal = Math.floor(attacker.atk * usedSkill.healAtkRatio)
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal)
        log({ turn, type: 'buff', text: `[第${turn}回合] ${prefix}${attacker.name} 施展【${usedSkill.name}】回复 ${heal} 点气血` })
      }
      if (usedSkill.buff) {
        attacker.buffs.push({
          type: usedSkill.buff.type as BuffType,
          remaining: usedSkill.buff.duration,
          value: usedSkill.buff.value,
          valuePercent: usedSkill.buff.valuePercent,
        })
        log({ turn, type: 'buff', text: `[第${turn}回合] ${prefix}${attacker.name} 获得【${usedSkill.name}】的增益效果` })
      }
      if (usedSkill.debuff && (usedSkill.isAoe || (usedSkill.targetCount && usedSkill.targetCount > 1))) {
        const targets = usedSkill.isAoe ? enemies.filter(e => e.alive) : enemies.filter(e => e.alive).slice(0, usedSkill.targetCount || 1)
        for (const t of targets) {
          tryApplyDebuff(t, t.name, usedSkill.debuff as any, attacker.atk, turn)
        }
      }
      return
    }

    // 攻击技能
    let attackTargets: PvpFighter[]
    if (usedSkill.isAoe) {
      attackTargets = enemies.filter(e => e.alive)
    } else if (usedSkill.targetCount && usedSkill.targetCount > 1) {
      attackTargets = [...enemies.filter(e => e.alive)].sort((a, b) => a.hp - b.hp).slice(0, usedSkill.targetCount)
    } else {
      attackTargets = [target]
    }
    const hits = usedSkill.hitCount || 1
    const perHitMul = mul / hits

    // 技能标签
    const targetLabel = usedSkill.isAoe ? '全体' : (attackTargets.length > 1 ? `${attackTargets.length}目标` : '')
    const hitsLabel = hits > 1 ? `${hits}段` : ''
    const skillLabel = [targetLabel, hitsLabel].filter(Boolean).join('·')

    if (skillLabel) {
      log({
        turn, type: isDivine ? 'crit' : 'normal',
        text: `[第${turn}回合] ${prefix}${attacker.name} 施展【${usedSkill.name}】(${skillLabel})`,
      })
    }

    // 注意：dealDamage 不在内部 push 吸血日志，由调用方在伤害日志后 push，
    // 避免出现"先吸血、后伤害"乃至跨回合错位的视觉问题
    const dealDamage = (t: PvpFighter, rawDmg: number, isCrit: boolean): { final: number; lifestealHeal: number } => {
      const final = applyIncomingDamage(t, rawDmg, isCrit)
      attacker.totalDmgDealt += final
      let lifestealHeal = 0
      if (attacker.lifesteal > 0 && attacker.hp > 0 && attacker.hp < attacker.maxHp) {
        const heal = Math.floor(final * attacker.lifesteal)
        if (heal > 0) {
          lifestealHeal = Math.min(heal, attacker.maxHp - attacker.hp)
          attacker.hp += lifestealHeal
        }
      }
      return { final, lifestealHeal }
    }

    if (hits > 1 && attackTargets.length === 1) {
      // 多段单体
      for (let h = 0; h < hits; h++) {
        const liveTarget = attackTargets[0].alive ? attackTargets[0] : pickTarget(enemies)
        if (!liveTarget) break
        const dr = calculateDamage(fighterToBattlerStats(attacker), fighterToBattlerStats(liveTarget), perHitMul, usedSkill.element, usedSkill.ignoreDef)
        if (dr.damage === 0) {
          log({ turn, type: 'dodge', text: `  第 ${h + 1} 段 被 ${liveTarget.name} 闪避` })
        } else {
          const { final, lifestealHeal } = dealDamage(liveTarget, dr.damage, dr.isCrit)
          const critText = dr.isCrit ? '暴击! ' : ''
          log({ turn, type: dr.isCrit ? 'crit' : 'normal', text: `  第 ${h + 1} 段 ${critText}对 ${liveTarget.name} 造成 ${final} 伤害` })
          if (lifestealHeal > 0) log({ turn, type: 'buff', text: `  【吸血】${attacker.name} 回复 ${lifestealHeal} 点气血` })
          if (usedSkill.debuff) tryApplyDebuff(liveTarget, liveTarget.name, usedSkill.debuff as any, attacker.atk, turn)
          triggerAwakenOnHit(attacker, liveTarget, turn)
          triggerRetaliate(attacker, liveTarget, final, dr.isCrit, turn)
          if (liveTarget.hp <= 0) liveTarget.alive = false
        }
      }
    } else {
      // AoE / 多目标 / 单体
      for (const t of attackTargets) {
        if (!t.alive) continue
        const dr = calculateDamage(fighterToBattlerStats(attacker), fighterToBattlerStats(t), mul, usedSkill.element, usedSkill.ignoreDef)
        if (dr.damage === 0) {
          log({ turn, type: 'dodge', text: `  ${t.name} 闪避了 ${attacker.name} 的攻击` })
          continue
        }
        const { final, lifestealHeal } = dealDamage(t, dr.damage, dr.isCrit)
        const critText = dr.isCrit ? '暴击! ' : ''
        if (skillLabel) {
          log({ turn, type: dr.isCrit ? 'crit' : 'normal', text: `  ${critText}对 ${t.name} 造成 ${final} 伤害` })
        } else {
          log({ turn, type: dr.isCrit ? 'crit' : 'normal', text: `[第${turn}回合] ${prefix}${critText}${attacker.name} 【${usedSkill.name}】对 ${t.name} 造成 ${final} 伤害` })
        }
        if (lifestealHeal > 0) log({ turn, type: 'buff', text: `  【吸血】${attacker.name} 回复 ${lifestealHeal} 点气血` })
        if (usedSkill.debuff) tryApplyDebuff(t, t.name, usedSkill.debuff as any, attacker.atk, turn)
        triggerAwakenOnHit(attacker, t, turn)
        triggerRetaliate(attacker, t, final, dr.isCrit, turn)
        if (t.hp <= 0) t.alive = false
      }

      // 连击（附灵）- 仅主修
      const st = attacker.awakenState
      if (st?.chainAttackChance > 0 && usedSkill === attacker.activeSkill) {
        if (Math.random() < st.chainAttackChance) {
          const chainT = pickTarget(enemies)
          if (chainT) {
            const dr = calculateDamage(fighterToBattlerStats(attacker), fighterToBattlerStats(chainT), mul * 0.6, usedSkill.element, usedSkill.ignoreDef)
            if (dr.damage > 0) {
              const { final, lifestealHeal } = dealDamage(chainT, dr.damage, dr.isCrit)
              log({ turn, type: 'buff', text: `  ✦【连击】${attacker.name} 再次出手，对 ${chainT.name} 造成 ${final} 伤害` })
              if (lifestealHeal > 0) log({ turn, type: 'buff', text: `  【吸血】${attacker.name} 回复 ${lifestealHeal} 点气血` })
              if (chainT.hp <= 0) chainT.alive = false
            }
          }
        }
      }
    }

    // 击杀结算
    for (const t of attackTargets) {
      if (!t.alive && t.hp <= 0) {
        attacker.kills++
        log({ turn, type: 'kill', text: `💀 ${t.name} 被 ${attacker.name} 击败！` })
        // 战意沸腾
        const atkPerKill = (attacker.passiveEffects as any)?.atkPerKillPercent
        const maxStacks = (attacker.passiveEffects as any)?.maxStacks || 8
        if (atkPerKill > 0 && attacker.killStacks < maxStacks) {
          attacker.killStacks++
          attacker.baseAtk = Math.floor(attacker.baseAtk * (1 + atkPerKill / 100))
          log({ turn, type: 'buff', text: `  [战意沸腾] ${attacker.name} 攻击提升！叠层 ${attacker.killStacks}/${maxStacks}` })
        }
      }
    }
  }

  // === 主循环 ===
  for (let turn = 1; turn <= maxTurns; turn++) {
    // 按速度排序所有存活单位
    const all: { fighter: PvpFighter; side: 'a' | 'b' }[] = []
    for (const f of sideA) if (f.alive) all.push({ fighter: f, side: 'a' })
    for (const f of sideB) if (f.alive) all.push({ fighter: f, side: 'b' })
    all.sort((x, y) => {
      const aSlow = hasSlow(x.fighter) ? 1 : 0
      const bSlow = hasSlow(y.fighter) ? 1 : 0
      if (aSlow !== bSlow) return aSlow - bSlow
      return y.fighter.spd - x.fighter.spd
    })

    for (const unit of all) {
      if (!unit.fighter.alive) continue
      const enemies = unit.side === 'a' ? sideB : sideA
      executeAction(unit.fighter, enemies, turn)
      // 检查战斗结束
      const aAlive = sideA.some(f => f.alive)
      const bAlive = sideB.some(f => f.alive)
      if (!aAlive || !bAlive) {
        const winner: 'a' | 'b' = aAlive ? 'a' : 'b'
        log({ turn, type: 'system', text: `【战斗结束】${winner === 'a' ? sideAName : sideBName} 胜利！` })
        return { winnerSide: winner, logs, sideA, sideB, totalTurns: turn }
      }
    }
  }

  // 超时按剩余总血量判定
  const aHp = sideA.reduce((s, f) => s + Math.max(0, f.hp), 0)
  const bHp = sideB.reduce((s, f) => s + Math.max(0, f.hp), 0)
  const winner: 'a' | 'b' = aHp >= bHp ? 'a' : 'b'
  log({ turn: maxTurns, type: 'system', text: `【战斗超时】按剩余血量判定 ${winner === 'a' ? sideAName : sideBName} 胜利（${sideAName} ${aHp} HP / ${sideBName} ${bHp} HP）` })
  return { winnerSide: winner, logs, sideA, sideB, totalTurns: maxTurns }
}

// ========== 兼容层：保留旧 SimpleStatsInput 接口（用于 NPC 守脉鬼差） ==========

export interface SimpleStatsInput {
  characterId: number
  name: string
  maxHp: number
  atk: number
  def: number
  spd: number
  crit_rate: number
  crit_dmg: number
  dodge: number
  lifesteal: number
  element?: string | null
}

export function simpleInputToPvp(s: SimpleStatsInput): PvpFighterInput {
  return {
    characterId: s.characterId,
    stats: {
      name: s.name, maxHp: s.maxHp, hp: s.maxHp,
      atk: s.atk, def: s.def, spd: s.spd,
      crit_rate: s.crit_rate, crit_dmg: s.crit_dmg,
      dodge: s.dodge, lifesteal: s.lifesteal,
      element: s.element || null,
      resists: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0.10 },
      spiritualRoot: s.element || null,
      armorPen: 0, accuracy: 0,
      elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
      spirit: 0,
    } as BattlerStats,
    equippedSkills: {
      activeSkill: { name: '基础攻击', multiplier: 1.0, element: s.element || null },
      divineSkills: [],
      passiveEffects: {
        atkPercent: 0, defPercent: 0, hpPercent: 0, spdPercent: 0,
        critRate: 0, critDmg: 0, dodge: 0, lifesteal: 0,
        resistFire: 0, resistWater: 0, resistWood: 0, resistMetal: 0, resistEarth: 0, resistCtrl: 0,
        regenPerTurn: 0, damageReductionFlat: 0, reflectPercent: 0,
      },
    },
  }
}

/**
 * 兼容旧接口（sectWarEngine / raid.post.ts 原本调用的 runMultiBattle）
 * 底层转发到完整版 runPvpBattle
 */
export function runMultiBattle(
  sideA: SimpleStatsInput[],
  sideB: SimpleStatsInput[],
  opts: { maxTurns?: number } = {}
): MultiBattleResult {
  return runPvpBattle(sideA.map(simpleInputToPvp), sideB.map(simpleInputToPvp), opts)
}
