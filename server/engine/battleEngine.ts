// 后端完整战斗引擎 - 从前端 battleEngine.ts 移植
import { Skill, SKILL_MAP, type DebuffType, type BuffType, type SkillDebuff, type SkillBuff, type PassiveEffect } from './skillData';

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
}

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
  spirit?: number; // 神识: 每点+0.5%神通伤害
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
  if (ELEMENT_ADVANTAGE[atk] === def) return 1.3;
  if (ELEMENT_ADVANTAGE[def] === atk) return 0.7;
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
  buff?: { type: 'atk_up' | 'def_up'; value: number; duration: number };
  hitCount?: number;
  healPercent?: number;
  isHeal?: boolean;
  description: string;
}

export interface MonsterSkillState {
  skills: MonsterSkillDef[];
  cds: number[];
  berserkTriggered: boolean;
  bossEnrageTriggered: boolean;
}

export function buildMonsterSkillPool(template: MonsterTemplate): MonsterSkillDef[] {
  const tier = parseInt(template.drop_table.replace(/\D/g, '')) || 1;
  const elem = template.element;
  const isBoss = template.role === 'boss';
  const role = template.role;
  const skills: MonsterSkillDef[] = [];

  // T1+: 基础属性攻击
  if (elem) {
    const elemSkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '喷火', multiplier: 1.5, cdTurns: 3, element: 'fire', debuff: { type: 'burn', chance: 0.15, duration: 2 }, description: '喷出火焰' },
      water: { name: '水箭术', multiplier: 1.4, cdTurns: 3, element: 'water', debuff: { type: 'slow', chance: 0.20, duration: 2 }, description: '射出水箭' },
      wood:  { name: '毒液喷射', multiplier: 1.3, cdTurns: 3, element: 'wood', debuff: { type: 'poison', chance: 0.25, duration: 2 }, description: '喷射毒液' },
      metal: { name: '利爪', multiplier: 1.5, cdTurns: 3, element: 'metal', debuff: { type: 'bleed', chance: 0.15, duration: 2 }, description: '锋利爪击' },
      earth: { name: '飞石术', multiplier: 1.4, cdTurns: 3, element: 'earth', debuff: { type: 'brittle', chance: 0.15, duration: 2, value: 0.15 }, description: '投掷巨石' },
    };
    if (elemSkills[elem]) skills.push(elemSkills[elem]);
  }

  if (tier >= 2) {
    skills.push({ name: '蛮力撞击', multiplier: 1.6, cdTurns: 5, element: null, debuff: { type: 'stun', chance: 0.20, duration: 1 }, description: '猛烈撞击' });
  }
  if (tier >= 2 && role === 'dps') {
    skills.push({ name: '连续撕咬', multiplier: 2.0, cdTurns: 4, element: null, hitCount: 3, description: '连续撕咬3段' });
  }
  if (tier >= 2 && role === 'speed') {
    skills.push({ name: '疾风连击', multiplier: 1.8, cdTurns: 3, element: null, hitCount: 4, description: '疾风连击4段' });
  }
  if (tier >= 2 && (role === 'tank' || role === 'boss')) {
    skills.push({ name: '吞噬灵气', multiplier: 0, cdTurns: 6, element: null, healPercent: 0.10, isHeal: true, description: '回复10%气血' });
  }

  // T3+
  if (tier >= 3 && elem) {
    const strongSkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '烈焰吐息', multiplier: 2.2, cdTurns: 5, element: 'fire', debuff: { type: 'burn', chance: 0.30, duration: 3 }, description: '高温火息' },
      water: { name: '寒冰刺', multiplier: 2.0, cdTurns: 5, element: 'water', debuff: { type: 'freeze', chance: 0.20, duration: 1 }, description: '冰锥攻击' },
      wood:  { name: '缠绕荆棘', multiplier: 1.8, cdTurns: 5, element: 'wood', debuff: { type: 'root', chance: 0.30, duration: 2 }, description: '荆棘缠绕' },
      metal: { name: '破甲斩', multiplier: 2.2, cdTurns: 5, element: 'metal', debuff: { type: 'brittle', chance: 0.25, duration: 3, value: 0.20 }, description: '重斩破甲' },
      earth: { name: '震地击', multiplier: 2.0, cdTurns: 5, element: 'earth', debuff: { type: 'stun', chance: 0.15, duration: 1 }, description: '震地攻击' },
    };
    if (strongSkills[elem]) skills.push(strongSkills[elem]);
  }
  if (tier >= 3) {
    skills.push({ name: '妖气封印', multiplier: 1.0, cdTurns: 7, element: null, debuff: { type: 'silence', chance: 0.30, duration: 2 }, description: '封印神通' });
  }
  if (tier >= 3 && !['dps', 'speed'].includes(role)) {
    skills.push({ name: '乱爪', multiplier: 2.4, cdTurns: 5, element: null, hitCount: 3, description: '疯狂乱抓3段' });
  }

  // T4+
  if (tier >= 4) {
    skills.push({ name: '妖力恢复', multiplier: 0, cdTurns: 8, element: null, healPercent: 0.15, isHeal: true, description: '回复15%气血' });
    skills.push({ name: '咆哮震慑', multiplier: 1.8, cdTurns: 6, element: null, debuff: { type: 'stun', chance: 0.30, duration: 1 }, description: '威压咆哮' });
  }
  if (tier >= 4 && elem) {
    const multiHitSkills: Record<string, MonsterSkillDef> = {
      fire:  { name: '连环火弹', multiplier: 2.8, cdTurns: 6, element: 'fire', hitCount: 4, debuff: { type: 'burn', chance: 0.15, duration: 2 }, description: '4枚火弹' },
      water: { name: '冰晶乱射', multiplier: 2.4, cdTurns: 6, element: 'water', hitCount: 3, debuff: { type: 'freeze', chance: 0.12, duration: 1 }, description: '冰晶3段' },
      wood:  { name: '荆棘连刺', multiplier: 2.4, cdTurns: 6, element: 'wood', hitCount: 4, debuff: { type: 'poison', chance: 0.15, duration: 2 }, description: '荆棘4段' },
      metal: { name: '暴风利刃', multiplier: 3.0, cdTurns: 6, element: 'metal', hitCount: 5, debuff: { type: 'bleed', chance: 0.12, duration: 2 }, description: '利刃5段' },
      earth: { name: '碎石连击', multiplier: 2.6, cdTurns: 6, element: 'earth', hitCount: 3, debuff: { type: 'stun', chance: 0.10, duration: 1 }, description: '碎石3段' },
    };
    if (multiHitSkills[elem]) skills.push(multiHitSkills[elem]);
  }

  // T5+
  if (tier >= 5) {
    skills.push({ name: '狂暴', multiplier: 0, cdTurns: 10, element: null, buff: { type: 'atk_up', value: 0.40, duration: 4 }, description: '攻击+40%' });
    skills.push({ name: '锁魂术', multiplier: 1.5, cdTurns: 7, element: null, debuff: { type: 'root', chance: 0.40, duration: 2 }, description: '束缚2回合' });
    skills.push({ name: '雷霆万钧', multiplier: 3.0, cdTurns: 7, element: 'metal', hitCount: 3, debuff: { type: 'stun', chance: 0.20, duration: 1 }, description: '雷霆3段' });
  }

  // T6+
  if (tier >= 6 && elem) {
    const t6Skills: Record<string, MonsterSkillDef> = {
      fire:  { name: '焚天', multiplier: 3.0, cdTurns: 8, element: 'fire', debuff: { type: 'burn', chance: 0.50, duration: 3 }, description: '天火焚世' },
      water: { name: '极寒领域', multiplier: 2.5, cdTurns: 8, element: 'water', debuff: { type: 'freeze', chance: 0.35, duration: 2 }, description: '极寒冰封' },
      wood:  { name: '万毒噬心', multiplier: 2.5, cdTurns: 8, element: 'wood', debuff: { type: 'poison', chance: 0.50, duration: 4 }, description: '剧毒入体' },
      metal: { name: '斩魂', multiplier: 3.5, cdTurns: 8, element: 'metal', debuff: { type: 'bleed', chance: 0.40, duration: 3 }, description: '斩魂一击' },
      earth: { name: '山崩地裂', multiplier: 2.8, cdTurns: 8, element: 'earth', debuff: { type: 'stun', chance: 0.25, duration: 2 }, description: '山崩天降' },
    };
    if (t6Skills[elem]) skills.push(t6Skills[elem]);
  }
  if (tier >= 6) {
    skills.push({ name: '涅槃重生', multiplier: 0, cdTurns: 12, element: null, healPercent: 0.25, isHeal: true, buff: { type: 'def_up', value: 0.20, duration: 3 }, description: '回复25%气血+防御' });
    skills.push({ name: '千刃绞杀', multiplier: 4.0, cdTurns: 9, element: null, hitCount: 5, debuff: { type: 'bleed', chance: 0.20, duration: 3 }, description: '5段绞杀' });
  }

  // T7+
  if (tier >= 7) {
    skills.push({ name: '天雷制裁', multiplier: 3.5, cdTurns: 8, element: 'metal', debuff: { type: 'stun', chance: 0.40, duration: 2 }, description: '天雷眩晕' });
    skills.push({ name: '灭世连击', multiplier: 5.0, cdTurns: 10, element: null, hitCount: 6, debuff: { type: 'stun', chance: 0.10, duration: 1 }, description: '6段灭世' });
    skills.push({ name: '天地造化', multiplier: 0, cdTurns: 15, element: null, healPercent: 0.35, isHeal: true, description: '回复35%气血' });
  }

  // T8+
  if (tier >= 8) {
    skills.push({ name: '混沌吞噬', multiplier: 6.0, cdTurns: 10, element: null, hitCount: 4, debuff: { type: 'stun', chance: 0.25, duration: 2 }, description: '混沌4段' });
    skills.push({ name: '太古沉眠', multiplier: 0, cdTurns: 15, element: null, healPercent: 0.40, isHeal: true, buff: { type: 'def_up', value: 0.40, duration: 4 }, description: '回复40%+防御' });
  }

  // Boss
  if (isBoss) {
    skills.push({ name: '首领之吼', multiplier: 1.2, cdTurns: 6, element: null, debuff: { type: 'atk_down', chance: 0.40, duration: 3, value: 0.15 }, description: '降攻15%' });
    if (tier >= 2) skills.push({ name: '首领恢复', multiplier: 0, cdTurns: 8, element: null, healPercent: 0.12, isHeal: true, description: '回复12%' });
    if (tier >= 3) skills.push({ name: '威压震慑', multiplier: 2.0, cdTurns: 7, element: null, debuff: { type: 'stun', chance: 0.35, duration: 1 }, description: '眩晕1回合' });
    if (tier >= 4) skills.push({ name: '凶煞之气', multiplier: 0, cdTurns: 8, element: null, buff: { type: 'def_up', value: 0.30, duration: 4 }, description: '防御+30%' });
    if (tier >= 5) skills.push({ name: '首领乱舞', multiplier: 3.5, cdTurns: 7, element: null, hitCount: 4, debuff: { type: 'bleed', chance: 0.25, duration: 3 }, description: '4段连击' });
    if (tier >= 6) skills.push({ name: '灭世怒吼', multiplier: 2.5, cdTurns: 9, element: null, debuff: { type: 'stun', chance: 0.45, duration: 2 }, description: '眩晕2回合' });
    if (tier >= 7) skills.push({ name: '首领灭杀', multiplier: 5.5, cdTurns: 10, element: null, hitCount: 5, debuff: { type: 'stun', chance: 0.15, duration: 1 }, description: '5段灭杀' });
  }

  return skills;
}

// 导出: 获取怪物技能描述列表(供battle路由返回给前端)
export function buildMonsterSkillDescriptions(template: MonsterTemplate): string[] {
  const skills = buildMonsterSkillPool(template);
  return skills.map(s => `${s.name}: ${s.description}`);
}

export function initMonsterSkillState(template: MonsterTemplate): MonsterSkillState {
  const skills = buildMonsterSkillPool(template);
  return { skills, cds: skills.map(() => 0), berserkTriggered: false, bossEnrageTriggered: false };
}

export function monsterChooseSkill(state: MonsterSkillState, monsterHp: number, monsterMaxHp: number, isBoss: boolean): MonsterSkillDef | null {
  const hpRatio = monsterHp / monsterMaxHp;
  if (hpRatio < 0.40) {
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
  let best: { skill: MonsterSkillDef; index: number } | null = null;
  for (let i = 0; i < state.skills.length; i++) {
    if (state.cds[i] <= 0) {
      const s = state.skills[i];
      if (s.isHeal) continue;
      if (!best || s.multiplier > best.skill.multiplier || (s.multiplier === best.skill.multiplier && s.cdTurns > best.skill.cdTurns)) {
        best = { skill: s, index: i };
      }
    }
  }
  if (best) { state.cds[best.index] = best.skill.cdTurns; return best.skill; }
  return null;
}

export function tickMonsterCds(state: MonsterSkillState) {
  for (let i = 0; i < state.cds.length; i++) { if (state.cds[i] > 0) state.cds[i]--; }
}

// ========== 怪物属性生成 ==========

export function generateMonsterStats(template: MonsterTemplate): BattlerStats {
  const power = template.power * randFloat(0.85, 1.15);
  // v2.0 方案 A: Boss role 保持原版平衡, 通过整体 power 压缩和装备品质提升让战斗更舒服
  const ratios: Record<string, { hp: number; atk: number; def: number; spd: number }> = {
    balanced: { hp: 0.30, atk: 0.30, def: 0.25, spd: 0.15 },
    tank:     { hp: 0.40, atk: 0.15, def: 0.35, spd: 0.10 },
    dps:      { hp: 0.20, atk: 0.45, def: 0.15, spd: 0.20 },
    speed:    { hp: 0.20, atk: 0.25, def: 0.15, spd: 0.40 },
    boss:     { hp: 0.35, atk: 0.30, def: 0.25, spd: 0.10 },
  };
  const r = ratios[template.role] || ratios.balanced;
  const HP_SCALE = 0.95;
  const ATK_SCALE = 0.90;
  const maxHp = Math.floor(power * r.hp * 10 * HP_SCALE);
  const tier = parseInt(template.drop_table.replace(/\D/g, '')) || 1;
  const role = template.role;

  const monsterResists = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0.10 };
  if (template.element && template.element in monsterResists) {
    (monsterResists as any)[template.element] = 0.40;
  }

  let critRate = 0.05 + tier * 0.01;
  let critDmg = 1.5 + tier * 0.05;
  if (role === 'dps') { critRate += 0.05; critDmg += 0.2; }
  if (role === 'boss') { critRate += 0.03; critDmg += 0.3; }

  let dodge = 0;
  if (role === 'speed') dodge = 0.05 + tier * 0.02;
  if (role === 'dps') dodge = tier * 0.01;
  if (role === 'boss') dodge = 0.02 + tier * 0.005;

  let lifesteal = 0;
  if (role === 'boss' && tier >= 3) lifesteal = 0.03 + tier * 0.005;
  if (role === 'dps' && tier >= 5) lifesteal = 0.02;

  let armorPen = 0;
  if (role === 'dps') armorPen = tier * 1.5;
  if (role === 'boss') armorPen = tier * 2;

  let accuracy = tier * 1;
  if (role === 'boss') accuracy = tier * 2;

  let ctrlResist = 0.10 + tier * 0.03;
  if (role === 'boss') ctrlResist = 0.20 + tier * 0.05;
  ctrlResist = Math.min(0.70, ctrlResist);
  monsterResists.ctrl = ctrlResist;

  return {
    name: template.name, maxHp, hp: maxHp,
    atk: Math.floor(power * r.atk * ATK_SCALE), def: Math.floor(power * r.def * 0.6),
    spd: Math.floor(power * r.spd * 0.5),
    crit_rate: Math.min(0.50, critRate), crit_dmg: Math.min(3.0, critDmg),
    dodge: Math.min(0.30, dodge), lifesteal: Math.min(0.15, lifesteal),
    element: template.element, resists: monsterResists,
    armorPen: Math.min(30, armorPen), accuracy: Math.min(25, accuracy),
  };
}

// ========== 伤害计算 ==========

export function calculateDamage(
  attacker: BattlerStats, defender: BattlerStats,
  skillMultiplier: number = 1.0, skillElement: string | null = null,
  ignoreDef: number = 0, ignoreDodge: boolean = false
): { damage: number; isCrit: boolean } {
  const useElement = skillElement || attacker.element;
  const elementMulti = getElementMultiplier(useElement, defender.element);

  let resistFactor = 1.0;
  if (useElement && defender.resists) {
    const r = (defender.resists as any)[useElement] || 0;
    resistFactor = 1.0 - Math.min(0.7, r);
  }

  // v1.2 附灵破甲叠加
  const awakenArmorPenPct = (attacker as any).awakenState?.armorPenPct || 0;
  const totalArmorPen = ignoreDef + (attacker.armorPen || 0) / 100 + awakenArmorPenPct;
  const effectiveDef = defender.def * Math.max(0, 1 - totalArmorPen);
  // 保持原版 DEF 权重 0.5 (v2.0 方案 A 验证过 0.7 会让后期玩家打不动 Boss)
  const atkDefRatio = attacker.atk / (attacker.atk + effectiveDef * 0.5);

  let elementDmgBonus = 1.0;
  if (useElement && attacker.elementDmg) {
    const ed = (attacker.elementDmg as any)[useElement] || 0;
    elementDmgBonus = 1 + ed / 100;
  }

  // v1.2 附灵条件型伤害加成
  const awakenState = (attacker as any).awakenState;
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
  }

  let damage = attacker.atk * skillMultiplier * elementMulti * resistFactor * atkDefRatio * elementDmgBonus * awakenDmgMul;

  const isCrit = Math.random() < attacker.crit_rate;
  if (isCrit) damage *= attacker.crit_dmg;

  if (!ignoreDodge) {
    const effectiveDodge = Math.max(0, defender.dodge - (attacker.accuracy || 0) / 100);
    if (Math.random() < effectiveDodge) return { damage: 0, isCrit: false };
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
  const player: any = { ...playerStats, hp: playerStats.maxHp, debuffs: [] as ActiveDebuff[], frozenTurns: 0 };
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
  ): boolean {
    if (Math.random() >= debuff.chance) return false;
    // 控制类抗性降低持续时间
    const isCtrl = ['freeze', 'stun', 'root', 'silence'].includes(debuff.type);
    let duration = debuff.duration;
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
      logs.push({ turn, text: `  ${targetName}被${DEBUFF_NAMES[debuff.type]} ${duration} 回合`, type: 'normal', ...snap() });
      return true;
    }
    // DOT/其他 debuff
    const targetMaxHp = target.stats?.maxHp || target.maxHp || 0;
    const dmg = calcDotDamage(debuff.type, targetMaxHp, attackerAtk);
    const exists = target.debuffs.find(d => d.type === debuff.type);
    if (exists) { exists.remaining = duration; exists.value = debuff.value; exists.damagePerTurn = dmg; }
    else target.debuffs.push({ type: debuff.type, remaining: duration, damagePerTurn: dmg, value: debuff.value });

    let text = `${targetName}陷入${DEBUFF_NAMES[debuff.type]} ${duration} 回合`;
    if (debuff.type === 'poison') text += ` (每回合 ${dmg} 毒伤)`;
    else if (debuff.type === 'burn') text += ` (每回合 ${dmg} 火伤)`;
    else if (debuff.type === 'bleed') text += ` (每回合 ${dmg} 流血)`;
    else if (debuff.type === 'brittle') text += ` (受伤+${((debuff.value || 0.15) * 100).toFixed(0)}%)`;
    else if (debuff.type === 'atk_down') text += ` (攻击-${((debuff.value || 0.15) * 100).toFixed(0)}%)`;
    else if (debuff.type === 'slow') text += ` (必定后攻)`;
    else if (debuff.type === 'silence') text += ` (无法使用神通)`;
    logs.push({ turn, text: `  ${text}`, type: 'normal', ...snap() });
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

  // 每回合累计玩家吸血汇总
  let turnLifestealTotal = 0;

  // v1.2 附灵工具：命中后 roll 主动触发 DOT（焚魂/淬毒/裂魂）
  function triggerAwakenOnHit(target: any, targetName: string, turn: number) {
    const st = player.awakenState;
    if (!st) return;
    const durBonus = st.debuffDurationBonus || 0;
    if (st.burnOnHitChance > 0 && Math.random() < st.burnOnHitChance) {
      const ok = tryApplyDebuff(target, targetName, { type: 'burn', chance: 1.0, duration: 2 + durBonus }, player.atk, turn);
      if (ok) logs.push({ turn, text: `  ✦【焚魂】${targetName}被烈焰灼烧`, type: 'buff', ...snap() });
    }
    if (st.poisonOnHitChance > 0 && Math.random() < st.poisonOnHitChance) {
      const ok = tryApplyDebuff(target, targetName, { type: 'poison', chance: 1.0, duration: 2 + durBonus }, player.atk, turn);
      if (ok) logs.push({ turn, text: `  ✦【淬毒】${targetName}中毒`, type: 'buff', ...snap() });
    }
    if (st.bleedOnHitChance > 0 && Math.random() < st.bleedOnHitChance) {
      const ok = tryApplyDebuff(target, targetName, { type: 'bleed', chance: 1.0, duration: 2 + durBonus }, player.atk, turn);
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
    for (const m of monsters.filter(mm => mm.alive)) {
      if (m.frozenTurns > 0) {
        m.frozenTurns--;
        logs.push({ turn, text: `  ${m.stats.name}被控制中,无法行动`, type: 'normal', ...snap() });
        continue;
      }
      tickMonsterCds(m.skillState);
      for (let bi = m.buffs.length - 1; bi >= 0; bi--) { m.buffs[bi].remaining--; if (m.buffs[bi].remaining <= 0) m.buffs.splice(bi, 1); }

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

      const mSkill = monsterChooseSkill(m.skillState, m.stats.hp, m.stats.maxHp, m.template.role === 'boss');

      if (mSkill && mSkill.multiplier === 0) {
        if (mSkill.healPercent) {
          const heal = Math.floor(m.stats.maxHp * mSkill.healPercent);
          m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + heal);
          logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}施展了【${mSkill.name}】，回复 ${heal} 点气血!`, type: 'buff', ...snap() });
        }
        if (mSkill.buff) {
          const existBuff = m.buffs.find(b => b.type === mSkill.buff!.type);
          if (existBuff) { existBuff.remaining = mSkill.buff.duration; existBuff.value = mSkill.buff.value; }
          else m.buffs.push({ type: mSkill.buff.type as BuffType, remaining: mSkill.buff.duration, value: mSkill.buff.value });
          if (mSkill.name === '狂暴') m.skillState.berserkTriggered = true;
          if (!mSkill.healPercent) logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}施展了【${mSkill.name}】！`, type: 'normal', ...snap() });
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
        if (pe?.poisonOnHitTaken && Math.random() < pe.poisonOnHitTaken) {
          tryApplyDebuff(sourceMonster, sourceMonster.stats.name, { type: 'poison', chance: 1, duration: 2 }, player.atk, turn);
        }
        if (pe?.burnOnHitTaken && Math.random() < pe.burnOnHitTaken) {
          tryApplyDebuff(sourceMonster, sourceMonster.stats.name, { type: 'burn', chance: 1, duration: 2 }, player.atk, turn);
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
          }
          if (player.hp <= 0) break;
        }
      } else {
        const mResult = calculateDamage(m.stats, player, skillMul, skillElem);
        if (mResult.damage === 0) {
          logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}的攻击被你闪避了`, type: 'normal', ...snap() });
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
  }

  for (let turn = 1; turn <= maxTurns; turn++) {
    const aliveMonsters = monsters.filter(m => m.alive);
    if (aliveMonsters.length === 0) break;

    turnLifestealTotal = 0;

    // v1.2 附灵每回合开始：回春 + 洗髓
    runAwakenTurnStart(turn);

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

    // 被动回血
    if (equippedSkills?.passiveEffects?.regenPerTurn && equippedSkills.passiveEffects.regenPerTurn > 0) {
      const heal = Math.floor(player.maxHp * equippedSkills.passiveEffects.regenPerTurn);
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

    // 先后手判定: 比较玩家身法和怪物平均身法；减速必定后攻
    const avgMonsterSpd = aliveMonsters.reduce((sum, m) => sum + m.stats.spd, 0) / aliveMonsters.length;
    let playerFirst = player.spd >= avgMonsterSpd;
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

    let mul = usedSkill.multiplier;
    let rootMatched = false;
    if (usedSkill.element && player.spiritualRoot && usedSkill.element === player.spiritualRoot) {
      mul *= 1.2;
      rootMatched = true;
    }
    // 神识加成神通伤害: 每点神识+0.5%
    if (isDivine && player.spirit && player.spirit > 0) {
      mul *= 1 + player.spirit * 0.005;
    }

    // buff/治疗技能(multiplier=0)
    if (mul === 0) {
      const prefix = isDivine ? '神通发动！' : '';
      if (usedSkill.healAtkRatio) {
        const heal = Math.floor(player.atk * usedSkill.healAtkRatio);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        logs.push({ turn, text: `[第${turn}回合] ${prefix}【${usedSkill.name}】回复 ${heal} 点气血`, type: 'buff', ...snap() });
      }
      if (usedSkill.buff) {
        logs.push({ turn, text: `[第${turn}回合] ${prefix}你获得了【${usedSkill.name}】的增益`, type: 'buff', ...snap() });
      }
      // AOE debuff (如时光凝滞)
      if (usedSkill.debuff && (usedSkill.isAoe || (usedSkill.targetCount && usedSkill.targetCount > 1))) {
        const debuffTargets = usedSkill.isAoe ? aliveMonsters : aliveMonsters.slice(0, usedSkill.targetCount || 1);
        for (const m of debuffTargets) {
          tryApplyDebuff(m, m.stats.name, usedSkill.debuff as any, player.atk, turn);
        }
      }
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
        return dmg;
      };

      if (hits > 1 && attackTargets.length === 1) {
        // 多段单体(溢出到下一只)
        let hitsDone = 0;
        while (hitsDone < hits) {
          const curTarget = monsters.find(m => m.alive && m.stats.hp > 0);
          if (!curTarget) break;
          const dmgResult = calculateDamage(player, curTarget.stats, perHitMul, usedSkill.element, usedSkill.ignoreDef);
          if (dmgResult.damage > 0) {
            const finalDmg = dealDamage(curTarget, dmgResult.damage);
            const critText = dmgResult.isCrit ? '暴击!' : '';
            if (dmgResult.isCrit) battleStats.playerCritCount++;
            if (getElementMultiplier(usedSkill.element || player.element, curTarget.stats.element) > 1.0) {
              battleStats.elementAdvantageHit = true;
            }
            logs.push({ turn, text: `  第${hitsDone + 1}段 ${critText}对${curTarget.stats.name}造成 ${finalDmg} 伤害`, type: dmgResult.isCrit ? 'crit' : 'normal', ...snap() });
            if (usedSkill.debuff) tryApplyDebuff(curTarget, curTarget.stats.name, usedSkill.debuff as any, player.atk, turn);
            // v1.2 附灵：命中触发 DOT
            triggerAwakenOnHit(curTarget, curTarget.stats.name, turn);
          }
          hitsDone++;
        }
      } else {
        // AOE/多目标/普通单体
        for (const t of attackTargets) {
          if (t.stats.hp <= 0) continue;
          const dmgResult = calculateDamage(player, t.stats, mul, usedSkill.element, usedSkill.ignoreDef);
          if (dmgResult.damage > 0) {
            const finalDmg = dealDamage(t, dmgResult.damage);
            const critText = dmgResult.isCrit ? '暴击!' : '';
            if (dmgResult.isCrit) battleStats.playerCritCount++;
            if (getElementMultiplier(usedSkill.element || player.element, t.stats.element) > 1.0) {
              battleStats.elementAdvantageHit = true;
            }
            if (!skillLabel) {
              logs.push({ turn, text: `[第${turn}回合] ${prefix}${critText}【${usedSkill.name}】对${t.stats.name}造成 ${finalDmg} 伤害`, type: dmgResult.isCrit ? 'crit' : 'normal', ...snap() });
            } else {
              logs.push({ turn, text: `  ${critText}对${t.stats.name}造成 ${finalDmg} 伤害`, type: dmgResult.isCrit ? 'crit' : 'normal', ...snap() });
            }
            if (usedSkill.debuff) tryApplyDebuff(t, t.stats.name, usedSkill.debuff as any, player.atk, turn);
            // v1.2 附灵：命中触发 DOT
            triggerAwakenOnHit(t, t.stats.name, turn);
          }
        }

        // v1.2 附灵：连击（仅普攻，即 mul === activeSkill.multiplier 且无 hits>1）
        const awakenState = player.awakenState;
        if (awakenState?.chainAttackChance > 0 && usedSkill === activeSkill && attackTargets.length > 0) {
          if (Math.random() < awakenState.chainAttackChance) {
            const chainTarget = monsters.find(m => m.alive && m.stats.hp > 0);
            if (chainTarget) {
              const dmgResult = calculateDamage(player, chainTarget.stats, mul * 0.6, usedSkill.element, usedSkill.ignoreDef);
              if (dmgResult.damage > 0) {
                const finalDmg = dealDamage(chainTarget, dmgResult.damage);
                logs.push({ turn, text: `  ✦【连击】再次出手，对${chainTarget.stats.name}造成 ${finalDmg} 伤害`, type: 'buff', ...snap() });
              }
            }
          }
        }
      }

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

    if (monsters.filter(m => m.alive).length === 0) break;
  }

  const allDead = monsters.filter(m => m.alive).length === 0;
  if (!allDead) {
    logs.push({ turn: maxTurns, text: '战斗超时，你选择撤退', type: 'system', ...snap() });
  }
  return { won: allDead, logs, totalExp, totalStone, monstersKilled, stats: battleStats };
}
