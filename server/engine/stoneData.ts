// 技能石静态数据表 - P1 MVP
// 与前端 game/stoneData.ts 保持一致

import type { Stone } from '../../shared/stoneTypes'

// ========== 核心石（Core） ==========
// 决定技能本质。每本书只能装 1 颗。

// 伤害型核心
export const CORE_DMG_STONES: Stone[] = [
  {
    id: 'core_strike', name: '基础斩击', type: 'core', rarity: 'white', element: null,
    description: '造成 100% 伤害',
    effect: { baseMultiplier: 1.0 },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'core_flame_slash', name: '烈焰核心', type: 'core', rarity: 'blue', element: 'fire',
    description: '造成 180% 伤害，附灼烧（25% / 3回合）',
    effect: { baseMultiplier: 1.8, debuff: { type: 'burn', chance: 0.25, duration: 3 } },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'core_thunder', name: '雷霆核心', type: 'core', rarity: 'purple', element: 'metal',
    description: '造成 250% 伤害，附眩晕（10% / 1回合）',
    effect: { baseMultiplier: 2.5, debuff: { type: 'stun', chance: 0.10, duration: 1 } },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_void_slash', name: '虚空核心', type: 'core', rarity: 'gold', element: null,
    description: '造成 400% 伤害，无视 20% 防御',
    effect: { baseMultiplier: 4.0, ignoreDef: 0.20 },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_chaos_sword', name: '混沌剑意', type: 'core', rarity: 'red', element: null,
    description: '造成 800% 伤害，无视 30% 防御',
    effect: { baseMultiplier: 8.0, ignoreDef: 0.30 },
    forSkillTypes: ['divine'],
  },
]

// 控制/Debuff 型核心（带基础伤害 + debuff）
export const CORE_DEBUFF_STONES: Stone[] = [
  {
    id: 'core_bleed', name: '流血核心', type: 'core', rarity: 'green', element: 'metal',
    description: '造成 130% 伤害，附流血（25% / 2回合）',
    effect: { baseMultiplier: 1.3, debuff: { type: 'bleed', chance: 0.25, duration: 2 } },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'core_burn', name: '灼烧核心', type: 'core', rarity: 'green', element: 'fire',
    description: '造成 130% 伤害，附灼烧（25% / 3回合）',
    effect: { baseMultiplier: 1.3, debuff: { type: 'burn', chance: 0.25, duration: 3 } },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'core_poison', name: '中毒核心', type: 'core', rarity: 'green', element: 'wood',
    description: '造成 130% 伤害，附中毒（25% / 3回合）',
    effect: { baseMultiplier: 1.3, debuff: { type: 'poison', chance: 0.25, duration: 3 } },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'core_freeze_lite', name: '冰封核心·初阶', type: 'core', rarity: 'green', element: 'water',
    description: '造成 130% 伤害，附冻结（15% / 1回合）',
    effect: { baseMultiplier: 1.3, debuff: { type: 'freeze', chance: 0.15, duration: 1 } },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'core_brittle_lite', name: '破防核心·初阶', type: 'core', rarity: 'green', element: 'earth',
    description: '造成 130% 伤害，附脆弱（25% / 3回合 / -20%DEF）',
    effect: { baseMultiplier: 1.3, debuff: { type: 'brittle', chance: 0.25, duration: 3, value: 0.20 } },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'core_freeze', name: '冰封核心', type: 'core', rarity: 'blue', element: 'water',
    description: '造成 180% 伤害，附减速（50% / 2回合）并概率冻结（10% / 1回合）',
    effect: { baseMultiplier: 1.8, debuff: { type: 'slow', chance: 0.50, duration: 2 } },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'core_brittle', name: '破防核心', type: 'core', rarity: 'blue', element: 'earth',
    description: '造成 180% 伤害，附脆弱（30% / 3回合 / -20%DEF）',
    effect: { baseMultiplier: 1.8, debuff: { type: 'brittle', chance: 0.30, duration: 3, value: 0.20 } },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'core_root', name: '束缚核心', type: 'core', rarity: 'blue', element: 'wood',
    description: '造成 120% 伤害，附束缚（50% / 2回合）',
    effect: { baseMultiplier: 1.2, debuff: { type: 'root', chance: 0.50, duration: 2 } },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_stun', name: '眩晕核心', type: 'core', rarity: 'purple', element: 'metal',
    description: '造成 250% 伤害，附眩晕（8% / 1回合）',
    effect: { baseMultiplier: 2.5, debuff: { type: 'stun', chance: 0.08, duration: 1 } },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_atk_debuff', name: '破灭核心', type: 'core', rarity: 'purple', element: 'wood',
    description: '造成 250% 伤害，附攻击削弱（40% / 3回合 / -20%ATK）',
    effect: { baseMultiplier: 2.5, debuff: { type: 'atk_down', chance: 0.40, duration: 3, value: 0.20 } },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_silence', name: '封印核心', type: 'core', rarity: 'gold', element: null,
    description: '造成 400% 伤害，附封印（25% / 2回合）',
    effect: { baseMultiplier: 4.0, debuff: { type: 'silence', chance: 0.25, duration: 2 } },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_timestop', name: '时停核心', type: 'core', rarity: 'red', element: null,
    description: '必定冻结敌方 2 回合（不造成直接伤害，单体）',
    effect: { baseMultiplier: 0, debuff: { type: 'freeze', chance: 1.0, duration: 2 }, mutexTags: ['target'] },
    forSkillTypes: ['divine'],
  },
]

// 回复型核心
export const CORE_HEAL_STONES: Stone[] = [
  {
    id: 'core_heal_instant', name: '灵泉核心', type: 'core', rarity: 'purple', element: 'water',
    description: '回复 200% ATK 气血',
    effect: { baseMultiplier: 0, healAtkRatio: 2.0 },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_heal_large', name: '天地归元核心', type: 'core', rarity: 'gold', element: 'wood',
    description: '回复 400% ATK 气血',
    effect: { baseMultiplier: 0, healAtkRatio: 4.0 },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_regen', name: '生生不息核心', type: 'core', rarity: 'purple', element: 'wood',
    description: '每回合回 8% 气血，持续 4 回合',
    effect: { baseMultiplier: 0, buff: { type: 'regen', duration: 4, valuePercent: 0.08 } },
    forSkillTypes: ['divine'],
  },
]

// Buff 型核心
export const CORE_BUFF_STONES: Stone[] = [
  {
    id: 'core_atk_up', name: '嗜血核心', type: 'core', rarity: 'purple', element: null,
    description: '自身 ATK+35%，持续 4 回合',
    effect: { baseMultiplier: 0, buff: { type: 'atk_up', duration: 4, value: 0.35 } },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_shield', name: '厚土核心', type: 'core', rarity: 'blue', element: 'earth',
    description: '获得 250% ATK 护盾，持续 4 回合',
    effect: { baseMultiplier: 0, buff: { type: 'shield', duration: 4, value: 2.5 } },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_immune', name: '金钟核心', type: 'core', rarity: 'blue', element: 'metal',
    description: '受到伤害减半，持续 2 回合',
    effect: { baseMultiplier: 0, buff: { type: 'immune', duration: 2 } },
    forSkillTypes: ['divine'],
  },
  {
    id: 'core_reflect', name: '明镜核心', type: 'core', rarity: 'purple', element: 'water',
    description: '反弹 30% 伤害，持续 3 回合',
    effect: { baseMultiplier: 0, buff: { type: 'reflect', duration: 3, value: 0.30 } },
    forSkillTypes: ['divine'],
  },
]

// 被动核心石 - 只能装入被动书
export const CORE_PASSIVE_STONES: Stone[] = [
  {
    id: 'core_passive_atk', name: '攻势核心', type: 'core', rarity: 'green', element: null,
    description: '攻击 +8%',
    effect: { passive: { ATK_percent: 8 } },
    forSkillTypes: ['passive'],
  },
  {
    id: 'core_passive_def', name: '坚壁核心', type: 'core', rarity: 'green', element: null,
    description: '防御 +10%',
    effect: { passive: { DEF_percent: 10 } },
    forSkillTypes: ['passive'],
  },
  {
    id: 'core_passive_hp', name: '磐根核心', type: 'core', rarity: 'green', element: null,
    description: '气血 +10%',
    effect: { passive: { HP_percent: 10 } },
    forSkillTypes: ['passive'],
  },
  {
    id: 'core_passive_regen', name: '流水核心', type: 'core', rarity: 'green', element: 'water',
    description: '每回合回 2% 气血',
    effect: { passive: { regen_per_turn_percent: 0.02 } },
    forSkillTypes: ['passive'],
  },
  {
    id: 'core_passive_dodge', name: '凌波核心', type: 'core', rarity: 'blue', element: 'water',
    description: '闪避 +8%',
    effect: { passive: { DODGE_flat: 0.08 } },
    forSkillTypes: ['passive'],
  },
  {
    id: 'core_passive_reflect', name: '荆棘核心', type: 'core', rarity: 'blue', element: 'wood',
    description: '反弹 8% 所受伤害',
    effect: { passive: { reflect_damage_percent: 0.08 } },
    forSkillTypes: ['passive'],
  },
  {
    id: 'core_passive_crit', name: '破绽核心', type: 'core', rarity: 'purple', element: 'metal',
    description: '暴击率 +8%，暴伤 +22%',
    effect: { passive: { CRIT_RATE_flat: 0.08, CRIT_DMG_flat: 0.22 } },
    forSkillTypes: ['passive'],
  },
  {
    id: 'core_passive_dot_amp', name: '万毒核心', type: 'core', rarity: 'purple', element: 'wood',
    description: '灼烧/中毒/流血伤害 +30%',
    effect: { passive: { dot_amplifier_percent: 30 } },
    forSkillTypes: ['passive'],
  },
  {
    id: 'core_passive_heal_amp', name: '春风核心', type: 'core', rarity: 'purple', element: 'wood',
    description: '受治疗效果 +30%',
    effect: { passive: { heal_amplifier_percent: 30 } },
    forSkillTypes: ['passive'],
  },
  {
    id: 'core_passive_allstat', name: '道心核心', type: 'core', rarity: 'red', element: null,
    description: '攻防血 +12%，全五行抗性 +10%',
    effect: { passive: {
      ATK_percent: 12, DEF_percent: 12, HP_percent: 12,
      RESIST_METAL: 0.10, RESIST_WOOD: 0.10, RESIST_WATER: 0.10, RESIST_FIRE: 0.10, RESIST_EARTH: 0.10,
    } },
    forSkillTypes: ['passive'],
  },
]

// ========== 增幅石（Amp） ==========
// 可多颗叠加（受 clamp）
export const AMP_STONES: Stone[] = [
  // 倍率
  { id: 'amp_dmg_small', name: '小型倍率石', type: 'amp', rarity: 'green', element: null,
    description: '核心倍率 +30%', effect: { multiplierBonus: 0.30 } },
  { id: 'amp_dmg_mid', name: '中型倍率石', type: 'amp', rarity: 'blue', element: null,
    description: '核心倍率 +50%', effect: { multiplierBonus: 0.50 } },
  { id: 'amp_dmg_large', name: '大型倍率石', type: 'amp', rarity: 'purple', element: null,
    description: '核心倍率 +80%', effect: { multiplierBonus: 0.80 } },

  // Debuff 概率
  { id: 'amp_chance', name: '精准石', type: 'amp', rarity: 'blue', element: null,
    description: 'Debuff 概率 +15%', effect: { chanceBonus: 0.15 } },
  { id: 'amp_chance_mega', name: '必中石', type: 'amp', rarity: 'gold', element: null,
    description: 'Debuff 概率 +25%', effect: { chanceBonus: 0.25 } },

  // 持续回合
  { id: 'amp_duration', name: '持续石', type: 'amp', rarity: 'blue', element: null,
    description: 'Buff/Debuff 持续 +1 回合', effect: { durationBonus: 1 } },
  { id: 'amp_duration_long', name: '长驻石', type: 'amp', rarity: 'purple', element: null,
    description: 'Buff/Debuff 持续 +2 回合', effect: { durationBonus: 2 } },

  // 目标数（互斥：target 系列互斥，且与 multi_hit 互斥；仅限神通）
  { id: 'amp_target_2', name: '双目标石', type: 'amp', rarity: 'blue', element: null,
    description: '目标 1→2', effect: { targetCountBonus: 1, mutexTags: ['target', 'multi_hit'] }, forSkillTypes: ['divine'] },
  { id: 'amp_target_3', name: '三目标石', type: 'amp', rarity: 'purple', element: null,
    description: '目标 1→3', effect: { targetCountBonus: 2, mutexTags: ['target', 'multi_hit'] }, forSkillTypes: ['divine'] },
  { id: 'amp_target_all', name: '群攻石', type: 'amp', rarity: 'gold', element: null,
    description: '目标 1→全体', effect: { isAoe: true, mutexTags: ['target', 'multi_hit'] }, forSkillTypes: ['divine'] },

  // 多段（互斥：同上；仅限神通）
  { id: 'amp_multi_hit_3', name: '三段石', type: 'amp', rarity: 'purple', element: null,
    description: '单次→分 3 段', effect: { hitCountBonus: 3, mutexTags: ['multi_hit', 'target'] }, forSkillTypes: ['divine'] },
  { id: 'amp_multi_hit_5', name: '五段石', type: 'amp', rarity: 'gold', element: null,
    description: '单次→分 5 段', effect: { hitCountBonus: 5, mutexTags: ['multi_hit', 'target'] }, forSkillTypes: ['divine'] },

  // CD
  { id: 'amp_cd_cut', name: '缩时石', type: 'amp', rarity: 'purple', element: null,
    description: '神通 CD -1 回合', effect: { cdCut: 1 } },
  { id: 'amp_cd_cut_mega', name: '聚灵石', type: 'amp', rarity: 'gold', element: null,
    description: '神通 CD -2 回合', effect: { cdCut: 2 } },

  // 穿透
  { id: 'amp_ignore_def', name: '破防石', type: 'amp', rarity: 'gold', element: null,
    description: '无视 20% 防御', effect: { extraIgnoreDef: 0.20 } },
]

// 被动专用增幅石
export const AMP_PASSIVE_STONES: Stone[] = [
  { id: 'amp_atk_p', name: '攻势片', type: 'amp', rarity: 'green', element: null,
    description: '攻击 +7%', effect: { passive: { ATK_percent: 7 } }, forSkillTypes: ['passive'] },
  { id: 'amp_def_p', name: '坚壁片', type: 'amp', rarity: 'green', element: null,
    description: '防御 +8%', effect: { passive: { DEF_percent: 8 } }, forSkillTypes: ['passive'] },
  { id: 'amp_hp_p', name: '磐根片', type: 'amp', rarity: 'green', element: null,
    description: '气血 +8%', effect: { passive: { HP_percent: 8 } }, forSkillTypes: ['passive'] },
  { id: 'amp_resist_metal', name: '金抗片', type: 'amp', rarity: 'green', element: 'metal',
    description: '金抗 +10%', effect: { passive: { RESIST_METAL: 0.10 } }, forSkillTypes: ['passive'] },
  { id: 'amp_resist_wood', name: '木抗片', type: 'amp', rarity: 'green', element: 'wood',
    description: '木抗 +10%', effect: { passive: { RESIST_WOOD: 0.10 } }, forSkillTypes: ['passive'] },
  { id: 'amp_resist_water', name: '水抗片', type: 'amp', rarity: 'green', element: 'water',
    description: '水抗 +10%', effect: { passive: { RESIST_WATER: 0.10 } }, forSkillTypes: ['passive'] },
  { id: 'amp_resist_fire', name: '火抗片', type: 'amp', rarity: 'green', element: 'fire',
    description: '火抗 +10%', effect: { passive: { RESIST_FIRE: 0.10 } }, forSkillTypes: ['passive'] },
  { id: 'amp_resist_earth', name: '土抗片', type: 'amp', rarity: 'green', element: 'earth',
    description: '土抗 +10%', effect: { passive: { RESIST_EARTH: 0.10 } }, forSkillTypes: ['passive'] },
  { id: 'amp_resist_ctrl', name: '控抗片', type: 'amp', rarity: 'blue', element: null,
    description: '控制抗性 +10%', effect: { passive: { RESIST_CTRL: 0.10 } }, forSkillTypes: ['passive'] },
  { id: 'amp_dodge', name: '闪避片', type: 'amp', rarity: 'blue', element: null,
    description: '闪避 +5%', effect: { passive: { DODGE_flat: 0.05 } }, forSkillTypes: ['passive'] },
  { id: 'amp_spd', name: '身法片', type: 'amp', rarity: 'blue', element: null,
    description: '速度 +8%', effect: { passive: { SPD_percent: 8 } }, forSkillTypes: ['passive'] },
  { id: 'amp_crit_rate', name: '暴击片', type: 'amp', rarity: 'blue', element: null,
    description: '暴击率 +5%', effect: { passive: { CRIT_RATE_flat: 0.05 } }, forSkillTypes: ['passive'] },
  { id: 'amp_crit_dmg', name: '暴伤片', type: 'amp', rarity: 'blue', element: null,
    description: '暴伤 +15%', effect: { passive: { CRIT_DMG_flat: 0.15 } }, forSkillTypes: ['passive'] },
  { id: 'amp_lifesteal', name: '吸血片', type: 'amp', rarity: 'purple', element: null,
    description: '吸血 +3%', effect: { passive: { LIFESTEAL_flat: 0.03 } }, forSkillTypes: ['passive'] },
  { id: 'amp_dot_amp', name: '毒烈片', type: 'amp', rarity: 'purple', element: null,
    description: 'DOT 伤害 +15%', effect: { passive: { dot_amplifier_percent: 15 } }, forSkillTypes: ['passive'] },
  { id: 'amp_heal_amp', name: '春风片', type: 'amp', rarity: 'purple', element: null,
    description: '受治疗 +15%', effect: { passive: { heal_amplifier_percent: 15 } }, forSkillTypes: ['passive'] },
]

// ========== 触发石（Trigger） ==========
// v2 重构：每颗触发石都是「技能行为改变」而非"条件加成"
// 每本书最多 1 颗
export const TRIGGER_STONES: Stone[] = [
  {
    id: 'trigger_echo', name: '余响石', type: 'trigger', rarity: 'purple', element: null,
    description: '暴击时：此技能立刻再打一次（第二次不再触发余响）',
    effect: { triggerType: 'echo' },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'trigger_swap_aoe', name: '变阵石', type: 'trigger', rarity: 'purple', element: null,
    description: '自身血量 <30% 时：此技能变为群攻（单体→全体）',
    effect: { triggerType: 'swap_aoe', triggerThreshold: 0.30 },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'trigger_extra_bleed', name: '裂伤石', type: 'trigger', rarity: 'purple', element: null,
    description: '暴击时：额外附加流血 3 回合（100% 命中）',
    effect: { triggerType: 'extra_bleed', triggerDuration: 3 },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'trigger_counter', name: '反击石', type: 'trigger', rarity: 'purple', element: null,
    description: '受击闪避成功时：立刻反击一次（不等下回合）',
    effect: { triggerType: 'counter' },
    forSkillTypes: ['active', 'divine', 'passive'],
  },
  {
    id: 'trigger_combo_burn', name: '爆燃石', type: 'trigger', rarity: 'gold', element: 'fire',
    description: '对已灼烧的目标攻击时：引爆灼烧层数 × 15% ATK 作为额外火伤',
    effect: { triggerType: 'combo_burn', triggerValue: 0.15 },
    forSkillTypes: ['active', 'divine'],
  },
  {
    id: 'trigger_skill_swap', name: '功法轮转石', type: 'trigger', rarity: 'gold', element: null,
    description: '此神通释放后：下回合主修变为群攻一次',
    effect: { triggerType: 'skill_swap' },
    forSkillTypes: ['divine'],
  },
  {
    id: 'trigger_last_stand', name: '不灭石', type: 'trigger', rarity: 'red', element: null,
    description: '受到致命伤害时：免死 1 次（保留 20% 气血）',
    effect: { triggerType: 'last_stand', triggerValue: 0.20 },
    forSkillTypes: ['passive'],
  },
]

// ========== 质变石（Ultimate） ==========
// 每本书最多 1 颗
// 主修每回合自动施展（无 CD），所以爆发型/连锁型质变石只允许装神通书
export const ULTIMATE_STONES: Stone[] = [
  { id: 'ult_lifesteal', name: '吸血石', type: 'ultimate', rarity: 'purple', element: null,
    description: '造成的伤害 30% 转为回血',
    effect: { ultType: 'lifesteal', ultValue: 0.30 },
    forSkillTypes: ['divine'] },
  { id: 'ult_overflow_dmg', name: '溢出斩杀石', type: 'ultimate', rarity: 'gold', element: null,
    description: '目标死亡时溢出伤害打下一只',
    effect: { ultType: 'overflow_dmg' },
    forSkillTypes: ['divine'] },
  { id: 'ult_overflow_heal', name: '溢出反伤石', type: 'ultimate', rarity: 'gold', element: null,
    description: '治疗溢出时对敌方造成等量伤害',
    effect: { ultType: 'overflow_heal' },
    forSkillTypes: ['active', 'divine'] },
  { id: 'ult_chain', name: '连锁石', type: 'ultimate', rarity: 'gold', element: null,
    description: '伤害技能对第二目标造成 60% 伤害',
    effect: { ultType: 'chain', ultValue: 0.60 },
    forSkillTypes: ['divine'] },
  { id: 'ult_heal_share', name: '分摊回血石', type: 'ultimate', rarity: 'purple', element: null,
    description: '回复技能同时治疗血量最低的第二人',
    effect: { ultType: 'heal_share' },
    forSkillTypes: ['active', 'divine'] },
  { id: 'ult_reflect', name: '荆棘之身石', type: 'ultimate', rarity: 'purple', element: null,
    description: '受击反弹 20% 伤害（永久）',
    effect: { ultType: 'reflect', ultValue: 0.20 },
    forSkillTypes: ['active', 'divine', 'passive'] },
  { id: 'ult_dot_detonate', name: 'DOT 引爆石', type: 'ultimate', rarity: 'gold', element: null,
    description: '敌方 DOT 剩余层数 ×15% 作为直接伤害',
    effect: { ultType: 'dot_detonate', ultValue: 0.15 },
    forSkillTypes: ['divine'] },
  { id: 'ult_regen_to_atk', name: '生生不息之怒', type: 'ultimate', rarity: 'red', element: null,
    description: '每回合回血时同时 ATK+5%（最多 3 层）',
    effect: { ultType: 'regen_to_atk', ultValue: 0.05 },
    forSkillTypes: ['active', 'divine', 'passive'] },
  { id: 'ult_true_damage', name: '真伤石', type: 'ultimate', rarity: 'red', element: null,
    description: '伤害无视所有防御和抗性，但倍率降为 70%',
    effect: { ultType: 'true_damage', ultValue: 0.70 },
    forSkillTypes: ['divine'] },
]

// ========== 聚合 ==========
export const ALL_STONES: Stone[] = [
  ...CORE_DMG_STONES,
  ...CORE_DEBUFF_STONES,
  ...CORE_HEAL_STONES,
  ...CORE_BUFF_STONES,
  ...CORE_PASSIVE_STONES,
  ...AMP_STONES,
  ...AMP_PASSIVE_STONES,
  ...TRIGGER_STONES,
  ...ULTIMATE_STONES,
]

export const STONE_MAP: Record<string, Stone> = {}
for (const s of ALL_STONES) {
  STONE_MAP[s.id] = s
}
