// 丹药静态数据 (新版: 使用具体灵草)

export interface HerbCost {
  herb_id: string;
  count: number;
}

export interface PillRecipe {
  id: string;
  name: string;
  type: 'battle' | 'breakthrough';
  rarity: 'green' | 'blue' | 'purple' | 'gold';
  cost: number;          // 灵石消耗
  herbCost: HerbCost[];  // 灵草消耗(具体种类和数量)
  tierRequired: number;  // 解锁所需境界tier
  successRate: number;   // 炼丹成功率 0~1
  description: string;
  // 战斗丹药基础效果(品质系数 1.0 时)
  buffDuration?: number; // 持续N场战斗
  buffEffect?: {
    atkPercent?: number;
    defPercent?: number;
    hpPercent?: number;
    critRate?: number;
    spdPercent?: number;
  };
  // 突破丹药基础效果
  expGain?: number;      // 提供修为
}

export const PILL_RECIPES: PillRecipe[] = [
  // ===== 战斗丹药 =====
  {
    id: 'atk_pill_1',
    name: '聚灵丹',
    type: 'battle',
    rarity: 'green',
    cost: 500,
    herbCost: [
      { herb_id: 'metal_herb',  count: 3 },
      { herb_id: 'common_herb', count: 2 },
    ],
    tierRequired: 1,
    successRate: 0.55,
    description: '攻击+15%,持续10场战斗(品质越高效果越好)',
    buffDuration: 10,
    buffEffect: { atkPercent: 15 },
  },
  {
    id: 'def_pill_1',
    name: '铁皮丹',
    type: 'battle',
    rarity: 'green',
    cost: 500,
    herbCost: [
      { herb_id: 'water_herb',  count: 3 },
      { herb_id: 'common_herb', count: 2 },
    ],
    tierRequired: 1,
    successRate: 0.55,
    description: '防御+15%,持续10场战斗',
    buffDuration: 10,
    buffEffect: { defPercent: 15 },
  },
  {
    id: 'hp_pill_1',
    name: '培元丹',
    type: 'battle',
    rarity: 'green',
    cost: 500,
    herbCost: [
      { herb_id: 'wood_herb',   count: 3 },
      { herb_id: 'common_herb', count: 2 },
    ],
    tierRequired: 1,
    successRate: 0.55,
    description: '气血+20%,持续10场战斗',
    buffDuration: 10,
    buffEffect: { hpPercent: 20 },
  },
  {
    id: 'crit_pill_1',
    name: '破妄丹',
    type: 'battle',
    rarity: 'blue',
    cost: 1500,
    herbCost: [
      { herb_id: 'fire_herb',   count: 5 },
      { herb_id: 'metal_herb',  count: 3 },
      { herb_id: 'common_herb', count: 5 },
    ],
    tierRequired: 2,
    successRate: 0.40,
    description: '会心率+8%,持续10场战斗',
    buffDuration: 10,
    buffEffect: { critRate: 8 },
  },
  {
    id: 'full_pill_1',
    name: '天元丹',
    type: 'battle',
    rarity: 'purple',
    cost: 5000,
    herbCost: [
      { herb_id: 'earth_herb',  count: 5 },
      { herb_id: 'metal_herb',  count: 3 },
      { herb_id: 'water_herb',  count: 3 },
      { herb_id: 'wood_herb',   count: 3 },
      { herb_id: 'common_herb', count: 10 },
    ],
    tierRequired: 3,
    successRate: 0.25,
    description: '攻击+10%/防御+10%/气血+10%,持续15场战斗',
    buffDuration: 15,
    buffEffect: { atkPercent: 10, defPercent: 10, hpPercent: 10 },
  },

  // ===== 突破丹药 =====
  {
    id: 'exp_pill_1',
    name: '筑基丹',
    type: 'breakthrough',
    rarity: 'green',
    cost: 1000,
    herbCost: [
      { herb_id: 'spirit_grass', count: 1 },
      { herb_id: 'common_herb',  count: 5 },
    ],
    tierRequired: 1,
    successRate: 0.50,
    description: '获得 500 修为(品质越高获得越多)',
    expGain: 500,
  },
  {
    id: 'exp_pill_2',
    name: '凝元丹',
    type: 'breakthrough',
    rarity: 'blue',
    cost: 5000,
    herbCost: [
      { herb_id: 'spirit_grass', count: 3 },
      { herb_id: 'water_herb',   count: 5 },
      { herb_id: 'common_herb',  count: 10 },
    ],
    tierRequired: 2,
    successRate: 0.35,
    description: '获得 3000 修为',
    expGain: 3000,
  },
  {
    id: 'exp_pill_3',
    name: '化神丹',
    type: 'breakthrough',
    rarity: 'purple',
    cost: 20000,
    herbCost: [
      { herb_id: 'spirit_grass', count: 10 },
      { herb_id: 'earth_herb',   count: 10 },
      { herb_id: 'common_herb',  count: 30 },
    ],
    tierRequired: 3,
    successRate: 0.20,
    description: '获得 15000 修为',
    expGain: 15000,
  },
  {
    id: 'exp_pill_4',
    name: '渡劫丹',
    type: 'breakthrough',
    rarity: 'gold',
    cost: 100000,
    herbCost: [
      { herb_id: 'spirit_grass', count: 50 },
      { herb_id: 'metal_herb',   count: 15 },
      { herb_id: 'wood_herb',    count: 15 },
      { herb_id: 'water_herb',   count: 15 },
      { herb_id: 'fire_herb',    count: 15 },
      { herb_id: 'earth_herb',   count: 15 },
    ],
    tierRequired: 5,
    successRate: 0.15,
    description: '获得 100000 修为',
    expGain: 100000,
  },
];

export function getPillById(id: string): PillRecipe | undefined {
  return PILL_RECIPES.find(p => p.id === id);
}

export function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    green: '#00CC00',
    blue: '#0066FF',
    purple: '#9933FF',
    gold: '#FFAA00',
  };
  return colors[rarity] || '#CCCCCC';
}
