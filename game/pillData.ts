// 丹药静态数据 (v3.0 三级丹药体系)
// - basic 初级: 固定值加成, tier 1+ 默认解锁
// - mid 中级: 低百分比, tier 3+ 默认解锁
// - elite 高级: 中等百分比, tier 5+ 需宗门商店购买丹方解锁
// 所有百分比最终效果受 +40% 硬上限 clamp (见 fight.post.ts)

export interface HerbCost {
  herb_id: string;
  count: number;
}

export interface PillRecipe {
  id: string;
  name: string;
  type: 'battle' | 'breakthrough';
  rarity: 'green' | 'blue' | 'purple' | 'gold';
  level?: 'basic' | 'mid' | 'elite';  // 丹药等级(仅战斗丹)
  requireUnlock?: boolean;             // 是否需要解锁才能炼制
  cost: number;
  herbCost: HerbCost[];
  tierRequired: number;
  successRate: number;
  description: string;
  buffDuration?: number;
  buffEffect?: {
    // 固定值(初级丹药)
    atkFlat?: number;
    defFlat?: number;
    hpFlat?: number;
    critRateFlat?: number;  // 注意: 会心率本身就是 flat 百分比
    spdFlat?: number;
    // 百分比(中级/高级丹药)
    atkPercent?: number;
    defPercent?: number;
    hpPercent?: number;
    spdPercent?: number;
  };
  expGain?: number;
}

export const PILL_RECIPES: PillRecipe[] = [
  // ===== 初级战斗丹药(固定值, 自动解锁) =====
  {
    id: 'basic_atk_pill',
    name: '小聚灵丹',
    type: 'battle',
    rarity: 'green',
    level: 'basic',
    cost: 200,
    herbCost: [
      { herb_id: 'metal_herb',  count: 2 },
      { herb_id: 'common_herb', count: 1 },
    ],
    tierRequired: 1,
    successRate: 0.70,
    description: '攻击+20,持续10场战斗(品质系数放大固定值)',
    buffDuration: 10,
    buffEffect: { atkFlat: 20 },
  },
  {
    id: 'basic_def_pill',
    name: '小铁皮丹',
    type: 'battle',
    rarity: 'green',
    level: 'basic',
    cost: 200,
    herbCost: [
      { herb_id: 'water_herb',  count: 2 },
      { herb_id: 'common_herb', count: 1 },
    ],
    tierRequired: 1,
    successRate: 0.70,
    description: '防御+15,持续10场战斗',
    buffDuration: 10,
    buffEffect: { defFlat: 15 },
  },
  {
    id: 'basic_hp_pill',
    name: '小培元丹',
    type: 'battle',
    rarity: 'green',
    level: 'basic',
    cost: 200,
    herbCost: [
      { herb_id: 'wood_herb',   count: 2 },
      { herb_id: 'common_herb', count: 1 },
    ],
    tierRequired: 1,
    successRate: 0.70,
    description: '气血+300,持续10场战斗',
    buffDuration: 10,
    buffEffect: { hpFlat: 300 },
  },
  {
    id: 'basic_crit_pill',
    name: '小破妄丹',
    type: 'battle',
    rarity: 'green',
    level: 'basic',
    cost: 400,
    herbCost: [
      { herb_id: 'fire_herb',   count: 2 },
      { herb_id: 'common_herb', count: 2 },
    ],
    tierRequired: 1,
    successRate: 0.65,
    description: '会心率+3%,持续10场战斗',
    buffDuration: 10,
    buffEffect: { critRateFlat: 3 },
  },

  // ===== 中级战斗丹药(低百分比, 金丹期解锁) =====
  {
    id: 'atk_pill_1',
    name: '聚灵丹',
    type: 'battle',
    rarity: 'blue',
    level: 'mid',
    cost: 1000,
    herbCost: [
      { herb_id: 'metal_herb',  count: 3 },
      { herb_id: 'common_herb', count: 2 },
    ],
    tierRequired: 3,
    successRate: 0.55,
    description: '攻击+6%,持续10场战斗(上限+40%)',
    buffDuration: 10,
    buffEffect: { atkPercent: 6 },
  },
  {
    id: 'def_pill_1',
    name: '铁皮丹',
    type: 'battle',
    rarity: 'blue',
    level: 'mid',
    cost: 1000,
    herbCost: [
      { herb_id: 'water_herb',  count: 3 },
      { herb_id: 'common_herb', count: 2 },
    ],
    tierRequired: 3,
    successRate: 0.55,
    description: '防御+6%,持续10场战斗(上限+40%)',
    buffDuration: 10,
    buffEffect: { defPercent: 6 },
  },
  {
    id: 'hp_pill_1',
    name: '培元丹',
    type: 'battle',
    rarity: 'blue',
    level: 'mid',
    cost: 1000,
    herbCost: [
      { herb_id: 'wood_herb',   count: 3 },
      { herb_id: 'common_herb', count: 2 },
    ],
    tierRequired: 3,
    successRate: 0.55,
    description: '气血+8%,持续10场战斗(上限+40%)',
    buffDuration: 10,
    buffEffect: { hpPercent: 8 },
  },

  // ===== 高级战斗丹药(中等百分比, 需宗门商店解锁) =====
  {
    id: 'elite_atk_pill',
    name: '大聚灵丹',
    type: 'battle',
    rarity: 'purple',
    level: 'elite',
    requireUnlock: true,
    cost: 5000,
    herbCost: [
      { herb_id: 'metal_herb',  count: 5 },
      { herb_id: 'earth_herb',  count: 2 },
      { herb_id: 'common_herb', count: 5 },
    ],
    tierRequired: 5,
    successRate: 0.30,
    description: '攻击+10%,持续12场战斗(上限+40%,需宗门商店解锁)',
    buffDuration: 12,
    buffEffect: { atkPercent: 10 },
  },
  {
    id: 'elite_def_pill',
    name: '大铁皮丹',
    type: 'battle',
    rarity: 'purple',
    level: 'elite',
    requireUnlock: true,
    cost: 5000,
    herbCost: [
      { herb_id: 'water_herb',  count: 5 },
      { herb_id: 'earth_herb',  count: 2 },
      { herb_id: 'common_herb', count: 5 },
    ],
    tierRequired: 5,
    successRate: 0.30,
    description: '防御+10%,持续12场战斗(上限+40%,需宗门商店解锁)',
    buffDuration: 12,
    buffEffect: { defPercent: 10 },
  },
  {
    id: 'elite_hp_pill',
    name: '大培元丹',
    type: 'battle',
    rarity: 'purple',
    level: 'elite',
    requireUnlock: true,
    cost: 5000,
    herbCost: [
      { herb_id: 'wood_herb',   count: 5 },
      { herb_id: 'earth_herb',  count: 2 },
      { herb_id: 'common_herb', count: 5 },
    ],
    tierRequired: 5,
    successRate: 0.30,
    description: '气血+12%,持续12场战斗(上限+40%,需宗门商店解锁)',
    buffDuration: 12,
    buffEffect: { hpPercent: 12 },
  },
  {
    id: 'full_pill_1',
    name: '天元丹',
    type: 'battle',
    rarity: 'gold',
    level: 'elite',
    requireUnlock: true,
    cost: 10000,
    herbCost: [
      { herb_id: 'earth_herb',  count: 5 },
      { herb_id: 'metal_herb',  count: 3 },
      { herb_id: 'water_herb',  count: 3 },
      { herb_id: 'wood_herb',   count: 3 },
      { herb_id: 'common_herb', count: 10 },
    ],
    tierRequired: 6,
    successRate: 0.20,
    description: '攻击/防御/气血各+6%,持续15场战斗(需宗门商店解锁)',
    buffDuration: 15,
    buffEffect: { atkPercent: 6, defPercent: 6, hpPercent: 6 },
  },

  // ===== 突破丹药(保持原数值) =====
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
