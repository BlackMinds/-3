// 子女专属功法 - 设计文档 5.7.2 → V2 改版（2026-05-14）
// 30 个独有功法（6 类 × 5 品质等级）+ 多槽位 + 嘲讽/减益新类型
// V2 改版要点：
//   - 类型扩展：在原 attack/tank/heal/buff 基础上 + taunt（嘲讽）+ debuff（减益）
//   - 多槽位：Lv.1/100/200 三个槽，圣品额外 Lv.300 第 4 槽（详见 child.ts unlockSkillSlotsIfNeeded）
//   - 重铸：消耗『血脉重铸丹』可重抽指定槽位（详见 /api/child/reroll-skill）
// 字段对齐 server/engine/skillData.ts: Skill 接口；ChildSkill 额外支持 extraDebuffs 多 debuff

import type { Skill, SkillDebuff } from './skillData'
import type { SpiritualRoot } from './companionData'

export type ChildSkillType = 'attack' | 'tank' | 'heal' | 'buff' | 'taunt' | 'debuff'

export interface ChildSkill extends Skill {
  childType: ChildSkillType
  /** 附加 debuff 列表（紫品蚀魂术 / 红品大道无常等多 debuff 功法用）— duoBattleEngine 识别 */
  extraDebuffs?: SkillDebuff[]
  /** 嘲讽生效回合数（仅 childType='taunt' 用） */
  tauntDuration?: number
  /** 嘲讽期间受到伤害减免比例（替父挡灾） */
  tauntDmgReductionPct?: number
  /** 嘲讽期间受到伤害转化玩家护盾比例（替罪金身） */
  tauntShieldShareToPlayerPct?: number
  /** 段数随机范围 [lo, hi]（如 [3, 8] 表示每次 cast 随机 3~8 段）；
   *  设置后 multiplier 表示**单段**倍率，duoBattleEngine 优先于 hitCount */
  hitCountRange?: [number, number]
}

// ============================================================
// 16 个专属功法
// ============================================================

export const CHILD_SKILLS: ChildSkill[] = [
  // ---------- 攻击型 (Attack · 5) ----------
  {
    id: 'ch_atk_green', name: '童子拳', type: 'active', rarity: 'green', element: null,
    multiplier: 1.10, description: '造成 110% 攻击伤害',
    childType: 'attack',
  },
  {
    id: 'ch_atk_blue', name: '流星指', type: 'active', rarity: 'blue', element: null,
    multiplier: 1.30, description: '造成 130% 攻击伤害，30% 流血 2 回合',
    debuff: { type: 'bleed', chance: 0.30, duration: 2 },
    childType: 'attack',
  },
  {
    id: 'ch_atk_purple', name: '破云箭', type: 'active', rarity: 'purple', element: 'metal',
    multiplier: 1.65, description: '造成 165% 金属性伤害（穿甲 8%）',
    ignoreDef: 0.08,
    childType: 'attack',
  },
  {
    id: 'ch_atk_gold', name: '万流归宗', type: 'divine', rarity: 'gold', element: 'metal',
    multiplier: 2.40, cdTurns: 8,
    description: '[3 段] 单体 3×80% 伤害，每段 35% 流血',
    debuff: { type: 'bleed', chance: 0.35, duration: 3 },
    hitCount: 3,
    childType: 'attack',
  },
  {
    id: 'ch_atk_red', name: '神童剑意', type: 'divine', rarity: 'red', element: 'metal',
    multiplier: 3.80, cdTurns: 10,
    description: '造成 380% 金属性伤害，40% 眩晕 1 回合',
    debuff: { type: 'stun', chance: 0.40, duration: 1 },
    childType: 'attack',
  },
  {
    // V2.1 新增：连击型红品攻击功法（与神童剑意"单段爆发+控制"形成路线分化）
    id: 'ch_atk_red2', name: '乱舞剑诀', type: 'divine', rarity: 'red', element: 'metal',
    multiplier: 0.80, cdTurns: 10,
    description: '[3-8 段随机] 单体每段 80% 金属性伤害（期望 ~440%），30% 流血 3 回合',
    hitCount: 5,                  // duoBattleEngine 不识别 hitCountRange 时的兜底
    hitCountRange: [3, 8],        // 实际段数每次 cast 在 [3,8] 间随机
    debuff: { type: 'bleed', chance: 0.30, duration: 3 },
    childType: 'attack',
  },

  // ---------- 肉盾型 (Tank · 5) ----------
  {
    id: 'ch_tank_green', name: '顽石身', type: 'passive', rarity: 'green', element: 'earth',
    multiplier: 0, description: '防御 +6%，气血 +5%',
    effect: { DEF_percent: 6, HP_percent: 5 },
    childType: 'tank',
  },
  {
    id: 'ch_tank_blue', name: '厚土护体', type: 'passive', rarity: 'blue', element: 'earth',
    multiplier: 0, description: '防御 +10%，气血 +8%，土抗 +10%',
    effect: { DEF_percent: 10, HP_percent: 8, RESIST_EARTH: 0.10 },
    childType: 'tank',
  },
  {
    id: 'ch_tank_purple', name: '不动金身', type: 'passive', rarity: 'purple', element: 'earth',
    multiplier: 0, description: '防御 +14%，气血 +12%，受伤减免 5%',
    effect: { DEF_percent: 14, HP_percent: 12, damage_reduction_flat: 0.05 },
    childType: 'tank',
  },
  {
    id: 'ch_tank_gold', name: '父母庇护', type: 'divine', rarity: 'gold', element: 'earth',
    multiplier: 0, cdTurns: 8,
    description: '护盾：吸收 200% 攻击力的伤害，持续 4 回合',
    buff: { type: 'shield', duration: 4, value: 2.0 },
    childType: 'tank',
  },
  {
    id: 'ch_tank_red', name: '不灭血脉', type: 'passive', rarity: 'red', element: 'earth',
    multiplier: 0, description: '防御 +18%，气血 +15%，致命伤害复活一次（保留 30% 气血）',
    effect: { DEF_percent: 18, HP_percent: 15, revive_once: true },
    childType: 'tank',
  },

  // ---------- 回复型 (Heal · 5) ----------
  {
    id: 'ch_heal_green', name: '春芽回元', type: 'passive', rarity: 'green', element: 'wood',
    multiplier: 0, description: '每回合回 1% 气血',
    effect: { regen_per_turn_percent: 0.01 },
    childType: 'heal',
  },
  {
    id: 'ch_heal_blue', name: '灵泉术·童', type: 'divine', rarity: 'blue', element: 'water',
    multiplier: 0, cdTurns: 7,
    description: '回复 100% 攻击力气血给父母（玩家本体）',
    healAtkRatio: 1.0,
    childType: 'heal',
  },
  {
    id: 'ch_heal_purple', name: '万木同生', type: 'divine', rarity: 'purple', element: 'wood',
    multiplier: 0, cdTurns: 8,
    description: '回复 150% 攻击力气血给全队 + 每回合回 2% 持续 3 回合',
    healAtkRatio: 1.5, isAoe: true,
    buff: { type: 'regen', duration: 3, valuePercent: 0.02 },
    childType: 'heal',
  },
  {
    id: 'ch_heal_gold', name: '妙手回春', type: 'passive', rarity: 'gold', element: 'wood',
    multiplier: 0, description: '受到治疗 +30%，每回合回 1.5% 气血，木抗 +10%',
    effect: { heal_amplifier_percent: 30, regen_per_turn_percent: 0.015, RESIST_WOOD: 0.10 },
    childType: 'heal',
  },
  {
    id: 'ch_heal_red', name: '生生不息·血脉', type: 'divine', rarity: 'red', element: 'wood',
    multiplier: 0, cdTurns: 10,
    description: '回复 250% 攻击力气血给全队 + 每回合回 3% 持续 4 回合',
    healAtkRatio: 2.5, isAoe: true,
    buff: { type: 'regen', duration: 4, valuePercent: 0.03 },
    childType: 'heal',
  },

  // ---------- Buff 型 (Buff · 5) ----------
  // 注意：MVP 阶段单 buff，红品多 buff 需要引擎层支持 buff 数组（详见文档 5.7.2 备注）
  {
    id: 'ch_buff_green', name: '鼓舞', type: 'divine', rarity: 'green', element: null,
    multiplier: 0, cdTurns: 6,
    description: '给父母 atk +10%，持续 3 回合',
    buff: { type: 'atk_up', duration: 3, value: 0.10 },
    childType: 'buff',
  },
  {
    id: 'ch_buff_blue', name: '灵犀', type: 'divine', rarity: 'blue', element: null,
    multiplier: 0, cdTurns: 7,
    description: '给父母 spd +20%，持续 3 回合',
    buff: { type: 'spd_up', duration: 3, value: 0.20 },
    childType: 'buff',
  },
  {
    id: 'ch_buff_purple', name: '战意激发', type: 'divine', rarity: 'purple', element: null,
    multiplier: 0, cdTurns: 8,
    description: '给父母 atk +25%，crit_rate +8%，持续 4 回合',
    buff: { type: 'atk_up', duration: 4, value: 0.25 },
    childType: 'buff',
  },
  {
    id: 'ch_buff_gold', name: '削敌锋芒', type: 'divine', rarity: 'gold', element: null,
    multiplier: 0, cdTurns: 8, isAoe: true,
    description: '[群攻] 全体敌人 atk -20% 持续 3 回合',
    debuff: { type: 'atk_down', chance: 1.0, duration: 3, value: 0.20 },
    childType: 'buff',
  },
  {
    id: 'ch_buff_red', name: '同心同力', type: 'divine', rarity: 'red', element: null,
    multiplier: 0, cdTurns: 10,
    description: '给父母 atk +35%，def +20%，crit_rate +10%，crit_dmg +30%，持续 5 回合（MVP 仅生效 atk +35%，多 buff 待引擎扩展）',
    buff: { type: 'atk_up', duration: 5, value: 0.35 },
    childType: 'buff',
  },

  // ---------- 嘲讽型 (Taunt · 5) ----------
  {
    id: 'ch_taunt_green', name: '引仇术', type: 'divine', rarity: 'green', element: 'earth',
    multiplier: 0, cdTurns: 6,
    description: '[群嘲] 吸引全体敌人攻击自己 1 回合，自身获得护盾抵挡 1 次伤害',
    buff: { type: 'shield', duration: 1, value: 1.0 },
    isAoe: true, tauntDuration: 1,
    childType: 'taunt',
  },
  {
    id: 'ch_taunt_blue', name: '替父挡灾', type: 'divine', rarity: 'blue', element: 'earth',
    multiplier: 0, cdTurns: 7,
    description: '[群嘲] 嘲讽全体敌人 2 回合，期间自身受到伤害减免 20%',
    isAoe: true, tauntDuration: 2, tauntDmgReductionPct: 0.20,
    childType: 'taunt',
  },
  {
    id: 'ch_taunt_purple', name: '替罪金身', type: 'divine', rarity: 'purple', element: 'earth',
    multiplier: 0, cdTurns: 8,
    description: '[群嘲] 嘲讽全体敌人 2 回合，期间受到伤害的 50% 转化为玩家护盾',
    isAoe: true, tauntDuration: 2, tauntShieldShareToPlayerPct: 0.50,
    childType: 'taunt',
  },
  {
    id: 'ch_taunt_gold', name: '万怨归身', type: 'divine', rarity: 'gold', element: 'earth',
    multiplier: 0, cdTurns: 8,
    description: '[群嘲] 嘲讽全体敌人 3 回合，反弹 30% 伤害',
    buff: { type: 'reflect', duration: 3, value: 0.30 },
    isAoe: true, tauntDuration: 3,
    childType: 'taunt',
  },
  {
    id: 'ch_taunt_red', name: '共生血契', type: 'passive', rarity: 'red', element: 'earth',
    multiplier: 0,
    description: '玩家受到的伤害 30% 转嫁子女，子女每回合回 2% 气血',
    effect: { regen_per_turn_percent: 0.02, damage_share_to_assist_percent: 0.30 },
    childType: 'taunt',
  },

  // ---------- 减益型 (Debuff · 5) ----------
  {
    id: 'ch_debuff_green', name: '锈骨咒', type: 'divine', rarity: 'green', element: 'metal',
    multiplier: 0, cdTurns: 6,
    description: '单体敌人攻击 -15%，持续 3 回合',
    debuff: { type: 'atk_down', chance: 1.0, duration: 3, value: 0.15 },
    childType: 'debuff',
  },
  {
    id: 'ch_debuff_blue', name: '散神诀', type: 'divine', rarity: 'blue', element: 'water',
    multiplier: 0, cdTurns: 7,
    description: '单体敌人速度 -25%，命中-15%，持续 3 回合',
    debuff: { type: 'spd_down', chance: 1.0, duration: 3, value: 0.25 },
    childType: 'debuff',
  },
  {
    id: 'ch_debuff_purple', name: '蚀魂术', type: 'divine', rarity: 'purple', element: 'water',
    multiplier: 0, cdTurns: 8,
    description: '单体敌人攻击 -20%，防御 -20%，持续 3 回合，附加 30% 中毒 2 回合',
    debuff: { type: 'atk_down', chance: 1.0, duration: 3, value: 0.20 },
    extraDebuffs: [
      { type: 'def_down', chance: 1.0, duration: 3, value: 0.20 },
      { type: 'poison',   chance: 0.30, duration: 2 },
    ],
    childType: 'debuff',
  },
  {
    id: 'ch_debuff_gold', name: '万灵衰退', type: 'divine', rarity: 'gold', element: null,
    multiplier: 0, cdTurns: 8, isAoe: true,
    description: '[群体] 全体敌人攻击/防御 -15%，持续 3 回合',
    debuff: { type: 'atk_down', chance: 1.0, duration: 3, value: 0.15 },
    extraDebuffs: [
      { type: 'def_down', chance: 1.0, duration: 3, value: 0.15 },
    ],
    childType: 'debuff',
  },
  {
    id: 'ch_debuff_red', name: '大道无常', type: 'divine', rarity: 'red', element: null,
    multiplier: 0, cdTurns: 10, isAoe: true,
    description: '[群体] 全体敌人攻防速 -20%，持续 4 回合，附加 50% 流血 3 回合',
    debuff: { type: 'atk_down', chance: 1.0, duration: 4, value: 0.20 },
    extraDebuffs: [
      { type: 'def_down', chance: 1.0, duration: 4, value: 0.20 },
      { type: 'spd_down', chance: 1.0, duration: 4, value: 0.20 },
      { type: 'bleed',    chance: 0.50, duration: 3 },
    ],
    childType: 'debuff',
  },
]

export const CHILD_SKILL_MAP: Record<string, ChildSkill> = {}
for (const s of CHILD_SKILLS) CHILD_SKILL_MAP[s.id] = s

// ============================================================
// 灵根 → 类型概率分布（参考文档 5.7.2）
// ============================================================

// V2 改版：6 类权重表（合计 100，每个灵根有特色搭配）
//   metal  — 攻击型为主，配合减益/嘲讽
//   fire   — 纯攻击为主
//   earth  — 肉盾 + 嘲讽（典型坦克路线）
//   water  — Buff + 减益（典型法师/辅助路线）
//   wood   — 回复 + Buff（典型奶妈路线）
//   mixed  — 全类型均匀
export const SKILL_TYPE_BY_ROOT: Record<SpiritualRoot | 'mixed', Record<ChildSkillType, number>> = {
  metal: { attack: 50, tank: 5,  heal: 0,  buff: 15, taunt: 10, debuff: 20 },
  fire:  { attack: 70, tank: 0,  heal: 0,  buff: 15, taunt: 5,  debuff: 10 },
  earth: { attack: 0,  tank: 50, heal: 0,  buff: 10, taunt: 30, debuff: 10 },
  water: { attack: 5,  tank: 5,  heal: 10, buff: 50, taunt: 5,  debuff: 25 },
  wood:  { attack: 0,  tank: 0,  heal: 60, buff: 25, taunt: 5,  debuff: 10 },
  mixed: { attack: 17, tank: 17, heal: 17, buff: 17, taunt: 16, debuff: 16 },
}

// 资质 → 功法品质映射
import type { ChildAptitude } from './childTalentData'

export const APTITUDE_TO_SKILL_RARITY: Record<ChildAptitude, 'green' | 'blue' | 'purple' | 'gold' | 'red'> = {
  0: 'green',   // 凡品
  1: 'green',   // 下品
  2: 'blue',    // 中品
  3: 'purple',  // 上品
  4: 'gold',    // 极品
  5: 'red',     // 仙品
  6: 'red',     // 圣品
}

// 出生时按主灵根 + 资质自动选择一个功法
export function pickInnateSkill(
  root: SpiritualRoot | 'mixed',
  aptitude: ChildAptitude
): ChildSkill {
  const typeWeights = SKILL_TYPE_BY_ROOT[root]
  const total = (Object.values(typeWeights) as number[]).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let chosenType: ChildSkillType = 'attack'
  for (const [type, w] of Object.entries(typeWeights)) {
    r -= w as number
    if (r <= 0) {
      chosenType = type as ChildSkillType
      break
    }
  }

  const targetRarity = APTITUDE_TO_SKILL_RARITY[aptitude]
  // V2.1：同类型同品质允许多个功法（如红品攻击 = 神童剑意 + 乱舞剑诀），随机选一个
  const matchedList = CHILD_SKILLS.filter(s => s.childType === chosenType && s.rarity === targetRarity)
  if (matchedList.length > 0) {
    return matchedList[Math.floor(Math.random() * matchedList.length)]
  }

  // 兜底（理论不会触发）：返回该类型的最低品质功法
  return CHILD_SKILLS.find(s => s.childType === chosenType) || CHILD_SKILLS[0]
}

// V2 改版：多槽位解锁等级
//   槽 1 = Lv.1（出生时获得，所有资质共有）
//   槽 2 = Lv.100
//   槽 3 = Lv.200
//   槽 4 = Lv.300（仅圣品 aptitude=6 解锁）
export function getSkillSlotUnlockLevels(aptitude: ChildAptitude): number[] {
  return aptitude >= 6 ? [1, 100, 200, 300] : [1, 100, 200]
}

// 子女功法效果数值随等级线性提升（5.7.2 等级缩放）
export function calcSkillLevelMultiplier(childLevel: number): number {
  return 1 + (childLevel / 100) * 0.5
}
