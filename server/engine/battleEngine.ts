// 后端完整战斗引擎 - 从前端 battleEngine.ts 移植
import { Skill, SKILL_MAP, type DebuffType, type BuffType, type SkillDebuff, type SkillBuff, type PassiveEffect } from './skillData';
import { BATTLE_FORMULA } from '~/shared/balance';

// ========== 类型定义 ==========

export interface PlayerAwakenState {
  // 运行时触发类（主动）
  burnOnHitChance?: number;
  poisonOnHitChance?: number;
  bleedOnHitChance?: number;
  chainAttackChance?: number;
  armorPenPct?: number;
  executeBonus?: number;
  lowHpAtkBonus?: number;
  lowHpDefBonus?: number;
  // 被动受伤类
  damageReduction?: number;
  critTakenReduction?: number;
  // 被动每回合
  regenPerTurn?: number;
  cleanseInterval?: number;
  // 开场一次性
  frenzyOpening?: number;
  // 对象加成
  vsBossBonus?: number;
  vsEliteBonus?: number;
  // debuff
  debuffDurationBonus?: number;
  // 复用现有钩子（Max-Merge 合并进 passive）
  poisonOnHitTaken?: number;
  burnOnHitTaken?: number;
  reflectOnCrit?: number;
  // ===== v1.3 灵戒附灵·主修功法增幅 =====
  // 通用向：仅主修攻击生效（usedSkill === activeSkill）
  mainSkillMultBonus?: number;       // 主修伤害倍率 +X%
  mainSkillCritRate?: number;        // 主修攻击额外暴击率 +X%
  mainSkillArmorPen?: number;        // 主修无视目标 X% 防御
  mainSkillLifesteal?: number;       // 主修命中回 X% 最大气血
  // 属性匹配向：仅主修元素匹配 requireElement 时生效
  mainSkillBleedAmp?: number;        // 主修施加流血每跳伤害 +X%（金）
  mainSkillBleedAmpElem?: AwakenElement;
  mainSkillPoisonAmp?: number;       // 主修施加中毒每跳伤害 +X%（木）
  mainSkillPoisonAmpElem?: AwakenElement;
  mainSkillFreezeChance?: number;    // 主修冻结概率 +X%（水）
  mainSkillFreezeChanceElem?: AwakenElement;
  mainSkillBurnDuration?: number;    // 主修灼烧持续 +X 回合（火）
  mainSkillBurnDurationElem?: AwakenElement;
  mainSkillBrittleAmp?: number;      // 主修脆弱减防加深 +X%（土）
  mainSkillBrittleAmpElem?: AwakenElement;
  // 机制向
  mainSkillChainChance?: number;     // 主修追击概率（与兵器 chainAttackChance 取大）
  mainSkillCritCdCut?: boolean;      // 主修暴击时所有神通 CD-1（每回合至多 1 次）
  mainSkillExecuteThr?: number;      // 残血阈值（0.20~0.35）
  mainSkillExecuteBonus?: number;    // 残血伤害加成（0.30~0.85）
}

export type AwakenElement = 'metal' | 'wood' | 'water' | 'fire' | 'earth';

export interface BattlerStats {
  name: string;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit_rate: number;
  crit_dmg: number;
  dodge: number;
  lifesteal: number;
  element: string | null;
  resists?: { metal: number; wood: number; water: number; fire: number; earth: number; ctrl: number };
  spiritualRoot?: string | null;
  armorPen?: number;
  accuracy?: number;
  elementDmg?: { metal: number; wood: number; water: number; fire: number; earth: number };
  spirit?: number; // 神识: 每点+0.1%神通伤害
  awaken?: PlayerAwakenState; // 装备附灵运行时状态（v1.2 新增）
}

export interface BattleLogEntry {
  turn: number;
  text: string;
  type: 'normal' | 'crit' | 'kill' | 'death' | 'system' | 'buff' | 'loot';
  playerHp?: number;
  playerMaxHp?: number;
  monsterHp?: number;
  monsterMaxHp?: number;
  monstersHp?: number[];
}

export interface MonsterTemplate {
  name: string;
  power: number;
  element: string | null;
  exp: number;
  stone_min: number;
  stone_max: number;
  role: string;
  drop_table: string;
}

export interface SkillRefInfo {
  name: string;
  multiplier: number;
  cdTurns?: number;
  element: string | null;
  debuff?: { type: DebuffType; chance: number; duration: number; value?: number };
  buff?: { type: BuffType; duration: number; value?: number; valuePercent?: number };
  ignoreDef?: number;
  isAoe?: boolean;
  targetCount?: number;
  hitCount?: number;
  healAtkRatio?: number;
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
    // v3 紫色被动
    dotAmpPct?: number;            // dot_amplifier_percent: 你造成 DOT 伤害放大%
    critAfterDodge?: boolean;      // crit_after_dodge: 闪避后下次攻击必暴击
    healAmpPct?: number;           // heal_amplifier_percent: 你受到的治疗放大%
  };
}

interface ActiveDebuff {
  type: DebuffType;
  remaining: number;
  damagePerTurn: number;
  value?: number;
  sourceName?: string;
}

interface ActiveBuff {
  type: BuffType;
  remaining: number;
  value?: number;
  valuePercent?: number;
  shieldHp?: number; // 'shield' 专用：剩余可吸收的伤害值
}

// debuff 中文名
const DEBUFF_NAMES: Record<string, string> = {
  burn: '灼烧', poison: '中毒', bleed: '流血', freeze: '冻结',
  stun: '眩晕', slow: '减速', brittle: '脆弱', atk_down: '降攻',
  root: '束缚', silence: '封印',
};

function calcDotDamage(type: DebuffType, targetMaxHp: number, attackerAtk: number): number {
  if (type === 'poison') return Math.max(1, Math.floor(targetMaxHp * 0.03));
  if (type === 'burn') return Math.max(1, Math.floor(attackerAtk * 0.15));
  if (type === 'bleed') return Math.max(1, Math.floor(attackerAtk * 0.10));
  return 0;
}

// ========== 五行相克 ==========

const ELEMENT_ADVANTAGE: Record<string, string> = {
  metal: 'wood', wood: 'earth', earth: 'water', water: 'fire', fire: 'metal',
};

function getElementMultiplier(atk: string | null, def: string | null): number {
  if (!atk || !def) return 1.0;
  if (ELEMENT_ADVANTAGE[atk] === def) return BATTLE_FORMULA.elementCounterMul;
  if (ELEMENT_ADVANTAGE[def] === atk) return BATTLE_FORMULA.elementResistedMul;
  return 1.0;
}

// ========== 随机数 ==========

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// ========== 怪物技能系统 ==========

export interface MonsterSkillDef {
  name: string;
  multiplier: number;
  cdTurns: number;
  element: string | null;
  debuff?: { type: DebuffType; chance: number; duration: number; value?: number };
  buff?: { type: 'atk_up' | 'def_up' | 'regen'; value: number; duration: number };
  hitCount?: number;
  healPercent?: number;
  isHeal?: boolean;
  // healer 群体标记：true 时治疗/buff 作用于全场队友
  isAoe?: boolean;
  description: string;
}

export interface MonsterSkillState {
  skills: MonsterSkillDef[];
  cds: number[];
  berserkTriggered: boolean;
  bossEnrageTriggered: boolean;
}

// healer 技能池：纯治疗/buff/debuff，按 tier 阶梯化（heal/buff 标 isAoe，作用全场怪物）
function buildHealerSkillPool(tier: number, elem: string | null): MonsterSkillDef[] {
  const skills: MonsterSkillDef[] = [];

  // 兜底元素攻击（healer 也得能动）
  if (elem) {
    const elemSkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '灵焰术', multiplier: 0.60, cdTurns: 3, element: 'fire',  debuff: { type: 'burn',   chance: 0.20, duration: 2 }, description: '灵焰灼伤' },
      water: { name: '寒露术', multiplier: 0.55, cdTurns: 3, element: 'water', debuff: { type: 'slow',   chance: 0.25, duration: 2 }, description: '寒露减速' },
      wood:  { name: '青藤刺', multiplier: 0.55, cdTurns: 3, element: 'wood',  debuff: { type: 'poison', chance: 0.30, duration: 2 }, description: '青藤施毒' },
      metal: { name: '锐金针', multiplier: 0.60, cdTurns: 3, element: 'metal', debuff: { type: 'bleed',  chance: 0.20, duration: 2 }, description: '金针放血' },
      earth: { name: '碎石击', multiplier: 0.55, cdTurns: 3, element: 'earth', debuff: { type: 'brittle', chance: 0.20, duration: 2, value: 0.15 }, description: '碎石脆甲' },
    };
    if (elemSkills[elem]) skills.push(elemSkills[elem]);
  } else {
    skills.push({ name: '灵力一击', multiplier: 0.55, cdTurns: 3, element: null, description: '灵力撞击' });
  }

  // 群体回血（按 tier 阶梯）— v3.6 healPercent ×0.6 削弱（旧 10/13/16/20/25/30）
  if (tier >= 5) skills.push({ name: '春霖术', multiplier: 0, cdTurns: 5, element: null, healPercent: 0.06, isHeal: true, isAoe: true, description: '全队回复6%气血' });
  if (tier >= 6) skills.push({ name: '甘霖普济', multiplier: 0, cdTurns: 6, element: null, healPercent: 0.08, isHeal: true, isAoe: true, description: '全队回复8%气血' });
  if (tier >= 7) skills.push({ name: '苍生庇护', multiplier: 0, cdTurns: 7, element: null, healPercent: 0.10, isHeal: true, isAoe: true, description: '全队回复10%气血' });
  if (tier >= 8) skills.push({ name: '九转续命', multiplier: 0, cdTurns: 8, element: null, healPercent: 0.12, isHeal: true, isAoe: true, description: '全队回复12%气血' });
  if (tier >= 9) skills.push({ name: '生灭轮回', multiplier: 0, cdTurns: 9, element: null, healPercent: 0.15, isHeal: true, isAoe: true, description: '全队回复15%气血' });
  if (tier >= 10) skills.push({ name: '天道无量', multiplier: 0, cdTurns: 10, element: null, healPercent: 0.18, isHeal: true, isAoe: true, description: '全队回复18%气血' });

  // 群体 regen（持续回复）— v3.6 value ×0.65 削弱（旧 4/6/8）
  if (tier >= 5) skills.push({ name: '灵气流转', multiplier: 0, cdTurns: 8, element: null, buff: { type: 'regen', value: 0.03, duration: 4 }, isAoe: true, description: '全队每回合回复3%气血 持续4回合' });
  if (tier >= 7) skills.push({ name: '九霄灵雨', multiplier: 0, cdTurns: 10, element: null, buff: { type: 'regen', value: 0.04, duration: 5 }, isAoe: true, description: '全队每回合回复4%气血 持续5回合' });
  if (tier >= 9) skills.push({ name: '永恒之心', multiplier: 0, cdTurns: 12, element: null, buff: { type: 'regen', value: 0.05, duration: 5 }, isAoe: true, description: '全队每回合回复5%气血 持续5回合' });

  // 群体 atk_up
  if (tier >= 5) skills.push({ name: '战意激扬', multiplier: 0, cdTurns: 7, element: null, buff: { type: 'atk_up', value: 0.20, duration: 3 }, isAoe: true, description: '全队攻击+20% 持续3回合' });
  if (tier >= 7) skills.push({ name: '破晓战吼', multiplier: 0, cdTurns: 9, element: null, buff: { type: 'atk_up', value: 0.30, duration: 4 }, isAoe: true, description: '全队攻击+30% 持续4回合' });
  if (tier >= 9) skills.push({ name: '万法归宗', multiplier: 0, cdTurns: 11, element: null, buff: { type: 'atk_up', value: 0.45, duration: 4 }, isAoe: true, description: '全队攻击+45% 持续4回合' });

  // 群体 def_up
  if (tier >= 5) skills.push({ name: '灵光护体', multiplier: 0, cdTurns: 7, element: null, buff: { type: 'def_up', value: 0.20, duration: 3 }, isAoe: true, description: '全队防御+20% 持续3回合' });
  if (tier >= 7) skills.push({ name: '金身护体', multiplier: 0, cdTurns: 9, element: null, buff: { type: 'def_up', value: 0.30, duration: 4 }, isAoe: true, description: '全队防御+30% 持续4回合' });
  if (tier >= 9) skills.push({ name: '鸿蒙圣体', multiplier: 0, cdTurns: 11, element: null, buff: { type: 'def_up', value: 0.45, duration: 4 }, isAoe: true, description: '全队防御+45% 持续4回合' });

  // debuff 技能（攻击型，对玩家施加控制/降攻）
  skills.push({ name: '妖气封印', multiplier: 0.50, cdTurns: 5, element: null, debuff: { type: 'silence', chance: 0.30, duration: 1 }, description: '封印玩家神通' });
  if (tier >= 5) skills.push({ name: '镇魂咒', multiplier: 0.50, cdTurns: 6, element: null, debuff: { type: 'atk_down', chance: 0.50, duration: 3, value: 0.20 }, description: '玩家攻击-20%' });
  if (tier >= 6) skills.push({ name: '风蚀咒', multiplier: 0.50, cdTurns: 6, element: null, debuff: { type: 'brittle', chance: 0.45, duration: 3, value: 0.25 }, description: '玩家防御-25%' });
  if (tier >= 7) skills.push({ name: '锁魂术', multiplier: 0.55, cdTurns: 7, element: null, debuff: { type: 'root', chance: 0.30, duration: 1 }, description: '束缚玩家1回合' });

  return skills;
}

export function buildMonsterSkillPool(template: MonsterTemplate): MonsterSkillDef[] {
  const tier = parseInt(template.drop_table.replace(/\D/g, '')) || 1;
  const elem = template.element;
  const isBoss = template.role === 'boss';
  const isHealer = template.role === 'healer';
  const role = template.role;

  if (isHealer) return buildHealerSkillPool(tier, elem);

  const skills: MonsterSkillDef[] = [];

  // T1+: 基础属性攻击 (v3.5: 攻击型 multiplier × 0.60, heal/buff 不动)
  if (elem) {
    const elemSkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '喷火', multiplier: 0.90, cdTurns: 3, element: 'fire', debuff: { type: 'burn', chance: 0.15, duration: 2 }, description: '喷出火焰' },
      water: { name: '水箭术', multiplier: 0.84, cdTurns: 3, element: 'water', debuff: { type: 'slow', chance: 0.20, duration: 2 }, description: '射出水箭' },
      wood:  { name: '毒液喷射', multiplier: 0.78, cdTurns: 3, element: 'wood', debuff: { type: 'poison', chance: 0.25, duration: 2 }, description: '喷射毒液' },
      metal: { name: '利爪', multiplier: 0.90, cdTurns: 3, element: 'metal', debuff: { type: 'bleed', chance: 0.15, duration: 2 }, description: '锋利爪击' },
      earth: { name: '飞石术', multiplier: 0.84, cdTurns: 3, element: 'earth', debuff: { type: 'brittle', chance: 0.15, duration: 2, value: 0.15 }, description: '投掷巨石' },
    };
    if (elemSkills[elem]) skills.push(elemSkills[elem]);
  }

  if (tier >= 2) {
    skills.push({ name: '蛮力撞击', multiplier: 0.96, cdTurns: 5, element: null, debuff: { type: 'stun', chance: 0.14, duration: 1 }, description: '猛烈撞击' });
  }
  if (tier >= 2 && role === 'dps') {
    skills.push({ name: '巨齿啃咬', multiplier: 1.44, cdTurns: 4, element: null, debuff: { type: 'bleed', chance: 0.25, duration: 2 }, description: '单体重击+流血' });
  }
  if (tier >= 2 && role === 'speed') {
    skills.push({ name: '影杀', multiplier: 1.20, cdTurns: 3, element: null, debuff: { type: 'slow', chance: 0.30, duration: 2 }, description: '突袭+减速' });
  }

  // T3+
  if (tier >= 3 && elem) {
    const strongSkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '烈焰吐息', multiplier: 1.08, cdTurns: 5, element: 'fire', debuff: { type: 'burn', chance: 0.30, duration: 3 }, description: '高温火息' },
      water: { name: '寒冰刺', multiplier: 0.96, cdTurns: 5, element: 'water', debuff: { type: 'freeze', chance: 0.14, duration: 1 }, description: '冰锥攻击' },
      wood:  { name: '缠绕荆棘', multiplier: 0.90, cdTurns: 5, element: 'wood', debuff: { type: 'root', chance: 0.20, duration: 1 }, description: '荆棘缠绕' },
      metal: { name: '破甲斩', multiplier: 1.08, cdTurns: 5, element: 'metal', debuff: { type: 'brittle', chance: 0.25, duration: 3, value: 0.20 }, description: '重斩破甲' },
      earth: { name: '震地击', multiplier: 0.96, cdTurns: 5, element: 'earth', debuff: { type: 'brittle', chance: 0.20, duration: 3, value: 0.18 }, description: '震地+脆弱' },
    };
    if (strongSkills[elem]) skills.push(strongSkills[elem]);
  }
  if (tier >= 3 && !['dps', 'speed'].includes(role)) {
    skills.push({ name: '狂猛劈砍', multiplier: 1.44, cdTurns: 5, element: null, debuff: { type: 'bleed', chance: 0.25, duration: 2 }, description: '单体重击+流血' });
  }

  // T4+
  if (tier >= 4) {
    skills.push({ name: '咆哮震慑', multiplier: 1.08, cdTurns: 6, element: null, debuff: { type: 'stun', chance: 0.14, duration: 1 }, description: '威压咆哮' });
  }
  if (tier >= 4 && elem) {
    const t4HeavySkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '焚天爆炎', multiplier: 1.56, cdTurns: 6, element: 'fire',  debuff: { type: 'burn',   chance: 0.30, duration: 3 }, description: '单体爆炎+灼烧' },
      water: { name: '寒冰穿心', multiplier: 1.44, cdTurns: 6, element: 'water', debuff: { type: 'freeze', chance: 0.18, duration: 1 }, description: '单体穿心+冻结' },
      wood:  { name: '毒针洗髓', multiplier: 1.44, cdTurns: 6, element: 'wood',  debuff: { type: 'poison', chance: 0.35, duration: 3 }, description: '单体毒针+剧毒' },
      metal: { name: '断魂利刃', multiplier: 1.62, cdTurns: 6, element: 'metal', debuff: { type: 'bleed',  chance: 0.25, duration: 3 }, description: '单体重斩+流血' },
      earth: { name: '山岳碎击', multiplier: 1.50, cdTurns: 6, element: 'earth', debuff: { type: 'bleed',  chance: 0.25, duration: 2 }, description: '单体重击+流血' },
    };
    if (t4HeavySkills[elem]) skills.push(t4HeavySkills[elem]);
  }

  // T5+ 攻击向（heal/buff 已剥离到 healer 怪身上）
  if (tier >= 5) {
    skills.push({ name: '雷电之怒', multiplier: 1.56, cdTurns: 7, element: 'metal', debuff: { type: 'bleed', chance: 0.30, duration: 2 }, description: '单体雷击+流血' });
  }

  // T6+
  if (tier >= 6 && elem) {
    const t6Skills: Record<string, MonsterSkillDef> = {
      fire:  { name: '焚天', multiplier: 1.38, cdTurns: 8, element: 'fire', debuff: { type: 'burn', chance: 0.50, duration: 3 }, description: '天火焚世' },
      water: { name: '极寒领域', multiplier: 1.20, cdTurns: 8, element: 'water', debuff: { type: 'freeze', chance: 0.25, duration: 1 }, description: '极寒冰封' },
      wood:  { name: '万毒噬心', multiplier: 1.20, cdTurns: 8, element: 'wood', debuff: { type: 'poison', chance: 0.50, duration: 4 }, description: '剧毒入体' },
      metal: { name: '斩魂', multiplier: 1.68, cdTurns: 8, element: 'metal', debuff: { type: 'bleed', chance: 0.40, duration: 3 }, description: '斩魂一击' },
      earth: { name: '山崩地裂', multiplier: 1.32, cdTurns: 8, element: 'earth', debuff: { type: 'stun', chance: 0.18, duration: 1 }, description: '山崩天降' },
    };
    if (t6Skills[elem]) skills.push(t6Skills[elem]);
  }
  if (tier >= 6) {
    skills.push({ name: '噬魂剑气', multiplier: 1.92, cdTurns: 9, element: null, debuff: { type: 'bleed', chance: 0.30, duration: 3 }, description: '单体重击+流血' });
  }

  // T7+
  if (tier >= 7) {
    skills.push({ name: '天雷制裁', multiplier: 1.68, cdTurns: 8, element: 'metal', debuff: { type: 'stun', chance: 0.20, duration: 1 }, description: '天雷眩晕' });
    skills.push({ name: '天罚之击', multiplier: 2.28, cdTurns: 10, element: null, debuff: { type: 'burn', chance: 0.30, duration: 3 }, description: '天罚重击+灼烧' });
  }

  // T8+
  if (tier >= 8) {
    skills.push({ name: '混沌一击', multiplier: 2.70, cdTurns: 10, element: null, debuff: { type: 'poison', chance: 0.35, duration: 3 }, description: '混沌重击+剧毒' });
  }

  // Boss 单独保留 heal/buff（boss 是孤狼战，没有 healer 配合）
  if (isBoss) {
    skills.push({ name: '首领之吼', multiplier: 0.72, cdTurns: 6, element: null, debuff: { type: 'atk_down', chance: 0.40, duration: 3, value: 0.15 }, description: '降攻15%' });
    if (tier >= 2) skills.push({ name: '首领恢复', multiplier: 0, cdTurns: 8, element: null, healPercent: 0.06, isHeal: true, description: '回复6%' });
    if (tier >= 3) skills.push({ name: '威压震慑', multiplier: 1.20, cdTurns: 7, element: null, debuff: { type: 'stun', chance: 0.18, duration: 1 }, description: '眩晕1回合' });
    if (tier >= 4) skills.push({ name: '凶煞之气', multiplier: 0, cdTurns: 8, element: null, buff: { type: 'def_up', value: 0.30, duration: 4 }, description: '防御+30%' });
    if (tier >= 5) skills.push({ name: '王者重击', multiplier: 1.80, cdTurns: 7, element: null, debuff: { type: 'bleed', chance: 0.30, duration: 3 }, description: '单体重击+流血' });
    if (tier >= 6) skills.push({ name: '灭世怒吼', multiplier: 1.50, cdTurns: 9, element: null, debuff: { type: 'stun', chance: 0.25, duration: 1 }, description: '眩晕1回合' });
    if (tier >= 7) skills.push({ name: '帝王斩', multiplier: 2.70, cdTurns: 10, element: null, debuff: { type: 'bleed', chance: 0.30, duration: 3 }, description: '单体重击+流血' });
    if (tier >= 7) skills.push({ name: '帝王神威', multiplier: 0, cdTurns: 12, element: null, buff: { type: 'atk_up', value: 0.35, duration: 4 }, description: '攻击+35% 持续4回合' });
    if (tier >= 8) skills.push({ name: '破碎虚空', multiplier: 0, cdTurns: 14, element: null, buff: { type: 'regen', value: 0.05, duration: 4 }, description: '持续4回合每回合回复5%气血' });
    if (tier >= 9) skills.push({ name: '界域吞噬', multiplier: 0, cdTurns: 12, element: null, buff: { type: 'def_up', value: 0.40, duration: 4 }, description: '防御+40% 持续4回合' });
    if (tier >= 10) skills.push({ name: '永生不灭', multiplier: 0, cdTurns: 18, element: null, buff: { type: 'regen', value: 0.08, duration: 5 }, description: '持续5回合每回合回复8%气血' });
    if (tier >= 10) skills.push({ name: '天道之力', multiplier: 0, cdTurns: 14, element: null, buff: { type: 'atk_up', value: 0.60, duration: 4 }, description: '攻击+60% 持续4回合' });
  }

  return skills;
}

// 导出: 获取怪物技能描述列表(供battle路由返回给前端)
export function buildMonsterSkillDescriptions(template: MonsterTemplate): string[] {
  const skills = buildMonsterSkillPool(template);
  return skills.map(s => `${s.name}: ${s.description}`);
}

// 生成奶妈 (healer) 怪物模板。T5+ 战斗自动注入一个奶妈
// power: 跟参考怪物（同 wave 普通怪）保持同等战力区间，避免奶妈成为软柿子或暴打
// element: 跟随 wave 主属性，保证元素表现一致
const HEALER_NAMES_BY_ELEM: Record<string, string[]> = {
  fire:  ['赤焰巫祝', '焰心圣女', '炎炉司祭'],
  water: ['玄水道姑', '寒月司命', '幽泉医者'],
  wood:  ['青丘药师', '木灵圣女', '回春仙子'],
  metal: ['金光司礼', '玉婵巫女', '锐金灵媒'],
  earth: ['厚土守巫', '地心司命', '玄土医者'],
};
const HEALER_NAMES_NEUTRAL = ['通玄圣女', '太虚医者', '天衡司命'];

// 按 tier 对齐 fight.post.ts 同 tier balanced 怪的 exp/stone 比例
// 否则 healer 用固定比例会在 T5/T6 经验严重超发，T9/T10 又过低
const HEALER_EXP_RATIO: Record<number, number> = {
  1: 0.18, 2: 0.08, 3: 0.12, 4: 0.09,
  5: 0.108, 6: 0.102, 7: 0.20, 8: 0.24, 9: 0.514, 10: 1.6,
};
const HEALER_STONE_MIN_RATIO: Record<number, number> = {
  1: 0.08, 2: 0.022, 3: 0.047, 4: 0.027,
  5: 0.028, 6: 0.033, 7: 0.10, 8: 0.25, 9: 0.179, 10: 0.889,
};
const HEALER_STONE_MAX_RATIO: Record<number, number> = {
  1: 0.22, 2: 0.066, 3: 0.117, 4: 0.071,
  5: 0.083, 6: 0.10, 7: 0.267, 8: 0.625, 9: 0.429, 10: 2.222,
};

export function makeHealerTemplate(tier: number, element: string | null, basePower: number): MonsterTemplate {
  const pool = element && HEALER_NAMES_BY_ELEM[element] ? HEALER_NAMES_BY_ELEM[element] : HEALER_NAMES_NEUTRAL;
  const name = pool[Math.floor(Math.random() * pool.length)];
  const expR  = HEALER_EXP_RATIO[tier]       ?? 0.10;
  const sMinR = HEALER_STONE_MIN_RATIO[tier] ?? 0.03;
  const sMaxR = HEALER_STONE_MAX_RATIO[tier] ?? 0.10;
  return {
    name,
    power: basePower,
    element,
    role: 'healer',
    exp: Math.floor(basePower * expR),
    stone_min: Math.floor(basePower * sMinR),
    stone_max: Math.floor(basePower * sMaxR),
    drop_table: `common_t${tier}`,
  };
}

export function initMonsterSkillState(template: MonsterTemplate): MonsterSkillState {
  const skills = buildMonsterSkillPool(template);
  return { skills, cds: skills.map(() => 0), berserkTriggered: false, bossEnrageTriggered: false };
}

// 选技能：优先级顺序：低血回血 → buff（若身上没在生效）→ 攻击 → 兜底 buff
// activeBuffTypes: 当前怪物身上已经存在的 buff 类型（避免反复叠相同 buff 浪费 CD）
// healPriority: healer 在团队 HP% 低时的回血权重提升（默认 0.40 自身阈值，传 'team' 则按团队最低 hp 触发）
export function monsterChooseSkill(
  state: MonsterSkillState,
  monsterHp: number,
  monsterMaxHp: number,
  isBoss: boolean,
  options?: { activeBuffTypes?: string[]; teamMinHpRatio?: number; isHealer?: boolean }
): MonsterSkillDef | null {
  const hpRatio = monsterHp / monsterMaxHp;
  const activeBuffTypes = options?.activeBuffTypes || [];
  const teamMinHpRatio = options?.teamMinHpRatio ?? hpRatio;
  const isHealer = options?.isHealer || false;

  // 1) 低血优先回血：自己 < 40%，或 healer 团队最低 < 40%
  // v3.6 healer 阈值 60→40，避免还没死人就疯狂奶导致玩家无窗口击杀 healer
  const healTriggerHp = 0.40;
  const triggerRatio = isHealer ? Math.min(hpRatio, teamMinHpRatio) : hpRatio;
  if (triggerRatio < healTriggerHp) {
    let bestHeal: { skill: MonsterSkillDef; index: number } | null = null;
    for (let i = 0; i < state.skills.length; i++) {
      if (state.cds[i] <= 0 && state.skills[i].isHeal) {
        if (!bestHeal || (state.skills[i].healPercent || 0) > (bestHeal.skill.healPercent || 0)) {
          bestHeal = { skill: state.skills[i], index: i };
        }
      }
    }
    if (bestHeal) { state.cds[bestHeal.index] = bestHeal.skill.cdTurns; return bestHeal.skill; }
  }

  // 2) 分桶：attackable / buffOnly（multiplier=0 + 有 buff 的）
  const attackable: { skill: MonsterSkillDef; index: number }[] = [];
  const buffOnly: { skill: MonsterSkillDef; index: number }[] = [];
  for (let i = 0; i < state.skills.length; i++) {
    if (state.cds[i] > 0) continue;
    const s = state.skills[i];
    if (s.isHeal) continue;
    if (s.multiplier > 0) {
      attackable.push({ skill: s, index: i });
    } else if (s.buff) {
      // 跳过身上已经在生效的同类 buff，避免反复刷新浪费回合
      if (!activeBuffTypes.includes(s.buff.type)) buffOnly.push({ skill: s, index: i });
    }
  }

  // 3) buff 优先级：healer 50% 概率开 buff；其他怪 25%
  const buffOpenRate = isHealer ? 0.50 : 0.25;
  if (buffOnly.length > 0 && Math.random() < buffOpenRate) {
    const pick = buffOnly[Math.floor(Math.random() * buffOnly.length)];
    state.cds[pick.index] = pick.skill.cdTurns;
    return pick.skill;
  }

  // 4) 攻击：选最大 multiplier
  if (attackable.length > 0) {
    let best = attackable[0];
    for (const a of attackable) {
      if (a.skill.multiplier > best.skill.multiplier ||
          (a.skill.multiplier === best.skill.multiplier && a.skill.cdTurns > best.skill.cdTurns)) {
        best = a;
      }
    }
    state.cds[best.index] = best.skill.cdTurns;
    return best.skill;
  }

  // 5) 兜底：实在没攻击就开 buff
  if (buffOnly.length > 0) {
    const pick = buffOnly[0];
    state.cds[pick.index] = pick.skill.cdTurns;
    return pick.skill;
  }

  return null;
}

export function tickMonsterCds(state: MonsterSkillState) {
  for (let i = 0; i < state.cds.length; i++) { if (state.cds[i] > 0) state.cds[i]--; }
}

// ========== 怪物属性生成 ==========

export function generateMonsterStats(template: MonsterTemplate): BattlerStats {
  const power = template.power * randFloat(0.85, 1.15);
  // v2.0 方案 A: Boss role 保持原版平衡, 通过整体 power 压缩和装备品质提升让战斗更舒服
  // healer：低攻、略脆、中速；技能伤害是配角，主要靠群体回血/buff 影响战局
  // v3.6: hp 0.30→0.18 / def 0.25→0.15, 让 healer 比 dps 略脆（hp 90% / def 同），
  //   配合 50% 抗控让"先杀 healer"成为可行策略而非被高 def/hp 反推
  // 注意：spd 字段已不用（怪物 spd 改按 tier 阶梯，见下方 SPD_BASE_BY_TIER），保留仅为回滚兜底
  const ratios: Record<string, { hp: number; atk: number; def: number; spd: number }> = {
    balanced: { hp: 0.30, atk: 0.30, def: 0.25, spd: 0.15 },
    tank:     { hp: 0.40, atk: 0.15, def: 0.35, spd: 0.10 },
    dps:      { hp: 0.20, atk: 0.45, def: 0.15, spd: 0.20 },
    speed:    { hp: 0.20, atk: 0.25, def: 0.15, spd: 0.40 },
    boss:     { hp: 0.35, atk: 0.30, def: 0.25, spd: 0.10 },
    healer:   { hp: 0.18, atk: 0.15, def: 0.15, spd: 0.30 },
  };
  const r = ratios[template.role] || ratios.balanced;
  const tier = parseInt(template.drop_table.replace(/\D/g, '')) || 1;
  const role = template.role;
  // v3.5: HP 整体 ×2 (配合玩家 HP ×2, 回合数翻倍)
  // 2026-04-25: 神识系数 0.5%→0.1% 后玩家神通伤害 -41%, HP 全 tier ×0.9
  // v3.5 (功法削弱): 全 tier × 0.60 联动玩家 DPS 下降, 保持 TTK 基本不变
  // 2026-04-26: T5+ 怪物血量 +5%（含秘境，秘境组队共用 generateMonsterStats）
  // 2026-04-26 (灵戒附灵): T6+ 再 +5% 抵消玩家主修流派峰值（T6 1.428→1.4994 / T7 1.5435→1.620675 / T8 1.6275→1.708875 / T9-T10 fallback 0.546→0.5733）
  const HP_SCALE_BY_TIER: Record<number, number> = {
    1: 1.03, 2: 1.03, 3: 1.03, 4: 1.03,
    5: 1.3335, 6: 1.4994, 7: 1.620675, 8: 1.708875,
  };
  const HP_SCALE = HP_SCALE_BY_TIER[tier] ?? 0.5733;
  // v3.4.1: ATK_SCALE 0.75 → 0.70 (-6.7%)
  // 2026-04-25: ATK_SCALE 0.70 → 0.665 (-5%) 联动神识削弱, 让玩家累积受伤不至飙升
  const ATK_SCALE = 0.665;
  const maxHp = Math.floor(power * r.hp * 10 * HP_SCALE);

  const monsterResists = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0.10 };
  if (template.element && template.element in monsterResists) {
    (monsterResists as any)[template.element] = 0.40;
  }

  let critRate = 0.05 + tier * 0.01;
  let critDmg = 1.5 + tier * 0.05;
  if (role === 'dps') { critRate += 0.05; critDmg += 0.2; }
  if (role === 'boss') { critRate += 0.03; critDmg += 0.3; }

  // v3.4: 怪物闪避拉满, 让 accuracy 副属性/附灵真正派上用场
  let dodge = 0;
  if (role === 'speed') dodge = 0.08 + tier * 0.03;
  if (role === 'dps') dodge = tier * 0.015;
  if (role === 'boss') dodge = 0.05 + tier * 0.015;

  let lifesteal = 0;
  if (role === 'boss' && tier >= 3) lifesteal = 0.03 + tier * 0.005;
  if (role === 'dps' && tier >= 5) lifesteal = 0.02;

  let armorPen = 0;
  if (role === 'dps') armorPen = tier * 1.5;
  if (role === 'boss') armorPen = tier * 2;

  // v3.4: Boss accuracy 拉满, 压玩家闪避更狠
  let accuracy = tier * 1;
  if (role === 'boss') accuracy = tier * 3;

  let ctrlResist = 0.10 + tier * 0.03;
  if (role === 'boss') ctrlResist = 0.20 + tier * 0.05;
  if (role === 'healer') ctrlResist = 0.50; // healer 自带 50% 抗控，避免被秒控干净
  ctrlResist = Math.min(0.70, ctrlResist);
  monsterResists.ctrl = ctrlResist;

  // 2026-04-27: 怪物 spd 改按 tier 阶梯 + role 倍率，不再随 power 几何增长
  // 让玩家正常装备能追上同 tier balanced/dps/boss/healer，speed 类怪保持先手设计意图
  const SPD_BASE_BY_TIER: Record<number, number> = {
    1: 30, 2: 60, 3: 120, 4: 200,
    5: 350, 6: 500, 7: 700, 8: 1000,
    9: 1300, 10: 1700,
  };
  const SPD_ROLE_MUL: Record<string, number> = {
    balanced: 1.0,
    tank:     0.7,
    dps:      1.5,
    speed:    2.5,
    boss:     1.0,
    healer:   1.5,
  };
  const spdBase = SPD_BASE_BY_TIER[tier] ?? SPD_BASE_BY_TIER[10];
  const spdRoleMul = SPD_ROLE_MUL[role] ?? 1.0;
  const spdValue = Math.floor(spdBase * spdRoleMul * randFloat(0.85, 1.15));

  return {
    name: template.name, maxHp, hp: maxHp,
    atk: Math.floor(power * r.atk * ATK_SCALE), def: Math.floor(power * r.def * 0.6),
    spd: spdValue,
    crit_rate: Math.min(0.50, critRate), crit_dmg: Math.min(2.5, critDmg), // v3.4: 怪物暴伤 cap 3.0→2.5
    dodge: Math.min(0.30, dodge), lifesteal: Math.min(0.15, lifesteal),
    element: template.element, resists: monsterResists,
    armorPen: Math.min(30, armorPen), accuracy: Math.min(25, accuracy),
  };
}

// ========== 伤害计算 ==========

export function calculateDamage(
  attacker: BattlerStats, defender: BattlerStats,
  skillMultiplier: number = 1.0, skillElement: string | null = null,
  ignoreDef: number = 0, ignoreDodge: boolean = false,
  isMainSkill: boolean = false,
): { damage: number; isCrit: boolean } {
  const useElement = skillElement || attacker.element;
  const elementMulti = getElementMultiplier(useElement, defender.element);

  let resistFactor = 1.0;
  if (useElement && defender.resists) {
    const r = (defender.resists as any)[useElement] || 0;
    resistFactor = 1.0 - Math.min(0.7, r);
  }

  // v1.2 附灵破甲叠加 + v1.3 主修破玄叠加
  const awakenState = (attacker as any).awakenState;
  const awakenArmorPenPct = awakenState?.armorPenPct || 0;
  const mainSkillArmorPen = (isMainSkill && awakenState?.mainSkillArmorPen) ? awakenState.mainSkillArmorPen : 0;
  const totalArmorPen = ignoreDef + (attacker.armorPen || 0) / 100 + awakenArmorPenPct + mainSkillArmorPen;
  const effectiveDef = defender.def * Math.max(0, 1 - totalArmorPen);
  // v3.4: DEF 权重从 balance.ts 读 (0.8), 让防御更值钱
  const atkDefRatio = attacker.atk / (attacker.atk + effectiveDef * BATTLE_FORMULA.atkDefRatioDefWeight);

  let elementDmgBonus = 1.0;
  if (useElement && attacker.elementDmg) {
    const ed = (attacker.elementDmg as any)[useElement] || 0;
    elementDmgBonus = 1 + ed / 100;
  }

  // v1.2 附灵条件型伤害加成 + v1.3 主修裂魂
  let awakenDmgMul = 1.0;
  if (awakenState) {
    // 斩杀：目标 HP < 30%
    if (awakenState.executeBonus > 0 && defender.maxHp > 0 && defender.hp / defender.maxHp < 0.30) {
      awakenDmgMul *= 1 + awakenState.executeBonus;
    }
    // 逆鳞：自身 HP < 50%
    if (awakenState.lowHpAtkBonus > 0 && attacker.maxHp > 0 && attacker.hp / attacker.maxHp < 0.50) {
      awakenDmgMul *= 1 + awakenState.lowHpAtkBonus;
    }
    // 对象加成：Boss / 精英（tank/dps）
    const defRole = (defender as any)._role;
    if (defRole === 'boss' && awakenState.vsBossBonus > 0) {
      awakenDmgMul *= 1 + awakenState.vsBossBonus;
    } else if ((defRole === 'tank' || defRole === 'dps') && awakenState.vsEliteBonus > 0) {
      awakenDmgMul *= 1 + awakenState.vsEliteBonus;
    }
    // v1.3 灵戒裂魂：仅主修攻击 + 目标 HP < 阈值
    if (isMainSkill && awakenState.mainSkillExecuteThr > 0 && defender.maxHp > 0 &&
        defender.hp / defender.maxHp < awakenState.mainSkillExecuteThr) {
      awakenDmgMul *= 1 + awakenState.mainSkillExecuteBonus;
    }
  }

  let damage = attacker.atk * skillMultiplier * elementMulti * resistFactor * atkDefRatio * elementDmgBonus * awakenDmgMul;

  // v3 飘渺神行：上一次闪避后的攻击强制暴击（命中不被闪避才消费）
  // v1.3 主修锋锐：主修攻击额外暴击率
  const mainSkillCritRate = (isMainSkill && awakenState?.mainSkillCritRate) ? awakenState.mainSkillCritRate : 0;
  let isCrit = Math.random() < (attacker.crit_rate + mainSkillCritRate);
  if ((attacker as any).forceCritNext) {
    isCrit = true;
  }

  if (!ignoreDodge) {
    const effectiveDodge = Math.max(0, defender.dodge - (attacker.accuracy || 0) / 100);
    if (Math.random() < effectiveDodge) return { damage: 0, isCrit: false };
  }

  if (isCrit) damage *= attacker.crit_dmg;
  // 命中后才消费 forceCritNext 标记（避免被闪避也丢标记）
  if ((attacker as any).forceCritNext) {
    (attacker as any).forceCritNext = false;
  }

  damage = Math.max(1, Math.floor(damage));
  return { damage, isCrit };
}

// ========== 从DB技能行构建EquippedSkillInfo ==========

export function buildEquippedSkillInfo(skillRows: any[]): EquippedSkillInfo {
  let activeSkill: SkillRefInfo | null = null;
  const divineSkills: SkillRefInfo[] = [];
  const pe = {
    atkPercent: 0, defPercent: 0, hpPercent: 0, spdPercent: 0,
    critRate: 0, critDmg: 0, dodge: 0, lifesteal: 0,
    resistFire: 0, resistWater: 0, resistWood: 0, resistMetal: 0, resistEarth: 0, resistCtrl: 0,
    regenPerTurn: 0, damageReductionFlat: 0, reflectPercent: 0,
    poisonOnHitTaken: 0, burnOnHitTaken: 0, reflectOnCrit: 0,
    reviveOnce: false, skillCdReduction: 0,
    dotAmpPct: 0, critAfterDodge: false, healAmpPct: 0,
  };

  for (const row of skillRows) {
    const skill = SKILL_MAP[row.skill_id];
    if (!skill) continue;
    const lvl = row.level || 1;
    const lvMul = 1 + (lvl - 1) * 0.15; // 每级+15%

    // buff缩放: value/valuePercent 按 lvMul, 无value的纯buff(如金钟罩immune)增加duration
    function scaleBuff(b: typeof skill.buff) {
      if (!b) return undefined;
      const hasValue = b.value !== undefined || b.valuePercent !== undefined;
      return {
        ...b,
        value: b.value ? b.value * lvMul : undefined,
        valuePercent: b.valuePercent ? b.valuePercent * lvMul : undefined,
        duration: hasValue ? b.duration : Math.floor(b.duration * lvMul), // 无数值buff按等级增加持续时间
      };
    }

    if (skill.type === 'active') {
      activeSkill = {
        name: skill.name, multiplier: skill.multiplier * lvMul, element: skill.element,
        debuff: skill.debuff ? { ...skill.debuff, chance: skill.debuff.chance * lvMul } : undefined,
        buff: scaleBuff(skill.buff),
        ignoreDef: skill.ignoreDef, isAoe: skill.isAoe, targetCount: skill.targetCount, hitCount: skill.hitCount, healAtkRatio: skill.healAtkRatio ? skill.healAtkRatio * lvMul : undefined,
      };
    } else if (skill.type === 'divine') {
      divineSkills.push({
        name: skill.name, multiplier: skill.multiplier * lvMul, cdTurns: skill.cdTurns, element: skill.element,
        debuff: skill.debuff ? { ...skill.debuff, chance: skill.debuff.chance * lvMul } : undefined,
        buff: scaleBuff(skill.buff),
        ignoreDef: skill.ignoreDef, isAoe: skill.isAoe, targetCount: skill.targetCount, hitCount: skill.hitCount, healAtkRatio: skill.healAtkRatio ? skill.healAtkRatio * lvMul : undefined,
      });
    } else if (skill.type === 'passive' && skill.effect) {
      const e = skill.effect;
      pe.atkPercent += (e.ATK_percent || 0) * lvMul;
      pe.defPercent += (e.DEF_percent || 0) * lvMul;
      pe.hpPercent += (e.HP_percent || 0) * lvMul;
      pe.spdPercent += (e.SPD_percent || 0) * lvMul;
      pe.critRate += (e.CRIT_RATE_flat || 0) * lvMul;
      pe.critDmg += (e.CRIT_DMG_flat || 0) * lvMul;
      pe.dodge += (e.DODGE_flat || 0) * lvMul;
      pe.lifesteal += (e.LIFESTEAL_flat || 0) * lvMul;
      pe.resistMetal += (e.RESIST_METAL || 0) * lvMul;
      pe.resistWood += (e.RESIST_WOOD || 0) * lvMul;
      pe.resistWater += (e.RESIST_WATER || 0) * lvMul;
      pe.resistFire += (e.RESIST_FIRE || 0) * lvMul;
      pe.resistEarth += (e.RESIST_EARTH || 0) * lvMul;
      pe.resistCtrl += (e.RESIST_CTRL || 0) * lvMul;
      pe.regenPerTurn += (e.regen_per_turn_percent || 0) * lvMul;
      pe.damageReductionFlat += (e.damage_reduction_flat || 0) * lvMul;
      pe.reflectPercent += (e.reflect_damage_percent || 0) * lvMul;
      pe.poisonOnHitTaken = Math.max(pe.poisonOnHitTaken || 0, (e.poison_on_hit_taken_chance || 0) * lvMul);
      pe.burnOnHitTaken = Math.max(pe.burnOnHitTaken || 0, (e.burn_on_hit_taken_chance || 0) * lvMul);
      pe.reflectOnCrit = Math.max(pe.reflectOnCrit || 0, (e.reflect_on_crit_taken || 0) * lvMul);
      if (e.revive_once) pe.reviveOnce = true;
      pe.skillCdReduction = Math.max(pe.skillCdReduction || 0, e.skill_cd_reduction_turns || 0);
      // 战意沸腾: atk_per_kill_percent 随等级缩放
      if (e.atk_per_kill_percent) {
        (pe as any).atkPerKillPercent = (e.atk_per_kill_percent || 0) * lvMul;
        (pe as any).maxStacks = e.max_stacks || 8;
      }
      // v3 紫色被动机制
      pe.dotAmpPct = (pe.dotAmpPct || 0) + (e.dot_amplifier_percent || 0) * lvMul;
      pe.healAmpPct = (pe.healAmpPct || 0) + (e.heal_amplifier_percent || 0) * lvMul;
      if (e.crit_after_dodge) pe.critAfterDodge = true;
    }
  }

  // v2.0: 同类百分比加成硬上限 +40%, 避免堆叠爆炸
  const PASSIVE_PCT_CAP = 40;
  pe.atkPercent = Math.min(pe.atkPercent, PASSIVE_PCT_CAP);
  pe.defPercent = Math.min(pe.defPercent, PASSIVE_PCT_CAP);
  pe.hpPercent = Math.min(pe.hpPercent, PASSIVE_PCT_CAP);
  pe.spdPercent = Math.min(pe.spdPercent, PASSIVE_PCT_CAP);

  return { activeSkill, divineSkills, passiveEffects: pe };
}

// ========== 波次战斗(1 vs N只怪) ==========

export interface WaveBattleStats {
  playerCritCount: number;        // 玩家本场暴击次数
  playerHitsTaken: number;        // 玩家本场被命中次数（造成 >0 伤害）
  elementAdvantageHit: boolean;   // 玩家对怪物打出过 1.3x 五行相克
  lifestealFullRecovery: boolean; // 通过吸血从非满血回到满血
  bossKilledByTurn3: boolean;     // 3 回合内击杀任一 Boss
}

export interface WaveBattleResult {
  won: boolean;
  logs: BattleLogEntry[];
  totalExp: number;
  totalStone: number;
  monstersKilled: { template: MonsterTemplate }[];
  stats: WaveBattleStats;
}

export function runWaveBattle(
  playerStats: BattlerStats,
  monsterList: { stats: BattlerStats; template: MonsterTemplate }[],
  equippedSkills?: EquippedSkillInfo
): WaveBattleResult {
  const player: any = { ...playerStats, hp: playerStats.maxHp, buffs: [] as ActiveBuff[], debuffs: [] as ActiveDebuff[], frozenTurns: 0 };
  const maxTurns = 50 * monsterList.length;
  const logs: BattleLogEntry[] = [];
  let totalExp = 0, totalStone = 0;
  const monstersKilled: { template: MonsterTemplate }[] = [];
  const battleStats: WaveBattleStats = {
    playerCritCount: 0,
    playerHitsTaken: 0,
    elementAdvantageHit: false,
    lifestealFullRecovery: false,
    bossKilledByTurn3: false,
  };

  const monsters = monsterList.map(m => {
    const stats: any = { ...m.stats };
    stats._role = m.template.role; // v1.2 附灵对象加成用
    return {
      stats,
      template: m.template,
      alive: true,
      skillState: initMonsterSkillState(m.template),
      baseAtk: m.stats.atk,
      baseDef: m.stats.def,
      buffs: [] as ActiveBuff[],
      debuffs: [] as ActiveDebuff[],
      frozenTurns: 0,
    };
  });

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
    // 抗性
    if (!player.resists) player.resists = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 };
    player.resists.metal += p.resistMetal || 0;
    player.resists.wood += p.resistWood || 0;
    player.resists.water += p.resistWater || 0;
    player.resists.fire += p.resistFire || 0;
    player.resists.earth += p.resistEarth || 0;
    player.resists.ctrl += p.resistCtrl || 0;
    // v3 紫色被动：DOT 增伤 / 闪避必暴标记 / 治疗增幅
    (player as any).dotAmpPct = p.dotAmpPct || 0;
    (player as any).critAfterDodge = !!p.critAfterDodge;
    (player as any).healAmpPct = p.healAmpPct || 0;
  }

  // v1.2 附灵运行时状态注入 + 与功法被动同位钩子 Max-Merge
  const aw = (playerStats as any).awaken || {};
  player.awakenState = {
    burnOnHitChance: aw.burnOnHitChance || 0,
    poisonOnHitChance: aw.poisonOnHitChance || 0,
    bleedOnHitChance: aw.bleedOnHitChance || 0,
    chainAttackChance: aw.chainAttackChance || 0,
    armorPenPct: aw.armorPenPct || 0,
    executeBonus: aw.executeBonus || 0,
    lowHpAtkBonus: aw.lowHpAtkBonus || 0,
    lowHpDefBonus: aw.lowHpDefBonus || 0,
    damageReduction: aw.damageReduction || 0,
    critTakenReduction: aw.critTakenReduction || 0,
    regenPerTurn: aw.regenPerTurn || 0,
    cleanseInterval: aw.cleanseInterval || 0,
    vsBossBonus: aw.vsBossBonus || 0,
    vsEliteBonus: aw.vsEliteBonus || 0,
    debuffDurationBonus: aw.debuffDurationBonus || 0,
    // v1.3 灵戒附灵·主修功法增幅
    mainSkillMultBonus: aw.mainSkillMultBonus || 0,
    mainSkillCritRate: aw.mainSkillCritRate || 0,
    mainSkillArmorPen: aw.mainSkillArmorPen || 0,
    mainSkillLifesteal: aw.mainSkillLifesteal || 0,
    mainSkillBleedAmp: aw.mainSkillBleedAmp || 0,
    mainSkillBleedAmpElem: aw.mainSkillBleedAmpElem,
    mainSkillPoisonAmp: aw.mainSkillPoisonAmp || 0,
    mainSkillPoisonAmpElem: aw.mainSkillPoisonAmpElem,
    mainSkillFreezeChance: aw.mainSkillFreezeChance || 0,
    mainSkillFreezeChanceElem: aw.mainSkillFreezeChanceElem,
    mainSkillBurnDuration: aw.mainSkillBurnDuration || 0,
    mainSkillBurnDurationElem: aw.mainSkillBurnDurationElem,
    mainSkillBrittleAmp: aw.mainSkillBrittleAmp || 0,
    mainSkillBrittleAmpElem: aw.mainSkillBrittleAmpElem,
    mainSkillChainChance: aw.mainSkillChainChance || 0,
    mainSkillCritCdCut: !!aw.mainSkillCritCdCut,
    mainSkillExecuteThr: aw.mainSkillExecuteThr || 0,
    mainSkillExecuteBonus: aw.mainSkillExecuteBonus || 0,
  };
  player.awakenTurnCounter = 0; // 用于 cleanseInterval 计数
  // 附灵与功法被动同类钩子：取最大值叠加到 passiveEffects（战斗循环读的是 pe.*）
  if (equippedSkills?.passiveEffects) {
    const pe = equippedSkills.passiveEffects;
    if (aw.poisonOnHitTaken) pe.poisonOnHitTaken = Math.max(pe.poisonOnHitTaken || 0, aw.poisonOnHitTaken);
    if (aw.burnOnHitTaken)   pe.burnOnHitTaken   = Math.max(pe.burnOnHitTaken   || 0, aw.burnOnHitTaken);
    if (aw.reflectOnCrit)    pe.reflectOnCrit    = Math.max(pe.reflectOnCrit    || 0, aw.reflectOnCrit);
  }
  // 开场狂怒：立即注入一个 atk_up buff，持续 4 回合
  if (aw.frenzyOpening && aw.frenzyOpening > 0) {
    if (!player.buffs) player.buffs = [];
    player.buffs.push({ type: 'atk_up', remaining: 4, value: aw.frenzyOpening });
  }

  const activeSkill: SkillRefInfo = equippedSkills?.activeSkill || { name: '基础剑法', multiplier: 1.0, element: null };
  const cdReduction = equippedSkills?.passiveEffects?.skillCdReduction || 0;
  const divineCds: number[] = (equippedSkills?.divineSkills || []).map(() => 0);
  let reviveAvailable = equippedSkills?.passiveEffects?.reviveOnce || false;
  // 战意沸腾
  const atkPerKillPercent = (equippedSkills?.passiveEffects as any)?.atkPerKillPercent || 0;
  const maxKillStacks = (equippedSkills?.passiveEffects as any)?.maxStacks || 8;
  let killStacks = 0;

  const names = monsters.map(m => m.stats.name).join('、');
  logs.push({ turn: 0, text: `你遭遇了 ${monsters.length} 只怪物: ${names}`, type: 'system', playerHp: player.hp, playerMaxHp: player.maxHp, monsterHp: 0, monsterMaxHp: 0 });

  function snap() {
    const t = monsters.find(m => m.alive);
    return { playerHp: Math.max(0, player.hp), playerMaxHp: player.maxHp, monsterHp: t ? Math.max(0, t.stats.hp) : 0, monsterMaxHp: t ? t.stats.maxHp : 0, monstersHp: monsters.map(m => m.alive ? Math.max(0, m.stats.hp) : 0) };
  }

  // 施加 debuff 到目标（返回是否命中）
  function tryApplyDebuff(
    target: { debuffs: ActiveDebuff[]; frozenTurns: number; stats?: any; maxHp?: number; resists?: any },
    targetName: string,
    debuff: { type: DebuffType; chance: number; duration: number; value?: number },
    attackerAtk: number,
    turn: number,
    inflictor?: { awakenState?: { debuffDurationBonus?: number } } | 'player',
  ): boolean {
    // v1.3 灵戒附灵·属性匹配向：仅当 inflictor === 'player' 且为主修攻击 + 主修元素匹配时增强 debuff
    let effChance = debuff.chance;
    let effDuration = debuff.duration;
    let effValue = debuff.value;
    let bleedAmpMul = 1.0;
    let poisonAmpMul = 1.0;
    let resonanceTag = '';
    if (inflictor === 'player') {
      const aState = (player as any).awakenState as PlayerAwakenState | undefined;
      const mainElem = (player as any)._mainSkillElement as string | undefined;
      if (aState && mainElem) {
        // 火 + 灼烧 → 持续 +
        if (debuff.type === 'burn' && mainElem === 'fire' &&
            aState.mainSkillBurnDurationElem === 'fire' && aState.mainSkillBurnDuration) {
          effDuration += aState.mainSkillBurnDuration;
          resonanceTag = ` ✦焚天+${aState.mainSkillBurnDuration}`;
        }
        // 水 + 冻结/眩晕/束缚 → 概率 +
        if ((debuff.type === 'freeze' || debuff.type === 'stun' || debuff.type === 'root') && mainElem === 'water' &&
            aState.mainSkillFreezeChanceElem === 'water' && aState.mainSkillFreezeChance) {
          effChance = Math.min(1, effChance + aState.mainSkillFreezeChance);
          resonanceTag = ` ✦水蕴+${(aState.mainSkillFreezeChance * 100).toFixed(0)}%`;
        }
        // 土 + 脆弱 → value 加深
        if (debuff.type === 'brittle' && mainElem === 'earth' &&
            aState.mainSkillBrittleAmpElem === 'earth' && aState.mainSkillBrittleAmp) {
          effValue = (effValue || 0.15) * (1 + aState.mainSkillBrittleAmp);
          resonanceTag = ` ✦厚土+${(aState.mainSkillBrittleAmp * 100).toFixed(0)}%`;
        }
        // 金 + 流血 → 每跳伤害 +
        if (debuff.type === 'bleed' && mainElem === 'metal' &&
            aState.mainSkillBleedAmpElem === 'metal' && aState.mainSkillBleedAmp) {
          bleedAmpMul = 1 + aState.mainSkillBleedAmp;
          resonanceTag = ` ✦金鸣+${(aState.mainSkillBleedAmp * 100).toFixed(0)}%`;
        }
        // 木 + 中毒 → 每跳伤害 +
        if (debuff.type === 'poison' && mainElem === 'wood' &&
            aState.mainSkillPoisonAmpElem === 'wood' && aState.mainSkillPoisonAmp) {
          poisonAmpMul = 1 + aState.mainSkillPoisonAmp;
          resonanceTag = ` ✦木灵+${(aState.mainSkillPoisonAmp * 100).toFixed(0)}%`;
        }
      }
    }

    if (Math.random() >= effChance) return false;
    // 控制类抗性降低持续时间
    const isCtrl = ['freeze', 'stun', 'root', 'silence'].includes(debuff.type);
    // 天师附灵：施加方延长减益持续回合（不影响控制类）
    let durBonus = 0;
    if (inflictor === 'player') durBonus = (player as any).awakenState?.debuffDurationBonus || 0;
    else if (inflictor && typeof inflictor === 'object') durBonus = inflictor.awakenState?.debuffDurationBonus || 0;
    if (isCtrl) durBonus = 0;
    let duration = effDuration + durBonus;
    const tianshiTag = durBonus > 0 ? ` ✦天师+${durBonus}` : '';
    if (isCtrl) {
      const r = Math.min(0.7, target.resists?.ctrl || 0);
      if (r > 0 && Math.random() < r) {
        logs.push({ turn, text: `  ${targetName}抵抗了${DEBUFF_NAMES[debuff.type]}`, type: 'normal', ...snap() });
        return false;
      }
    }
    // 冻结/眩晕/束缚合并到 frozenTurns
    if (debuff.type === 'freeze' || debuff.type === 'stun' || debuff.type === 'root') {
      target.frozenTurns = Math.max(target.frozenTurns, duration);
      logs.push({ turn, text: `  ${targetName}被${DEBUFF_NAMES[debuff.type]} ${duration} 回合${tianshiTag}${resonanceTag}`, type: 'normal', ...snap() });
      return true;
    }
    // DOT/其他 debuff
    const targetMaxHp = target.stats?.maxHp || target.maxHp || 0;
    let dmg = calcDotDamage(debuff.type, targetMaxHp, attackerAtk);
    // v3 万毒归一：玩家施加 DOT 时按 dotAmpPct 放大（target 不是 player 即视为玩家施加）
    const isDotType = debuff.type === 'poison' || debuff.type === 'burn' || debuff.type === 'bleed';
    if (isDotType && target !== player && (player as any).dotAmpPct) {
      dmg = Math.max(1, Math.floor(dmg * (1 + (player as any).dotAmpPct / 100)));
    }
    // v1.3 主修元素附灵：流血/中毒每跳伤害放大
    if (debuff.type === 'bleed' && bleedAmpMul > 1) {
      dmg = Math.max(1, Math.floor(dmg * bleedAmpMul));
    }
    if (debuff.type === 'poison' && poisonAmpMul > 1) {
      dmg = Math.max(1, Math.floor(dmg * poisonAmpMul));
    }
    const exists = target.debuffs.find(d => d.type === debuff.type);
    if (exists) { exists.remaining = duration; exists.value = effValue; exists.damagePerTurn = dmg; }
    else target.debuffs.push({ type: debuff.type, remaining: duration, damagePerTurn: dmg, value: effValue });

    let text = `${targetName}陷入${DEBUFF_NAMES[debuff.type]} ${duration} 回合`;
    if (debuff.type === 'poison') text += ` (每回合 ${dmg} 毒伤)`;
    else if (debuff.type === 'burn') text += ` (每回合 ${dmg} 火伤)`;
    else if (debuff.type === 'bleed') text += ` (每回合 ${dmg} 流血)`;
    else if (debuff.type === 'brittle') text += ` (受伤+${((effValue || 0.15) * 100).toFixed(0)}%)`;
    else if (debuff.type === 'atk_down') text += ` (攻击-${((effValue || 0.15) * 100).toFixed(0)}%)`;
    else if (debuff.type === 'slow') text += ` (必定后攻)`;
    else if (debuff.type === 'silence') text += ` (无法使用神通)`;
    logs.push({ turn, text: `  ${text}${tianshiTag}${resonanceTag}`, type: 'normal', ...snap() });
    return true;
  }

  // 结算目标 DOT 伤害 & 递减剩余
  function tickDebuffs(target: { debuffs: ActiveDebuff[] }, targetName: string, turn: number): number {
    let dot = 0;
    for (const d of target.debuffs) {
      if (d.damagePerTurn > 0) {
        dot += d.damagePerTurn;
        logs.push({ turn, text: `  ${targetName}受到${DEBUFF_NAMES[d.type]} ${d.damagePerTurn} 点伤害`, type: 'normal', ...snap() });
      }
    }
    // 递减
    for (let i = target.debuffs.length - 1; i >= 0; i--) {
      target.debuffs[i].remaining--;
      if (target.debuffs[i].remaining <= 0) {
        logs.push({ turn, text: `  ${targetName}的${DEBUFF_NAMES[target.debuffs[i].type]}效果结束`, type: 'normal', ...snap() });
        target.debuffs.splice(i, 1);
      }
    }
    return dot;
  }

  // 获取 debuff 加成系数
  function getBrittleBonus(target: { debuffs: ActiveDebuff[] }): number {
    const b = target.debuffs.find(d => d.type === 'brittle');
    return b ? (b.value || 0.15) : 0;
  }
  function getAtkDownMul(target: { debuffs: ActiveDebuff[] }): number {
    const a = target.debuffs.find(d => d.type === 'atk_down');
    return a ? (1 - (a.value || 0.15)) : 1;
  }
  function hasSilence(target: { debuffs: ActiveDebuff[] }): boolean {
    return target.debuffs.some(d => d.type === 'silence');
  }
  function hasSlow(target: { debuffs: ActiveDebuff[] }): boolean {
    return target.debuffs.some(d => d.type === 'slow');
  }

  // 玩家 buff 辅助：按 type 求所有 value 总和（用于 atk_up/def_up/spd_up/crit_up 叠加）
  function sumPlayerBuff(type: BuffType): number {
    if (!player.buffs) return 0;
    let sum = 0;
    for (const b of player.buffs as ActiveBuff[]) {
      if (b.type === type && typeof b.value === 'number') sum += b.value;
    }
    return sum;
  }
  // 是否有某类 buff
  function hasPlayerBuff(type: BuffType): boolean {
    if (!player.buffs) return false;
    return (player.buffs as ActiveBuff[]).some(b => b.type === type);
  }

  // 玩家施放 buff 时注入 player.buffs（同 type 覆盖持续时间/数值）
  function applyPlayerBuff(b: { type: BuffType; duration: number; value?: number; valuePercent?: number }, skillName: string, turn: number) {
    if (!player.buffs) player.buffs = [];
    const buffs = player.buffs as ActiveBuff[];
    // shield 的剩余量以当前 atk × value 计算一次；续上时累加
    let shieldHp: number | undefined;
    if (b.type === 'shield' && b.value) shieldHp = Math.max(0, Math.floor(player.atk * b.value));
    const exists = buffs.find(x => x.type === b.type);
    if (exists) {
      exists.remaining = Math.max(exists.remaining, b.duration);
      if (b.value !== undefined) exists.value = b.value;
      if (b.valuePercent !== undefined) exists.valuePercent = b.valuePercent;
      if (shieldHp !== undefined) exists.shieldHp = (exists.shieldHp || 0) + shieldHp;
    } else {
      buffs.push({ type: b.type, remaining: b.duration, value: b.value, valuePercent: b.valuePercent, shieldHp });
    }
    // 日志文本
    const desc: Record<string, string> = {
      shield: `获得护盾 ${shieldHp || 0} 点`,
      immune: `受到伤害减半`,
      atk_up: `攻击+${((b.value || 0) * 100).toFixed(0)}%`,
      def_up: `防御+${((b.value || 0) * 100).toFixed(0)}%`,
      spd_up: `身法+${((b.value || 0) * 100).toFixed(0)}%`,
      crit_up: `暴击+${((b.value || 0) * 100).toFixed(0)}%`,
      regen: `每回合回复 ${(((b.valuePercent || 0)) * 100).toFixed(0)}% 气血`,
      reflect: `反弹${((b.value || 0) * 100).toFixed(0)}%伤害`,
    };
    const effText = desc[b.type] || '增益';
    logs.push({ turn, text: `  【${skillName}】${effText}，持续 ${b.duration} 回合`, type: 'buff', ...snap() });
  }

  // 每回合开始：消耗玩家 buff 中的 regen（单独结算）
  function runPlayerBuffTurnStart(turn: number) {
    if (!player.buffs) return;
    const buffs = player.buffs as ActiveBuff[];
    for (const b of buffs) {
      if (b.type === 'regen' && b.valuePercent && player.hp > 0 && player.hp < player.maxHp) {
        const heal = Math.max(1, Math.floor(player.maxHp * b.valuePercent));
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        if (player.hp > before) {
          logs.push({ turn, text: `  ✦【回复】回复 ${player.hp - before} 点气血`, type: 'buff', ...snap() });
        }
      }
    }
  }

  // 每回合末：玩家 buff 时长 -1，到期移除
  function tickPlayerBuffs(turn: number) {
    if (!player.buffs) return;
    const buffs = player.buffs as ActiveBuff[];
    for (let i = buffs.length - 1; i >= 0; i--) {
      buffs[i].remaining--;
      if (buffs[i].remaining <= 0) buffs.splice(i, 1);
    }
  }

  // 每回合累计玩家吸血汇总
  let turnLifestealTotal = 0;

  // v1.2 附灵工具：命中后 roll 主动触发 DOT（焚魂/淬毒/裂魂）
  function triggerAwakenOnHit(target: any, targetName: string, turn: number) {
    const st = player.awakenState;
    if (!st) return;
    if (st.burnOnHitChance > 0 && Math.random() < st.burnOnHitChance) {
      const ok = tryApplyDebuff(target, targetName, { type: 'burn', chance: 1.0, duration: 2 }, player.atk, turn, 'player');
      if (ok) logs.push({ turn, text: `  ✦【焚魂】${targetName}被烈焰灼烧`, type: 'buff', ...snap() });
    }
    if (st.poisonOnHitChance > 0 && Math.random() < st.poisonOnHitChance) {
      const ok = tryApplyDebuff(target, targetName, { type: 'poison', chance: 1.0, duration: 2 }, player.atk, turn, 'player');
      if (ok) logs.push({ turn, text: `  ✦【淬毒】${targetName}中毒`, type: 'buff', ...snap() });
    }
    if (st.bleedOnHitChance > 0 && Math.random() < st.bleedOnHitChance) {
      const ok = tryApplyDebuff(target, targetName, { type: 'bleed', chance: 1.0, duration: 2 }, player.atk, turn, 'player');
      if (ok) logs.push({ turn, text: `  ✦【裂魂】${targetName}流血不止`, type: 'buff', ...snap() });
    }
  }

  // v1.2 附灵工具：每回合开始的玩家自身效果（回血 + 洗髓）
  function runAwakenTurnStart(turn: number) {
    const st = player.awakenState;
    if (!st) return;
    player.awakenTurnCounter = (player.awakenTurnCounter || 0) + 1;
    // 回春
    if (st.regenPerTurn > 0 && player.hp > 0 && player.hp < player.maxHp) {
      const heal = Math.max(1, Math.floor(player.maxHp * st.regenPerTurn));
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      if (player.hp > before) {
        logs.push({ turn, text: `  ✦【回春】回复 ${player.hp - before} 点气血`, type: 'buff', ...snap() });
      }
    }
    // 洗髓：每 N 回合清除 1 个减益
    // 优先级: 控制类(freeze/stun/root → frozenTurns; silence) → 其次清最老 debuff
    if (st.cleanseInterval > 0 && (player.awakenTurnCounter % st.cleanseInterval === 0)) {
      if (player.frozenTurns > 0) {
        // freeze/stun/root 合并到 frozenTurns, 一次清干净
        player.frozenTurns = 0;
        logs.push({ turn, text: `  ✦【洗髓】解除了控制状态`, type: 'buff', ...snap() });
      } else if (player.debuffs && player.debuffs.length > 0) {
        // 先找 silence（也是控制类）
        const silenceIdx = player.debuffs.findIndex((d: ActiveDebuff) => d.type === 'silence');
        let removed: ActiveDebuff;
        if (silenceIdx >= 0) {
          removed = player.debuffs.splice(silenceIdx, 1)[0];
        } else {
          // 其次：最老的一个（shift 第 0 个，FIFO）
          removed = player.debuffs.shift();
        }
        logs.push({ turn, text: `  ✦【洗髓】清除了 ${DEBUFF_NAMES[removed.type] || removed.type}`, type: 'buff', ...snap() });
      }
    }
  }

  // v1.2 附灵工具：玩家受伤减免（返回修正后的伤害）
  function applyAwakenIncomingReduction(damage: number, isCrit: boolean): number {
    const st = player.awakenState;
    if (!st) return damage;
    let d = damage;
    if (st.damageReduction > 0) d = d * (1 - st.damageReduction);
    if (isCrit && st.critTakenReduction > 0) d = d * (1 - st.critTakenReduction);
    // 不屈：HP<30% 时 DEF 动态 +X%（在 applyIncoming 前已经过 dealDamage 计算，DEF 不动态变）
    // 改为折扣实际伤害近似生效：加成 def → 伤害 × def/(def*bonus) ≈ 1/(1+bonus)
    if (st.lowHpDefBonus > 0 && player.maxHp > 0 && player.hp / player.maxHp < 0.30) {
      d = d * (1 / (1 + st.lowHpDefBonus));
    }
    return Math.max(1, Math.floor(d));
  }

  // 怪物攻击逻辑(提取为函数,先后手复用)
  function executeMonsterAttacks(turn: number) {
    // 玩家 buff：def_up 临时放大 player.def，怪物全部攻击结束后还原
    const defUp = sumPlayerBuff('def_up');
    const origPlayerDef = player.def;
    if (defUp > 0) player.def = Math.floor(origPlayerDef * (1 + defUp));
    for (const m of monsters.filter(mm => mm.alive)) {
      if (m.frozenTurns > 0) {
        m.frozenTurns--;
        logs.push({ turn, text: `  ${m.stats.name}被控制中,无法行动`, type: 'normal', ...snap() });
        continue;
      }
      tickMonsterCds(m.skillState);
      for (let bi = m.buffs.length - 1; bi >= 0; bi--) {
        const b = m.buffs[bi];
        if (b.type === 'regen' && b.value && m.stats.hp < m.stats.maxHp) {
          const heal = Math.max(1, Math.floor(m.stats.maxHp * b.value));
          m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + heal);
          logs.push({ turn, text: `  ${m.stats.name} 持续回复了 ${heal} 点气血`, type: 'buff', ...snap() });
        }
        b.remaining--;
        if (b.remaining <= 0) m.buffs.splice(bi, 1);
      }

      let mAtk = m.baseAtk;
      let mDef = m.baseDef;
      for (const b of m.buffs) {
        if (b.type === 'atk_up' && b.value) mAtk = Math.floor(mAtk * (1 + b.value));
        if (b.type === 'def_up' && b.value) mDef = Math.floor(mDef * (1 + b.value));
      }
      if (m.template.role === 'boss' && !m.skillState.bossEnrageTriggered && m.stats.hp < m.stats.maxHp * 0.30) {
        m.skillState.bossEnrageTriggered = true;
        logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}进入狂暴状态！攻击永久+30%!`, type: 'crit', ...snap() });
      }
      if (m.skillState.bossEnrageTriggered) mAtk = Math.floor(mAtk * 1.30);
      if (m.buffs.some(b => b.type === 'atk_up') && m.skillState.berserkTriggered) mDef = Math.floor(mDef * 0.80);
      // 应用 atk_down debuff
      mAtk = Math.floor(mAtk * getAtkDownMul(m));
      m.stats.atk = mAtk;
      m.stats.def = mDef;

      const isHealer = m.template.role === 'healer';
      const aliveAllies = monsters.filter(mm => mm.alive);
      const teamMinHpRatio = isHealer
        ? aliveAllies.reduce((min, mm) => Math.min(min, mm.stats.hp / mm.stats.maxHp), 1)
        : undefined;
      const mSkill = monsterChooseSkill(
        m.skillState, m.stats.hp, m.stats.maxHp, m.template.role === 'boss',
        { activeBuffTypes: m.buffs.map(b => b.type), teamMinHpRatio, isHealer },
      );

      if (mSkill && mSkill.multiplier === 0) {
        // healer 的 heal/buff 自动作用全场存活怪物（isAoe 标记），普通怪只对自己
        const targets = (isHealer && mSkill.isAoe) ? aliveAllies : [m];

        if (mSkill.healPercent) {
          // 群体回血：跳过满血的（不浪费）；若全队满血，CD 退回 1 回合
          const needHeal = targets.filter(t => t.stats.hp < t.stats.maxHp);
          if (needHeal.length === 0 && isHealer && mSkill.isAoe) {
            const idx = m.skillState.skills.findIndex(s => s === mSkill);
            if (idx >= 0) m.skillState.cds[idx] = 1;
          } else {
            const healTargets = needHeal.length > 0 ? needHeal : targets;
            let totalHealed = 0;
            for (const t of healTargets) {
              const before = t.stats.hp;
              const heal = Math.floor(t.stats.maxHp * mSkill.healPercent);
              t.stats.hp = Math.min(t.stats.maxHp, t.stats.hp + heal);
              totalHealed += t.stats.hp - before;
            }
            const scopeText = (isHealer && mSkill.isAoe)
              ? `全队回复 ${totalHealed} 点气血（${healTargets.length} 个目标）`
              : `回复 ${totalHealed} 点气血`;
            logs.push({
              turn,
              text: `[第${turn}回合] ${m.stats.name}施展了【${mSkill.name}】，${scopeText}！`,
              type: 'buff',
              ...snap(),
            });
          }
        }
        if (mSkill.buff) {
          for (const t of targets) {
            const existBuff = t.buffs.find(b => b.type === mSkill.buff!.type);
            if (existBuff) { existBuff.remaining = mSkill.buff.duration; existBuff.value = mSkill.buff.value; }
            else t.buffs.push({ type: mSkill.buff.type as BuffType, remaining: mSkill.buff.duration, value: mSkill.buff.value });
            if (mSkill.name === '狂暴') t.skillState.berserkTriggered = true;
          }
          if (!mSkill.healPercent) {
            const scopeText = (isHealer && mSkill.isAoe) ? '全队获得' : '获得';
            logs.push({
              turn,
              text: `[第${turn}回合] ${m.stats.name}施展了【${mSkill.name}】！${scopeText}增益`,
              type: 'normal',
              ...snap(),
            });
          }
        }
        continue;
      }

      const skillMul = mSkill ? mSkill.multiplier : 1.0;
      const skillElem = mSkill ? mSkill.element : null;
      const skillName = mSkill ? mSkill.name : '普通攻击';
      const hits = mSkill?.hitCount || 1;

      const pe = equippedSkills?.passiveEffects;
      // 受伤处理函数（应用玩家脆弱/减伤/附灵减伤，返回扣血后的实际伤害；反伤/触发型留给调用方后置）
      const applyPlayerHit = (rawDmg: number, isCrit: boolean = false) => {
        let dmg = rawDmg;
        const brittle = getBrittleBonus(player);
        if (brittle > 0) dmg = Math.floor(dmg * (1 + brittle));
        if (pe?.damageReductionFlat) dmg = Math.floor(dmg * (1 - pe.damageReductionFlat));
        // v1.2 附灵：受伤减免 + 暴击额外减免 + 不屈（低血 DEF 叠加→近似减伤）
        dmg = applyAwakenIncomingReduction(dmg, isCrit);
        // 玩家 buff：金钟罩等（immune = 伤害减半）
        if (hasPlayerBuff('immune')) dmg = Math.max(1, Math.floor(dmg * 0.5));
        // 玩家 buff：护盾先行吸收（厚土盾等）
        const buffs = player.buffs as ActiveBuff[] | undefined;
        if (buffs && dmg > 0) {
          const shield = buffs.find(b => b.type === 'shield' && (b.shieldHp || 0) > 0);
          if (shield && shield.shieldHp && shield.shieldHp > 0) {
            const absorbed = Math.min(dmg, shield.shieldHp);
            shield.shieldHp -= absorbed;
            dmg -= absorbed;
            if (absorbed > 0) {
              logs.push({ turn, text: `  【护盾】吸收 ${absorbed} 点伤害`, type: 'buff', ...snap() });
            }
            if (shield.shieldHp <= 0) {
              buffs.splice(buffs.indexOf(shield), 1);
              logs.push({ turn, text: `  【护盾】破碎`, type: 'buff', ...snap() });
            }
          }
        }
        player.hp -= dmg;
        if (dmg > 0) battleStats.playerHitsTaken++;
        return dmg;
      };
      // 后置反伤/触发（在伤害日志之后展示）
      const triggerRetaliate = (dmg: number, isCrit: boolean, sourceMonster: typeof m) => {
        if (pe?.reflectPercent && pe.reflectPercent > 0) {
          const rf = Math.floor(dmg * pe.reflectPercent);
          if (rf > 0) {
            sourceMonster.stats.hp -= rf;
            logs.push({ turn, text: `  【反伤】反弹 ${rf} 点伤害给${sourceMonster.stats.name}`, type: 'normal', ...snap() });
          }
        }
        // 玩家 buff：明镜止水（reflect）按 dmg 百分比反弹, 单次反弹 cap = 玩家 ATK × 4
        // 附加底量: 玩家 maxHP × 5% 独立叠加 (不受 cap), 给反弹一个体面下限, 不受小怪低伤害挤压
        // v3.5: 8% → 5%, 与 reflect value 0.40 → 0.24 联动削弱
        const reflectSum = sumPlayerBuff('reflect');
        if (reflectSum > 0 && dmg > 0) {
          const reflectCap = Math.floor(player.atk * 4);
          const baseRf = Math.min(Math.floor(dmg * reflectSum), reflectCap);
          const hpBonus = Math.floor(player.maxHp * 0.05);
          const rf = baseRf + hpBonus;
          if (rf > 0) {
            sourceMonster.stats.hp -= rf;
            logs.push({ turn, text: `  【明镜反伤】反弹 ${rf} 点伤害给${sourceMonster.stats.name}`, type: 'normal', ...snap() });
          }
        }
        if (pe?.poisonOnHitTaken && Math.random() < pe.poisonOnHitTaken) {
          tryApplyDebuff(sourceMonster, sourceMonster.stats.name, { type: 'poison', chance: 1, duration: 2 }, player.atk, turn, 'player');
        }
        if (pe?.burnOnHitTaken && Math.random() < pe.burnOnHitTaken) {
          tryApplyDebuff(sourceMonster, sourceMonster.stats.name, { type: 'burn', chance: 1, duration: 2 }, player.atk, turn, 'player');
        }
        if (isCrit && pe?.reflectOnCrit && Math.random() < pe.reflectOnCrit) {
          const rfc = Math.floor(dmg * 0.5);
          sourceMonster.stats.hp -= rfc;
          logs.push({ turn, text: `  【暴击反弹】${sourceMonster.stats.name}受到 ${rfc} 点反震`, type: 'normal', ...snap() });
        }
      };

      if (hits > 1) {
        const perHitMul = skillMul / hits;
        logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}施展了【${skillName}】(${hits}段)!`, type: 'crit', ...snap() });
        for (let h = 0; h < hits; h++) {
          const mResult = calculateDamage(m.stats, player, perHitMul, skillElem);
          if (mResult.damage > 0) {
            const dmg = applyPlayerHit(mResult.damage, mResult.isCrit);
            const critText = mResult.isCrit ? '暴击!' : '';
            logs.push({ turn, text: `  第${h + 1}段 ${critText}造成 ${dmg} 点伤害`, type: mResult.isCrit ? 'crit' : 'normal', ...snap() });
            triggerRetaliate(dmg, mResult.isCrit, m);
          } else if ((player as any).critAfterDodge) {
            // v3 飘渺神行：多段攻击中闪避也触发标记
            (player as any).forceCritNext = true;
          }
          if (player.hp <= 0) break;
        }
      } else {
        const mResult = calculateDamage(m.stats, player, skillMul, skillElem);
        if (mResult.damage === 0) {
          logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}的攻击被你闪避了`, type: 'normal', ...snap() });
          // v3 飘渺神行：闪避后下次攻击必暴击
          if ((player as any).critAfterDodge) {
            (player as any).forceCritNext = true;
          }
        } else {
          const dmg = applyPlayerHit(mResult.damage, mResult.isCrit);
          const isSkillAttack = mSkill !== null;
          logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}${isSkillAttack ? '施展【' + skillName + '】，' : ''}攻击了你，造成 ${dmg} 点伤害`, type: mResult.isCrit ? 'crit' : 'normal', ...snap() });
          triggerRetaliate(dmg, mResult.isCrit, m);
        }
      }
      // 应用怪技能 debuff 到玩家
      if (mSkill?.debuff && player.hp > 0) {
        tryApplyDebuff(player, '你', mSkill.debuff as any, m.stats.atk, turn);
      }
      if (player.hp <= 0) break;
    }
    // 还原临时放大的 def（避免影响玩家自身攻击回合里对 def 的读取）
    player.def = origPlayerDef;
  }

  for (let turn = 1; turn <= maxTurns; turn++) {
    const aliveMonsters = monsters.filter(m => m.alive);
    if (aliveMonsters.length === 0) break;

    turnLifestealTotal = 0;

    // v1.2 附灵每回合开始：回春 + 洗髓
    runAwakenTurnStart(turn);
    // 玩家 buff 回合开始：结算 regen（灵泉术/生生不息/天地归元）
    runPlayerBuffTurnStart(turn);

    // 结算玩家 DOT
    const playerDot = tickDebuffs(player, '你', turn);
    if (playerDot > 0) {
      player.hp -= playerDot;
      if (player.hp <= 0) {
        if (reviveAvailable) {
          reviveAvailable = false;
          player.hp = Math.floor(player.maxHp * 0.20);
          logs.push({ turn, text: `[第${turn}回合] 【不灭金身】发动!`, type: 'buff', ...snap() });
        } else {
          logs.push({ turn, text: '你在持续伤害中陨落了…3回合后原地复活', type: 'death', playerHp: 0, playerMaxHp: player.maxHp, monsterHp: 0, monsterMaxHp: 0 });
          return { won: false, logs, totalExp, totalStone, monstersKilled, stats: battleStats };
        }
      }
    }
    // 结算怪物 DOT
    for (const m of aliveMonsters) {
      const dot = tickDebuffs(m, m.stats.name, turn);
      if (dot > 0) m.stats.hp -= dot;
    }
    // 击杀检查（DOT 致死）
    for (const m of monsters) {
      if (m.alive && m.stats.hp <= 0) {
        m.alive = false;
        const exp = Math.floor(m.template.exp * randFloat(0.9, 1.1));
        const stone = rand(m.template.stone_min, m.template.stone_max);
        totalExp += exp;
        totalStone += stone;
        monstersKilled.push({ template: m.template });
        if (m.template.role === 'boss' && turn <= 3) battleStats.bossKilledByTurn3 = true;
        logs.push({ turn, text: `${m.stats.name}因持续伤害死亡，获得 ${exp} 修为、${stone} 灵石`, type: 'kill', ...snap() });
      }
    }

    // 被动回血（v3 春风化雨：healAmpPct 增幅）
    if (equippedSkills?.passiveEffects?.regenPerTurn && equippedSkills.passiveEffects.regenPerTurn > 0) {
      const healAmp = 1 + ((player as any).healAmpPct || 0) / 100;
      const heal = Math.floor(player.maxHp * equippedSkills.passiveEffects.regenPerTurn * healAmp);
      if (heal > 0 && player.hp < player.maxHp) {
        const actualHeal = Math.min(heal, player.maxHp - player.hp);
        player.hp += actualHeal;
        logs.push({ turn, text: `  【被动回血】回复 ${actualHeal} 点气血`, type: 'buff', ...snap() });
      }
    }

    // 玩家被控制检查
    if (player.frozenTurns > 0) {
      player.frozenTurns--;
      logs.push({ turn, text: `[第${turn}回合] 你被控制中,无法行动`, type: 'normal', ...snap() });
      executeMonsterAttacks(turn);
      if (player.hp <= 0) {
        if (reviveAvailable) {
          reviveAvailable = false;
          player.hp = Math.floor(player.maxHp * 0.20);
          logs.push({ turn, text: `[第${turn}回合] 【不灭金身】发动!`, type: 'buff', ...snap() });
        } else {
          logs.push({ turn, text: '你的气血耗尽，陨落了…3回合后原地复活', type: 'death', playerHp: 0, playerMaxHp: player.maxHp, monsterHp: 0, monsterMaxHp: 0 });
          return { won: false, logs, totalExp, totalStone, monstersKilled, stats: battleStats };
        }
      }
      continue;
    }

    // 先后手判定: 比较玩家身法和怪物【最慢身法】；减速必定后攻
    // 改为对比最慢怪：避免高速 dps 怪混在队伍里把平均拉爆，让玩家明显感知到自己堆的身法
    const minMonsterSpd = Math.min(...aliveMonsters.map(m => m.stats.spd));
    const spdUpSum = sumPlayerBuff('spd_up');
    const effPlayerSpd = spdUpSum > 0 ? player.spd * (1 + spdUpSum) : player.spd;
    let playerFirst = effPlayerSpd >= minMonsterSpd;
    if (hasSlow(player)) playerFirst = false;

    // 选目标(血量最低)
    const target = aliveMonsters.reduce((a, b) => a.stats.hp < b.stats.hp ? a : b);

    // === 后手方先执行(如果怪物先手,先执行怪物攻击) ===
    if (!playerFirst) {
      executeMonsterAttacks(turn);
      if (player.hp <= 0) {
        if (reviveAvailable) {
          reviveAvailable = false;
          player.hp = Math.floor(player.maxHp * 0.20);
          logs.push({ turn, text: `[第${turn}回合] 【不灭金身】发动!`, type: 'buff', ...snap() });
        } else {
          logs.push({ turn, text: '你的气血耗尽，陨落了…3回合后原地复活', type: 'death', playerHp: 0, playerMaxHp: player.maxHp, monsterHp: 0, monsterMaxHp: 0 });
          return { won: false, logs, totalExp, totalStone, monstersKilled, stats: battleStats };
        }
      }
    }

    // 玩家攻击（silence 禁用神通）
    let usedSkill: SkillRefInfo = activeSkill;
    let isDivine = false;
    const silenced = hasSilence(player);
    if (silenced) {
      logs.push({ turn, text: `  你被封印,无法使用神通`, type: 'normal', ...snap() });
    }
    const divines = silenced ? [] : (equippedSkills?.divineSkills || []);
    for (let i = 0; i < divines.length; i++) {
      if (divineCds[i] <= 0) {
        usedSkill = divines[i];
        divineCds[i] = Math.max(1, (divines[i].cdTurns || 5) - cdReduction);
        isDivine = true;
        break;
      }
    }
    for (let i = 0; i < divineCds.length; i++) { if (divineCds[i] > 0) divineCds[i]--; }

    // v1.3 灵戒附灵·主修判定：仅 active skill (主修) 触发 mainSkill* 钩子
    const isMainSkill = (usedSkill === activeSkill);
    // 设置当前主修元素到 player 上，供 tryApplyDebuff 检查（仅主修攻击期间有效）
    (player as any)._mainSkillElement = isMainSkill ? activeSkill.element : null;

    let mul = usedSkill.multiplier;
    let rootMatched = false;
    if (usedSkill.element && player.spiritualRoot && usedSkill.element === player.spiritualRoot) {
      mul *= 1.2;
      rootMatched = true;
    }
    // 神识加成神通伤害: 每点神识+0.1% (2026-04-25: 0.5%→0.1% — 神识 216 时旧 +108% 神通伤害过强)
    if (isDivine && player.spirit && player.spirit > 0) {
      mul *= 1 + player.spirit * 0.001;
    }
    // v1.3 心法贯通：主修伤害倍率 +X%
    if (isMainSkill && player.awakenState?.mainSkillMultBonus) {
      mul *= 1 + player.awakenState.mainSkillMultBonus;
    }
    // 玩家 buff：atk_up 通过 mul 放大（与 def_up 临时放大 def 对称，避免战意沸腾累积冲突）
    const atkUpSum = sumPlayerBuff('atk_up');
    if (atkUpSum > 0) mul *= (1 + atkUpSum);
    // 玩家 buff：crit_up 临时加到暴击率（回合末还原）
    const critUpSum = sumPlayerBuff('crit_up');
    const origPlayerCritRate = player.crit_rate;
    if (critUpSum > 0) player.crit_rate = Math.min(0.95, origPlayerCritRate + critUpSum);

    // buff/治疗技能(multiplier=0)
    if (mul === 0) {
      const prefix = isDivine ? '神通发动！' : '';
      if (usedSkill.healAtkRatio) {
        // v3 春风化雨：healAmpPct 增幅神通治疗
        const healAmp = 1 + ((player as any).healAmpPct || 0) / 100;
        const heal = Math.floor(player.atk * usedSkill.healAtkRatio * healAmp);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        logs.push({ turn, text: `[第${turn}回合] ${prefix}【${usedSkill.name}】回复 ${heal} 点气血`, type: 'buff', ...snap() });
      }
      if (usedSkill.buff) {
        // 若已通过 healAtkRatio 写过本次"神通发动"标题, buff 只追加效果行, 避免重复
        if (!usedSkill.healAtkRatio) {
          logs.push({ turn, text: `[第${turn}回合] ${prefix}【${usedSkill.name}】`, type: 'buff', ...snap() });
        }
        applyPlayerBuff(usedSkill.buff as any, usedSkill.name, turn);
      }
      // AOE debuff (如时光凝滞)
      if (usedSkill.debuff && (usedSkill.isAoe || (usedSkill.targetCount && usedSkill.targetCount > 1))) {
        const debuffTargets = usedSkill.isAoe ? aliveMonsters : aliveMonsters.slice(0, usedSkill.targetCount || 1);
        for (const m of debuffTargets) {
          tryApplyDebuff(m, m.stats.name, usedSkill.debuff as any, player.atk, turn, 'player');
        }
      }
      // v1.3 清理主修元素标记
      (player as any)._mainSkillElement = null;
    } else {
      // 攻击技能
      let attackTargets: typeof aliveMonsters;
      if (usedSkill.isAoe) {
        attackTargets = [...aliveMonsters];
      } else if (usedSkill.targetCount && usedSkill.targetCount > 1) {
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
        logs.push({ turn, text: `[第${turn}回合] ${prefix}【${usedSkill.name}】(${skillLabel})`, type: isDivine ? 'crit' : 'normal', ...snap() });
      }

      // v1.3 主修噬灵：主修命中即触发（与暴击无关），按最大气血百分比回复
      const mainSkillLifestealRate = (isMainSkill && player.awakenState?.mainSkillLifesteal) ? player.awakenState.mainSkillLifesteal : 0;
      // v1.3 心剑回响：主修暴击时所有神通 CD-1（每回合至多 1 次）
      let critCdCutUsedThisTurn = false;

      // 对怪物造成伤害（应用脆弱、吸血汇总）
      const dealDamage = (target: typeof monsters[0], rawDmg: number) => {
        let dmg = rawDmg;
        const brittle = getBrittleBonus(target);
        if (brittle > 0) dmg = Math.floor(dmg * (1 + brittle));
        target.stats.hp -= dmg;
        if (player.lifesteal > 0) {
          const heal = Math.floor(dmg * player.lifesteal);
          const actualHeal = Math.min(heal, player.maxHp - player.hp);
          if (actualHeal > 0) {
            const before = player.hp;
            player.hp += actualHeal;
            turnLifestealTotal += actualHeal;
            if (before < player.maxHp && player.hp >= player.maxHp) {
              battleStats.lifestealFullRecovery = true;
            }
          }
        }
        // v1.3 主修噬灵：按最大气血百分比回血
        if (mainSkillLifestealRate > 0 && dmg > 0) {
          const heal = Math.floor(player.maxHp * mainSkillLifestealRate);
          const actualHeal = Math.min(heal, player.maxHp - player.hp);
          if (actualHeal > 0) {
            player.hp += actualHeal;
            turnLifestealTotal += actualHeal;
          }
        }
        return dmg;
      };
      // v1.3 心剑回响：当主修暴击时调用
      const tryCritCdCut = (isCrit: boolean) => {
        if (!isCrit || !isMainSkill || critCdCutUsedThisTurn) return;
        if (!player.awakenState?.mainSkillCritCdCut) return;
        let cut = false;
        for (let i = 0; i < divineCds.length; i++) {
          if (divineCds[i] > 0) { divineCds[i] = Math.max(0, divineCds[i] - 1); cut = true; }
        }
        if (cut) {
          critCdCutUsedThisTurn = true;
          logs.push({ turn, text: '  ✦【心剑回响】主修暴击，所有神通 CD -1', type: 'buff', ...snap() });
        }
      };

      if (hits > 1 && attackTargets.length === 1) {
        // 多段单体(溢出到下一只)
        let hitsDone = 0;
        while (hitsDone < hits) {
          const curTarget = monsters.find(m => m.alive && m.stats.hp > 0);
          if (!curTarget) break;
          const dmgResult = calculateDamage(player, curTarget.stats, perHitMul, usedSkill.element, usedSkill.ignoreDef, false, isMainSkill);
          if (dmgResult.damage > 0) {
            const finalDmg = dealDamage(curTarget, dmgResult.damage);
            const critText = dmgResult.isCrit ? '暴击!' : '';
            if (dmgResult.isCrit) battleStats.playerCritCount++;
            tryCritCdCut(dmgResult.isCrit);
            if (getElementMultiplier(usedSkill.element || player.element, curTarget.stats.element) > 1.0) {
              battleStats.elementAdvantageHit = true;
            }
            logs.push({ turn, text: `  第${hitsDone + 1}段 ${critText}对${curTarget.stats.name}造成 ${finalDmg} 伤害`, type: dmgResult.isCrit ? 'crit' : 'normal', ...snap() });
            if (usedSkill.debuff) tryApplyDebuff(curTarget, curTarget.stats.name, usedSkill.debuff as any, player.atk, turn, 'player');
            // v1.2 附灵：命中触发 DOT
            triggerAwakenOnHit(curTarget, curTarget.stats.name, turn);
          } else {
            logs.push({ turn, text: `  第${hitsDone + 1}段 被${curTarget.stats.name}闪避`, type: 'normal', ...snap() });
          }
          hitsDone++;
        }
      } else {
        // AOE/多目标/普通单体
        for (const t of attackTargets) {
          if (t.stats.hp <= 0) continue;
          const dmgResult = calculateDamage(player, t.stats, mul, usedSkill.element, usedSkill.ignoreDef, false, isMainSkill);
          if (dmgResult.damage > 0) {
            const finalDmg = dealDamage(t, dmgResult.damage);
            const critText = dmgResult.isCrit ? '暴击!' : '';
            if (dmgResult.isCrit) battleStats.playerCritCount++;
            tryCritCdCut(dmgResult.isCrit);
            if (getElementMultiplier(usedSkill.element || player.element, t.stats.element) > 1.0) {
              battleStats.elementAdvantageHit = true;
            }
            if (!skillLabel) {
              logs.push({ turn, text: `[第${turn}回合] ${prefix}${critText}【${usedSkill.name}】对${t.stats.name}造成 ${finalDmg} 伤害`, type: dmgResult.isCrit ? 'crit' : 'normal', ...snap() });
            } else {
              logs.push({ turn, text: `  ${critText}对${t.stats.name}造成 ${finalDmg} 伤害`, type: dmgResult.isCrit ? 'crit' : 'normal', ...snap() });
            }
            if (usedSkill.debuff) tryApplyDebuff(t, t.stats.name, usedSkill.debuff as any, player.atk, turn, 'player');
            // v1.2 附灵：命中触发 DOT
            triggerAwakenOnHit(t, t.stats.name, turn);
          } else {
            // 闪避日志：避免多目标技能里被闪避的目标"凭空消失"，让玩家以为多目标没生效
            if (skillLabel) {
              logs.push({ turn, text: `  ${t.stats.name} 闪避了你的攻击`, type: 'normal', ...snap() });
            } else {
              logs.push({ turn, text: `[第${turn}回合] ${prefix}【${usedSkill.name}】被${t.stats.name}闪避`, type: 'normal', ...snap() });
            }
          }
        }

        // 技能自带自增益（如 地裂天崩 def_up / 时光凝滞 atk_up）
        if (usedSkill.buff) {
          applyPlayerBuff(usedSkill.buff as any, usedSkill.name, turn);
        }

        // v1.2 附灵：连击（仅普攻=主修） + v1.3 灵戒紫电连华：与 chainAttackChance 取最大（防双发爆发）
        const awakenState = player.awakenState;
        const baseChain = awakenState?.chainAttackChance || 0;
        const ringChain = (isMainSkill && awakenState?.mainSkillChainChance) ? awakenState.mainSkillChainChance : 0;
        const chainChance = Math.max(baseChain, ringChain);
        if (chainChance > 0 && usedSkill === activeSkill && attackTargets.length > 0) {
          if (Math.random() < chainChance) {
            const chainTarget = monsters.find(m => m.alive && m.stats.hp > 0);
            if (chainTarget) {
              const dmgResult = calculateDamage(player, chainTarget.stats, mul * 0.6, usedSkill.element, usedSkill.ignoreDef, false, false);
              if (dmgResult.damage > 0) {
                const finalDmg = dealDamage(chainTarget, dmgResult.damage);
                const chainTag = ringChain > baseChain ? '紫电连华' : '连击';
                logs.push({ turn, text: `  ✦【${chainTag}】再次出手，对${chainTarget.stats.name}造成 ${finalDmg} 伤害`, type: 'buff', ...snap() });
              }
            }
          }
        }
      }
      // v1.3 攻击结束后清掉主修元素标记，防止后续怪物攻击或下一回合误命中
      (player as any)._mainSkillElement = null;

      // 吸血汇总日志
      if (turnLifestealTotal > 0) {
        logs.push({ turn, text: `  【吸血】回复 ${turnLifestealTotal} 点气血`, type: 'buff', ...snap() });
      }

      // 检查击杀
      for (const m of monsters) {
        if (m.alive && m.stats.hp <= 0) {
          m.alive = false;
          const exp = Math.floor(m.template.exp * randFloat(0.9, 1.1));
          const stone = rand(m.template.stone_min, m.template.stone_max);
          totalExp += exp;
          totalStone += stone;
          monstersKilled.push({ template: m.template });
          if (m.template.role === 'boss' && turn <= 3) battleStats.bossKilledByTurn3 = true;
          logs.push({ turn, text: `你击杀了${m.stats.name}，获得 ${exp} 修为、${stone} 灵石`, type: 'kill', ...snap() });
          // 战意沸腾: 击杀叠攻
          if (atkPerKillPercent > 0 && killStacks < maxKillStacks) {
            killStacks++;
            player.atk = Math.floor(player.atk * (1 + atkPerKillPercent / 100));
            logs.push({ turn, text: `[战意沸腾] 击杀叠层 ${killStacks}/${maxKillStacks}，攻击提升!`, type: 'buff', ...snap() });
          }
        }
      }
      const remaining = monsters.filter(mm => mm.alive).length;
      if (remaining > 0 && remaining < aliveMonsters.length) {
        logs.push({ turn, text: `还剩 ${remaining} 只怪物!`, type: 'system', ...snap() });
      }
    }

    // 玩家攻击段结束：还原临时覆盖的 crit_rate（atk_up 走 mul 不需还原）
    player.crit_rate = origPlayerCritRate;

    // === 先手方已攻击完,现在后手方攻击 ===
    if (playerFirst) {
      executeMonsterAttacks(turn);
    }

    // 玩家死亡检查(先手是玩家时,怪物后攻可能打死玩家)
    if (player.hp <= 0) {
      if (reviveAvailable) {
        reviveAvailable = false;
        player.hp = Math.floor(player.maxHp * 0.20);
        logs.push({ turn, text: `[第${turn}回合] 【不灭金身】发动!`, type: 'buff', ...snap() });
      } else {
        logs.push({ turn, text: '你的气血耗尽，陨落了…3回合后原地复活', type: 'death', playerHp: 0, playerMaxHp: player.maxHp, monsterHp: 0, monsterMaxHp: 0 });
        return { won: false, logs, totalExp, totalStone, monstersKilled, stats: battleStats };
      }
    }

    // 回合末：衰减玩家 buff 时长
    tickPlayerBuffs(turn);

    if (monsters.filter(m => m.alive).length === 0) break;
  }

  const allDead = monsters.filter(m => m.alive).length === 0;
  if (!allDead) {
    logs.push({ turn: maxTurns, text: '战斗超时，你选择撤退', type: 'system', ...snap() });
  }
  return { won: allDead, logs, totalExp, totalStone, monstersKilled, stats: battleStats };
}
