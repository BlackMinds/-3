import type { MapData, RealmTier, SkillData } from './types';

// ========== 境界数据 ==========
export const REALM_TIERS: RealmTier[] = [
  { tier: 1, realm: '练气', stages: 9, base_power: 100, power_multiplier: 1.0, breakthrough_type: 'auto', exp_multiplier: 1 },
  { tier: 2, realm: '筑基', stages: 3, base_power: 1000, power_multiplier: 3.0, breakthrough_type: 'resource', exp_multiplier: 10 },
  { tier: 3, realm: '金丹', stages: 3, base_power: 5000, power_multiplier: 8.0, breakthrough_type: 'tribulation', exp_multiplier: 50 },
  { tier: 4, realm: '元婴', stages: 3, base_power: 20000, power_multiplier: 20.0, breakthrough_type: 'tribulation', exp_multiplier: 200 },
  { tier: 5, realm: '化神', stages: 3, base_power: 100000, power_multiplier: 50.0, breakthrough_type: 'tribulation', exp_multiplier: 800 },
  { tier: 6, realm: '渡劫', stages: 3, base_power: 500000, power_multiplier: 120.0, breakthrough_type: 'tribulation', exp_multiplier: 3000 },
  { tier: 7, realm: '大乘', stages: 3, base_power: 2000000, power_multiplier: 200.0, breakthrough_type: 'tribulation', exp_multiplier: 8000 },
  { tier: 8, realm: '飞升', stages: 5, base_power: 10000000, power_multiplier: 300.0, breakthrough_type: 'tribulation', exp_multiplier: 15000 },
];

export const REALM_STAGE_NAMES: Record<number, string[]> = {
  8: ['散仙', '真仙', '金仙', '太乙金仙', '大罗金仙'],
};

// ========== 灵根数据 ==========
export const SPIRITUAL_ROOTS: Record<string, { name: string; char: string; color: string; glow: string }> = {
  metal: { name: '金灵根', char: '金', color: '#c9a85c', glow: 'rgba(201,168,92,0.3)' },
  wood:  { name: '木灵根', char: '木', color: '#6baa7d', glow: 'rgba(107,170,125,0.3)' },
  water: { name: '水灵根', char: '水', color: '#5b8eaa', glow: 'rgba(91,142,170,0.3)' },
  fire:  { name: '火灵根', char: '火', color: '#c45c4a', glow: 'rgba(196,92,74,0.3)' },
  earth: { name: '土灵根', char: '土', color: '#a08a60', glow: 'rgba(160,138,96,0.3)' },
};

// ========== 五行相克 ==========
export const ELEMENT_ADVANTAGE: Record<string, string> = {
  metal: 'wood',   // 金克木
  wood: 'earth',   // 木克土
  earth: 'water',  // 土克水
  water: 'fire',   // 水克火
  fire: 'metal',   // 火克金
};

export function getElementMultiplier(attackerElement: string | null, defenderElement: string | null): number {
  if (!attackerElement || !defenderElement) return 1.0;
  if (ELEMENT_ADVANTAGE[attackerElement] === defenderElement) return 1.3;
  if (ELEMENT_ADVANTAGE[defenderElement] === attackerElement) return 0.7;
  return 1.0;
}

// ========== 地图数据 ==========
export const MAPS: MapData[] = [
  {
    id: 'qingfeng_valley', name: '清风谷', tier: 1,
    realm_required: '练气一层', recommended_power: 1,
    element: null, description: '灵气稀薄的山谷，新手历练之地',
    monsters: [
      { id: 'wild_boar', name: '野猪妖', power: 50, element: null, exp: 10, spirit_stone_range: [5, 15], role: 'balanced', drop_table: 'common_t1' },
      { id: 'gray_wolf', name: '灰狼', power: 80, element: null, exp: 15, spirit_stone_range: [5, 15], role: 'balanced', drop_table: 'common_t1' },
      { id: 'snake_spirit', name: '蛇妖', power: 120, element: 'wood', exp: 25, spirit_stone_range: [5, 15], role: 'balanced', drop_table: 'common_t1' },
    ],
    boss: { id: 'wolf_king', name: '狼王', power: 300, element: null, exp: 200, spirit_stone_range: [100, 200], role: 'boss', drop_table: 'boss_t1' },
  },
  {
    id: 'misty_swamp', name: '迷雾沼泽', tier: 1,
    realm_required: '练气五层', recommended_power: 5,
    element: 'water', description: '毒瘴弥漫的湿地，盛产炼丹草药',
    monsters: [
      { id: 'toad_spirit', name: '蟾蜍精', power: 200, element: 'water', exp: 20, spirit_stone_range: [5, 15], role: 'balanced', drop_table: 'common_t1' },
      { id: 'swamp_snake', name: '沼蛇', power: 280, element: 'water', exp: 30, spirit_stone_range: [5, 15], role: 'balanced', drop_table: 'common_t1' },
      { id: 'mud_golem', name: '泥傀儡', power: 350, element: 'earth', exp: 40, spirit_stone_range: [10, 30], role: 'tank', drop_table: 'uncommon_t1' },
    ],
    boss: { id: 'swamp_king', name: '沼泽蛟', power: 600, element: 'water', exp: 400, spirit_stone_range: [100, 200], role: 'boss', drop_table: 'boss_t1' },
  },
  {
    id: 'sunset_mountain', name: '落霞山', tier: 2,
    realm_required: '筑基初期', recommended_power: 15,
    element: 'fire', description: '晚霞笼罩的火灵山，装备掉率较高',
    monsters: [
      { id: 'fire_fox', name: '火狐妖', power: 800, element: 'fire', exp: 80, spirit_stone_range: [20, 60], role: 'balanced', drop_table: 'common_t2' },
      { id: 'magma_lizard', name: '熔岩蜥', power: 1000, element: 'fire', exp: 100, spirit_stone_range: [20, 60], role: 'balanced', drop_table: 'common_t2' },
      { id: 'flame_bird', name: '火鸦', power: 1500, element: 'fire', exp: 150, spirit_stone_range: [40, 100], role: 'dps', drop_table: 'uncommon_t2' },
    ],
    boss: { id: 'fire_python', name: '赤炎蟒', power: 3000, element: 'fire', exp: 1500, spirit_stone_range: [500, 1000], role: 'boss', drop_table: 'boss_t2' },
  },
  {
    id: 'jade_bamboo_forest', name: '翠竹林', tier: 2,
    realm_required: '筑基初期', recommended_power: 20,
    element: 'wood', description: '灵竹成林，功法残页掉率高',
    monsters: [
      { id: 'bamboo_spirit', name: '竹灵', power: 900, element: 'wood', exp: 90, spirit_stone_range: [20, 60], role: 'balanced', drop_table: 'common_t2' },
      { id: 'vine_demon', name: '藤妖', power: 1200, element: 'wood', exp: 120, spirit_stone_range: [20, 60], role: 'balanced', drop_table: 'common_t2' },
      { id: 'jade_monkey', name: '玉面猴', power: 1600, element: 'wood', exp: 160, spirit_stone_range: [40, 100], role: 'dps', drop_table: 'uncommon_t2' },
    ],
    boss: { id: 'bamboo_king', name: '千年竹妖', power: 3500, element: 'wood', exp: 1800, spirit_stone_range: [500, 1000], role: 'boss', drop_table: 'boss_t2' },
  },
  {
    id: 'iron_ore_cave', name: '黑铁矿洞', tier: 2,
    realm_required: '筑基中期', recommended_power: 25,
    element: 'metal', description: '地下矿洞，盛产炼器矿石',
    monsters: [
      { id: 'iron_golem', name: '铁傀儡', power: 1200, element: 'metal', exp: 110, spirit_stone_range: [20, 60], role: 'balanced', drop_table: 'common_t2' },
      { id: 'cave_bat', name: '矿蝠', power: 1400, element: 'metal', exp: 130, spirit_stone_range: [20, 60], role: 'balanced', drop_table: 'common_t2' },
      { id: 'crystal_worm', name: '晶蚕', power: 2000, element: 'earth', exp: 180, spirit_stone_range: [40, 100], role: 'dps', drop_table: 'uncommon_t2' },
    ],
    boss: { id: 'ore_king', name: '矿灵王', power: 4000, element: 'metal', exp: 2000, spirit_stone_range: [500, 1000], role: 'boss', drop_table: 'boss_t2' },
  },
  {
    id: 'myriad_demon_mountain', name: '万妖山', tier: 3,
    realm_required: '金丹初期', recommended_power: 35,
    element: 'wood', description: '妖兽盘踞深山，高品质装备掉率提升',
    monsters: [
      { id: 'tree_demon', name: '树妖', power: 4000, element: 'wood', exp: 400, spirit_stone_range: [80, 200], role: 'balanced', drop_table: 'common_t3' },
      { id: 'bear_spirit', name: '熊妖', power: 5500, element: 'earth', exp: 550, spirit_stone_range: [80, 200], role: 'balanced', drop_table: 'common_t3' },
      { id: 'flower_demon', name: '花妖', power: 7000, element: 'wood', exp: 700, spirit_stone_range: [150, 400], role: 'dps', drop_table: 'uncommon_t3' },
    ],
    boss: { id: 'demon_ape', name: '妖猿王', power: 15000, element: 'earth', exp: 8000, spirit_stone_range: [2000, 5000], role: 'boss', drop_table: 'boss_t3' },
  },
  {
    id: 'thunderpeak', name: '雷鸣峰', tier: 3,
    realm_required: '金丹初期', recommended_power: 40,
    element: 'metal', description: '雷电交加的山巅，金系功法的圣地',
    monsters: [
      { id: 'thunder_hawk', name: '雷鹰', power: 5000, element: 'metal', exp: 500, spirit_stone_range: [80, 200], role: 'balanced', drop_table: 'common_t3' },
      { id: 'storm_wolf', name: '风暴狼', power: 6500, element: 'metal', exp: 650, spirit_stone_range: [80, 200], role: 'balanced', drop_table: 'common_t3' },
      { id: 'lightning_serpent', name: '雷蛇', power: 8000, element: 'metal', exp: 800, spirit_stone_range: [150, 400], role: 'dps', drop_table: 'uncommon_t3' },
    ],
    boss: { id: 'thunder_roc', name: '雷鹏', power: 18000, element: 'metal', exp: 9000, spirit_stone_range: [2000, 5000], role: 'boss', drop_table: 'boss_t3' },
  },
  {
    id: 'ancient_ruins', name: '上古遗迹', tier: 3,
    realm_required: '金丹中期', recommended_power: 45,
    element: 'earth', description: '远古修士留下的遗迹，套装部件掉落概率高',
    monsters: [
      { id: 'stone_guard', name: '石卫士', power: 6000, element: 'earth', exp: 600, spirit_stone_range: [80, 200], role: 'balanced', drop_table: 'common_t3' },
      { id: 'rune_puppet', name: '符傀儡', power: 8000, element: 'earth', exp: 800, spirit_stone_range: [150, 400], role: 'dps', drop_table: 'uncommon_t3' },
      { id: 'ancient_wraith', name: '远古怨灵', power: 10000, element: null, exp: 1000, spirit_stone_range: [150, 400], role: 'dps', drop_table: 'uncommon_t3' },
    ],
    boss: { id: 'ruin_guardian', name: '遗迹守护者', power: 22000, element: 'earth', exp: 12000, spirit_stone_range: [2000, 5000], role: 'boss', drop_table: 'boss_t3' },
  },
  {
    id: 'dark_sea', name: '幽冥海', tier: 4,
    realm_required: '元婴初期', recommended_power: 55,
    element: 'water', description: '深邃黑暗的海域，水系装备圣地',
    monsters: [
      { id: 'sea_serpent', name: '海蛟', power: 18000, element: 'water', exp: 2000, spirit_stone_range: [300, 800], role: 'balanced', drop_table: 'common_t4' },
      { id: 'ghost_fish', name: '幽灵鱼', power: 22000, element: 'water', exp: 2500, spirit_stone_range: [300, 800], role: 'balanced', drop_table: 'common_t4' },
      { id: 'kraken_spawn', name: '墨海兽', power: 30000, element: 'water', exp: 3500, spirit_stone_range: [600, 1500], role: 'dps', drop_table: 'uncommon_t4' },
    ],
    boss: { id: 'dragon_turtle', name: '龙龟', power: 60000, element: 'water', exp: 30000, spirit_stone_range: [8000, 20000], role: 'boss', drop_table: 'boss_t4' },
  },
  {
    id: 'soul_forest', name: '噬魂林', tier: 4,
    realm_required: '元婴初期', recommended_power: 60,
    element: 'wood', description: '诡异的黑森林，藏有上古功法残卷',
    monsters: [
      { id: 'soul_tree', name: '噬魂树', power: 20000, element: 'wood', exp: 2200, spirit_stone_range: [300, 800], role: 'balanced', drop_table: 'common_t4' },
      { id: 'shadow_cat', name: '幽影猫', power: 25000, element: null, exp: 2800, spirit_stone_range: [300, 800], role: 'balanced', drop_table: 'common_t4' },
      { id: 'corpse_flower', name: '尸花', power: 32000, element: 'wood', exp: 3800, spirit_stone_range: [600, 1500], role: 'dps', drop_table: 'uncommon_t4' },
    ],
    boss: { id: 'soul_eater', name: '噬魂古树', power: 65000, element: 'wood', exp: 35000, spirit_stone_range: [8000, 20000], role: 'boss', drop_table: 'boss_t4' },
  },
  {
    id: 'desert_of_sands', name: '流沙大漠', tier: 4,
    realm_required: '元婴中期', recommended_power: 65,
    element: 'earth', description: '无尽沙漠，稀有矿物和土系材料产地',
    monsters: [
      { id: 'sand_scorpion', name: '沙蝎王', power: 24000, element: 'earth', exp: 2600, spirit_stone_range: [300, 800], role: 'balanced', drop_table: 'common_t4' },
      { id: 'dust_wyrm', name: '沙虫', power: 30000, element: 'earth', exp: 3200, spirit_stone_range: [300, 800], role: 'balanced', drop_table: 'common_t4' },
      { id: 'mirage_fox', name: '蜃狐', power: 38000, element: 'fire', exp: 4200, spirit_stone_range: [600, 1500], role: 'dps', drop_table: 'uncommon_t4' },
    ],
    boss: { id: 'sand_emperor', name: '流沙帝蝎', power: 80000, element: 'earth', exp: 40000, spirit_stone_range: [8000, 20000], role: 'boss', drop_table: 'boss_t4' },
  },
  {
    id: 'purgatory', name: '九幽炼狱', tier: 5,
    realm_required: '化神初期', recommended_power: 80,
    element: 'fire', description: '炼狱之地，极品装备产出',
    monsters: [
      { id: 'hell_guard', name: '狱卒', power: 90000, element: 'fire', exp: 10000, spirit_stone_range: [1000, 3000], role: 'balanced', drop_table: 'common_t5' },
      { id: 'demon_soldier', name: '魔兵', power: 110000, element: 'metal', exp: 12000, spirit_stone_range: [2000, 6000], role: 'dps', drop_table: 'uncommon_t5' },
      { id: 'bone_dragon', name: '骨龙', power: 150000, element: 'fire', exp: 18000, spirit_stone_range: [5000, 12000], role: 'dps', drop_table: 'rare_t5' },
    ],
    boss: { id: 'purgatory_lord', name: '炼狱魔君', power: 350000, element: 'fire', exp: 100000, spirit_stone_range: [30000, 80000], role: 'boss', drop_table: 'boss_t5' },
  },
  {
    id: 'frozen_abyss', name: '寒渊冰窟', tier: 5,
    realm_required: '化神初期', recommended_power: 85,
    element: 'water', description: '极寒深渊，冰系套装部件产出地',
    monsters: [
      { id: 'frost_giant', name: '霜巨人', power: 95000, element: 'water', exp: 11000, spirit_stone_range: [1000, 3000], role: 'balanced', drop_table: 'common_t5' },
      { id: 'ice_wraith', name: '冰魄', power: 120000, element: 'water', exp: 14000, spirit_stone_range: [2000, 6000], role: 'dps', drop_table: 'uncommon_t5' },
      { id: 'blizzard_wyrm', name: '冰蛟龙', power: 160000, element: 'water', exp: 19000, spirit_stone_range: [5000, 12000], role: 'dps', drop_table: 'rare_t5' },
    ],
    boss: { id: 'ice_emperor', name: '寒渊冰帝', power: 380000, element: 'water', exp: 110000, spirit_stone_range: [30000, 80000], role: 'boss', drop_table: 'boss_t5' },
  },
  {
    id: 'demon_battlefield', name: '魔域战场', tier: 5,
    realm_required: '化神中期', recommended_power: 95,
    element: null, description: '人魔大战遗址，各属性功法均有掉落',
    monsters: [
      { id: 'demon_general', name: '魔将', power: 130000, element: 'fire', exp: 15000, spirit_stone_range: [2000, 6000], role: 'dps', drop_table: 'uncommon_t5' },
      { id: 'dark_knight', name: '暗骑士', power: 160000, element: 'metal', exp: 18000, spirit_stone_range: [2000, 6000], role: 'dps', drop_table: 'uncommon_t5' },
      { id: 'war_demon', name: '战魔', power: 200000, element: null, exp: 22000, spirit_stone_range: [5000, 12000], role: 'dps', drop_table: 'rare_t5' },
    ],
    boss: { id: 'demon_commander', name: '魔帅', power: 450000, element: null, exp: 150000, spirit_stone_range: [30000, 80000], role: 'boss', drop_table: 'boss_t5' },
  },
  {
    id: 'tribulation_wasteland', name: '天劫荒原', tier: 6,
    realm_required: '渡劫初期', recommended_power: 110,
    element: 'metal', description: '天劫频繁降临的荒原，顶级装备产出',
    monsters: [
      { id: 'thunder_beast', name: '雷兽', power: 450000, element: 'metal', exp: 50000, spirit_stone_range: [5000, 15000], role: 'balanced', drop_table: 'common_t6' },
      { id: 'void_creature', name: '虚空生物', power: 550000, element: null, exp: 65000, spirit_stone_range: [8000, 25000], role: 'speed', drop_table: 'uncommon_t6' },
      { id: 'fallen_immortal', name: '堕仙', power: 700000, element: 'metal', exp: 85000, spirit_stone_range: [15000, 40000], role: 'dps', drop_table: 'rare_t6' },
    ],
    boss: { id: 'thunder_emperor', name: '雷帝', power: 1500000, element: 'metal', exp: 500000, spirit_stone_range: [100000, 300000], role: 'boss', drop_table: 'boss_t6' },
  },
  {
    id: 'void_rift', name: '虚空裂缝', tier: 6,
    realm_required: '渡劫初期', recommended_power: 120,
    element: null, description: '时空裂缝中的异度空间，顶级功法产出',
    monsters: [
      { id: 'void_stalker', name: '虚空猎手', power: 480000, element: null, exp: 55000, spirit_stone_range: [5000, 15000], role: 'balanced', drop_table: 'common_t6' },
      { id: 'time_phantom', name: '时光幻影', power: 580000, element: null, exp: 70000, spirit_stone_range: [8000, 25000], role: 'speed', drop_table: 'uncommon_t6' },
      { id: 'chaos_elemental', name: '混沌元素', power: 750000, element: null, exp: 90000, spirit_stone_range: [15000, 40000], role: 'dps', drop_table: 'rare_t6' },
    ],
    boss: { id: 'void_lord', name: '虚空之主', power: 1600000, element: null, exp: 550000, spirit_stone_range: [100000, 300000], role: 'boss', drop_table: 'boss_t6' },
  },
  // T7-T10 怪物 Power 平滑调整: 缓解飞升期断崖
  // T7: ×0.70, T8: ×0.65, T9: ×0.60, T10: ×0.50
  {
    id: 'celestial_mountain', name: '昆仑仙境', tier: 7,
    realm_required: '大乘初期', recommended_power: 140,
    element: 'metal', description: '传说中的仙山，仙器级装备掉率极高',
    monsters: [
      { id: 'celestial_crane', name: '仙鹤', power: 1260000, element: 'metal', exp: 200000, spirit_stone_range: [30000, 80000], role: 'balanced', drop_table: 'common_t7' },
      { id: 'jade_lion', name: '玉麒麟', power: 1540000, element: 'earth', exp: 250000, spirit_stone_range: [50000, 150000], role: 'dps', drop_table: 'uncommon_t7' },
      { id: 'golden_dragon', name: '金龙', power: 1960000, element: 'metal', exp: 320000, spirit_stone_range: [80000, 250000], role: 'dps', drop_table: 'rare_t7' },
    ],
    boss: { id: 'kunlun_elder', name: '昆仑仙尊', power: 4200000, element: 'metal', exp: 2000000, spirit_stone_range: [500000, 1500000], role: 'boss', drop_table: 'boss_t7' },
  },
  {
    id: 'nether_realm', name: '幽冥黄泉', tier: 7,
    realm_required: '大乘中期', recommended_power: 155,
    element: 'water', description: '生死之间的黄泉路，高阶套装产出',
    monsters: [
      { id: 'nether_guard', name: '冥卫', power: 1750000, element: 'water', exp: 280000, spirit_stone_range: [30000, 80000], role: 'balanced', drop_table: 'common_t7' },
      { id: 'soul_reaper', name: '夺魂使', power: 2100000, element: null, exp: 350000, spirit_stone_range: [50000, 150000], role: 'dps', drop_table: 'uncommon_t7' },
      { id: 'death_dragon', name: '冥龙', power: 2800000, element: 'water', exp: 450000, spirit_stone_range: [80000, 250000], role: 'dps', drop_table: 'rare_t7' },
    ],
    boss: { id: 'nether_king', name: '冥王', power: 6300000, element: 'water', exp: 3000000, spirit_stone_range: [500000, 1500000], role: 'boss', drop_table: 'boss_t7' },
  },
  {
    id: 'immortal_realm', name: '天界仙宫', tier: 8,
    realm_required: '飞升·散仙', recommended_power: 170,
    element: null, description: '飞升后的仙界，太古神器掉落之地',
    monsters: [
      { id: 'immortal_soldier', name: '天兵', power: 5200000, element: 'metal', exp: 800000, spirit_stone_range: [200000, 500000], role: 'balanced', drop_table: 'common_t8' },
      { id: 'divine_beast', name: '神兽', power: 6500000, element: null, exp: 1000000, spirit_stone_range: [400000, 1000000], role: 'dps', drop_table: 'uncommon_t8' },
      { id: 'ancient_god', name: '远古神灵', power: 9750000, element: null, exp: 1500000, spirit_stone_range: [800000, 2000000], role: 'dps', drop_table: 'rare_t8' },
    ],
    boss: { id: 'heavenly_lord', name: '天帝', power: 19500000, element: null, exp: 10000000, spirit_stone_range: [2000000, 5000000], role: 'boss', drop_table: 'boss_t8' },
  },
  {
    id: 'chaos_origin', name: '混沌本源', tier: 8,
    realm_required: '飞升·金仙', recommended_power: 180,
    element: null, description: '万物起源之地，终极历练场',
    monsters: [
      { id: 'chaos_beast', name: '混沌兽', power: 11700000, element: null, exp: 2000000, spirit_stone_range: [200000, 500000], role: 'balanced', drop_table: 'common_t8' },
      { id: 'primordial_fiend', name: '太古凶兽', power: 14300000, element: null, exp: 2500000, spirit_stone_range: [800000, 2000000], role: 'dps', drop_table: 'rare_t8' },
      { id: 'dao_phantom', name: '道之幻影', power: 18200000, element: null, exp: 3200000, spirit_stone_range: [800000, 2000000], role: 'dps', drop_table: 'rare_t8' },
    ],
    boss: { id: 'chaos_lord', name: '混沌之主', power: 32500000, element: null, exp: 20000000, spirit_stone_range: [2000000, 5000000], role: 'boss', drop_table: 'boss_t8' },
  },
  // ===== T9 地图 =====
  {
    id: 'void_holy_land', name: '太虚圣境', tier: 9,
    realm_required: '飞升·太乙金仙', recommended_power: 185,
    element: 'metal', description: '圣者修行之地,剑意纵横',
    monsters: [
      { id: 'void_knight', name: '虚空剑侍', power: 36000000, element: 'metal', exp: 5000000, spirit_stone_range: [500000, 1200000], role: 'balanced', drop_table: 'common_t9' },
      { id: 'holy_guardian', name: '圣境守护', power: 45000000, element: 'earth', exp: 6500000, spirit_stone_range: [500000, 1200000], role: 'tank', drop_table: 'common_t9' },
      { id: 'celestial_phoenix', name: '天凤', power: 54000000, element: 'fire', exp: 8000000, spirit_stone_range: [1000000, 2500000], role: 'dps', drop_table: 'uncommon_t9' },
    ],
    boss: { id: 'void_emperor', name: '太虚帝君', power: 90000000, element: 'metal', exp: 40000000, spirit_stone_range: [5000000, 12000000], role: 'boss', drop_table: 'boss_t9' },
  },
  {
    id: 'hongmeng_realm', name: '鸿蒙秘境', tier: 9,
    realm_required: '飞升·太乙金仙', recommended_power: 190,
    element: 'wood', description: '鸿蒙未开之地,灵气最浓',
    monsters: [
      { id: 'hongmeng_beast', name: '鸿蒙异兽', power: 42000000, element: 'wood', exp: 6000000, spirit_stone_range: [500000, 1200000], role: 'balanced', drop_table: 'common_t9' },
      { id: 'origin_spirit', name: '本源精灵', power: 51000000, element: 'water', exp: 7500000, spirit_stone_range: [500000, 1200000], role: 'balanced', drop_table: 'common_t9' },
      { id: 'primordial_dragon', name: '始祖龙', power: 60000000, element: null, exp: 9000000, spirit_stone_range: [1500000, 3000000], role: 'dps', drop_table: 'uncommon_t9' },
    ],
    boss: { id: 'hongmeng_lord', name: '鸿蒙道尊', power: 108000000, element: null, exp: 50000000, spirit_stone_range: [6000000, 15000000], role: 'boss', drop_table: 'boss_t9' },
  },
  {
    id: 'myriad_battlefield', name: '万界战场', tier: 9,
    realm_required: '飞升·太乙金仙', recommended_power: 195,
    element: null, description: '万界交锋之地,最强者汇聚',
    monsters: [
      { id: 'realm_warrior', name: '界域战士', power: 48000000, element: 'fire', exp: 7000000, spirit_stone_range: [600000, 1500000], role: 'balanced', drop_table: 'common_t9' },
      { id: 'void_assassin', name: '虚空刺客', power: 57000000, element: null, exp: 8500000, spirit_stone_range: [600000, 1500000], role: 'speed', drop_table: 'uncommon_t9' },
      { id: 'ancient_titan', name: '远古泰坦', power: 72000000, element: 'earth', exp: 10000000, spirit_stone_range: [2000000, 4000000], role: 'tank', drop_table: 'uncommon_t9' },
    ],
    boss: { id: 'war_god', name: '万界战神', power: 120000000, element: null, exp: 60000000, spirit_stone_range: [8000000, 20000000], role: 'boss', drop_table: 'boss_t9' },
  },
  // ===== T10 地图 =====
  {
    id: 'dao_trial', name: '天道试炼', tier: 10,
    realm_required: '飞升·大罗金仙', recommended_power: 198,
    element: null, description: '天道考验,唯有至强者方能通过',
    monsters: [
      { id: 'dao_puppet', name: '天道傀儡', power: 75000000, element: null, exp: 15000000, spirit_stone_range: [2000000, 5000000], role: 'balanced', drop_table: 'common_t10' },
      { id: 'rule_enforcer', name: '规则执行者', power: 100000000, element: null, exp: 20000000, spirit_stone_range: [2000000, 5000000], role: 'dps', drop_table: 'uncommon_t10' },
      { id: 'fate_weaver', name: '命运织者', power: 125000000, element: null, exp: 25000000, spirit_stone_range: [5000000, 10000000], role: 'dps', drop_table: 'uncommon_t10' },
    ],
    boss: { id: 'dao_avatar', name: '天道化身', power: 250000000, element: null, exp: 100000000, spirit_stone_range: [20000000, 50000000], role: 'boss', drop_table: 'boss_t10' },
  },
  {
    id: 'eternal_peak', name: '永恒之巅', tier: 10,
    realm_required: '飞升·大罗金仙', recommended_power: 200,
    element: null, description: '万界之巅,游戏终极地图',
    monsters: [
      { id: 'eternal_guardian', name: '永恒守卫', power: 100000000, element: 'metal', exp: 20000000, spirit_stone_range: [3000000, 8000000], role: 'balanced', drop_table: 'common_t10' },
      { id: 'time_lord', name: '时间领主', power: 150000000, element: 'water', exp: 30000000, spirit_stone_range: [3000000, 8000000], role: 'dps', drop_table: 'uncommon_t10' },
      { id: 'creation_god', name: '创世之灵', power: 200000000, element: null, exp: 40000000, spirit_stone_range: [8000000, 20000000], role: 'dps', drop_table: 'uncommon_t10' },
    ],
    boss: { id: 'eternal_one', name: '永恒之主', power: 400000000, element: null, exp: 200000000, spirit_stone_range: [50000000, 100000000], role: 'boss', drop_table: 'boss_t10' },
  },
];

// ========== 初始技能 ==========
export const STARTER_SKILLS: SkillData[] = [
  { id: 'basic_sword', name: '基础剑法', rarity: 'white', element: null, multiplier: 1.0, type: 'active', description: '造成100%灵力伤害', color: '#CCCCCC' },
];

// ========== 境界属性加成 ==========
// 每个境界提供: 固定值加成 + 百分比加成
export interface RealmBonus {
  hp: number;       // 固定气血
  atk: number;      // 固定攻击
  def: number;      // 固定防御
  spd: number;      // 固定身法
  hp_pct: number;   // 气血百分比
  atk_pct: number;  // 攻击百分比
  def_pct: number;  // 防御百分比
  crit_rate: number; // 暴击率(绝对值)
  crit_dmg: number;  // 暴击伤害(绝对值)
  dodge: number;     // 闪避(绝对值)
}

// 按 realm_tier 索引, 每个大境界突破后的累计加成
export const REALM_BONUSES: Record<number, RealmBonus> = {
  1: { hp: 0,     atk: 0,    def: 0,   spd: 0,   hp_pct: 0,   atk_pct: 0,   def_pct: 0,   crit_rate: 0,    crit_dmg: 0,   dodge: 0 },
  2: { hp: 200,   atk: 15,   def: 10,  spd: 8,   hp_pct: 5,   atk_pct: 5,   def_pct: 5,   crit_rate: 0.01, crit_dmg: 0.05, dodge: 0 },
  3: { hp: 600,   atk: 50,   def: 30,  spd: 25,  hp_pct: 12,  atk_pct: 12,  def_pct: 10,  crit_rate: 0.02, crit_dmg: 0.10, dodge: 0.01 },
  4: { hp: 1500,  atk: 150,  def: 80,  spd: 60,  hp_pct: 20,  atk_pct: 20,  def_pct: 18,  crit_rate: 0.04, crit_dmg: 0.20, dodge: 0.02 },
  5: { hp: 4000,  atk: 400,  def: 220, spd: 150, hp_pct: 30,  atk_pct: 30,  def_pct: 25,  crit_rate: 0.06, crit_dmg: 0.30, dodge: 0.03 },
  6: { hp: 10000, atk: 1000, def: 550, spd: 350, hp_pct: 45,  atk_pct: 45,  def_pct: 38,  crit_rate: 0.08, crit_dmg: 0.45, dodge: 0.04 },
  7: { hp: 25000, atk: 2500, def: 1400,spd: 800, hp_pct: 65,  atk_pct: 65,  def_pct: 55,  crit_rate: 0.10, crit_dmg: 0.60, dodge: 0.05 },
  8: { hp: 60000, atk: 6000, def: 3500,spd: 2000,hp_pct: 100, atk_pct: 100, def_pct: 80,  crit_rate: 0.15, crit_dmg: 0.80, dodge: 0.06 },
};

// 小境界(stage)额外倍率: 每阶在大境界基础上叠加 stage * 10% 的百分比加成
export function getRealmStageMultiplier(stage: number): number {
  return 1 + (stage - 1) * 0.10;
}

export function getRealmBonusAtLevel(tier: number, stage: number): RealmBonus {
  const base = REALM_BONUSES[tier] || REALM_BONUSES[1];
  const mul = getRealmStageMultiplier(stage);
  return {
    hp: Math.floor(base.hp * mul),
    atk: Math.floor(base.atk * mul),
    def: Math.floor(base.def * mul),
    spd: Math.floor(base.spd * mul),
    hp_pct: Math.round(base.hp_pct * mul * 10) / 10,
    atk_pct: Math.round(base.atk_pct * mul * 10) / 10,
    def_pct: Math.round(base.def_pct * mul * 10) / 10,
    crit_rate: Math.round(base.crit_rate * mul * 1000) / 1000,
    crit_dmg: Math.round(base.crit_dmg * mul * 100) / 100,
    dodge: Math.round(base.dodge * mul * 1000) / 1000,
  };
}

// ========== 功法槽位按境界解锁 ==========
// 渐进式解锁: 练气 1+1+1 → 筑基 1+2+2 → 金丹 1+2+3 → 元婴+ 1+3+3
export interface SkillSlotLimits {
  active: number;   // 主修槽位数
  divine: number;   // 神通槽位数
  passive: number;  // 被动槽位数
}

export function getSkillSlotLimits(realmTier: number): SkillSlotLimits {
  if (realmTier <= 1) return { active: 1, divine: 1, passive: 1 }; // 练气
  if (realmTier === 2) return { active: 1, divine: 2, passive: 2 }; // 筑基
  if (realmTier === 3) return { active: 1, divine: 2, passive: 3 }; // 金丹
  return { active: 1, divine: 3, passive: 3 }; // 元婴+
}

// ========== 境界名格式化 ==========
export function getRealmName(tier: number, stage: number): string {
  const t = REALM_TIERS.find(r => r.tier === tier);
  if (!t) return '未知';
  if (tier === 8) {
    const names = REALM_STAGE_NAMES[8];
    return names[Math.min(stage - 1, names.length - 1)] || t.realm;
  }
  if (t.stages <= 3) {
    const stageNames = ['初期', '中期', '后期'];
    return `${t.realm}${stageNames[Math.min(stage - 1, 2)]}`;
  }
  return `${t.realm}${stage === 10 ? '圆满' : stage + '层'}`;
}

// ========== 修为需求公式 ==========
// 练气期: 线性快速突破（爽感期）
// 筑基+: 几何增长（平缓曲线，指数从 1.6 降至 1.4 避免后期断崖）
export function getExpRequired(tier: number, stage: number): number {
  const t = REALM_TIERS.find(r => r.tier === tier);
  if (!t) return Infinity;
  if (tier === 1) return Math.floor(50 * Math.pow(stage, 1.2));
  return Math.floor(100 * t.exp_multiplier * Math.pow(stage + 1, 1.4));
}

// ========== 根据角色境界获取可用地图 ==========
export function getUnlockedMaps(tier: number, stage: number): MapData[] {
  // 简化的解锁逻辑：tier匹配或低于当前tier的地图都解锁
  return MAPS.filter(m => {
    if (m.tier < tier) return true;
    if (m.tier === tier) {
      // 同tier需要对应stage
      if (m.tier <= 2) return true; // T1-T2只看tier
      return true; // 简化：同tier全解锁
    }
    return false;
  });
}

// ========== 数字格式化 ==========
export function formatNumber(n: number): string {
  return String(Math.floor(n));
}
