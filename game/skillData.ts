// 功法静态数据 - 完整版 (47 个功法)

export type DebuffType = 'burn' | 'poison' | 'bleed' | 'freeze' | 'stun' | 'slow' | 'brittle' | 'atk_down' | 'root' | 'silence';
export type BuffType = 'atk_up' | 'def_up' | 'spd_up' | 'crit_up' | 'shield' | 'regen' | 'reflect' | 'immune';

export interface SkillDebuff {
  type: DebuffType;
  chance: number;          // 触发概率 0~1
  duration: number;        // 持续回合
  value?: number;          // brittle/atk_down 用,百分比降低
}

export interface SkillBuff {
  type: BuffType;
  duration: number;
  value?: number;          // 百分比 (atk_up/def_up/spd_up) 或 倍率 (shield/reflect)
  valuePercent?: number;   // regen 用 (每回合回多少%)
}

// 被动效果 (放在 effect 中,前端读取)
export interface PassiveEffect {
  ATK_percent?: number;
  DEF_percent?: number;
  HP_percent?: number;
  SPD_percent?: number;
  CRIT_RATE_flat?: number;
  CRIT_DMG_flat?: number;
  DODGE_flat?: number;
  LIFESTEAL_flat?: number;
  RESIST_METAL?: number;
  RESIST_WOOD?: number;
  RESIST_WATER?: number;
  RESIST_FIRE?: number;
  RESIST_EARTH?: number;
  RESIST_CTRL?: number;
  regen_per_turn_percent?: number;
  damage_reduction_flat?: number;
  reflect_damage_percent?: number;
  // 触发型被动
  poison_on_hit_taken_chance?: number;  // 被打概率使敌方中毒
  burn_on_hit_taken_chance?: number;    // 被打概率使敌方灼烧
  reflect_on_crit_taken?: number;       // 被暴击时反弹伤害%
  // 特殊效果
  revive_once?: boolean;                 // 免死1次,保留20%血
  skill_cd_reduction_turns?: number;     // 神通CD-N回合
  atk_per_kill_percent?: number;         // 每击杀+%攻击
  max_stacks?: number;                    // 最大叠层
  battle_frenzy_stacks?: number;         // 战意沸腾当前叠层(由 store 维护)
  // v3 紫色被动新机制
  dot_amplifier_percent?: number;        // 你造成的 DOT(灼烧/中毒/流血)伤害放大%
  crit_after_dodge?: boolean;            // 闪避后下次攻击必暴击
  heal_amplifier_percent?: number;       // 你受到的治疗(神通治疗/被动 regen)放大%
}

export interface Skill {
  id: string;
  name: string;
  type: 'active' | 'divine' | 'passive';
  rarity: 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'red';
  element: 'metal' | 'wood' | 'water' | 'fire' | 'earth' | null;
  multiplier: number;
  description: string;
  cdTurns?: number;
  debuff?: SkillDebuff;
  buff?: SkillBuff;
  effect?: PassiveEffect;
  ignoreDef?: number;       // 无视防御百分比
  isAoe?: boolean;          // 全体攻击
  targetCount?: number;     // 攻击目标数(2=打2只,3=打3只)
  hitCount?: number;        // 多段攻击(每段 = 倍率/hitCount)
  healAtkRatio?: number;    // 即时回血(攻击力倍率,如 2.0 = 回复200%攻击力的气血)
}

// 主修功法 (6 个: 基础剑法 + 五行各一)
export const ACTIVE_SKILLS: Skill[] = [
  { id: 'basic_sword', name: '基础剑法', type: 'active', rarity: 'white', element: null, multiplier: 1.0, description: '造成100%灵力伤害' },
  { id: 'wind_blade', name: '风刃术', type: 'active', rarity: 'green', element: 'metal', multiplier: 1.3, description: '造成130%金属性伤害,30%流血2回合', debuff: { type: 'bleed', chance: 0.30, duration: 2 } },
  { id: 'vine_whip', name: '缠藤术', type: 'active', rarity: 'green', element: 'wood', multiplier: 1.3, description: '造成130%木属性伤害,40%中毒3回合', debuff: { type: 'poison', chance: 0.40, duration: 3 } },
  { id: 'ice_palm', name: '寒冰掌', type: 'active', rarity: 'green', element: 'water', multiplier: 1.3, description: '造成130%水属性伤害,25%冻结1回合', debuff: { type: 'freeze', chance: 0.25, duration: 1 } },
  { id: 'flame_sword', name: '烈焰剑诀', type: 'active', rarity: 'green', element: 'fire', multiplier: 1.3, description: '造成130%火属性伤害,40%灼烧3回合', debuff: { type: 'burn', chance: 0.40, duration: 3 } },
  { id: 'quake_fist', name: '裂地拳', type: 'active', rarity: 'green', element: 'earth', multiplier: 1.3, description: '造成130%土属性伤害,30%脆弱3回合', debuff: { type: 'brittle', chance: 0.30, duration: 3, value: 0.20 } },
];

// 神通技能 (14 个) - v3.4: 蓝-15% / 紫金-20% / 红-33%
export const DIVINE_SKILLS: Skill[] = [
  // 玄品
  { id: 'fire_rain', name: '天火术', type: 'divine', rarity: 'blue', element: 'fire', multiplier: 1.7, cdTurns: 5, description: '[群攻] 全体170%伤害,20%灼烧3回合', debuff: { type: 'burn', chance: 0.20, duration: 3 }, isAoe: true },
  { id: 'frost_nova', name: '霜冻新星', type: 'divine', rarity: 'blue', element: 'water', multiplier: 1.5, cdTurns: 6, description: '[群攻] 全体150%伤害,50%冻结2回合', debuff: { type: 'freeze', chance: 0.50, duration: 2 }, isAoe: true },
  { id: 'earth_shield', name: '厚土盾', type: 'divine', rarity: 'blue', element: 'earth', multiplier: 0, cdTurns: 7, description: '获得250%攻击的护盾,持续4回合', buff: { type: 'shield', duration: 4, value: 2.5 } },
  { id: 'quake_wave', name: '地裂波', type: 'divine', rarity: 'blue', element: 'earth', multiplier: 1.5, cdTurns: 6, description: '[群攻] 全体150%伤害,30%脆弱3回合', debuff: { type: 'brittle', chance: 0.30, duration: 3, value: 0.20 }, isAoe: true },
  { id: 'vine_prison', name: '万藤缚', type: 'divine', rarity: 'blue', element: 'wood', multiplier: 1.0, cdTurns: 7, description: '[群攻] 全体100%伤害,50%束缚2回合', debuff: { type: 'root', chance: 0.50, duration: 2 }, isAoe: true },
  { id: 'golden_bell', name: '金钟罩', type: 'divine', rarity: 'blue', element: 'metal', multiplier: 0, cdTurns: 8, description: '受到伤害减半,持续2回合', buff: { type: 'immune', duration: 2 } },
  // 地品
  { id: 'sword_storm', name: '剑雨纷飞', type: 'divine', rarity: 'purple', element: 'metal', multiplier: 2.3, cdTurns: 7, description: '[3目标] 230%伤害,30%流血3回合', debuff: { type: 'bleed', chance: 0.30, duration: 3 }, targetCount: 3 },
  { id: 'twin_flame', name: '双焰斩', type: 'divine', rarity: 'purple', element: 'fire', multiplier: 2.8, cdTurns: 6, description: '[2目标] 280%伤害,40%灼烧3回合', debuff: { type: 'burn', chance: 0.40, duration: 3 }, targetCount: 2 },
  { id: 'flurry_palm', name: '连环掌', type: 'divine', rarity: 'purple', element: 'wood', multiplier: 2.9, cdTurns: 6, description: '[3段] 单体3×96%伤害,每段30%中毒', debuff: { type: 'poison', chance: 0.30, duration: 3 }, hitCount: 3 },
  { id: 'spring_heal', name: '灵泉术', type: 'divine', rarity: 'purple', element: 'water', multiplier: 0, cdTurns: 7, description: '回复200%攻击力气血,每回合回5% 3回合', buff: { type: 'regen', duration: 3, valuePercent: 0.05 }, healAtkRatio: 2.0 },
  { id: 'blood_fury', name: '嗜血诀', type: 'divine', rarity: 'purple', element: null, multiplier: 0, cdTurns: 8, description: '攻击+35% 4回合', buff: { type: 'atk_up', duration: 4, value: 0.35 } },
  { id: 'wood_heal', name: '生生不息', type: 'divine', rarity: 'purple', element: 'wood', multiplier: 0, cdTurns: 8, description: '每回合回8%气血,持续4回合', buff: { type: 'regen', duration: 4, valuePercent: 0.08 } },
  { id: 'mirror_water', name: '明镜止水', type: 'divine', rarity: 'purple', element: 'water', multiplier: 0, cdTurns: 9, description: '反弹30%伤害 3回合', buff: { type: 'reflect', duration: 3, value: 0.30 } },
  // 天品
  { id: 'metal_burst', name: '万剑归宗', type: 'divine', rarity: 'gold', element: 'metal', multiplier: 4.5, cdTurns: 10, description: '造成450%伤害,40%流血3回合', debuff: { type: 'bleed', chance: 0.40, duration: 3 } },
  { id: 'quake_stomp', name: '地裂天崩', type: 'divine', rarity: 'gold', element: 'earth', multiplier: 3.8, cdTurns: 9, description: '造成380%伤害,30%眩晕1回合,自身防御+20% 3回合', debuff: { type: 'stun', chance: 0.30, duration: 1 }, buff: { type: 'def_up', duration: 3, value: 0.20 } },
  { id: 'life_drain', name: '噬魂大法', type: 'divine', rarity: 'gold', element: 'wood', multiplier: 3.5, cdTurns: 8, description: '造成350%伤害并吸血,40%降低敌方攻击20% 3回合', debuff: { type: 'atk_down', chance: 0.40, duration: 3, value: 0.20 } },
  { id: 'inferno_burst', name: '九天玄火阵', type: 'divine', rarity: 'gold', element: 'fire', multiplier: 3.5, cdTurns: 10, description: '[群攻] 全体350%伤害,50%灼烧4回合', debuff: { type: 'burn', chance: 0.50, duration: 4 }, isAoe: true },
  { id: 'storm_blade', name: '暴风斩', type: 'divine', rarity: 'gold', element: 'metal', multiplier: 3.8, cdTurns: 8, description: '[5段] 单体5×76%伤害,每段40%流血', debuff: { type: 'bleed', chance: 0.40, duration: 3 }, hitCount: 5 },
  { id: 'heaven_heal', name: '天地归元', type: 'divine', rarity: 'gold', element: 'wood', multiplier: 0, cdTurns: 10, description: '回复400%攻击力气血,每回合回8% 4回合', buff: { type: 'regen', duration: 4, valuePercent: 0.08 }, healAtkRatio: 4.0 },
  // 仙品
  { id: 'time_stop', name: '时光凝滞', type: 'divine', rarity: 'red', element: null, multiplier: 0, cdTurns: 12, description: '[群攻] 全体冻结2回合,自身攻击+25% 3回合', debuff: { type: 'freeze', chance: 1.0, duration: 2 }, buff: { type: 'atk_up', duration: 3, value: 0.25 }, isAoe: true },
  { id: 'heavenly_wrath', name: '天罚雷劫', type: 'divine', rarity: 'red', element: 'metal', multiplier: 5.8, cdTurns: 12, description: '造成580%伤害,40%眩晕1回合', debuff: { type: 'stun', chance: 0.40, duration: 1 } },
];

// 被动功法 (19 个)
export const PASSIVE_SKILLS: Skill[] = [
  // 灵品
  { id: 'body_refine', name: '金刚体', type: 'passive', rarity: 'green', element: 'earth', multiplier: 0, description: '防御+10%,土抗+10%', effect: { DEF_percent: 10, RESIST_EARTH: 0.10 } },
  { id: 'flame_body', name: '焚体诀', type: 'passive', rarity: 'green', element: 'fire', multiplier: 0, description: '攻击+8%,火抗+10%', effect: { ATK_percent: 8, RESIST_FIRE: 0.10 } },
  { id: 'water_flow', name: '流水心法', type: 'passive', rarity: 'green', element: 'water', multiplier: 0, description: '每回合回2%气血,水抗+10%', effect: { regen_per_turn_percent: 0.02, RESIST_WATER: 0.10 } },
  { id: 'root_grip', name: '盘根术', type: 'passive', rarity: 'green', element: 'wood', multiplier: 0, description: '气血+10%,木抗+10%', effect: { HP_percent: 10, RESIST_WOOD: 0.10 } },
  { id: 'metal_skin', name: '金身术', type: 'passive', rarity: 'green', element: 'metal', multiplier: 0, description: '防御+8%,金抗+10%', effect: { DEF_percent: 8, RESIST_METAL: 0.10 } },
  // 玄品
  { id: 'swift_step', name: '凌波微步', type: 'passive', rarity: 'blue', element: 'water', multiplier: 0, description: '闪避+5%,暴击率+4%,水抗+10%', effect: { DODGE_flat: 0.05, CRIT_RATE_flat: 0.04, RESIST_WATER: 0.10 } },
  { id: 'iron_skin', name: '铁布衫', type: 'passive', rarity: 'blue', element: 'metal', multiplier: 0, description: '防御+10%,控制抗性+10%,被暴击反弹10%', effect: { DEF_percent: 10, RESIST_CTRL: 0.10, reflect_on_crit_taken: 0.10 } },
  { id: 'thorn_aura', name: '荆棘之体', type: 'passive', rarity: 'blue', element: 'wood', multiplier: 0, description: '反弹8%伤害,木抗+15%,被打10%中毒2回合', effect: { reflect_damage_percent: 0.08, RESIST_WOOD: 0.15, poison_on_hit_taken_chance: 0.10 } },
  { id: 'flame_aura', name: '焚身火甲', type: 'passive', rarity: 'blue', element: 'fire', multiplier: 0, description: '攻击+8%,火抗+15%,被打10%灼烧2回合', effect: { ATK_percent: 8, RESIST_FIRE: 0.15, burn_on_hit_taken_chance: 0.10 } },
  { id: 'earth_wall', name: '厚土心法', type: 'passive', rarity: 'blue', element: 'earth', multiplier: 0, description: '防御+8%,气血+6%,土抗+15%', effect: { DEF_percent: 8, HP_percent: 6, RESIST_EARTH: 0.15 } },
  // 地品
  { id: 'crit_master', name: '破绽感知', type: 'passive', rarity: 'purple', element: 'metal', multiplier: 0, description: '暴击率+6%,暴击伤害+18%', effect: { CRIT_RATE_flat: 0.06, CRIT_DMG_flat: 0.18 } },
  { id: 'earth_fortitude', name: '不动如山', type: 'passive', rarity: 'purple', element: 'earth', multiplier: 0, description: '防御+12%,气血+10%,控制抗性+20%', effect: { DEF_percent: 12, HP_percent: 10, RESIST_CTRL: 0.20 } },
  { id: 'poison_body', name: '百毒不侵', type: 'passive', rarity: 'purple', element: 'wood', multiplier: 0, description: '木抗+30%,控制抗性+10%,吸血+5%', effect: { RESIST_WOOD: 0.30, RESIST_CTRL: 0.10, LIFESTEAL_flat: 0.05 } },
  { id: 'fire_mastery', name: '焚天之体', type: 'passive', rarity: 'purple', element: 'fire', multiplier: 0, description: '攻击+12%,火抗+20%', effect: { ATK_percent: 12, RESIST_FIRE: 0.20 } },
  { id: 'dot_amplifier', name: '万毒归一', type: 'passive', rarity: 'purple', element: 'wood', multiplier: 0, description: '你造成的灼烧/中毒/流血伤害+25%,攻击+6%,暴击率+3%', effect: { dot_amplifier_percent: 25, ATK_percent: 6, CRIT_RATE_flat: 0.03 } },
  { id: 'phantom_step', name: '飘渺神行', type: 'passive', rarity: 'purple', element: 'water', multiplier: 0, description: '闪避+8%,闪避后下次攻击必暴击,速度+8%', effect: { DODGE_flat: 0.08, crit_after_dodge: true, SPD_percent: 8 } },
  { id: 'healing_spring', name: '春风化雨', type: 'passive', rarity: 'purple', element: 'wood', multiplier: 0, description: '你受到的治疗+30%,每回合回血+2%,水/木抗+10%', effect: { heal_amplifier_percent: 30, regen_per_turn_percent: 0.02, RESIST_WATER: 0.10, RESIST_WOOD: 0.10 } },
  // 天品
  { id: 'water_mastery', name: '渊海之心', type: 'passive', rarity: 'gold', element: 'water', multiplier: 0, description: '每回合回3%血,水抗+20%,防御+12%', effect: { regen_per_turn_percent: 0.03, RESIST_WATER: 0.20, DEF_percent: 12 } },
  { id: 'battle_frenzy', name: '战意沸腾', type: 'passive', rarity: 'gold', element: null, multiplier: 0, description: '攻击+15%, 会心率+5%, 会心伤害+18%', effect: { ATK_percent: 15, CRIT_RATE_flat: 0.05, CRIT_DMG_flat: 0.18 } },
  { id: 'heavenly_body', name: '不灭金身', type: 'passive', rarity: 'gold', element: 'earth', multiplier: 0, description: '防御+15%,减伤8%,土抗+25%,免死1次保留20%血', effect: { DEF_percent: 15, damage_reduction_flat: 0.08, RESIST_EARTH: 0.25, revive_once: true } },
  // 仙品
  { id: 'dao_heart', name: '道心通明', type: 'passive', rarity: 'red', element: null, multiplier: 0, description: '全属性+12%,全五行抗+10%,控抗+15%,所有神通CD-1', effect: { ATK_percent: 12, DEF_percent: 12, HP_percent: 12, RESIST_METAL: 0.10, RESIST_WOOD: 0.10, RESIST_WATER: 0.10, RESIST_FIRE: 0.10, RESIST_EARTH: 0.10, RESIST_CTRL: 0.15, skill_cd_reduction_turns: 1 } },
  { id: 'five_elements_harmony', name: '五行归一', type: 'passive', rarity: 'red', element: null, multiplier: 0, description: '攻防血+8%,全五行抗+15%', effect: { ATK_percent: 8, DEF_percent: 8, HP_percent: 8, RESIST_METAL: 0.15, RESIST_WOOD: 0.15, RESIST_WATER: 0.15, RESIST_FIRE: 0.15, RESIST_EARTH: 0.15 } },
];

export const ALL_SKILLS = [...ACTIVE_SKILLS, ...DIVINE_SKILLS, ...PASSIVE_SKILLS];

// 名称到ID映射(自动生成)
export const SKILL_NAME_TO_ID: Record<string, string> = ALL_SKILLS.reduce((map, s) => {
  map[s.name] = s.id;
  return map;
}, {} as Record<string, string>);
