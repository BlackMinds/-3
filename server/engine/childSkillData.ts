// 子女专属功法 - 设计文档 5.7.2
// 16 个独有功法（4 类 × 5 品质等级，红品归为传说）
// 出生时根据主灵根 + 资质自动觉醒，跟随等级自然升级，不可重铸
// 字段对齐 server/engine/skillData.ts: Skill 接口

import type { Skill } from './skillData'
import type { SpiritualRoot } from './companionData'

export type ChildSkillType = 'attack' | 'tank' | 'heal' | 'buff'

export interface ChildSkill extends Skill {
  childType: ChildSkillType
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
]

export const CHILD_SKILL_MAP: Record<string, ChildSkill> = {}
for (const s of CHILD_SKILLS) CHILD_SKILL_MAP[s.id] = s

// ============================================================
// 灵根 → 类型概率分布（参考文档 5.7.2）
// ============================================================

export const SKILL_TYPE_BY_ROOT: Record<SpiritualRoot | 'mixed', Record<ChildSkillType, number>> = {
  metal: { attack: 70, tank: 10, heal: 0,  buff: 20 },
  fire:  { attack: 80, tank: 0,  heal: 0,  buff: 20 },
  earth: { attack: 0,  tank: 80, heal: 0,  buff: 20 },
  water: { attack: 10, tank: 10, heal: 10, buff: 70 },
  wood:  { attack: 0,  tank: 0,  heal: 70, buff: 30 },
  mixed: { attack: 25, tank: 25, heal: 25, buff: 25 },  // 双灵根/五行混灵
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
  const matched = CHILD_SKILLS.find(s => s.childType === chosenType && s.rarity === targetRarity)
  if (matched) return matched

  // 兜底（理论不会触发）：返回该类型的最低品质功法
  return CHILD_SKILLS.find(s => s.childType === chosenType) || CHILD_SKILLS[0]
}

// 子女功法效果数值随等级线性提升（5.7.2 等级缩放）
export function calcSkillLevelMultiplier(childLevel: number): number {
  return 1 + (childLevel / 100) * 0.5
}
