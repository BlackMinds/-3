// 技能石系统类型定义
// 前后端共享：前端从 ~/shared/stoneTypes，后端从 ~/shared/stoneTypes

import type { DebuffType, BuffType } from '../server/engine/skillData'

export type StoneType = 'core' | 'amp' | 'trigger' | 'ultimate'
export type Rarity = 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'red'
export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | null
export type SkillType = 'active' | 'divine' | 'passive'

export interface PassiveStatBlock {
  ATK_percent?: number
  DEF_percent?: number
  HP_percent?: number
  SPD_percent?: number
  CRIT_RATE_flat?: number
  CRIT_DMG_flat?: number
  DODGE_flat?: number
  LIFESTEAL_flat?: number
  RESIST_METAL?: number
  RESIST_WOOD?: number
  RESIST_WATER?: number
  RESIST_FIRE?: number
  RESIST_EARTH?: number
  RESIST_CTRL?: number
  regen_per_turn_percent?: number
  damage_reduction_flat?: number
  reflect_damage_percent?: number
  poison_on_hit_taken_chance?: number
  burn_on_hit_taken_chance?: number
  reflect_on_crit_taken?: number
  revive_once?: boolean
  skill_cd_reduction_turns?: number
  dot_amplifier_percent?: number
  crit_after_dodge?: boolean
  heal_amplifier_percent?: number
}

export interface StoneEffect {
  baseMultiplier?: number
  debuff?: { type: DebuffType; chance: number; duration: number; value?: number }
  buff?: { type: BuffType; duration: number; value?: number; valuePercent?: number }
  healAtkRatio?: number
  isAoe?: boolean
  targetCount?: number
  hitCount?: number
  ignoreDef?: number
  passive?: PassiveStatBlock

  multiplierBonus?: number
  chanceBonus?: number
  durationBonus?: number
  targetCountBonus?: number
  hitCountBonus?: number
  cdCut?: number
  extraIgnoreDef?: number

  // 新设计：触发石都是「机制改变」而非"条件加成"
  triggerType?:
    | 'echo'           // 暴击时此技能立刻再打一次
    | 'swap_aoe'       // 血量 < threshold 时此技能变群攻
    | 'combo_burn'     // 对已灼烧目标攻击时引爆灼烧（层数 × value 秒伤）
    | 'extra_bleed'    // 暴击时额外附加流血（duration 回合）
    | 'counter'        // 受击闪避后立刻反击一次
    | 'skill_swap'     // 神通释放后下回合主修变群攻
    | 'last_stand'     // 受到致命伤害时免死 1 次（保留 value×maxHP 血）
  triggerValue?: number
  triggerThreshold?: number
  triggerDuration?: number

  ultType?:
    | 'lifesteal' | 'overflow_dmg' | 'overflow_heal' | 'chain' | 'heal_share'
    | 'reflect' | 'dot_detonate' | 'shield_to_dmg' | 'regen_to_atk' | 'true_damage'
  ultValue?: number

  mutexTags?: string[]
}

export interface Stone {
  id: string
  name: string
  type: StoneType
  rarity: Rarity
  element: Element
  description: string
  effect: StoneEffect
  forSkillTypes?: SkillType[]
}

export interface SkillBook {
  id: string
  name: string
  skillType: SkillType
  rarity: Rarity
  element: Element
  description: string
}

export interface SlottedBook {
  bookId: string
  stones: (string | null)[]
  level?: number
}

export function getSlotLayout(rarity: Rarity): StoneType[] {
  switch (rarity) {
    case 'white':  return ['core']
    case 'green':  return ['core', 'amp']
    case 'blue':   return ['core', 'amp', 'amp']
    case 'purple': return ['core', 'amp', 'amp', 'trigger']
    case 'gold':   return ['core', 'amp', 'amp', 'trigger', 'ultimate']
    case 'red':    return ['core', 'amp', 'amp', 'trigger', 'ultimate']
  }
}

const RARITY_ORDER: Rarity[] = ['white', 'green', 'blue', 'purple', 'gold', 'red']

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r)
}

export function canSlotStone(bookRarity: Rarity, stoneRarity: Rarity): boolean {
  return rarityRank(stoneRarity) <= rarityRank(bookRarity)
}

export const STONE_CAPS = {
  multiplierBonusTotal: 1.50,
  chanceBonusTotal: 0.40,
  durationBonusTotal: 3,
  lifestealTotal: 0.30,
  ignoreDefTotal: 0.50,
} as const
