// 洞府建筑静态数据

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;          // 单字图标
  description: string;
  maxLevel: number;
  // 产出 (每小时)
  output?: {
    type: 'exp' | 'spirit_stone' | 'herb';
    base: number;        // 1级产出
    perLevelMul: number; // 每级倍率
  };
  // 战斗加成
  battleBonus?: {
    type: 'expBonus' | 'skillRate' | 'craftRate' | 'equipQuality';
    base: number;        // 1级加成 (百分比)
    perLevel: number;    // 每级加成 (百分比)
  };
  // 升级配置
  baseCost: number;      // 升级基础灵石
  costMul: number;       // 升级灵石倍率
  baseTime: number;      // 升级基础时间(秒)
  unlockTier: number;    // 解锁所需角色境界 tier
  prerequisite?: { buildingId: string; level: number };
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'spirit_array',
    name: '聚灵阵',
    icon: '阵',
    description: '凝聚天地灵气,产出修为。',
    maxLevel: 20,
    output: { type: 'exp', base: 50, perLevelMul: 1.15 },
    baseCost: 1000,
    costMul: 1.6,
    baseTime: 0,
    unlockTier: 1,
  },
  {
    id: 'herb_field',
    name: '灵田',
    icon: '田',
    description: '种植灵草,产出炼丹材料。',
    maxLevel: 15,
    baseCost: 1500,
    costMul: 1.7,
    baseTime: 0,
    unlockTier: 1,
  },
  {
    id: 'treasure_pot',
    name: '聚宝盆',
    icon: '宝',
    description: '汇聚四方灵脉,产出灵石。',
    maxLevel: 20,
    output: { type: 'spirit_stone', base: 800, perLevelMul: 1.22 },
    baseCost: 2000,
    costMul: 1.8,
    baseTime: 0,
    unlockTier: 1,
  },
  {
    id: 'martial_hall',
    name: '演武堂',
    icon: '武',
    description: '提升历练时获得的修为。',
    maxLevel: 10,
    battleBonus: { type: 'expBonus', base: 5, perLevel: 2 },
    baseCost: 3000,
    costMul: 2.5,
    baseTime: 60,
    unlockTier: 1,
  },
  {
    id: 'sutra_pavilion',
    name: '藏经阁',
    icon: '经',
    description: '提升打怪掉落功法的概率。',
    maxLevel: 10,
    battleBonus: { type: 'skillRate', base: 5, perLevel: 2 },
    baseCost: 5000,
    costMul: 2.5,
    baseTime: 120,
    unlockTier: 2,
    prerequisite: { buildingId: 'spirit_array', level: 5 },
  },
  {
    id: 'pill_room',
    name: '炼丹房',
    icon: '丹',
    description: '提升炼丹成功率。',
    maxLevel: 10,
    battleBonus: { type: 'craftRate', base: 5, perLevel: 3 },
    baseCost: 8000,
    costMul: 2.5,
    baseTime: 180,
    unlockTier: 2,
    prerequisite: { buildingId: 'herb_field', level: 5 },
  },
  {
    id: 'forge_room',
    name: '炼器房',
    icon: '器',
    description: '提升打怪掉落装备品质。',
    maxLevel: 10,
    battleBonus: { type: 'equipQuality', base: 1, perLevel: 1 },
    baseCost: 10000,
    costMul: 2.5,
    baseTime: 300,
    unlockTier: 3,
    prerequisite: { buildingId: 'sutra_pavilion', level: 5 },
  },
];

// 计算指定等级的升级灵石消耗
export function getUpgradeCost(building: BuildingDef, currentLevel: number): number {
  return Math.floor(building.baseCost * Math.pow(building.costMul, currentLevel - 1));
}

// 计算指定等级的升级时间(秒)
export function getUpgradeTime(building: BuildingDef, currentLevel: number): number {
  if (currentLevel <= 5) return 0;
  return Math.floor(building.baseTime * Math.pow(1.5, currentLevel - 6));
}

// 计算每小时产出（mul 为赞助倍率，默认 1.0）
export function getOutputPerHour(building: BuildingDef, level: number, mul: number = 1): number {
  if (!building.output) return 0;
  return Math.floor(building.output.base * Math.pow(building.output.perLevelMul, level - 1) * mul);
}

// 计算战斗加成数值(百分比)
export function getBattleBonus(building: BuildingDef, level: number): number {
  if (!building.battleBonus) return 0;
  return building.battleBonus.base + building.battleBonus.perLevel * (level - 1);
}

// 根据上次领取时间计算累积产出（mul 为赞助倍率，默认 1.0）
export function calcAccumulated(building: BuildingDef, level: number, lastCollectTime: number, maxHours: number = 24, mul: number = 1): number {
  if (!building.output) return 0;
  const now = Date.now();
  const elapsedMs = now - lastCollectTime;
  const elapsedHours = Math.min(elapsedMs / 3600000, maxHours);
  if (elapsedHours <= 0) return 0;
  return Math.floor(getOutputPerHour(building, level, mul) * elapsedHours);
}

export function getBuildingById(id: string): BuildingDef | undefined {
  return BUILDINGS.find(b => b.id === id);
}
