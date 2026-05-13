// 道侣礼制丹方 - 设计文档 3.3.4
// 11 个核心丹方，按性格分类，玩家在炼丹房"礼制"Tab 选择炼制

import type { Personality } from './companionData'

export type GiftRarity = 'low' | 'mid' | 'high' | 'top' | 'immortal'
// low=下品+2 / mid=中品+3 / high=上品+5 / top=极品+10 / immortal=仙品+20

export interface GiftRecipe {
  id: string
  name: string
  rarity: GiftRarity
  baseIntimacy: number               // 基础亲密度收益（不含品质系数）
  fitPersonality: Personality | 'all'  // 适配性格（'all' = 万能礼物）
  ingredients: { itemId: string; qty: number }[]
  spiritStoneCost: number
  unlockedBy: 'auto' | 'storyline' | 'finale_storyline' | 'qixi'
  // auto: 亲密度阶段自动解锁
  // storyline: 完成道侣专属剧情线某节点
  // finale_storyline: 极品丹方需完成最终章
  // qixi: 仅七夕活动期间限时解锁
}

export const GIFT_RECIPES: GiftRecipe[] = [
  // ---------- 下品 (low, +2) ----------
  {
    id: 'fruit_jam',
    name: '灵果蜜饯',
    rarity: 'low',
    baseIntimacy: 2,
    fitPersonality: 'all',
    ingredients: [
      { itemId: 'silk_flower', qty: 3 },
      { itemId: 'common_herb', qty: 2 },
    ],
    spiritStoneCost: 200,
    unlockedBy: 'auto',
  },
  {
    id: 'colorful_beads',
    name: '彩珠串',
    rarity: 'low',
    baseIntimacy: 2,
    fitPersonality: '俏皮',  // 通用但俏皮 +50%
    ingredients: [
      { itemId: 'silk_flower', qty: 3 },
      { itemId: 'metal_herb', qty: 2 },
    ],
    spiritStoneCost: 300,
    unlockedBy: 'auto',
  },

  // ---------- 中品 (mid, +3) ----------
  {
    id: 'peach_wine',
    name: '桃花酿',
    rarity: 'mid',
    baseIntimacy: 3,
    fitPersonality: '活泼',
    ingredients: [
      { itemId: 'butterfly_flower', qty: 5 },
      { itemId: 'fire_herb', qty: 3 },
    ],
    spiritStoneCost: 800,
    unlockedBy: 'auto',
  },
  {
    id: 'warm_jade_sachet',
    name: '温玉香囊',
    rarity: 'mid',
    baseIntimacy: 3,
    fitPersonality: '温柔',
    ingredients: [
      { itemId: 'butterfly_flower', qty: 3 },
      { itemId: 'earth_herb', qty: 3 },
    ],
    spiritStoneCost: 800,
    unlockedBy: 'auto',
  },
  {
    id: 'kiddy_beads',
    name: '童趣彩珠',
    rarity: 'mid',
    baseIntimacy: 3,
    fitPersonality: '俏皮',
    ingredients: [
      { itemId: 'butterfly_flower', qty: 5 },
      { itemId: 'common_herb', qty: 10 },
    ],
    spiritStoneCost: 600,
    unlockedBy: 'auto',
  },

  // ---------- 上品 (high, +5) ----------
  {
    id: 'frost_pendant',
    name: '寒玉佩',
    rarity: 'high',
    baseIntimacy: 5,
    fitPersonality: '冷艳',
    ingredients: [
      { itemId: 'moonlight_orchid', qty: 3 },
      { itemId: 'water_herb', qty: 5 },
    ],
    spiritStoneCost: 2000,
    unlockedBy: 'storyline',
  },
  {
    id: 'purple_gold_hairpin',
    name: '紫金钗',
    rarity: 'high',
    baseIntimacy: 5,
    fitPersonality: '高傲',
    ingredients: [
      { itemId: 'moonlight_orchid', qty: 5 },
      { itemId: 'metal_herb', qty: 5 },
    ],
    spiritStoneCost: 2500,
    unlockedBy: 'storyline',
  },
  {
    id: 'moonlight_pill',
    name: '月华丹',
    rarity: 'high',
    baseIntimacy: 5,
    fitPersonality: '冷艳',  // 通用但冷艳 +50%
    ingredients: [
      { itemId: 'moonlight_orchid', qty: 3 },
      { itemId: 'spirit_grass', qty: 1 },
    ],
    spiritStoneCost: 3000,
    unlockedBy: 'storyline',
  },

  // ---------- 极品 (top, +10) ----------
  {
    id: 'lotus_heart',
    name: '并蒂莲心',
    rarity: 'top',
    baseIntimacy: 10,
    fitPersonality: 'all',  // 万能 +50%
    ingredients: [
      { itemId: 'couple_lotus', qty: 1 },
      { itemId: 'moonlight_orchid', qty: 10 },
      { itemId: 'spirit_grass', qty: 5 },
    ],
    spiritStoneCost: 50000,
    unlockedBy: 'finale_storyline',
  },
  {
    id: 'mandarin_pendant',
    name: '鸳鸯玉佩',
    rarity: 'top',
    baseIntimacy: 10,
    fitPersonality: 'all',
    ingredients: [
      { itemId: 'couple_lotus', qty: 2 },
      { itemId: 'lifelong_grass', qty: 3 },
      { itemId: 'metal_herb', qty: 5 },
      { itemId: 'wood_herb', qty: 5 },
      { itemId: 'water_herb', qty: 5 },
      { itemId: 'fire_herb', qty: 5 },
      { itemId: 'earth_herb', qty: 5 },
    ],
    spiritStoneCost: 80000,
    unlockedBy: 'finale_storyline',
  },

  // ---------- 仙品 (immortal, +20) ----------
  {
    id: 'red_dust_hairpin',
    name: '红尘仙缘簪',
    rarity: 'immortal',
    baseIntimacy: 20,
    fitPersonality: 'all',  // 万能 +100%（特殊倍率运行时单独处理）
    ingredients: [
      { itemId: 'red_dust_flower', qty: 1 },
      { itemId: 'couple_lotus', qty: 10 },
      { itemId: 'lifelong_grass', qty: 20 },
      { itemId: 'spirit_grass', qty: 30 },
    ],
    spiritStoneCost: 500000,
    unlockedBy: 'qixi',
  },
]

export const GIFT_RECIPE_MAP: Record<string, GiftRecipe> = {}
for (const r of GIFT_RECIPES) GIFT_RECIPE_MAP[r.id] = r

// 仙品万能礼物加成（替代标准 1.5×）
export const IMMORTAL_GIFT_LOVE_MULTIPLIER = 2.0

// 计算赠礼的亲密度收益（礼物无品质，固定按 baseIntimacy × 反应系数）
export function calcGiftIntimacy(
  recipe: GiftRecipe,
  reaction: 'love' | 'dislike' | 'normal'
): number {
  if (reaction === 'dislike') return -3
  let multiplier = 1
  if (reaction === 'love') {
    multiplier = recipe.rarity === 'immortal' ? IMMORTAL_GIFT_LOVE_MULTIPLIER : 1.5
  }
  return Math.round(recipe.baseIntimacy * multiplier)
}
