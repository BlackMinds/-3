/** 妖兽图鉴名录（万界妖谱）—— 80 条精选 T5+ 妖兽 + 星级/加成定义 */

// ========== 类型定义 ==========
export type PokedexCategory = 'boss' | 'rare' | 'uncommon';
export type PokedexElement = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | null;

export interface PokedexEntry {
  mapKey: string;        // ALL_MAPS 的 key
  name: string;          // ALL_MAPS[mapKey].monsters[].name 或 .boss.name
  tier: number;          // 5..18
  element: PokedexElement;
  power: number;         // 与 ALL_MAPS 一致
  role: string;          // 'boss' | 'dps' | 'speed' | 'tank' 等，与 ALL_MAPS 一致
  category: PokedexCategory;
  displayName?: string;  // 重名怪物的产地后缀展示名，如 '虚空之主·虚空裂域'
}

export interface PokedexBonus {
  hpPct?: number;
  atkPct?: number;
  defPct?: number;
  critDmg?: number;
}

// ========== 星级 / 加成常量 ==========

// 星级阈值：累计击杀达到 [1, 50, 200, 1000] 时分别升到 1/2/3/4 星
export const POKEDEX_STAR_THRESHOLDS = [1, 50, 200, 1000] as const;

// 每星加成（方案 B 强档）：1星 hp / 2星 atk / 3星 def / 4星 critDmg
// 80 条全满 4★ 上限：血量/攻击/防御 各 +80%，会心伤害 +88%
export const POKEDEX_BONUS_PER_STAR: Record<1 | 2 | 3 | 4, PokedexBonus> = {
  1: { hpPct: 0.01 },
  2: { atkPct: 0.01 },
  3: { defPct: 0.01 },
  4: { critDmg: 0.011 },
};

// 满星额外奖励（里程碑触发后永久加成，Phase 5 接入）
export const POKEDEX_MAX_STAR_BONUS: PokedexBonus = {
  hpPct: 0.01, atkPct: 0.01, defPct: 0.01, critDmg: 0.01,
};

// ========== 名录数据（30 boss + 10 rare + 40 uncommon = 80） ==========

export const POKEDEX_ROSTER: PokedexEntry[] = [
  // ===== T5+ Boss（30 条） =====
  { mapKey: 'purgatory',            name: '炼狱魔君',   tier: 5,  element: 'fire',  power: 35_000,        role: 'boss', category: 'boss' },
  { mapKey: 'frozen_abyss',         name: '寒渊冰帝',   tier: 5,  element: 'water', power: 38_000,        role: 'boss', category: 'boss' },
  { mapKey: 'demon_battlefield',    name: '魔帅',       tier: 5,  element: null,    power: 45_000,        role: 'boss', category: 'boss' },
  { mapKey: 'tribulation_wasteland',name: '雷帝',       tier: 6,  element: 'metal', power: 90_000,        role: 'boss', category: 'boss' },
  { mapKey: 'void_rift',            name: '虚空之主',   tier: 6,  element: null,    power: 96_000,        role: 'boss', category: 'boss', displayName: '虚空之主·虚空裂域' },
  { mapKey: 'celestial_mountain',   name: '昆仑仙尊',   tier: 7,  element: 'metal', power: 120_000,       role: 'boss', category: 'boss' },
  { mapKey: 'nether_realm',         name: '冥王',       tier: 7,  element: 'water', power: 180_000,       role: 'boss', category: 'boss' },
  { mapKey: 'immortal_realm',       name: '天帝',       tier: 8,  element: null,    power: 300_000,       role: 'boss', category: 'boss' },
  { mapKey: 'chaos_origin',         name: '混沌之主',   tier: 8,  element: null,    power: 500_000,       role: 'boss', category: 'boss' },
  { mapKey: 'void_holy_land',       name: '太虚帝君',   tier: 9,  element: 'metal', power: 600_000,       role: 'boss', category: 'boss' },
  { mapKey: 'hongmeng_realm',       name: '鸿蒙道尊',   tier: 9,  element: null,    power: 720_000,       role: 'boss', category: 'boss' },
  { mapKey: 'myriad_battlefield',   name: '万界战神',   tier: 9,  element: null,    power: 800_000,       role: 'boss', category: 'boss' },
  { mapKey: 'dao_trial',            name: '天道化身',   tier: 10, element: null,    power: 750_000,       role: 'boss', category: 'boss' },
  { mapKey: 'eternal_peak',         name: '永恒之主',   tier: 10, element: null,    power: 1_200_000,     role: 'boss', category: 'boss' },
  { mapKey: 'primal_chaos_sea',     name: '鸿蒙帝君',   tier: 11, element: null,    power: 4_500_000,     role: 'boss', category: 'boss' },
  { mapKey: 'nine_heavens_court',   name: '九霄玉帝',   tier: 11, element: 'metal', power: 5_500_000,     role: 'boss', category: 'boss' },
  { mapKey: 'eternal_void',         name: '虚空之主',   tier: 12, element: null,    power: 16_000_000,    role: 'boss', category: 'boss', displayName: '虚空之主·永恒虚空' },
  { mapKey: 'genesis_realm',        name: '创世道祖',   tier: 12, element: null,    power: 25_000_000,    role: 'boss', category: 'boss' },
  { mapKey: 'astral_dao_field',     name: '天宇道君',   tier: 13, element: 'metal', power: 60_000_000,    role: 'boss', category: 'boss' },
  { mapKey: 'myriad_origin_void',   name: '万源道祖',   tier: 13, element: null,    power: 70_000_000,    role: 'boss', category: 'boss' },
  { mapKey: 'causality_sea',        name: '因果天尊',   tier: 14, element: 'water', power: 180_000_000,   role: 'boss', category: 'boss' },
  { mapKey: 'spacetime_rift',       name: '时空之主',   tier: 14, element: null,    power: 220_000_000,   role: 'boss', category: 'boss' },
  { mapKey: 'genesis_dawn',         name: '初辰道神',   tier: 15, element: null,    power: 550_000_000,   role: 'boss', category: 'boss' },
  { mapKey: 'myriad_dao_end',       name: '终焉道祖',   tier: 15, element: null,    power: 700_000_000,   role: 'boss', category: 'boss' },
  { mapKey: 'primal_dao_origin',    name: '洪荒初道祖', tier: 16, element: null,    power: 1_400_000_000, role: 'boss', category: 'boss' },
  { mapKey: 'celestial_dao_dawn',   name: '天道初辰',   tier: 16, element: null,    power: 1_800_000_000, role: 'boss', category: 'boss' },
  { mapKey: 'hongjun_dao_field',    name: '鸿钧道君',   tier: 17, element: null,    power: 2_400_000_000, role: 'boss', category: 'boss' },
  { mapKey: 'heavenly_extreme',     name: '天极道祖',   tier: 17, element: null,    power: 3_000_000_000, role: 'boss', category: 'boss' },
  { mapKey: 'wuji_dao_realm',       name: '无极道祖',   tier: 18, element: null,    power: 4_500_000_000, role: 'boss', category: 'boss' },
  { mapKey: 'beyond_chaos',         name: '混沌之外',   tier: 18, element: null,    power: 6_000_000_000, role: 'boss', category: 'boss' },

  // ===== T5-T8 Rare（10 条） =====
  { mapKey: 'purgatory',            name: '骨龙',       tier: 5,  element: 'fire',  power: 15_000,        role: 'dps',  category: 'rare' },
  { mapKey: 'frozen_abyss',         name: '冰蛟龙',     tier: 5,  element: 'water', power: 16_000,        role: 'dps',  category: 'rare' },
  { mapKey: 'demon_battlefield',    name: '战魔',       tier: 5,  element: null,    power: 20_000,        role: 'dps',  category: 'rare' },
  { mapKey: 'tribulation_wasteland',name: '堕仙',       tier: 6,  element: 'metal', power: 42_000,        role: 'dps',  category: 'rare' },
  { mapKey: 'void_rift',            name: '混沌元素',   tier: 6,  element: null,    power: 45_000,        role: 'dps',  category: 'rare' },
  { mapKey: 'celestial_mountain',   name: '金龙',       tier: 7,  element: 'metal', power: 56_000,        role: 'dps',  category: 'rare' },
  { mapKey: 'nether_realm',         name: '冥龙',       tier: 7,  element: 'water', power: 80_000,        role: 'dps',  category: 'rare' },
  { mapKey: 'immortal_realm',       name: '远古神灵',   tier: 8,  element: null,    power: 150_000,       role: 'dps',  category: 'rare' },
  { mapKey: 'chaos_origin',         name: '太古凶兽',   tier: 8,  element: null,    power: 220_000,       role: 'dps',  category: 'rare' },
  { mapKey: 'chaos_origin',         name: '道之幻影',   tier: 8,  element: null,    power: 280_000,       role: 'dps',  category: 'rare' },

  // ===== T9-T18 Uncommon（40 条） =====
  { mapKey: 'void_holy_land',       name: '天凤',       tier: 9,  element: 'fire',  power: 360_000,       role: 'dps',   category: 'uncommon' },
  { mapKey: 'hongmeng_realm',       name: '始祖龙',     tier: 9,  element: null,    power: 400_000,       role: 'dps',   category: 'uncommon' },
  { mapKey: 'myriad_battlefield',   name: '虚空刺客',   tier: 9,  element: null,    power: 380_000,       role: 'speed', category: 'uncommon' },
  { mapKey: 'myriad_battlefield',   name: '远古泰坦',   tier: 9,  element: 'earth', power: 480_000,       role: 'tank',  category: 'uncommon' },
  { mapKey: 'dao_trial',            name: '规则执行者', tier: 10, element: null,    power: 300_000,       role: 'dps',   category: 'uncommon' },
  { mapKey: 'dao_trial',            name: '命运织者',   tier: 10, element: null,    power: 375_000,       role: 'dps',   category: 'uncommon' },
  { mapKey: 'eternal_peak',         name: '时间领主',   tier: 10, element: 'water', power: 450_000,       role: 'dps',   category: 'uncommon' },
  { mapKey: 'eternal_peak',         name: '创世之灵',   tier: 10, element: null,    power: 500_000,       role: 'dps',   category: 'uncommon' },
  { mapKey: 'primal_chaos_sea',     name: '本源龙神',   tier: 11, element: null,    power: 1_600_000,     role: 'dps',   category: 'uncommon' },
  { mapKey: 'primal_chaos_sea',     name: '虚空圣使',   tier: 11, element: 'metal', power: 1_850_000,     role: 'dps',   category: 'uncommon' },
  { mapKey: 'nine_heavens_court',   name: '星辰大将',   tier: 11, element: 'fire',  power: 2_000_000,     role: 'dps',   category: 'uncommon' },
  { mapKey: 'nine_heavens_court',   name: '雷霆君主',   tier: 11, element: 'metal', power: 2_200_000,     role: 'dps',   category: 'uncommon' },
  { mapKey: 'eternal_void',         name: '永恒刺客',   tier: 12, element: null,    power: 6_000_000,     role: 'speed', category: 'uncommon' },
  { mapKey: 'eternal_void',         name: '本源毁灭者', tier: 12, element: 'fire',  power: 6_700_000,     role: 'dps',   category: 'uncommon' },
  { mapKey: 'genesis_realm',        name: '法则裁定者', tier: 12, element: null,    power: 8_500_000,     role: 'dps',   category: 'uncommon' },
  { mapKey: 'genesis_realm',        name: '终焉先知',   tier: 12, element: null,    power: 10_000_000,    role: 'dps',   category: 'uncommon' },
  { mapKey: 'astral_dao_field',     name: '星海掠者',   tier: 13, element: 'water', power: 18_000_000,    role: 'dps',   category: 'uncommon' },
  { mapKey: 'astral_dao_field',     name: '宙环先知',   tier: 13, element: null,    power: 23_000_000,    role: 'dps',   category: 'uncommon' },
  { mapKey: 'myriad_origin_void',   name: '本源剑灵',   tier: 13, element: 'metal', power: 20_000_000,    role: 'speed', category: 'uncommon' },
  { mapKey: 'myriad_origin_void',   name: '本源终焉',   tier: 13, element: 'fire',  power: 26_000_000,    role: 'dps',   category: 'uncommon' },
  { mapKey: 'causality_sea',        name: '命运刺客',   tier: 14, element: null,    power: 55_000_000,    role: 'speed', category: 'uncommon' },
  { mapKey: 'causality_sea',        name: '因果裁决',   tier: 14, element: null,    power: 70_000_000,    role: 'dps',   category: 'uncommon' },
  { mapKey: 'spacetime_rift',       name: '空裂幽影',   tier: 14, element: null,    power: 62_000_000,    role: 'dps',   category: 'uncommon' },
  { mapKey: 'spacetime_rift',       name: '裂界吞噬者', tier: 14, element: 'fire',  power: 78_000_000,    role: 'dps',   category: 'uncommon' },
  { mapKey: 'genesis_dawn',         name: '创世圣使',   tier: 15, element: 'metal', power: 170_000_000,   role: 'dps',   category: 'uncommon' },
  { mapKey: 'genesis_dawn',         name: '初道化形',   tier: 15, element: null,    power: 210_000_000,   role: 'dps',   category: 'uncommon' },
  { mapKey: 'myriad_dao_end',       name: '终焉剑魄',   tier: 15, element: 'metal', power: 200_000_000,   role: 'speed', category: 'uncommon' },
  { mapKey: 'myriad_dao_end',       name: '末劫呼唤者', tier: 15, element: 'fire',  power: 260_000_000,   role: 'dps',   category: 'uncommon' },
  { mapKey: 'primal_dao_origin',    name: '初道使',     tier: 16, element: 'metal', power: 380_000_000,   role: 'speed', category: 'uncommon' },
  { mapKey: 'primal_dao_origin',    name: '洪荒道魂',   tier: 16, element: null,    power: 460_000_000,   role: 'dps',   category: 'uncommon' },
  { mapKey: 'celestial_dao_dawn',   name: '初道神将',   tier: 16, element: 'water', power: 430_000_000,   role: 'dps',   category: 'uncommon' },
  { mapKey: 'celestial_dao_dawn',   name: '道辰天将',   tier: 16, element: 'fire',  power: 560_000_000,   role: 'dps',   category: 'uncommon' },
  { mapKey: 'hongjun_dao_field',    name: '钧道使',     tier: 17, element: 'metal', power: 800_000_000,   role: 'speed', category: 'uncommon' },
  { mapKey: 'hongjun_dao_field',    name: '钧道天尊',   tier: 17, element: null,    power: 950_000_000,   role: 'dps',   category: 'uncommon' },
  { mapKey: 'heavenly_extreme',     name: '极道使',     tier: 17, element: 'fire',  power: 900_000_000,   role: 'dps',   category: 'uncommon' },
  { mapKey: 'heavenly_extreme',     name: '天极天尊',   tier: 17, element: 'water', power: 1_150_000_000, role: 'dps',   category: 'uncommon' },
  { mapKey: 'wuji_dao_realm',       name: '无极道使',   tier: 18, element: 'metal', power: 1_500_000_000, role: 'speed', category: 'uncommon' },
  { mapKey: 'wuji_dao_realm',       name: '无极天尊',   tier: 18, element: null,    power: 1_800_000_000, role: 'dps',   category: 'uncommon' },
  { mapKey: 'beyond_chaos',         name: '终极道神',   tier: 18, element: 'water', power: 2_000_000_000, role: 'dps',   category: 'uncommon' },
  { mapKey: 'beyond_chaos',         name: '末劫之主',   tier: 18, element: null,    power: 2_500_000_000, role: 'dps',   category: 'uncommon' },
];

// ========== 索引 / 工具函数 ==========

/** entry_key 单一真相源：DB / 前端 / 战斗事件三端用同一规则 */
export function getEntryKey(mapKey: string, name: string): string {
  return `${mapKey}:${name}`;
}

/** 按 entry_key 索引的 Map（O(1) 查询） */
export const POKEDEX_BY_KEY: ReadonlyMap<string, PokedexEntry> = new Map(
  POKEDEX_ROSTER.map(e => [getEntryKey(e.mapKey, e.name), e])
);

/** 是否在图鉴名录内 */
export function isInRoster(mapKey: string, name: string): boolean {
  return POKEDEX_BY_KEY.has(getEntryKey(mapKey, name));
}

/** 累计击杀数 → 星级（0/1/2/3/4） */
export function getStarLevel(killCount: number): 0 | 1 | 2 | 3 | 4 {
  if (killCount >= POKEDEX_STAR_THRESHOLDS[3]) return 4;
  if (killCount >= POKEDEX_STAR_THRESHOLDS[2]) return 3;
  if (killCount >= POKEDEX_STAR_THRESHOLDS[1]) return 2;
  if (killCount >= POKEDEX_STAR_THRESHOLDS[0]) return 1;
  return 0;
}

/** 累计 N 颗星对应的总加成（叠加 1..stars 每一段） */
export function getBonusForStars(stars: 0 | 1 | 2 | 3 | 4): PokedexBonus {
  const out: PokedexBonus = { hpPct: 0, atkPct: 0, defPct: 0, critDmg: 0 };
  for (let s = 1; s <= stars; s++) {
    const seg = POKEDEX_BONUS_PER_STAR[s as 1 | 2 | 3 | 4];
    out.hpPct! += seg.hpPct ?? 0;
    out.atkPct! += seg.atkPct ?? 0;
    out.defPct! += seg.defPct ?? 0;
    out.critDmg! += seg.critDmg ?? 0;
  }
  return out;
}
