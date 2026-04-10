import type { BattlerStats, BattleLogEntry, BattleResult, MonsterTemplate, MonsterBattleInfo, DropItem, CharacterData } from './types';
import { getElementMultiplier } from './data';
import { generateEquipment } from './equipData';

// 已装备功法信息（传入战斗引擎用）
export type DebuffType = 'burn' | 'poison' | 'bleed' | 'freeze' | 'stun' | 'slow' | 'brittle' | 'atk_down' | 'root' | 'silence';
export type BuffType = 'atk_up' | 'def_up' | 'spd_up' | 'crit_up' | 'shield' | 'regen' | 'reflect' | 'immune';

export interface SkillDebuffInfo {
  type: DebuffType;
  chance: number;
  duration: number;
  value?: number;
}

export interface SkillBuffInfo {
  type: BuffType;
  duration: number;
  value?: number;
  valuePercent?: number;
}

export interface SkillRefInfo {
  name: string;
  multiplier: number;
  cdTurns?: number;
  element: string | null;
  debuff?: SkillDebuffInfo;
  buff?: SkillBuffInfo;
  ignoreDef?: number;
  isAoe?: boolean;
  targetCount?: number;   // 2=打2只, 3=打3只
  hitCount?: number;      // 多段攻击
  healAtkRatio?: number;  // 即时回血(攻击力倍率)
}

export interface EquippedSkillInfo {
  activeSkill: SkillRefInfo | null;
  divineSkills: SkillRefInfo[];
  passiveEffects: {
    atkPercent: number; defPercent: number; hpPercent: number; spdPercent: number;
    critRate: number; critDmg: number; dodge: number; lifesteal: number;
    resistFire: number; resistWater: number; resistWood: number; resistMetal: number; resistEarth: number; resistCtrl: number;
    regenPerTurn: number; damageReductionFlat: number; reflectPercent: number;
    poisonOnHitTaken?: number; burnOnHitTaken?: number; reflectOnCrit?: number;
    reviveOnce?: boolean; skillCdReduction?: number;
  };
}

// 战斗中的 debuff 状态
interface ActiveDebuff {
  type: DebuffType;
  remaining: number;
  damagePerTurn: number;  // 仅 burn/poison/bleed
  value?: number;          // brittle (DEF降低%) / atk_down (ATK降低%)
}

interface ActiveBuff {
  type: BuffType;
  remaining: number;
  value?: number;
  valuePercent?: number;
}

// 洞府战斗加成
export interface CaveBonusInfo {
  skillRate: number;     // 功法掉率加成 %
  equipQuality: number;  // 装备品质偏移
}

let _caveBonus: CaveBonusInfo = { skillRate: 0, equipQuality: 0 };
export function setCaveBonus(b: CaveBonusInfo) {
  _caveBonus = b;
}

// 装备的福缘加成 (百分比)
let _equipLuck = 0;
export function setEquipLuck(luck: number) {
  _equipLuck = luck;
}

// 装备的灵气浓度加成 (百分比)
let _spiritDensity = 0;
export function setSpiritDensity(v: number) {
  _spiritDensity = v;
}
export function getSpiritDensity(): number {
  return _spiritDensity;
}

// 装备的战斗扩展属性
let _equipCombatStats = { armorPen: 0, accuracy: 0, elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 } };
export function setEquipCombatStats(stats: typeof _equipCombatStats) {
  _equipCombatStats = stats;
}

// ========== 怪物技能系统 ==========

interface MonsterSkillDef {
  name: string;
  multiplier: number;        // 伤害倍率 (1.0=普攻级, 0=纯辅助)
  cdTurns: number;            // 冷却回合
  element: string | null;
  debuff?: SkillDebuffInfo;
  buff?: { type: 'atk_up' | 'def_up'; value: number; duration: number };  // 怪物自身buff
  hitCount?: number;          // 多段攻击 (每段 = 倍率/hitCount)
  healPercent?: number;       // 自身回血 (最大血量百分比, 如0.15=回15%血)
  isHeal?: boolean;           // 标记为回复技能 (AI低血量优先释放)
  description: string;
}

// 怪物运行时技能状态
interface MonsterSkillState {
  skills: MonsterSkillDef[];
  cds: number[];
  berserkTriggered: boolean;  // 狂暴是否已触发
  bossEnrageTriggered: boolean; // Boss低血量强化
}

// 按 tier 和 element 生成怪物技能池
function buildMonsterSkillPool(template: MonsterTemplate): MonsterSkillDef[] {
  const tier = parseInt(template.drop_table.replace(/\D/g, '')) || 1;
  const elem = template.element;
  const isBoss = template.role === 'boss';
  const role = template.role;
  const skills: MonsterSkillDef[] = [];

  // ===== T1+: 基础属性攻击 =====
  if (elem) {
    const elemSkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '喷火', multiplier: 1.5, cdTurns: 3, element: 'fire',
               debuff: { type: 'burn', chance: 0.15, duration: 2 }, description: '喷出火焰,15%灼烧2回合' },
      water: { name: '水箭术', multiplier: 1.4, cdTurns: 3, element: 'water',
               debuff: { type: 'slow', chance: 0.20, duration: 2 }, description: '射出水箭,20%减速2回合' },
      wood:  { name: '毒液喷射', multiplier: 1.3, cdTurns: 3, element: 'wood',
               debuff: { type: 'poison', chance: 0.25, duration: 2 }, description: '喷射毒液,25%中毒2回合' },
      metal: { name: '利爪', multiplier: 1.5, cdTurns: 3, element: 'metal',
               debuff: { type: 'bleed', chance: 0.15, duration: 2 }, description: '锋利爪击,15%流血2回合' },
      earth: { name: '飞石术', multiplier: 1.4, cdTurns: 3, element: 'earth',
               debuff: { type: 'brittle', chance: 0.15, duration: 2, value: 0.15 }, description: '投掷巨石,15%脆弱2回合' },
    };
    if (elemSkills[elem]) skills.push(elemSkills[elem]);
  }

  // T2+: 通用眩晕技能 (让控制抗性从早期就有作用)
  if (tier >= 2) {
    skills.push({
      name: '蛮力撞击', multiplier: 1.6, cdTurns: 5, element: null,
      debuff: { type: 'stun', chance: 0.20, duration: 1 },
      description: '猛烈撞击,20%眩晕1回合',
    });
  }

  // T2+: 多段攻击 (按role区分)
  if (tier >= 2 && role === 'dps') {
    skills.push({
      name: '连续撕咬', multiplier: 2.0, cdTurns: 4, element: null,
      hitCount: 3, description: '连续撕咬3段,总计200%伤害',
    });
  }
  if (tier >= 2 && role === 'speed') {
    skills.push({
      name: '疾风连击', multiplier: 1.8, cdTurns: 3, element: null,
      hitCount: 4, description: '疾风般连击4段,总计180%伤害',
    });
  }

  // T2+: tank/boss回复技能
  if (tier >= 2 && (role === 'tank' || role === 'boss')) {
    skills.push({
      name: '吞噬灵气', multiplier: 0, cdTurns: 6, element: null,
      healPercent: 0.10, isHeal: true,
      description: '吸收周围灵气,回复10%最大气血',
    });
  }

  // ===== T3+: 强化属性攻击 =====
  if (tier >= 3 && elem) {
    const strongSkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '烈焰吐息', multiplier: 2.2, cdTurns: 5, element: 'fire',
               debuff: { type: 'burn', chance: 0.30, duration: 3 }, description: '高温火息,30%灼烧3回合' },
      water: { name: '寒冰刺', multiplier: 2.0, cdTurns: 5, element: 'water',
               debuff: { type: 'freeze', chance: 0.20, duration: 1 }, description: '冰锥攻击,20%冻结1回合' },
      wood:  { name: '缠绕荆棘', multiplier: 1.8, cdTurns: 5, element: 'wood',
               debuff: { type: 'root', chance: 0.30, duration: 2 }, description: '荆棘缠绕,30%束缚2回合' },
      metal: { name: '破甲斩', multiplier: 2.2, cdTurns: 5, element: 'metal',
               debuff: { type: 'brittle', chance: 0.25, duration: 3, value: 0.20 }, description: '重斩破甲,25%脆弱3回合' },
      earth: { name: '震地击', multiplier: 2.0, cdTurns: 5, element: 'earth',
               debuff: { type: 'stun', chance: 0.15, duration: 1 }, description: '震地攻击,15%眩晕1回合' },
    };
    if (strongSkills[elem]) skills.push(strongSkills[elem]);
  }

  // T3+: 封印技能 (让控制抗性更有价值)
  if (tier >= 3) {
    skills.push({
      name: '妖气封印', multiplier: 1.0, cdTurns: 7, element: null,
      debuff: { type: 'silence', chance: 0.30, duration: 2 },
      description: '妖气缠身,30%封印2回合(无法施展神通)',
    });
  }

  // T3+: 通用多段
  if (tier >= 3 && !['dps', 'speed'].includes(role)) {
    skills.push({
      name: '乱爪', multiplier: 2.4, cdTurns: 5, element: null,
      hitCount: 3, description: '疯狂乱抓3段,总计240%伤害',
    });
  }

  // ===== T4+: 回复 + 控制升级 =====
  if (tier >= 4) {
    // 更强的回复
    skills.push({
      name: '妖力恢复', multiplier: 0, cdTurns: 8, element: null,
      healPercent: 0.15, isHeal: true,
      description: '凝聚妖力,回复15%最大气血',
    });
    // 强眩晕
    skills.push({
      name: '咆哮震慑', multiplier: 1.8, cdTurns: 6, element: null,
      debuff: { type: 'stun', chance: 0.30, duration: 1 },
      description: '威压咆哮,30%眩晕1回合',
    });
  }

  // T4+: 多段属性攻击
  if (tier >= 4 && elem) {
    const multiHitSkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '连环火弹', multiplier: 2.8, cdTurns: 6, element: 'fire', hitCount: 4,
               debuff: { type: 'burn', chance: 0.15, duration: 2 }, description: '连射4枚火弹,每段15%灼烧' },
      water: { name: '冰晶乱射', multiplier: 2.4, cdTurns: 6, element: 'water', hitCount: 3,
               debuff: { type: 'freeze', chance: 0.12, duration: 1 }, description: '冰晶乱射3段,每段12%冻结' },
      wood:  { name: '荆棘连刺', multiplier: 2.4, cdTurns: 6, element: 'wood', hitCount: 4,
               debuff: { type: 'poison', chance: 0.15, duration: 2 }, description: '荆棘连刺4段,每段15%中毒' },
      metal: { name: '暴风利刃', multiplier: 3.0, cdTurns: 6, element: 'metal', hitCount: 5,
               debuff: { type: 'bleed', chance: 0.12, duration: 2 }, description: '利刃暴风5段,每段12%流血' },
      earth: { name: '碎石连击', multiplier: 2.6, cdTurns: 6, element: 'earth', hitCount: 3,
               debuff: { type: 'stun', chance: 0.10, duration: 1 }, description: '碎石连击3段,每段10%眩晕' },
    };
    if (multiHitSkills[elem]) skills.push(multiHitSkills[elem]);
  }

  // ===== T5+: 狂暴 + 高级技能 =====
  if (tier >= 5) {
    skills.push({
      name: '狂暴', multiplier: 0, cdTurns: 10, element: null,
      buff: { type: 'atk_up', value: 0.40, duration: 4 },
      description: '攻击+40%持续4回合,但防御-20%',
    });
    // 束缚+伤害
    skills.push({
      name: '锁魂术', multiplier: 1.5, cdTurns: 7, element: null,
      debuff: { type: 'root', chance: 0.40, duration: 2 },
      description: '锁魂束缚,40%束缚2回合(强制后手)',
    });
  }

  // T5+: 高级多段 + 眩晕连击
  if (tier >= 5) {
    skills.push({
      name: '雷霆万钧', multiplier: 3.0, cdTurns: 7, element: 'metal', hitCount: 3,
      debuff: { type: 'stun', chance: 0.20, duration: 1 },
      description: '雷霆3段打击,每段20%眩晕',
    });
  }

  // ===== T6+: 终极技能 =====
  if (tier >= 6 && elem) {
    const t6Skills: Record<string, MonsterSkillDef> = {
      fire:  { name: '焚天', multiplier: 3.0, cdTurns: 8, element: 'fire',
               debuff: { type: 'burn', chance: 0.50, duration: 3 }, description: '天火焚世,50%灼烧3回合' },
      water: { name: '极寒领域', multiplier: 2.5, cdTurns: 8, element: 'water',
               debuff: { type: 'freeze', chance: 0.35, duration: 2 }, description: '极寒冰封,35%冻结2回合' },
      wood:  { name: '万毒噬心', multiplier: 2.5, cdTurns: 8, element: 'wood',
               debuff: { type: 'poison', chance: 0.50, duration: 4 }, description: '剧毒入体,50%中毒4回合' },
      metal: { name: '斩魂', multiplier: 3.5, cdTurns: 8, element: 'metal',
               debuff: { type: 'bleed', chance: 0.40, duration: 3 }, description: '斩魂一击,40%流血3回合' },
      earth: { name: '山崩地裂', multiplier: 2.8, cdTurns: 8, element: 'earth',
               debuff: { type: 'stun', chance: 0.25, duration: 2 }, description: '山崩天降,25%眩晕2回合' },
    };
    if (t6Skills[elem]) skills.push(t6Skills[elem]);
  }

  // T6+: 强力回复
  if (tier >= 6) {
    skills.push({
      name: '涅槃重生', multiplier: 0, cdTurns: 12, element: null,
      healPercent: 0.25, isHeal: true,
      buff: { type: 'def_up', value: 0.20, duration: 3 },
      description: '涅槃之力,回复25%气血并防御+20%持续3回合',
    });
  }

  // T6+: 极强多段
  if (tier >= 6) {
    skills.push({
      name: '千刃绞杀', multiplier: 4.0, cdTurns: 9, element: null, hitCount: 5,
      debuff: { type: 'bleed', chance: 0.20, duration: 3 },
      description: '刃雨绞杀5段,每段20%流血,总计400%伤害',
    });
  }

  // ===== T7+: 仙级技能 =====
  if (tier >= 7) {
    // 仙级眩晕
    skills.push({
      name: '天雷制裁', multiplier: 3.5, cdTurns: 8, element: 'metal',
      debuff: { type: 'stun', chance: 0.40, duration: 2 },
      description: '召唤天雷,40%眩晕2回合',
    });
    // 仙级多段
    skills.push({
      name: '灭世连击', multiplier: 5.0, cdTurns: 10, element: null, hitCount: 6,
      debuff: { type: 'stun', chance: 0.10, duration: 1 },
      description: '毁灭连击6段,每段10%眩晕,总计500%伤害',
    });
    // 仙级回复
    skills.push({
      name: '天地造化', multiplier: 0, cdTurns: 15, element: null,
      healPercent: 0.35, isHeal: true,
      description: '汲取天地精华,回复35%最大气血',
    });
  }

  // ===== T8: 太古技能 =====
  if (tier >= 8) {
    skills.push({
      name: '混沌吞噬', multiplier: 6.0, cdTurns: 10, element: null, hitCount: 4,
      debuff: { type: 'stun', chance: 0.25, duration: 2 },
      description: '混沌之力4段,每段25%眩晕,总计600%伤害',
    });
    skills.push({
      name: '太古沉眠', multiplier: 0, cdTurns: 15, element: null,
      healPercent: 0.40, isHeal: true,
      buff: { type: 'def_up', value: 0.40, duration: 4 },
      description: '太古之力,回复40%气血并防御+40%持续4回合',
    });
  }

  // ===== Boss额外技能 =====
  if (isBoss) {
    // 所有Boss: 首领之吼
    skills.push({
      name: '首领之吼', multiplier: 1.2, cdTurns: 6, element: null,
      debuff: { type: 'atk_down', chance: 0.40, duration: 3, value: 0.15 },
      description: '威压吼叫,40%降低目标攻击15%持续3回合',
    });

    // T2+ Boss: 回复
    if (tier >= 2) {
      skills.push({
        name: '首领恢复', multiplier: 0, cdTurns: 8, element: null,
        healPercent: 0.12, isHeal: true,
        description: '首领凝聚妖力,回复12%最大气血',
      });
    }

    // T3+ Boss: 震慑眩晕
    if (tier >= 3) {
      skills.push({
        name: '威压震慑', multiplier: 2.0, cdTurns: 7, element: null,
        debuff: { type: 'stun', chance: 0.35, duration: 1 },
        description: '首领威压,35%眩晕1回合',
      });
    }

    // T4+ Boss: 凶煞之气
    if (tier >= 4) {
      skills.push({
        name: '凶煞之气', multiplier: 0, cdTurns: 8, element: null,
        buff: { type: 'def_up', value: 0.30, duration: 4 },
        description: '凶煞护体,防御+30%持续4回合',
      });
    }

    // T5+ Boss: 多段重击
    if (tier >= 5) {
      skills.push({
        name: '首领乱舞', multiplier: 3.5, cdTurns: 7, element: null, hitCount: 4,
        debuff: { type: 'bleed', chance: 0.25, duration: 3 },
        description: '首领狂乱4段攻击,每段25%流血',
      });
    }

    // T6+ Boss: 封印+眩晕连招
    if (tier >= 6) {
      skills.push({
        name: '灭世怒吼', multiplier: 2.5, cdTurns: 9, element: null,
        debuff: { type: 'stun', chance: 0.45, duration: 2 },
        description: '灭世吼叫,45%眩晕2回合',
      });
    }

    // T7+ Boss: 终极连击
    if (tier >= 7) {
      skills.push({
        name: '首领灭杀', multiplier: 5.5, cdTurns: 10, element: null, hitCount: 5,
        debuff: { type: 'stun', chance: 0.15, duration: 1 },
        description: '首领灭杀5段,每段15%眩晕,总计550%伤害',
      });
    }
  }

  return skills;
}

// 初始化怪物技能运行状态
function initMonsterSkillState(template: MonsterTemplate): MonsterSkillState {
  const skills = buildMonsterSkillPool(template);
  return {
    skills,
    cds: skills.map(() => 0),
    berserkTriggered: false,
    bossEnrageTriggered: false,
  };
}

// 怪物AI选择技能（返回 null 表示普通攻击）
function monsterChooseSkill(
  state: MonsterSkillState,
  monsterHp: number,
  monsterMaxHp: number,
  isBoss: boolean
): MonsterSkillDef | null {
  const hpRatio = monsterHp / monsterMaxHp;

  // 低血量时优先回复技能 (血量<40%时寻找可用的回复技能)
  if (hpRatio < 0.40) {
    let bestHeal: { skill: MonsterSkillDef; index: number } | null = null;
    for (let i = 0; i < state.skills.length; i++) {
      if (state.cds[i] <= 0 && state.skills[i].isHeal) {
        const s = state.skills[i];
        if (!bestHeal || (s.healPercent || 0) > (bestHeal.skill.healPercent || 0)) {
          bestHeal = { skill: s, index: i };
        }
      }
    }
    if (bestHeal) {
      state.cds[bestHeal.index] = bestHeal.skill.cdTurns;
      return bestHeal.skill;
    }
  }

  // 正常选技：优先高倍率攻击技能，buff技能次之
  let best: { skill: MonsterSkillDef; index: number } | null = null;
  for (let i = 0; i < state.skills.length; i++) {
    if (state.cds[i] <= 0) {
      const s = state.skills[i];
      if (s.isHeal) continue; // 血量充足时不主动用回复
      // 优先级: 高倍率 > 相同倍率时选CD更长的(更强的技能)
      if (!best || s.multiplier > best.skill.multiplier || (s.multiplier === best.skill.multiplier && (s.cdTurns > best.skill.cdTurns))) {
        best = { skill: s, index: i };
      }
    }
  }

  if (best) {
    state.cds[best.index] = best.skill.cdTurns;
    return best.skill;
  }
  return null;
}

// 每回合递减怪物技能CD
function tickMonsterCds(state: MonsterSkillState) {
  for (let i = 0; i < state.cds.length; i++) {
    if (state.cds[i] > 0) state.cds[i]--;
  }
}

// 随机数辅助
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// 根据怪物模板生成战斗属性（含浮动）
export function generateMonsterStats(template: MonsterTemplate): BattlerStats {
  const fluctuation = 0.15;
  const power = template.power * randFloat(1 - fluctuation, 1 + fluctuation);

  // 根据role分配属性
  const ratios: Record<string, { hp: number; atk: number; def: number; spd: number }> = {
    balanced: { hp: 0.30, atk: 0.30, def: 0.25, spd: 0.15 },
    tank:     { hp: 0.40, atk: 0.15, def: 0.35, spd: 0.10 },
    dps:      { hp: 0.20, atk: 0.45, def: 0.15, spd: 0.20 },
    speed:    { hp: 0.20, atk: 0.25, def: 0.15, spd: 0.40 },
    boss:     { hp: 0.35, atk: 0.30, def: 0.25, spd: 0.10 },
  };

  const r = ratios[template.role] || ratios.balanced;
  const maxHp = Math.floor(power * r.hp * 10);

  // 怪物对自己属性有 40% 抗性, 控制抗性 10%
  const monsterResists = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0.10 };
  if (template.element && template.element in monsterResists) {
    (monsterResists as any)[template.element] = 0.40;
  }

  // 按 tier 和 role 分配特殊属性
  const tier = parseInt(template.drop_table.replace(/\D/g, '')) || 1;
  const role = template.role;

  // 暴击: tier越高越强, dps/speed/boss额外加成
  let critRate = 0.05 + tier * 0.01;
  let critDmg = 1.5 + tier * 0.05;
  if (role === 'dps') { critRate += 0.05; critDmg += 0.2; }
  if (role === 'boss') { critRate += 0.03; critDmg += 0.3; }

  // 闪避: speed型有闪避, tier越高越多
  let dodge = 0;
  if (role === 'speed') dodge = 0.05 + tier * 0.02;
  if (role === 'dps') dodge = tier * 0.01;
  if (role === 'boss') dodge = 0.02 + tier * 0.005;

  // 吸血: boss和高tier dps有吸血
  let lifesteal = 0;
  if (role === 'boss' && tier >= 3) lifesteal = 0.03 + tier * 0.005;
  if (role === 'dps' && tier >= 5) lifesteal = 0.02;

  // 破甲: dps和boss有破甲
  let armorPen = 0;
  if (role === 'dps') armorPen = tier * 1.5;
  if (role === 'boss') armorPen = tier * 2;

  // 命中: 对抗玩家闪避
  let accuracy = tier * 1;
  if (role === 'boss') accuracy = tier * 2;

  // 控制抗性: boss更高
  let ctrlResist = 0.10 + tier * 0.03;
  if (role === 'boss') ctrlResist = 0.20 + tier * 0.05;
  ctrlResist = Math.min(0.70, ctrlResist);

  monsterResists.ctrl = ctrlResist;

  return {
    name: template.name,
    maxHp,
    hp: maxHp,
    atk: Math.floor(power * r.atk),
    def: Math.floor(power * r.def * 0.6),
    spd: Math.floor(power * r.spd * 0.3),
    crit_rate: Math.min(0.50, critRate),
    crit_dmg: Math.min(3.0, critDmg),
    dodge: Math.min(0.30, dodge),
    lifesteal: Math.min(0.15, lifesteal),
    element: template.element,
    resists: monsterResists,
    armorPen: Math.min(30, armorPen),
    accuracy: Math.min(25, accuracy),
  };
}

// 根据角色数据生成战斗属性
export function characterToBattler(char: CharacterData): BattlerStats {
  return {
    name: char.name,
    maxHp: char.max_hp,
    hp: char.max_hp,
    atk: char.atk,
    def: char.def,
    spd: char.spd,
    crit_rate: Number(char.crit_rate),
    crit_dmg: Number(char.crit_dmg),
    dodge: Number(char.dodge),
    lifesteal: Number(char.lifesteal),
    element: char.spiritual_root,
    resists: {
      metal: Number(char.resist_metal || 0),
      wood:  Number(char.resist_wood  || 0),
      water: Number(char.resist_water || 0),
      fire:  Number(char.resist_fire  || 0),
      earth: Number(char.resist_earth || 0),
      ctrl:  Number(char.resist_ctrl  || 0),
    },
    spiritualRoot: char.spiritual_root,
  };
}

// 计算伤害
function calculateDamage(
  attacker: BattlerStats,
  defender: BattlerStats,
  skillMultiplier: number = 1.0,
  skillElement: string | null = null,
  ignoreDef: number = 0,
  ignoreDodge: boolean = false
): { damage: number; isCrit: boolean } {
  const useElement = skillElement || attacker.element;
  const elementMulti = getElementMultiplier(useElement, defender.element);

  let resistFactor = 1.0;
  if (useElement && defender.resists) {
    const r = (defender.resists as any)[useElement] || 0;
    resistFactor = 1.0 - Math.min(0.7, r);
  }

  // 无视防御 (技能 ignoreDef + 装备 armorPen)
  const totalArmorPen = ignoreDef + (attacker.armorPen || 0) / 100;
  const effectiveDef = defender.def * Math.max(0, 1 - totalArmorPen);
  const atkDefRatio = attacker.atk / (attacker.atk + effectiveDef * 0.5);

  // 元素强化加成
  let elementDmgBonus = 1.0;
  if (useElement && attacker.elementDmg) {
    const ed = (attacker.elementDmg as any)[useElement] || 0;
    elementDmgBonus = 1 + ed / 100;
  }

  let damage = attacker.atk * skillMultiplier * elementMulti * resistFactor * atkDefRatio * elementDmgBonus;

  const isCrit = Math.random() < attacker.crit_rate;
  if (isCrit) {
    damage *= attacker.crit_dmg;
  }

  // 闪避: 受命中影响 (effective_dodge = max(0, dodge - accuracy))
  if (!ignoreDodge) {
    const effectiveDodge = Math.max(0, defender.dodge - (attacker.accuracy || 0) / 100);
    if (Math.random() < effectiveDodge) {
      return { damage: 0, isCrit: false };
    }
  }

  damage = Math.max(1, Math.floor(damage));
  return { damage, isCrit };
}

// 怪物技能描述（从真实技能池生成）
function getMonsterSkills(template: MonsterTemplate): string[] {
  const skills: string[] = ['普通攻击 - 基础攻击'];
  const pool = buildMonsterSkillPool(template);
  for (const s of pool) {
    skills.push(`${s.name} - ${s.description} (CD${s.cdTurns}回合)`);
  }
  if (template.role === 'boss') {
    skills.push('首领被动 - 气血低于30%时攻击永久+30%');
  }
  return skills;
}

// 生成怪物战斗信息
export function buildMonsterInfo(template: MonsterTemplate, stats: BattlerStats): MonsterBattleInfo {
  return {
    name: template.name,
    element: template.element,
    power: template.power,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    role: template.role,
    skills: getMonsterSkills(template),
  };
}

// 执行一波战斗 (1 vs 多只怪)
export function runWaveBattle(
  playerStats: BattlerStats,
  monsterList: { stats: BattlerStats; template: MonsterTemplate }[],
  equippedSkills?: EquippedSkillInfo
): BattleResult {
  // 合并所有怪的战斗为一场大战
  // 玩家每回合攻击一只(血量最低的), 所有存活怪每回合攻击玩家
  const player = { ...playerStats, hp: playerStats.maxHp };
  const maxTurns = 50 * monsterList.length; // 回合上限按怪物数量放宽
  const logs: BattleLogEntry[] = [];
  let totalExp = 0, totalStone = 0;
  const allDrops: DropItem[] = [];

  // 怪物列表(可变血量+技能状态)
  const monsters = monsterList.map(m => ({
    stats: { ...m.stats },
    template: m.template,
    alive: true,
    skillState: initMonsterSkillState(m.template),
    baseAtk: m.stats.atk,
    baseDef: m.stats.def,
    buffs: [] as ActiveBuff[],
    frozenTurns: 0,  // 冻结/眩晕剩余回合
  }));

  // 应用被动
  if (equippedSkills?.passiveEffects) {
    const p = equippedSkills.passiveEffects;
    player.atk = Math.floor(player.atk * (1 + p.atkPercent / 100));
    player.def = Math.floor(player.def * (1 + p.defPercent / 100));
    player.maxHp = Math.floor(player.maxHp * (1 + p.hpPercent / 100));
    player.spd = Math.floor(player.spd * (1 + (p.spdPercent || 0) / 100));
    player.hp = player.maxHp;
    player.crit_rate += p.critRate;
    player.crit_dmg += p.critDmg;
    player.dodge += p.dodge || 0;
    player.lifesteal += p.lifesteal || 0;
  }
  player.armorPen = _equipCombatStats.armorPen;
  player.accuracy = _equipCombatStats.accuracy;
  player.elementDmg = _equipCombatStats.elementDmg;

  const activeSkill: SkillRefInfo = equippedSkills?.activeSkill || { name: '基础剑法', multiplier: 1.0, element: null };
  const cdReduction = equippedSkills?.passiveEffects?.skillCdReduction || 0;
  const divineCds: number[] = (equippedSkills?.divineSkills || []).map(() => 0);
  let reviveAvailable = equippedSkills?.passiveEffects?.reviveOnce || false;

  // 遭遇日志
  const names = monsters.map(m => m.stats.name).join('、');
  logs.push({ turn: 0, text: `你遭遇了 ${monsters.length} 只怪物: ${names}`, type: 'system',
    playerHp: player.hp, playerMaxHp: player.maxHp, monsterHp: 0, monsterMaxHp: 0 });

  for (let turn = 1; turn <= maxTurns; turn++) {
    const aliveMonsters = monsters.filter(m => m.alive);
    if (aliveMonsters.length === 0) break;

    // 被动回血
    if (equippedSkills?.passiveEffects?.regenPerTurn && equippedSkills.passiveEffects.regenPerTurn > 0) {
      const heal = Math.floor(player.maxHp * equippedSkills.passiveEffects.regenPerTurn);
      if (heal > 0 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + heal);
      }
    }

    // 选目标(血量最低的)
    const target = aliveMonsters.reduce((a, b) => a.stats.hp < b.stats.hp ? a : b);

    // 玩家攻击目标
    let usedSkill: SkillRefInfo = activeSkill;
    let isDivine = false;
    const divines = equippedSkills?.divineSkills || [];
    for (let i = 0; i < divines.length; i++) {
      if (divineCds[i] <= 0) {
        usedSkill = divines[i];
        divineCds[i] = Math.max(1, (divines[i].cdTurns || 5) - cdReduction);
        isDivine = true;
        break;
      }
    }
    for (let i = 0; i < divineCds.length; i++) {
      if (divineCds[i] > 0) divineCds[i]--;
    }

    let mul = usedSkill.multiplier;
    let rootMatched = false;
    if (usedSkill.element && player.spiritualRoot && usedSkill.element === player.spiritualRoot) {
      mul *= 1.2;
      rootMatched = true;
    }

    // 辅助: 生成快照
    function snap2() {
      const t = monsters.find(m => m.alive);
      return { playerHp: Math.max(0, player.hp), playerMaxHp: player.maxHp,
        monsterHp: t ? t.stats.hp : 0, monsterMaxHp: t ? t.stats.maxHp : 0 };
    }

    // buff/回复技能 (multiplier=0)
    if (mul === 0) {
      const prefix = isDivine ? '神通发动！' : '';
      // 即时回血(按攻击力)
      if (usedSkill.healAtkRatio) {
        const heal = Math.floor(player.atk * usedSkill.healAtkRatio);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        logs.push({ turn, text: `[第${turn}回合] ${prefix}【${usedSkill.name}】回复 ${heal} 点气血`, type: 'buff', ...snap2() });
      }
      if (usedSkill.buff) {
        logs.push({ turn, text: `[第${turn}回合] ${prefix}你获得了【${usedSkill.name}】的增益`, type: 'buff', ...snap2() });
      }
      // AOE debuff (冻结/眩晕实际生效,合并日志)
      if (usedSkill.debuff && (usedSkill.isAoe || (usedSkill.targetCount && usedSkill.targetCount > 1))) {
        const debuffTargets = usedSkill.isAoe ? aliveMonsters : aliveMonsters.slice(0, usedSkill.targetCount || 1);
        const hitNames: string[] = [];
        for (const m of debuffTargets) {
          if (usedSkill.debuff && Math.random() < usedSkill.debuff.chance) {
            const dtype = usedSkill.debuff.type;
            if (dtype === 'freeze' || dtype === 'stun') {
              m.frozenTurns = usedSkill.debuff.duration;
            }
            hitNames.push(m.stats.name);
          }
        }
        if (hitNames.length > 0) {
          const dtype = usedSkill.debuff.type;
          const dname = (dtype === 'freeze') ? '冻结' : (dtype === 'stun') ? '眩晕' : '控制';
          logs.push({ turn, text: `[第${turn}回合] ${hitNames.join('、')}被${dname}!`, type: 'normal', ...snap2() });
        }
      }
    } else {
      // 攻击技能: 确定目标
      let attackTargets: typeof aliveMonsters;
      if (usedSkill.isAoe) {
        attackTargets = [...aliveMonsters];
      } else if (usedSkill.targetCount && usedSkill.targetCount > 1) {
        // 多目标: 按血量从低到高选 N 只
        const sorted = [...aliveMonsters].sort((a, b) => a.stats.hp - b.stats.hp);
        attackTargets = sorted.slice(0, Math.min(usedSkill.targetCount, sorted.length));
      } else {
        attackTargets = [target];
      }

      const prefix = isDivine ? '神通发动！' : (rootMatched ? '灵根共鸣！' : '');
      const hits = usedSkill.hitCount || 1;
      const perHitMul = mul / hits;
      const targetLabel = usedSkill.isAoe ? '全体' : (attackTargets.length > 1 ? `${attackTargets.length}目标` : '');
      const hitsLabel = hits > 1 ? `${hits}段` : '';
      const skillLabel = [targetLabel, hitsLabel].filter(Boolean).join('·');
      if (skillLabel) {
        logs.push({ turn, text: `[第${turn}回合] ${prefix}【${usedSkill.name}】(${skillLabel})`, type: isDivine ? 'crit' : 'normal', ...snap2() });
      }

      // 攻击逻辑(多段在目标死后溢出到下一只)
      let hitsRemaining = hits * attackTargets.length; // 总打击次数
      if (hits > 1 && attackTargets.length === 1) {
        // 多段单体: 溢出到任意存活怪
        let hitsDone = 0;
        while (hitsDone < hits) {
          const curTarget = monsters.find(m => m.alive && m.stats.hp > 0);
          if (!curTarget) break;
          const dmgResult = calculateDamage(player, curTarget.stats, perHitMul, usedSkill.element, usedSkill.ignoreDef);
          if (dmgResult.damage > 0) {
            curTarget.stats.hp -= dmgResult.damage;
            if (player.lifesteal > 0) {
              player.hp = Math.min(player.maxHp, player.hp + Math.floor(dmgResult.damage * player.lifesteal));
            }
            const critText = dmgResult.isCrit ? '暴击!' : '';
            const hitLabel = `第${hitsDone + 1}段 `;
            logs.push({ turn, text: `  ${hitLabel}${critText}对${curTarget.stats.name}造成 ${dmgResult.damage} 伤害`,
              type: dmgResult.isCrit ? 'crit' : 'normal', ...snap2() });
            if (usedSkill.debuff && Math.random() < usedSkill.debuff.chance) {
              if (usedSkill.debuff!.type === 'freeze' || usedSkill.debuff!.type === 'stun') {
                curTarget.frozenTurns = usedSkill.debuff!.duration;
              }
              logs.push({ turn, text: `  ${curTarget.stats.name}受到debuff!`, type: 'normal', ...snap2() });
            }
          }
          hitsDone++;
        }
      } else {
        // AOE/多目标/普通单体: 每个目标打1次
        for (const t of attackTargets) {
          if (t.stats.hp <= 0) continue;
          const dmgResult = calculateDamage(player, t.stats, mul, usedSkill.element, usedSkill.ignoreDef);
          if (dmgResult.damage > 0) {
            t.stats.hp -= dmgResult.damage;
            if (player.lifesteal > 0) {
              player.hp = Math.min(player.maxHp, player.hp + Math.floor(dmgResult.damage * player.lifesteal));
            }
            const critText = dmgResult.isCrit ? '暴击!' : '';
            if (!skillLabel) {
              logs.push({ turn,
                text: `[第${turn}回合] ${prefix}${critText}【${usedSkill.name}】对${t.stats.name}造成 ${dmgResult.damage} 伤害`,
                type: dmgResult.isCrit ? 'crit' : 'normal', ...snap2() });
            } else {
              logs.push({ turn,
                text: `  ${critText}对${t.stats.name}造成 ${dmgResult.damage} 伤害`,
                type: dmgResult.isCrit ? 'crit' : 'normal', ...snap2() });
            }
            if (usedSkill.debuff && Math.random() < usedSkill.debuff.chance) {
              if (usedSkill.debuff!.type === 'freeze' || usedSkill.debuff!.type === 'stun') {
                t.frozenTurns = usedSkill.debuff!.duration;
              }
              logs.push({ turn, text: `  ${t.stats.name}受到debuff!`, type: 'normal', ...snap2() });
            }
          }
        }
      }

      // 即时回血 (攻击技能也可以带)
      if (usedSkill.healPercent) {
        const heal = Math.floor(player.maxHp * usedSkill.healPercent);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        logs.push({ turn, text: `[第${turn}回合] 回复 ${heal} 点气血`, type: 'buff', ...snap2() });
      }

      // 检查击杀
      for (const m of monsters) {
        if (m.alive && m.stats.hp <= 0) {
          m.alive = false;
          const exp = Math.floor(m.template.exp * randFloat(0.9, 1.1));
          const stone = rand(m.template.spirit_stone_range[0], m.template.spirit_stone_range[1]);
          totalExp += exp;
          totalStone += stone;
          const drops = generateDrops(m.template);
          allDrops.push(...drops);
          logs.push({ turn, text: `你击杀了${m.stats.name}，获得 ${exp} 修为、${stone} 灵石`, type: 'kill', ...snap2() });
          for (const d of drops) {
            logs.push({ turn, text: `${m.stats.name}掉落了【${d.name}】！`, type: 'loot', ...snap2() });
          }
        }
      }
      const remaining = monsters.filter(mm => mm.alive).length;
      if (remaining > 0 && remaining < aliveMonsters.length) {
        logs.push({ turn, text: `还剩 ${remaining} 只怪物!`, type: 'system', ...snap2() });
      }
    }

    // 所有存活怪物攻击玩家
    const frozenNames: string[] = [];
    for (const m of monsters.filter(mm => mm.alive)) {
      // 冻结/眩晕: 跳过攻击
      if (m.frozenTurns > 0) {
        m.frozenTurns--;
        frozenNames.push(m.stats.name);
        continue;
      }
      // 怪物buff/CD递减
      tickMonsterCds(m.skillState);
      for (let bi = m.buffs.length - 1; bi >= 0; bi--) {
        m.buffs[bi].remaining--;
        if (m.buffs[bi].remaining <= 0) m.buffs.splice(bi, 1);
      }

      // 怪物有效属性
      let mAtk = m.baseAtk;
      let mDef = m.baseDef;
      for (const b of m.buffs) {
        if (b.type === 'atk_up' && b.value) mAtk = Math.floor(mAtk * (1 + b.value));
        if (b.type === 'def_up' && b.value) mDef = Math.floor(mDef * (1 + b.value));
      }
      // Boss低血量强化
      if (m.template.role === 'boss' && !m.skillState.bossEnrageTriggered && m.stats.hp < m.stats.maxHp * 0.30) {
        m.skillState.bossEnrageTriggered = true;
        logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}进入狂暴状态！攻击永久+30%!`, type: 'crit', ...snap2() });
      }
      if (m.skillState.bossEnrageTriggered) mAtk = Math.floor(mAtk * 1.30);
      if (m.buffs.some(b => b.type === 'atk_up') && m.skillState.berserkTriggered) mDef = Math.floor(mDef * 0.80);
      m.stats.atk = mAtk;
      m.stats.def = mDef;

      // 选择技能
      const mSkill = monsterChooseSkill(m.skillState, m.stats.hp, m.stats.maxHp, m.template.role === 'boss');

      // 非攻击技能 (buff/回复)
      if (mSkill && mSkill.multiplier === 0) {
        if (mSkill.healPercent) {
          const heal = Math.floor(m.stats.maxHp * mSkill.healPercent);
          m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + heal);
          logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}施展了【${mSkill.name}】，回复 ${heal} 点气血!`, type: 'buff', ...snap2() });
        }
        if (mSkill.buff) {
          const existBuff = m.buffs.find(b => b.type === mSkill.buff!.type);
          if (existBuff) { existBuff.remaining = mSkill.buff.duration; existBuff.value = mSkill.buff.value; }
          else m.buffs.push({ type: mSkill.buff.type as BuffType, remaining: mSkill.buff.duration, value: mSkill.buff.value });
          if (mSkill.name === '狂暴') m.skillState.berserkTriggered = true;
          if (!mSkill.healPercent) {
            logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}施展了【${mSkill.name}】！`, type: 'normal', ...snap2() });
          }
        }
        if (mSkill.debuff) {
          // wave战斗中简化debuff处理：直接降低玩家属性
          if (mSkill.debuff.type === 'atk_down' && mSkill.debuff.value && Math.random() < mSkill.debuff.chance) {
            logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}的【${mSkill.name}】削弱了你的攻击!`, type: 'normal', ...snap2() });
          }
        }
        continue;
      }

      // 攻击技能或普攻
      const skillMul = mSkill ? mSkill.multiplier : 1.0;
      const skillElem = mSkill ? mSkill.element : null;
      const skillName = mSkill ? mSkill.name : '普通攻击';
      const hits = mSkill?.hitCount || 1;

      if (hits > 1) {
        // 多段攻击
        const perHitMul = skillMul / hits;
        logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}施展了【${skillName}】(${hits}段)!`, type: 'crit', ...snap2() });
        for (let h = 0; h < hits; h++) {
          const mResult = calculateDamage(m.stats, player, perHitMul, skillElem);
          if (mResult.damage > 0) {
            let dmg = mResult.damage;
            if (equippedSkills?.passiveEffects?.damageReductionFlat) {
              dmg = Math.floor(dmg * (1 - equippedSkills.passiveEffects.damageReductionFlat));
            }
            player.hp -= dmg;
            const critText = mResult.isCrit ? '暴击!' : '';
            logs.push({ turn, text: `  第${h + 1}段 ${critText}造成 ${dmg} 点伤害`,
              type: mResult.isCrit ? 'crit' : 'normal', playerHp: Math.max(0, player.hp), playerMaxHp: player.maxHp,
              monsterHp: m.stats.hp, monsterMaxHp: m.stats.maxHp });
          }
          if (player.hp <= 0) break;
        }
        // 多段结束后判定debuff
        if (mSkill?.debuff && player.hp > 0) {
          if (Math.random() < mSkill.debuff.chance) {
            logs.push({ turn, text: `[第${turn}回合] 你受到了【${mSkill.name}】的异常效果!`, type: 'normal', ...snap2() });
          }
        }
      } else {
        // 单段攻击
        const mResult = calculateDamage(m.stats, player, skillMul, skillElem);
        if (mResult.damage > 0) {
          let dmg = mResult.damage;
          if (equippedSkills?.passiveEffects?.damageReductionFlat) {
            dmg = Math.floor(dmg * (1 - equippedSkills.passiveEffects.damageReductionFlat));
          }
          player.hp -= dmg;
          const isSkillAttack = mSkill !== null;
          logs.push({ turn,
            text: `[第${turn}回合] ${m.stats.name}${isSkillAttack ? '施展【' + skillName + '】，' : ''}攻击了你，造成 ${dmg} 点伤害`,
            type: mResult.isCrit ? 'crit' : 'normal', playerHp: Math.max(0, player.hp), playerMaxHp: player.maxHp,
            monsterHp: target.alive ? target.stats.hp : 0, monsterMaxHp: target.stats.maxHp });
        }
      }
    }

    // 被控制日志(合并)
    if (frozenNames.length > 0) {
      logs.push({ turn, text: `[第${turn}回合] ${frozenNames.join('、')}被控制中,无法行动`, type: 'normal', ...snap2() });
    }

    // 玩家死亡判定
    if (player.hp <= 0) {
      if (reviveAvailable) {
        reviveAvailable = false;
        player.hp = Math.floor(player.maxHp * 0.20);
        logs.push({ turn, text: `[第${turn}回合] 【不灭金身】发动!`, type: 'buff',
          playerHp: player.hp, playerMaxHp: player.maxHp, monsterHp: 0, monsterMaxHp: 0 });
      } else {
        logs.push({ turn: turn, text: '你的气血耗尽，陨落了…3回合后原地复活', type: 'death',
          playerHp: 0, playerMaxHp: player.maxHp, monsterHp: 0, monsterMaxHp: 0 });
        const mInfo = buildMonsterInfo(monsterList[0].template, monsterList[0].stats);
        return { won: false, turns: turn, expGained: totalExp, spiritStoneGained: totalStone, logs, drops: allDrops, monsterInfo: mInfo };
      }
    }

    // 全灭检查
    if (monsters.filter(m => m.alive).length === 0) break;
  }

  const mInfo = buildMonsterInfo(monsterList[0].template, monsterList[0].stats);
  const allDead = monsters.filter(m => m.alive).length === 0;
  return { won: allDead, turns: 0, expGained: totalExp, spiritStoneGained: totalStone, logs, drops: allDrops, monsterInfo: mInfo };
}

// 执行一场战斗 (单怪,保留兼容)
export function runBattle(
  playerStats: BattlerStats,
  monsterStats: BattlerStats,
  monsterTemplate: MonsterTemplate,
  equippedSkills?: EquippedSkillInfo
): BattleResult {
  const logs: BattleLogEntry[] = [];
  const player = { ...playerStats, hp: playerStats.maxHp };
  const monster = { ...monsterStats };
  const maxTurns = 50;
  const baseAtk = player.atk;
  const baseDef = player.def;
  const baseSpd = player.spd;

  // 怪物技能状态
  const monsterSkillState = initMonsterSkillState(monsterTemplate);
  const monsterBaseAtk = monster.atk;
  const monsterBaseDef = monster.def;
  // 怪物身上的buff列表
  const monsterBuffs: ActiveBuff[] = [];
  // 玩家身上的怪物施加的debuff
  const playerDebuffs: ActiveDebuff[] = [];

  // 应用被动功法加成
  if (equippedSkills?.passiveEffects) {
    const p = equippedSkills.passiveEffects;
    player.atk = Math.floor(player.atk * (1 + p.atkPercent / 100));
    player.def = Math.floor(player.def * (1 + p.defPercent / 100));
    player.maxHp = Math.floor(player.maxHp * (1 + p.hpPercent / 100));
    player.spd = Math.floor(player.spd * (1 + (p.spdPercent || 0) / 100));
    player.hp = player.maxHp;
    player.crit_rate += p.critRate;
    player.crit_dmg += p.critDmg;
    player.dodge += p.dodge || 0;
    player.lifesteal += p.lifesteal || 0;
  }

  // 应用装备战斗扩展属性
  player.armorPen = _equipCombatStats.armorPen;
  player.accuracy = _equipCombatStats.accuracy;
  player.elementDmg = _equipCombatStats.elementDmg;

  const activeSkill: SkillRefInfo = equippedSkills?.activeSkill || { name: '基础剑法', multiplier: 1.0, element: null };
  // 神通 CD 受 道心通明 影响 (-N)
  const cdReduction = equippedSkills?.passiveEffects.skillCdReduction || 0;
  const divineCds: number[] = (equippedSkills?.divineSkills || []).map(() => 0);

  const monsterDebuffs: ActiveDebuff[] = [];
  const playerBuffs: ActiveBuff[] = [];
  let playerShield = 0;
  let reviveAvailable = equippedSkills?.passiveEffects.reviveOnce || false;

  function snap(): Pick<BattleLogEntry, 'playerHp' | 'playerMaxHp' | 'monsterHp' | 'monsterMaxHp'> {
    return {
      playerHp: Math.max(0, player.hp),
      playerMaxHp: player.maxHp,
      monsterHp: Math.max(0, monster.hp),
      monsterMaxHp: monster.maxHp,
    };
  }

  function debuffName(type: string): string {
    return ({ burn: '灼烧', poison: '中毒', bleed: '流血', freeze: '冻结', stun: '眩晕', slow: '减速', brittle: '脆弱', atk_down: '攻击削弱', root: '束缚', silence: '封印' } as any)[type] || type;
  }

  function buffName(type: string): string {
    return ({ atk_up: '攻击提升', def_up: '防御提升', spd_up: '速度提升', crit_up: '暴击提升', shield: '护盾', regen: '持续回血', reflect: '伤害反弹', immune: '免疫控制' } as any)[type] || type;
  }

  // 应用 buff (玩家自身)
  function applyBuff(buff: SkillBuffInfo, turn: number) {
    const exist = playerBuffs.find(b => b.type === buff.type);
    if (exist) {
      exist.remaining = buff.duration;
      exist.value = buff.value;
      exist.valuePercent = buff.valuePercent;
    } else {
      playerBuffs.push({ type: buff.type, remaining: buff.duration, value: buff.value, valuePercent: buff.valuePercent });
    }
    if (buff.type === 'shield' && buff.value !== undefined) {
      playerShield = Math.floor(baseAtk * buff.value);
    }
    logs.push({ turn, text: `[第${turn}回合] 你获得了【${buffName(buff.type)}】`, type: 'buff', ...snap() });
  }

  // 触发 debuff (对怪物)
  function tryApplyDebuff(skill: { debuff?: SkillDebuffInfo }, casterAtk: number, target: BattlerStats, turn: number) {
    if (!skill.debuff) return;
    let chance = skill.debuff.chance;
    const debuff = skill.debuff;
    const controlTypes = ['freeze', 'stun', 'root', 'silence'];
    const isControl = controlTypes.includes(debuff.type);

    // 命中率: 控制类用 ctrl 抗性,DOT 用对应属性抗性
    if (target.resists) {
      if (isControl) {
        chance *= (1 - Math.min(0.7, target.resists.ctrl || 0));
      } else {
        const elemMap: Record<string, string> = { burn: 'fire', poison: 'wood', bleed: 'metal' };
        const elemKey = elemMap[debuff.type];
        if (elemKey) {
          const r = (target.resists as any)[elemKey] || 0;
          chance *= (1 - Math.min(0.7, r));
        }
      }
    }

    if (Math.random() >= chance) return;

    // 持续时间也受抗性影响
    let duration = debuff.duration;
    if (target.resists && !isControl) {
      const elemMap: Record<string, string> = { burn: 'fire', poison: 'wood', bleed: 'metal' };
      const elemKey = elemMap[debuff.type];
      if (elemKey) {
        const r = (target.resists as any)[elemKey] || 0;
        duration = Math.max(1, Math.floor(duration * (1 - Math.min(0.7, r))));
      }
    }

    // 计算每回合伤害(只 DOT 类)
    let dmg = 0;
    if (debuff.type === 'burn')   dmg = Math.floor(casterAtk * 0.15);
    if (debuff.type === 'poison') dmg = Math.floor(target.maxHp * 0.03);
    if (debuff.type === 'bleed')  dmg = Math.floor(casterAtk * 0.10);
    if (dmg > 0 && dmg < 1) dmg = 1;

    const exist = monsterDebuffs.find(d => d.type === debuff.type);
    if (exist) {
      exist.remaining = duration;
      exist.damagePerTurn = dmg;
      exist.value = debuff.value;
    } else {
      monsterDebuffs.push({ type: debuff.type, remaining: duration, damagePerTurn: dmg, value: debuff.value });
    }
    // 详细描述
    let detail = '';
    if (debuff.type === 'brittle' && debuff.value)  detail = ` 防御 -${(debuff.value * 100).toFixed(0)}%`;
    if (debuff.type === 'atk_down' && debuff.value) detail = ` 攻击 -${(debuff.value * 100).toFixed(0)}%`;
    if (debuff.type === 'burn')                     detail = ` 每回合受 ${dmg} 火伤`;
    if (debuff.type === 'poison')                   detail = ` 每回合受 ${dmg} 毒伤`;
    if (debuff.type === 'bleed')                    detail = ` 每回合受 ${dmg} 流血伤害`;
    logs.push({
      turn,
      text: `[第${turn}回合] ${monster.name}陷入了【${debuffName(debuff.type)}】状态!${detail} (${duration}回合)`,
      type: 'normal',
      ...snap(),
    });
  }

  // 触发 debuff (怪物对玩家)
  function tryApplyMonsterDebuff(debuff: SkillDebuffInfo, casterAtk: number, target: BattlerStats, turn: number) {
    let chance = debuff.chance;
    const controlTypes = ['freeze', 'stun', 'root', 'silence'];
    const isControl = controlTypes.includes(debuff.type);

    // 玩家抗性削弱概率
    if (target.resists) {
      if (isControl) {
        chance *= (1 - Math.min(0.7, target.resists.ctrl || 0));
      } else {
        const elemMap: Record<string, string> = { burn: 'fire', poison: 'wood', bleed: 'metal' };
        const elemKey = elemMap[debuff.type];
        if (elemKey) {
          const r = (target.resists as any)[elemKey] || 0;
          chance *= (1 - Math.min(0.7, r));
        }
      }
    }

    if (Math.random() >= chance) return;

    let duration = debuff.duration;
    // 控制类受玩家控制抗性影响持续时间
    if (isControl && target.resists) {
      const ctrlResist = target.resists.ctrl || 0;
      duration = Math.max(1, Math.floor(duration * (1 - Math.min(0.5, ctrlResist))));
    }

    let dmg = 0;
    if (debuff.type === 'burn')   dmg = Math.floor(casterAtk * 0.15);
    if (debuff.type === 'poison') dmg = Math.floor(target.maxHp * 0.03);
    if (debuff.type === 'bleed')  dmg = Math.floor(casterAtk * 0.10);
    if (dmg > 0 && dmg < 1) dmg = 1;

    const exist = playerDebuffs.find(d => d.type === debuff.type);
    if (exist) {
      exist.remaining = duration;
      exist.damagePerTurn = dmg;
      exist.value = debuff.value;
    } else {
      playerDebuffs.push({ type: debuff.type, remaining: duration, damagePerTurn: dmg, value: debuff.value });
    }

    let detail = '';
    if (debuff.type === 'brittle' && debuff.value)  detail = ` 防御 -${(debuff.value * 100).toFixed(0)}%`;
    if (debuff.type === 'atk_down' && debuff.value) detail = ` 攻击 -${(debuff.value * 100).toFixed(0)}%`;
    if (debuff.type === 'burn')                     detail = ` 每回合受 ${dmg} 火伤`;
    if (debuff.type === 'poison')                   detail = ` 每回合受 ${dmg} 毒伤`;
    if (debuff.type === 'bleed')                    detail = ` 每回合受 ${dmg} 流血伤害`;
    logs.push({
      turn,
      text: `[第${turn}回合] 你陷入了【${debuffName(debuff.type)}】状态!${detail} (${duration}回合)`,
      type: 'normal',
      ...snap(),
    });
  }

  // 是否被控制无法行动 (freeze/stun)
  function isStunned(): boolean {
    return monsterDebuffs.some(d => d.type === 'freeze' || d.type === 'stun');
  }
  // 是否减速/束缚 (强制后攻)
  function isSlowed(): boolean {
    return monsterDebuffs.some(d => d.type === 'slow' || d.type === 'root');
  }
  // 玩家是否处于 immune buff (金钟罩) 下
  function playerImmune(): boolean {
    return playerBuffs.some(b => b.type === 'immune');
  }

  // 遭遇日志
  logs.push({ turn: 0, text: `你遭遇了【${monster.name}】`, type: 'system', ...snap() });

  for (let turn = 1; turn <= maxTurns; turn++) {
    // 回合开始: 结算怪物身上的 DOT debuff
    for (let i = monsterDebuffs.length - 1; i >= 0; i--) {
      const d = monsterDebuffs[i];
      if (d.damagePerTurn > 0) {
        monster.hp -= d.damagePerTurn;
        logs.push({ turn, text: `[第${turn}回合] ${monster.name}受到【${debuffName(d.type)}】伤害 ${d.damagePerTurn} 点`, type: 'normal', ...snap() });
      }
      d.remaining--;
      if (d.remaining <= 0) monsterDebuffs.splice(i, 1);
      if (monster.hp <= 0) {
        return buildResult(true, turn, monsterTemplate.exp, monsterTemplate, logs, monsterTemplate, monsterStats);
      }
    }

    // 回合开始: 结算玩家身上的 buff
    for (let i = playerBuffs.length - 1; i >= 0; i--) {
      const b = playerBuffs[i];
      if (b.type === 'regen' && b.valuePercent) {
        const heal = Math.floor(player.maxHp * b.valuePercent);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        logs.push({ turn, text: `[第${turn}回合] 你回复 ${heal} 点气血`, type: 'buff', ...snap() });
      }
      b.remaining--;
      if (b.remaining <= 0) {
        if (b.type === 'shield') playerShield = 0;
        playerBuffs.splice(i, 1);
      }
    }

    // 被动每回合回血
    if (equippedSkills?.passiveEffects.regenPerTurn && equippedSkills.passiveEffects.regenPerTurn > 0) {
      const heal = Math.floor(player.maxHp * equippedSkills.passiveEffects.regenPerTurn);
      if (heal > 0 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + heal);
      }
    }

    // 当前回合的有效属性 (受 buff/debuff 影响)
    let effectiveAtk = baseAtk;
    let effectiveDef = baseDef;
    let effectiveSpd = baseSpd;
    if (equippedSkills?.passiveEffects) {
      const p = equippedSkills.passiveEffects;
      effectiveAtk = Math.floor(baseAtk * (1 + p.atkPercent / 100));
      effectiveDef = Math.floor(baseDef * (1 + p.defPercent / 100));
      effectiveSpd = Math.floor(baseSpd * (1 + (p.spdPercent || 0) / 100));
    }
    for (const b of playerBuffs) {
      if (b.type === 'atk_up' && b.value)  effectiveAtk = Math.floor(effectiveAtk * (1 + b.value));
      if (b.type === 'def_up' && b.value)  effectiveDef = Math.floor(effectiveDef * (1 + b.value));
      if (b.type === 'spd_up' && b.value)  effectiveSpd = Math.floor(effectiveSpd * (1 + b.value));
    }
    // 玩家受怪物debuff影响
    for (const d of playerDebuffs) {
      if (d.type === 'brittle' && d.value)  effectiveDef = Math.floor(effectiveDef * (1 - d.value));
      if (d.type === 'atk_down' && d.value) effectiveAtk = Math.floor(effectiveAtk * (1 - d.value));
    }
    player.atk = effectiveAtk;
    player.def = effectiveDef;
    player.spd = effectiveSpd;

    // 回合开始: 结算玩家身上的怪物debuff (DOT)
    for (let i = playerDebuffs.length - 1; i >= 0; i--) {
      const d = playerDebuffs[i];
      if (d.damagePerTurn > 0) {
        let dotDmg = d.damagePerTurn;
        if (equippedSkills?.passiveEffects.damageReductionFlat) {
          dotDmg = Math.floor(dotDmg * (1 - equippedSkills.passiveEffects.damageReductionFlat));
        }
        player.hp -= dotDmg;
        logs.push({ turn, text: `[第${turn}回合] 你受到【${debuffName(d.type)}】伤害 ${dotDmg} 点`, type: 'normal', ...snap() });
      }
      d.remaining--;
      if (d.remaining <= 0) playerDebuffs.splice(i, 1);
    }

    // 回合开始: 结算怪物buff
    for (let i = monsterBuffs.length - 1; i >= 0; i--) {
      monsterBuffs[i].remaining--;
      if (monsterBuffs[i].remaining <= 0) monsterBuffs.splice(i, 1);
    }

    // 怪物技能CD递减
    tickMonsterCds(monsterSkillState);

    // 怪物的有效属性 (受 debuff + buff 影响)
    let monsterEffectiveAtk = monsterBaseAtk;
    let monsterEffectiveDef = monsterBaseDef;
    // 怪物buff加成
    for (const b of monsterBuffs) {
      if (b.type === 'atk_up' && b.value) monsterEffectiveAtk = Math.floor(monsterEffectiveAtk * (1 + b.value));
      if (b.type === 'def_up' && b.value) monsterEffectiveDef = Math.floor(monsterEffectiveDef * (1 + b.value));
    }
    // Boss低血量强化 (30%血以下 +30% ATK，永久)
    if (monsterTemplate.role === 'boss' && !monsterSkillState.bossEnrageTriggered && monster.hp < monster.maxHp * 0.30) {
      monsterSkillState.bossEnrageTriggered = true;
      logs.push({ turn, text: `[第${turn}回合] ${monster.name}进入狂暴状态！攻击永久+30%!`, type: 'crit', ...snap() });
    }
    if (monsterSkillState.bossEnrageTriggered) {
      monsterEffectiveAtk = Math.floor(monsterEffectiveAtk * 1.30);
    }
    // 狂暴状态防御-20% (有狂暴buff时生效)
    if (monsterBuffs.some(b => b.type === 'atk_up' && monsterSkillState.berserkTriggered)) {
      monsterEffectiveDef = Math.floor(monsterEffectiveDef * 0.80);
    }
    // debuff减属性
    for (const d of monsterDebuffs) {
      if (d.type === 'brittle' && d.value)  monsterEffectiveDef = Math.floor(monsterEffectiveDef * (1 - d.value));
      if (d.type === 'atk_down' && d.value) monsterEffectiveAtk = Math.floor(monsterEffectiveAtk * (1 - d.value));
    }
    monster.atk = monsterEffectiveAtk;
    monster.def = monsterEffectiveDef;

    // 决定先后手
    const slowed = isSlowed();
    const playerFirst = slowed ? false : player.spd >= monster.spd;

    const attacks: { isPlayer: boolean; attacker: BattlerStats; defender: BattlerStats }[] = playerFirst
      ? [{ isPlayer: true, attacker: player, defender: monster }, { isPlayer: false, attacker: monster, defender: player }]
      : [{ isPlayer: false, attacker: monster, defender: player }, { isPlayer: true, attacker: player, defender: monster }];

    for (const atk of attacks) {
      if (!atk.isPlayer) {
        // 怪物攻击: 被冻结/眩晕则跳过
        if (isStunned()) {
          logs.push({ turn, text: `[第${turn}回合] ${monster.name}处于控制中,无法行动`, type: 'normal', ...snap() });
          continue;
        }

        // 怪物选择技能
        const mSkill = monsterChooseSkill(monsterSkillState, monster.hp, monster.maxHp, monsterTemplate.role === 'boss');

        // 辅助: 应用怪物伤害到玩家（护盾/减伤/反弹等）
        function applyMonsterDmgToPlayer(rawDmg: number, skillName: string, isCrit: boolean, isSkill: boolean, turn: number) {
          let dmg = rawDmg;
          if (playerShield > 0) {
            const absorb = Math.min(playerShield, dmg);
            playerShield -= absorb;
            dmg -= absorb;
            if (absorb > 0) {
              logs.push({ turn, text: `[第${turn}回合] 护盾吸收了 ${absorb} 点伤害`, type: 'buff', ...snap() });
            }
          }
          if (equippedSkills?.passiveEffects.damageReductionFlat) {
            dmg = Math.floor(dmg * (1 - equippedSkills.passiveEffects.damageReductionFlat));
          }
          if (playerImmune()) {
            dmg = Math.floor(dmg * 0.5);
          }
          if (dmg > 0) {
            player.hp -= dmg;
            // 反弹
            const reflectBuff = playerBuffs.find(b => b.type === 'reflect');
            let reflectPercent = (reflectBuff?.value || 0) + (equippedSkills?.passiveEffects.reflectPercent || 0) / 100;
            if (isCrit && equippedSkills?.passiveEffects.reflectOnCrit) {
              reflectPercent += equippedSkills.passiveEffects.reflectOnCrit;
            }
            if (reflectPercent > 0) {
              const reflectDmg = Math.floor(dmg * reflectPercent);
              monster.hp -= reflectDmg;
              logs.push({ turn, text: `[第${turn}回合] 反弹 ${reflectDmg} 点伤害给 ${monster.name}`, type: 'normal', ...snap() });
            }
            // 被打触发型
            if (equippedSkills?.passiveEffects.poisonOnHitTaken && Math.random() < equippedSkills.passiveEffects.poisonOnHitTaken) {
              tryApplyDebuff({ debuff: { type: 'poison', chance: 1.0, duration: 2 } }, player.atk, monster, turn);
            }
            if (equippedSkills?.passiveEffects.burnOnHitTaken && Math.random() < equippedSkills.passiveEffects.burnOnHitTaken) {
              tryApplyDebuff({ debuff: { type: 'burn', chance: 1.0, duration: 2 } }, player.atk, monster, turn);
            }
          }
          return dmg;
        }

        // 非攻击技能 (buff/回复/buff+debuff)
        if (mSkill && mSkill.multiplier === 0) {
          // 回复
          if (mSkill.healPercent) {
            const heal = Math.floor(monster.maxHp * mSkill.healPercent);
            monster.hp = Math.min(monster.maxHp, monster.hp + heal);
            logs.push({ turn, text: `[第${turn}回合] ${monster.name}施展了【${mSkill.name}】，回复 ${heal} 点气血!`, type: 'buff', ...snap() });
          }
          // buff
          if (mSkill.buff) {
            const existBuff = monsterBuffs.find(b => b.type === mSkill.buff!.type);
            if (existBuff) { existBuff.remaining = mSkill.buff.duration; existBuff.value = mSkill.buff.value; }
            else monsterBuffs.push({ type: mSkill.buff.type as BuffType, remaining: mSkill.buff.duration, value: mSkill.buff.value });
            if (mSkill.name === '狂暴') {
              monsterSkillState.berserkTriggered = true;
              logs.push({ turn, text: `[第${turn}回合] ${monster.name}施展了【${mSkill.name}】！攻击+40%,防御-20%!`, type: 'crit', ...snap() });
            } else if (!mSkill.healPercent) {
              logs.push({ turn, text: `[第${turn}回合] ${monster.name}施展了【${mSkill.name}】！`, type: 'normal', ...snap() });
            }
          }
          // debuff (如首领之吼)
          if (mSkill.debuff) {
            tryApplyMonsterDebuff(mSkill.debuff, monster.atk, player, turn);
          }
          continue;
        }

        // 攻击技能或普攻
        const skillMul = mSkill ? mSkill.multiplier : 1.0;
        const skillElem = mSkill ? mSkill.element : null;
        const skillName = mSkill ? mSkill.name : '普通攻击';
        const hits = mSkill?.hitCount || 1;

        if (hits > 1) {
          // 多段攻击
          const perHitMul = skillMul / hits;
          logs.push({ turn, text: `[第${turn}回合] ${monster.name}施展了【${skillName}】(${hits}段)!`, type: 'crit', ...snap() });
          let totalDmg = 0;
          for (let h = 0; h < hits; h++) {
            const result = calculateDamage(atk.attacker, atk.defender, perHitMul, skillElem);
            if (result.damage === 0) {
              logs.push({ turn, text: `  第${h + 1}段被闪避了`, type: 'normal', ...snap() });
            } else {
              const applied = applyMonsterDmgToPlayer(result.damage, skillName, result.isCrit, true, turn);
              totalDmg += applied;
              const critText = result.isCrit ? '暴击!' : '';
              logs.push({ turn, text: `  第${h + 1}段 ${critText}造成 ${applied} 点伤害`, type: result.isCrit ? 'crit' : 'normal', ...snap() });
              // 每段独立判定debuff
              if (mSkill?.debuff) {
                tryApplyMonsterDebuff(mSkill.debuff, monster.atk, player, turn);
              }
            }
            if (player.hp <= 0) break;
          }
        } else {
          // 单段攻击
          const result = calculateDamage(atk.attacker, atk.defender, skillMul, skillElem);
          if (result.damage === 0) {
            logs.push({ turn, text: `[第${turn}回合] ${monster.name}的【${skillName}】被你闪避了`, type: 'normal', ...snap() });
          } else {
            const applied = applyMonsterDmgToPlayer(result.damage, skillName, result.isCrit, mSkill !== null, turn);
            const isSkillAttack = mSkill !== null;
            logs.push({
              turn,
              text: result.isCrit
                ? `[第${turn}回合] ${monster.name}施展【${skillName}】暴击！对你造成 ${applied} 点伤害`
                : `[第${turn}回合] ${monster.name}${isSkillAttack ? '施展【' + skillName + '】，' : ''}攻击了你，造成 ${applied} 点伤害`,
              type: result.isCrit ? 'crit' : 'normal',
              ...snap(),
            });
            if (mSkill?.debuff) {
              tryApplyMonsterDebuff(mSkill.debuff, monster.atk, player, turn);
            }
          }
        }
      } else {
        // 玩家攻击
        // 检查神通是否可用 (被封印则不释放)
        let usedSkill: SkillRefInfo = activeSkill;
        let isDivine = false;
        const silenced = monsterDebuffs.some(d => d.type === 'silence');
        const divines = equippedSkills?.divineSkills || [];

        if (!silenced) {
          for (let i = 0; i < divines.length; i++) {
            if (divineCds[i] <= 0) {
              usedSkill = divines[i];
              divineCds[i] = Math.max(1, (divines[i].cdTurns || 5) - cdReduction);
              isDivine = true;
              break;
            }
          }
        }
        // CD 每回合减1
        for (let i = 0; i < divineCds.length; i++) {
          if (divineCds[i] > 0) divineCds[i]--;
        }

        // 灵根匹配加成
        let finalMultiplier = usedSkill.multiplier;
        let rootMatched = false;
        if (usedSkill.element && player.spiritualRoot && usedSkill.element === player.spiritualRoot) {
          finalMultiplier *= 1.2;
          rootMatched = true;
        }

        // 纯 buff 技能 (multiplier=0): 不计算伤害但仍然触发 buff/debuff
        if (finalMultiplier === 0) {
          if (usedSkill.buff) applyBuff(usedSkill.buff, turn);
          if (usedSkill.debuff) tryApplyDebuff(usedSkill, player.atk, monster, turn);
          logs.push({ turn, text: `[第${turn}回合] 你施展了【${usedSkill.name}】`, type: 'buff', ...snap() });
          continue;
        }

        // 如果怪物被束缚 (root),无视闪避
        const monsterRooted = monsterDebuffs.some(d => d.type === 'root');
        const result = calculateDamage(atk.attacker, atk.defender, finalMultiplier, usedSkill.element, usedSkill.ignoreDef, monsterRooted);

        if (result.damage === 0) {
          logs.push({ turn, text: `[第${turn}回合] 你的【${usedSkill.name}】被${monster.name}闪避了`, type: 'normal', ...snap() });
        } else {
          atk.defender.hp -= result.damage;

          if (player.lifesteal > 0) {
            const heal = Math.floor(result.damage * player.lifesteal);
            player.hp = Math.min(player.maxHp, player.hp + heal);
          }

          const prefix = isDivine ? '神通发动！' : (rootMatched ? '灵根共鸣！' : '');
          logs.push({
            turn,
            text: result.isCrit
              ? `[第${turn}回合] ${prefix}会心一击！【${usedSkill.name}】对${monster.name}造成 ${result.damage} 点暴击伤害`
              : `[第${turn}回合] ${prefix}你对${monster.name}施展了【${usedSkill.name}】，造成 ${result.damage} 点伤害`,
            type: isDivine ? 'crit' : (result.isCrit ? 'crit' : 'normal'),
            ...snap(),
          });

          // 命中后尝试附加 debuff 和自身 buff
          tryApplyDebuff(usedSkill, player.atk, monster, turn);
          if (usedSkill.buff) applyBuff(usedSkill.buff, turn);
        }
      }

      if (atk.defender.hp <= 0) {
        if (atk.isPlayer) {
          return buildResult(true, turn, monsterTemplate.exp, monsterTemplate, logs, monsterTemplate, monsterStats);
        } else {
          // 免死效果: 触发后保留 20% 血,只能触发一次
          if (reviveAvailable) {
            reviveAvailable = false;
            player.hp = Math.floor(player.maxHp * 0.20);
            logs.push({ turn, text: `[第${turn}回合] 【不灭金身】发动!免死保留 ${player.hp} 点气血!`, type: 'buff', ...snap() });
            continue;
          }
          return buildResult(false, turn, 0, 0, logs, monsterTemplate, monsterStats);
        }
      }
    }
  }

  logs.push({ turn: maxTurns, text: '战斗超时，你选择撤退', type: 'system', ...snap() });
  return buildResult(false, maxTurns, 0, 0, logs, monsterTemplate, monsterStats);
}

function buildResult(
  won: boolean,
  turns: number,
  exp: number | MonsterTemplate,
  spiritStoneOrTemplate: number | MonsterTemplate,
  logs: BattleLogEntry[],
  template: MonsterTemplate,
  monsterStats: BattlerStats
): BattleResult {
  const mInfo = buildMonsterInfo(template, monsterStats);

  if (!won) {
    logs.push({ turn: turns, text: '你的气血耗尽，陨落了…3回合后原地复活', type: 'death' });
    return { won: false, turns, expGained: 0, spiritStoneGained: 0, logs, drops: [], monsterInfo: mInfo };
  }

  const expGained = Math.floor(template.exp * randFloat(0.9, 1.1));
  const spiritStone = rand(template.spirit_stone_range[0], template.spirit_stone_range[1]);
  const drops = generateDrops(template);

  logs.push({
    turn: turns,
    text: `你击杀了${template.name}，获得 ${expGained} 修为、${spiritStone} 灵石`,
    type: 'kill',
  });

  for (const drop of drops) {
    logs.push({
      turn: turns,
      text: `${template.name}掉落了【${drop.name}】！`,
      type: 'loot',
    });
  }

  return { won: true, turns, expGained, spiritStoneGained: spiritStone, logs, drops, monsterInfo: mInfo };
}

// 掉落生成
function generateDrops(template: MonsterTemplate): DropItem[] {
  const drops: DropItem[] = [];
  const isBoss = template.role === 'boss';

  // 装备掉落 (受福缘加成)
  const mapTier = parseInt(template.drop_table.replace(/\D/g, '')) || 1;
  const luckMul = 1 + _equipLuck / 100;
  const equipRate = (isBoss ? 1.0 : (template.drop_table.includes('uncommon') ? 0.30 : 0.20)) * luckMul;
  if (Math.random() < equipRate) {
    const equip = generateEquipment(mapTier, isBoss);
    drops.push({
      name: equip.name,
      type: 'equipment',
      rarity: equip.rarity,
      equipData: equip,
    });
  }

  // 功法掉落 (洞府藏经阁 + 福缘加成)
  const baseSkillRate = isBoss ? 0.50 : 0.15;
  const skillRate = baseSkillRate * (1 + _caveBonus.skillRate / 100) * luckMul;
  if (Math.random() < skillRate) {
    // 按地图 tier 决定可掉落的功法
    let skills: string[];
    if (mapTier >= 9) {
      // T9-T10: 仙品优先
      skills = [
        '时光凝滞', '天罚雷劫', '道心通明', '五行归一',
        '万剑归宗', '地裂天崩', '噬魂大法', '九天玄火阵',
        '渊海之心', '战意沸腾', '不灭金身',
      ];
    } else if (mapTier >= 7) {
      // 天品 + 仙品
      skills = [
        '时光凝滞', '天罚雷劫',
        '万剑归宗', '地裂天崩', '噬魂大法', '九天玄火阵', '暴风斩', '天地归元',
        '道心通明', '五行归一', '渊海之心', '战意沸腾', '不灭金身',
      ];
    } else if (mapTier >= 5) {
      // 地品
      skills = [
        '剑雨纷飞', '双焰斩', '连环掌', '灵泉术',
        '嗜血诀', '生生不息', '明镜止水',
        '破绽感知', '不动如山', '百毒不侵', '焚天之体',
      ];
    } else if (mapTier >= 3) {
      // 玄品
      skills = [
        '天火术', '霜冻新星', '厚土盾', '万藤缚', '金钟罩', '地裂波',
        '凌波微步', '铁布衫', '荆棘之体', '焚身火甲', '厚土心法',
      ];
    } else {
      // 灵品 (主修五行 + 基础被动)
      skills = [
        '风刃术', '缠藤术', '寒冰掌', '烈焰剑诀', '裂地拳',
        '金刚体', '焚体诀', '流水心法', '盘根术', '金身术',
      ];
    }
    drops.push({
      name: skills[rand(0, skills.length - 1)],
      type: 'skill',
      rarity: 'blue',
    });
  }

  // 灵草掉落
  const herbRate = (isBoss ? 0.80 : 0.30) * luckMul;
  if (Math.random() < herbRate) {
    // 根据怪物五行决定灵草种类
    const elementToHerb: Record<string, { id: string; name: string }> = {
      metal: { id: 'metal_herb',   name: '锐金草' },
      wood:  { id: 'wood_herb',    name: '青木叶' },
      water: { id: 'water_herb',   name: '玄水苔' },
      fire:  { id: 'fire_herb',    name: '赤焰花' },
      earth: { id: 'earth_herb',   name: '厚土参' },
    };
    let herbDef = template.element ? elementToHerb[template.element] : null;
    if (!herbDef) {
      // 无属性怪物掉通用灵草或仙灵草
      herbDef = isBoss && Math.random() < 0.30
        ? { id: 'spirit_grass', name: '仙灵草' }
        : { id: 'common_herb', name: '灵草' };
    }

    // 根据 tier 决定品质
    let qualityId = 'white', qualityName = '凡品';
    const r = Math.random();
    if (mapTier >= 7) {
      if (r < 0.4) { qualityId = 'gold';   qualityName = '天品'; }
      else         { qualityId = 'purple'; qualityName = '地品'; }
    } else if (mapTier >= 5) {
      if (r < 0.5) { qualityId = 'purple'; qualityName = '地品'; }
      else         { qualityId = 'blue';   qualityName = '玄品'; }
    } else if (mapTier >= 3) {
      if (r < 0.4) { qualityId = 'blue';   qualityName = '玄品'; }
      else         { qualityId = 'green';  qualityName = '灵品'; }
    } else {
      if (r < 0.20) { qualityId = 'green'; qualityName = '灵品'; }
      else          { qualityId = 'white'; qualityName = '凡品'; }
    }

    // Boss 提升一档
    if (isBoss) {
      const order = ['white', 'green', 'blue', 'purple', 'gold', 'red'];
      const idx = Math.min(order.indexOf(qualityId) + 1, order.length - 1);
      qualityId = order[idx];
      const names = ['凡品', '灵品', '玄品', '地品', '天品', '仙品'];
      qualityName = names[idx];
    }

    drops.push({
      name: `${qualityName}·${herbDef.name}`,
      type: 'material',
      rarity: qualityId,
      equipData: { herb_id: herbDef.id, quality: qualityId, count: isBoss ? 3 : 1 },
    });
  }

  return drops;
}
