// 装备静态数据

export type WeaponType = 'sword' | 'blade' | 'spear' | 'fan';

export interface Equipment {
  id?: number;
  slot: string;
  name: string;
  rarity: string;
  primary_stat: string;
  primary_value: number;
  sub_stats: { stat: string; value: number }[];
  set_id: string | null;
  enhance_level: number;
  tier: number;
  weapon_type?: WeaponType | null;
  req_level?: number;
}

// tier -> 穿戴等级
const TIER_REQ_LEVEL: Record<number, number> = {
  1: 1, 2: 15, 3: 35, 4: 55, 5: 80, 6: 110, 7: 140, 8: 170, 9: 185, 10: 195,
};

// 武器类型定义
export interface WeaponTypeDef {
  id: WeaponType;
  name: string;
  description: string;
  bonus: {
    ATK_percent?: number;
    CRIT_RATE_flat?: number;     // 百分比 (e.g. 3 = +3%)
    CRIT_DMG_flat?: number;      // 百分比 (e.g. 15 = +15%)
    SPD_percent?: number;
    LIFESTEAL_flat?: number;     // 百分比
    SPIRIT_percent?: number;
  };
}

export const WEAPON_TYPES: WeaponTypeDef[] = [
  {
    id: 'sword', name: '剑',
    description: '攻守兼备,暴击率小幅提升,适合泛用',
    bonus: { ATK_percent: 5, CRIT_RATE_flat: 3 },
  },
  {
    id: 'blade', name: '刀',
    description: '高攻高爆发,暴击伤害加成,适合暴击流',
    bonus: { ATK_percent: 10, CRIT_DMG_flat: 15 },
  },
  {
    id: 'spear', name: '枪',
    description: '快攻吸血,高速多段攻击,适合持久战',
    bonus: { ATK_percent: 3, SPD_percent: 12, LIFESTEAL_flat: 3 },
  },
  {
    id: 'fan', name: '扇',
    description: '提升神识,强化神通威力,适合法术流',
    bonus: { ATK_percent: 3, SPIRIT_percent: 25 },
  },
];

export function getWeaponTypeDef(type: string | null | undefined): WeaponTypeDef | undefined {
  if (!type) return undefined;
  return WEAPON_TYPES.find(w => w.id === type);
}

// 槽位定义
export const EQUIP_SLOTS = [
  { slot: 'weapon',   name: '兵器',   primaryStat: 'ATK' },
  { slot: 'armor',    name: '法袍',   primaryStat: 'DEF' },
  { slot: 'helmet',   name: '法冠',   primaryStat: 'HP' },
  { slot: 'boots',    name: '步云靴', primaryStat: 'SPD' },
  { slot: 'treasure', name: '法宝',   primaryStat: 'ATK' },
  { slot: 'ring',     name: '灵戒',   primaryStat: 'CRIT_RATE' },
  { slot: 'pendant',  name: '灵佩',   primaryStat: 'SPIRIT' },
];

// 品质定义
export const RARITIES = [
  { id: 'white',  name: '凡器',   color: '#CCCCCC', statMul: 1.00, subCount: 0 },
  { id: 'green',  name: '灵器',   color: '#00CC00', statMul: 1.05, subCount: 1 },
  { id: 'blue',   name: '法器',   color: '#0066FF', statMul: 1.10, subCount: 2 },
  { id: 'purple', name: '灵宝',   color: '#9933FF', statMul: 1.18, subCount: 3 },
  { id: 'gold',   name: '仙器',   color: '#FFAA00', statMul: 1.25, subCount: 4 },
  { id: 'red',    name: '太古神器', color: '#FF3333', statMul: 1.35, subCount: 4 },
];

// 品质权重（按地图tier）
// 品质权重: [凡器, 灵器, 法器, 灵宝, 仙器, 太古神器]
const QUALITY_WEIGHTS: Record<number, number[]> = {
  1:  [60, 30, 9,  1,   0,    0],
  2:  [40, 35, 18, 6,   1,    0],
  3:  [20, 35, 25, 15,  4.5,  0.5],
  4:  [5,  25, 30, 25,  13,   2],
  5:  [0,  10, 30, 35,  22,   3],
  6:  [0,  0,  20, 40,  35,   5],
  7:  [0,  0,  10, 35,  45,   10],
  8:  [0,  0,  5,  25,  55,   15],
  9:  [0,  0,  0,  20,  60,   20],
  10: [0,  0,  0,  10,  60,   30],
};

// 副属性池
const SUB_STAT_POOL = [
  // 基础
  { stat: 'ATK', name: '攻击', range: [10, 50] },
  { stat: 'HP', name: '气血', range: [50, 250] },
  { stat: 'DEF', name: '防御', range: [5, 30] },
  { stat: 'SPD', name: '身法', range: [2, 10] },
  { stat: 'CRIT_RATE', name: '会心率', range: [1, 5] },
  { stat: 'CRIT_DMG', name: '会心伤害', range: [3, 15] },
  // 战斗深化 (百分比, 数值 = 1~5)
  { stat: 'ARMOR_PEN', name: '破甲', range: [1, 5] },
  { stat: 'ACCURACY', name: '命中', range: [1, 5] },
  // 五行强化 (百分比, 数值 = 2~8)
  { stat: 'METAL_DMG', name: '金系强化', range: [2, 8] },
  { stat: 'WOOD_DMG', name: '木系强化', range: [2, 8] },
  { stat: 'WATER_DMG', name: '水系强化', range: [2, 8] },
  { stat: 'FIRE_DMG', name: '火系强化', range: [2, 8] },
  { stat: 'EARTH_DMG', name: '土系强化', range: [2, 8] },
  // 资源获取 (百分比, 数值 = 2~6)
  { stat: 'SPIRIT_DENSITY', name: '灵气浓度', range: [2, 6] },
  { stat: 'LUCK', name: '福缘', range: [2, 6] },
];

// 主属性基础值（按槽位）
const PRIMARY_BASE: Record<string, number> = {
  ATK: 30,
  DEF: 20,
  HP: 200,
  SPD: 15,
  CRIT_RATE: 3,
  SPIRIT: 8,
};

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// 兵器名称 (按武器类型 + 品质)
const WEAPON_NAMES: Record<WeaponType, string[]> = {
  sword: ['铁剑', '青锋剑', '寒光剑', '诛仙剑', '无极剑', '混沌剑'],
  blade: ['铁刀', '柳叶刀', '虎魄刀', '斩魂刀', '九幽刀', '焚天刀'],
  spear: ['铁枪', '银纹枪', '裂风枪', '惊鸿枪', '雷霆枪', '破虚枪'],
  fan: ['折扇', '玉骨扇', '清风扇', '云霞扇', '太虚扇', '乾坤扇'],
};

// 炼器房品质加成
let _forgeQualityBonus = 0;
export function setForgeQualityBonus(v: number) {
  _forgeQualityBonus = v;
}

// 生成一件装备
export function generateEquipment(mapTier: number, isBoss: boolean): Equipment {
  // 随机槽位
  const slotDef = EQUIP_SLOTS[rand(0, EQUIP_SLOTS.length - 1)];

  // 随机品质
  const weights = [...(QUALITY_WEIGHTS[mapTier] || QUALITY_WEIGHTS[1])];
  // 炼器房加成: 每级将低品质权重向高品质转移
  if (_forgeQualityBonus > 0) {
    for (let shift = 0; shift < _forgeQualityBonus; shift++) {
      for (let i = weights.length - 1; i > 0; i--) {
        const move = weights[i - 1] * 0.10;
        weights[i] += move;
        weights[i - 1] -= move;
      }
    }
  }
  if (isBoss) {
    // Boss掉落品质向上偏移
    for (let i = weights.length - 1; i > 0; i--) {
      const shift = weights[i - 1] * 0.3;
      weights[i] += shift;
      weights[i - 1] -= shift;
    }
  }
  const rarityIdx = weightedRandom(weights);
  const rarity = RARITIES[rarityIdx];

  // 主属性
  const base = PRIMARY_BASE[slotDef.primaryStat] || 30;
  const primaryValue = Math.floor(base * mapTier * rarity.statMul);

  // 副属性
  const subStats: { stat: string; value: number }[] = [];
  const usedStats = new Set([slotDef.primaryStat]);
  // 百分比类副属性不随 tier 缩放,基础类才缩放
  const flatStats = new Set(['ATK', 'HP', 'DEF', 'SPD']);
  for (let i = 0; i < rarity.subCount; i++) {
    const available = SUB_STAT_POOL.filter(s => !usedStats.has(s.stat));
    if (available.length === 0) break;
    const sub = available[rand(0, available.length - 1)];
    usedStats.add(sub.stat);
    const baseVal = rand(sub.range[0], sub.range[1]);
    // 攻防血身法 才按 tier 缩放
    const value = flatStats.has(sub.stat) ? baseVal * Math.ceil(mapTier / 2) : baseVal;
    subStats.push({ stat: sub.stat, value });
  }

  // 武器类型: 只给 weapon 槽位分配
  let weaponType: WeaponType | undefined;
  let displayName = `${rarity.name}·${slotDef.name}`;
  if (slotDef.slot === 'weapon') {
    const types: WeaponType[] = ['sword', 'blade', 'spear', 'fan'];
    weaponType = types[rand(0, types.length - 1)];
    const namePool = WEAPON_NAMES[weaponType];
    const nameIdx = Math.min(rarityIdx, namePool.length - 1);
    displayName = `${rarity.name}·${namePool[nameIdx]}`;
  }

  return {
    slot: slotDef.slot,
    name: displayName,
    rarity: rarity.id,
    primary_stat: slotDef.primaryStat,
    primary_value: primaryValue,
    sub_stats: subStats,
    set_id: null,
    enhance_level: 0,
    tier: mapTier,
    weapon_type: weaponType || null,
    req_level: TIER_REQ_LEVEL[mapTier] || 1,
  };
}

// 属性中文名
export const STAT_NAMES: Record<string, string> = {
  ATK: '攻击',
  DEF: '防御',
  HP: '气血',
  SPD: '身法',
  CRIT_RATE: '会心率',
  CRIT_DMG: '会心伤害',
  SPIRIT: '神识',
  ARMOR_PEN: '破甲',
  ACCURACY: '命中',
  METAL_DMG: '金系强化',
  WOOD_DMG: '木系强化',
  WATER_DMG: '水系强化',
  FIRE_DMG: '火系强化',
  EARTH_DMG: '土系强化',
  SPIRIT_DENSITY: '灵气浓度',
  LUCK: '福缘',
};

// 哪些副属性是百分比 (显示时加 %)
export const PERCENT_STATS = new Set([
  'CRIT_RATE', 'CRIT_DMG',
  'ARMOR_PEN', 'ACCURACY',
  'METAL_DMG', 'WOOD_DMG', 'WATER_DMG', 'FIRE_DMG', 'EARTH_DMG',
  'SPIRIT_DENSITY', 'LUCK',
]);

// 品质颜色
export function getRarityColor(rarity: string): string {
  return RARITIES.find(r => r.id === rarity)?.color || '#CCCCCC';
}

export function getRarityName(rarity: string): string {
  return RARITIES.find(r => r.id === rarity)?.name || '未知';
}

export function getSlotName(slot: string): string {
  return EQUIP_SLOTS.find(s => s.slot === slot)?.name || slot;
}

// 强化相关
export function getEnhanceCost(rarity: string, currentLevel: number): number {
  const baseCosts: Record<string, number> = {
    white: 50, green: 100, blue: 300, purple: 800, gold: 2000, red: 5000,
  };
  const baseCost = baseCosts[rarity] || 300;
  return Math.floor(baseCost * Math.pow(currentLevel + 2, 1.4));
}

export function getEnhanceSuccessRate(nextLevel: number): number {
  if (nextLevel <= 5) return 1.0;
  if (nextLevel === 6) return 0.80;
  if (nextLevel === 7) return 0.70;
  if (nextLevel === 8) return 0.55;
  if (nextLevel === 9) return 0.40;
  if (nextLevel === 10) return 0.25;
  return 0;
}

// 强化后的主属性值
export function getEnhancedPrimaryValue(basePrimary: number, enhanceLevel: number): number {
  return Math.floor(basePrimary * (1 + enhanceLevel * 0.08));
}

// 强化加成量
export function getEnhanceBonus(basePrimary: number, enhanceLevel: number): number {
  return getEnhancedPrimaryValue(basePrimary, enhanceLevel) - basePrimary;
}
