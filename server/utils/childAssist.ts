// 助战子女战斗装配公共逻辑
// 抽自 fight.post.ts，供普通战斗 / 通天塔挑战共用
//   1. prepareChildAssist:   查 DB → 算 buffed（atk/def/hp/spd × passive%），异步，一次性
//   2. applyChildAssistToChar: 按 stageMul 缩放 → 挂载 char._duo_assist_* / _child_battle_*，同步，每场战斗一次
import type { Pool } from 'pg'
import { CHILD_SKILL_MAP } from '~/server/engine/childSkillData'
import { calcChildBaseStats } from '~/server/utils/child'
import type { ChildAptitude } from '~/server/engine/childTalentData'

export interface ChildAssistPrep {
  buffedAtk: number; buffedDef: number; buffedHp: number; buffedSpd: number
  stageMul: number
  childCritR: number; childCritD: number; childDodge: number
  childLs: number; childRctrl: number; childSpirit: number
  childResMetal: number; childResWood: number; childResWater: number; childResFire: number; childResEarth: number
  childRegen: number; childDmgReduction: number; childReflect: number
  childDmgShareToAssist: number
  spiritualRoot: string | null
  name: string; gender: string; aptitude: number; aptName: string; level: number
  talentsCount: number
  innateSkills: any[]
}

const STAGE_MUL: Record<string, number> = { youth: 0.5, adult_youth: 0.8, adult: 1.0 }
const APT_NAMES = ['凡品', '下品', '中品', '上品', '极品', '仙品', '圣品']

/**
 * 按 char.battling_child_id 查助战子女，组装 buffed 属性 prep。
 * 无助战 / 子女非战斗阶段 / stageMul=0 时返回 null。
 */
export async function prepareChildAssist(
  pool: Pool,
  char: { id: number; battling_child_id: number | null }
): Promise<ChildAssistPrep | null> {
  if (!char.battling_child_id) return null

  const { rows: childRows } = await pool.query(
    'SELECT aptitude, level, atk, def, max_hp, spd, stage, awakened_talents, crit_rate, crit_dmg, dodge, lifesteal, spirit, resist_ctrl, spiritual_root, learned_skills FROM children WHERE id = $1 AND character_id = $2 AND is_battling = TRUE',
    [char.battling_child_id, char.id]
  )
  if (!childRows[0]) return null

  const c = childRows[0]
  const stageMul = STAGE_MUL[c.stage] || 0
  if (stageMul <= 0) return null

  // 基础四属性即时按公式重算，避免存量子女字段不刷新
  const baseStats = calcChildBaseStats(c.aptitude as ChildAptitude, c.level)
  c.atk = baseStats.atk
  c.def = baseStats.def
  c.max_hp = baseStats.maxHp
  c.spd = baseStats.spd

  const { CHILD_TALENT_MAP } = await import('~/server/engine/childTalentData')
  const talents = Array.isArray(c.awakened_talents) ? c.awakened_talents : []
  const learnedSkills = Array.isArray(c.learned_skills) ? c.learned_skills : []
  // V2 改版：天赋 + passive 类型血脉功法共用 PassiveEffect 管线
  const allEffects: any[] = []
  for (const t of talents) {
    const def = (CHILD_TALENT_MAP as any)[t.talent_id]
    if (def?.effect) allEffects.push(def.effect)
  }
  const skillObjs: any[] = []
  for (const s of learnedSkills) {
    const def = (CHILD_SKILL_MAP as any)[s.skill_id]
    if (!def) continue
    skillObjs.push(def)
    if (def.type === 'passive' && def.effect) allEffects.push(def.effect)
  }
  let atkPct = 0, defPct = 0, hpPct = 0, spdPct = 0
  let resMetal = 0, resWood = 0, resWater = 0, resFire = 0, resEarth = 0
  let bonusCritR = 0, bonusCritD = 0, bonusDodge = 0, bonusLs = 0, bonusRctrl = 0
  let childRegen = 0, childDmgReduction = 0, childReflect = 0, childDmgShareToAssist = 0
  for (const e of allEffects) {
    atkPct += e.ATK_percent || 0
    defPct += e.DEF_percent || 0
    hpPct  += e.HP_percent  || 0
    spdPct += e.SPD_percent || 0
    resMetal += e.RESIST_METAL || 0
    resWood  += e.RESIST_WOOD  || 0
    resWater += e.RESIST_WATER || 0
    resFire  += e.RESIST_FIRE  || 0
    resEarth += e.RESIST_EARTH || 0
    bonusCritR += e.CRIT_RATE_flat || 0
    bonusCritD += e.CRIT_DMG_flat  || 0
    bonusDodge += e.DODGE_flat     || 0
    bonusLs    += e.LIFESTEAL_flat || 0
    bonusRctrl += e.RESIST_CTRL    || 0
    childRegen            += e.regen_per_turn_percent          || 0
    childDmgReduction     += e.damage_reduction_flat           || 0
    childReflect          += e.reflect_damage_percent          || 0
    childDmgShareToAssist += e.damage_share_to_assist_percent  || 0
  }

  const { rows: equipRows } = await pool.query(
    'SELECT primary_stat, sub_stats FROM child_equipment WHERE child_id = $1 AND is_equipped = TRUE',
    [char.battling_child_id]
  )
  let eqAtk = 0, eqDef = 0, eqHp = 0, eqSpd = 0
  let eqCritR = 0, eqCritD = 0, eqDodge = 0, eqLs = 0, eqRctrl = 0, eqSpirit = 0
  const addStat = (s: any) => {
    if (!s) return
    const v = Number(s.value || 0)
    switch (s.stat) {
      case 'atk':         eqAtk += v; break
      case 'def':         eqDef += v; break
      case 'max_hp':      eqHp += v; break
      case 'spd':         eqSpd += v; break
      case 'crit_rate':   eqCritR += v; break
      case 'crit_dmg':    eqCritD += v; break
      case 'dodge':       eqDodge += v; break
      case 'lifesteal':   eqLs += v; break
      case 'resist_ctrl': eqRctrl += v; break
      case 'spirit':      eqSpirit += v; break
    }
  }
  for (const er of equipRows) {
    addStat(er.primary_stat)
    for (const s of (Array.isArray(er.sub_stats) ? er.sub_stats : [])) addStat(s)
  }

  const { rows: nameRows } = await pool.query(
    'SELECT name, gender, aptitude, level FROM children WHERE id = $1',
    [char.battling_child_id]
  )
  const nm = nameRows[0] || { name: '助战', gender: 'male', aptitude: 0, level: 1 }

  return {
    buffedAtk: Math.floor((c.atk + eqAtk) * (1 + atkPct / 100)),
    buffedDef: Math.floor((c.def + eqDef) * (1 + defPct / 100)),
    buffedHp:  Math.floor((c.max_hp + eqHp) * (1 + hpPct / 100)),
    buffedSpd: Math.floor((c.spd + eqSpd) * (1 + spdPct / 100)),
    stageMul,
    childCritR:  Number(c.crit_rate || 0) + eqCritR + bonusCritR,
    childCritD:  Number(c.crit_dmg || 1) + eqCritD + bonusCritD,
    childDodge:  Number(c.dodge || 0) + eqDodge + bonusDodge,
    childLs:     Number(c.lifesteal || 0) + eqLs + bonusLs,
    childRctrl:  Number(c.resist_ctrl || 0) + eqRctrl + bonusRctrl,
    childSpirit: (c.spirit || 0) + eqSpirit,
    childResMetal: resMetal,
    childResWood:  resWood,
    childResWater: resWater,
    childResFire:  resFire,
    childResEarth: resEarth,
    childRegen, childDmgReduction, childReflect, childDmgShareToAssist,
    spiritualRoot: c.spiritual_root || null,
    name: nm.name,
    gender: nm.gender,
    aptitude: nm.aptitude,
    aptName: APT_NAMES[nm.aptitude] || '凡品',
    level: nm.level,
    talentsCount: talents.length,
    innateSkills: skillObjs,
  }
}

/**
 * 按 stageMul 缩放 prep，把 _duo_assist_stats / _duo_assist_skills / _child_battle_* 挂到 char。
 * 调用方随后用 char._duo_assist_stats 判断是否走 runDuoWaveBattle。
 * (2026-05-13 起去除 70% cap，让高资质子女可超越本体)
 */
export function attachChildAssistToChar(char: any, prep: ChildAssistPrep): void {
  const a = prep
  const assistAtk = Math.floor(a.buffedAtk * a.stageMul)
  const assistDef = Math.floor(a.buffedDef * a.stageMul)
  const assistHp  = Math.floor(a.buffedHp  * a.stageMul)
  const assistSpd = Math.floor(a.buffedSpd * a.stageMul)
  const assistCritRate = a.childCritR * a.stageMul
  const assistCritDmg  = Math.max(1, 1 + Math.max(0, a.childCritD - 1) * a.stageMul)
  const assistDodgeV   = a.childDodge * a.stageMul
  const assistLs       = a.childLs    * a.stageMul
  const assistRctrl    = a.childRctrl * a.stageMul
  const assistSpirit   = Math.floor(a.childSpirit * a.stageMul)
  const assistResMetal = a.childResMetal * a.stageMul
  const assistResWood  = a.childResWood  * a.stageMul
  const assistResWater = a.childResWater * a.stageMul
  const assistResFire  = a.childResFire  * a.stageMul
  const assistResEarth = a.childResEarth * a.stageMul

  char._duo_assist_stats = {
    name: a.name,
    maxHp: assistHp, hp: assistHp,
    atk: assistAtk, def: assistDef, spd: assistSpd,
    crit_rate: assistCritRate, crit_dmg: assistCritDmg,
    dodge: assistDodgeV, lifesteal: assistLs,
    element: a.spiritualRoot,
    resists: {
      metal: assistResMetal, wood: assistResWood, water: assistResWater,
      fire: assistResFire, earth: assistResEarth, ctrl: assistRctrl,
    },
    spirit: assistSpirit, armorPen: 0, accuracy: 0,
    regenPerTurn: a.childRegen,
    dmgReductionFlat: a.childDmgReduction,
    reflectPercent: a.childReflect,
    dmgShareFromPlayerPct: a.childDmgShareToAssist,
  }
  char._duo_assist_skills = a.innateSkills
  char._child_battle_atk = assistAtk
  char._child_battle_def = assistDef
  char._child_battle_hp = assistHp
  char._child_talents_count = a.talentsCount
  char._child_battle_label = `${a.name}·${a.aptName} Lv.${a.level}`
  char._child_battle_data = {
    name: a.name, gender: a.gender, aptitude: a.aptitude, aptitudeName: a.aptName,
    level: a.level, atk: assistAtk, def: assistDef, maxHp: assistHp, spd: assistSpd,
  }
}
