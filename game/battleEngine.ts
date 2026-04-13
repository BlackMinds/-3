// 前端只需要类型定义和状态设置器（战斗计算已迁移到后端）

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

export interface CaveBonusInfo {
  skillRate: number;
  equipQuality: number;
}

let _caveBonus: CaveBonusInfo = { skillRate: 0, equipQuality: 0 };
export function setCaveBonus(b: CaveBonusInfo) { _caveBonus = b; }
export function getCaveBonus(): CaveBonusInfo { return _caveBonus; }

let _equipLuck = 0;
export function setEquipLuck(luck: number) { _equipLuck = luck; }
export function getEquipLuck(): number { return _equipLuck; }

let _spiritDensity = 0;
export function setSpiritDensity(v: number) { _spiritDensity = v; }
export function getSpiritDensity(): number { return _spiritDensity; }

let _equipCombatStats = { armorPen: 0, accuracy: 0, elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 } };
export function setEquipCombatStats(stats: typeof _equipCombatStats) { _equipCombatStats = stats; }
export function getEquipCombatStats() { return _equipCombatStats; }
