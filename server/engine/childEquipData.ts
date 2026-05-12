// 子女装备配置 - design 5.6.2
// 4 槽位 / 6 品质 / 属性按子女等级 + 品质倍率生成
// 数值范围设计为玩家本体装备的 ~30%，确保子女不超过本体

import { rand } from '~/server/utils/random'

export type ChildSlot = 'weapon' | 'robe' | 'amulet1' | 'amulet2'
export type ChildRarity = 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'red'

export const RARITY_QUALITY_MUL: Record<ChildRarity, number> = {
  white: 1.0,
  green: 1.4,
  blue: 1.9,
  purple: 2.5,
  gold: 3.3,
  red: 4.5,
}

export const RARITY_DISPLAY: Record<ChildRarity, string> = {
  white: '凡品', green: '灵品', blue: '玄品', purple: '地品', gold: '天品', red: '仙品',
}

const NAMES_BY_SLOT: Record<ChildSlot, string[]> = {
  weapon: ['童子剑', '玉笛', '灵铃', '青锋', '稚刃'],
  robe:   ['童袍', '稚衣', '紫绫衫', '云纹袍'],
  amulet1:['平安符', '护身玉', '红绳结'],
  amulet2:['长命锁', '辟邪铃', '清心玉'],
}

const SLOT_NAMES: Record<ChildSlot, string> = {
  weapon: '主武器', robe: '法袍', amulet1: '饰品·上', amulet2: '饰品·下',
}

export function getSlotDisplay(slot: string): string {
  return SLOT_NAMES[slot as ChildSlot] || slot
}

// 主属性按 slot 决定：weapon=atk / robe=max_hp / amulet=def or spd 二选一
export function generateChildEquipment(slot: ChildSlot, rarity: ChildRarity, childLevel: number): {
  name: string
  slot: ChildSlot
  rarity: ChildRarity
  tier: number
  primary_stat: { stat: string; value: number }
  sub_stats: Array<{ stat: string; value: number }> | null
} {
  const mul = RARITY_QUALITY_MUL[rarity]
  const lvBase = Math.max(1, childLevel)

  let primary: { stat: string; value: number }
  if (slot === 'weapon') {
    primary = { stat: 'atk', value: Math.floor(5 * lvBase * mul) }
  } else if (slot === 'robe') {
    primary = { stat: 'max_hp', value: Math.floor(20 * lvBase * mul) }
  } else {
    // 饰品 50/50 防御 or 速度
    if (Math.random() < 0.5) {
      primary = { stat: 'def', value: Math.floor(3 * lvBase * mul) }
    } else {
      primary = { stat: 'spd', value: Math.floor(2 * lvBase * mul) }
    }
  }

  // 副词条数量按品质平铺（2026-05-12 小夏决策）：凡 1 / 灵 2 / 玄 3 / 地 4 / 天 5 / 仙 6
  const SUB_COUNT_BY_RARITY: Record<ChildRarity, number> = {
    white: 1, green: 2, blue: 3, purple: 4, gold: 5, red: 6,
  }
  const subCount = SUB_COUNT_BY_RARITY[rarity] || 0
  const sub_stats: Array<{ stat: string; value: number }> = []
  // 副词条候选池：4 基础 + 6 二级（10 种）
  const candPool = [
    'atk', 'def', 'max_hp', 'spd',
    'crit_rate', 'crit_dmg', 'dodge', 'lifesteal', 'resist_ctrl', 'spirit',
  ]
  // 同件装备避免出现 2 条相同 stat
  const usedStats = new Set<string>()
  for (let i = 0; i < subCount; i++) {
    let stat = ''
    for (let tries = 0; tries < 12; tries++) {
      const candidate = candPool[Math.floor(Math.random() * candPool.length)]
      if (!usedStats.has(candidate)) { stat = candidate; break }
    }
    if (!stat) break
    usedStats.add(stat)

    let value = 0
    if (stat === 'crit_rate')        value = +(rand(2, 5) * mul / 100).toFixed(4)    // 2-5% × mul
    else if (stat === 'crit_dmg')    value = +(rand(5, 15) * mul / 100).toFixed(4)   // 5-15%
    else if (stat === 'dodge')       value = +(rand(1, 3) * mul / 100).toFixed(4)    // 1-3%
    else if (stat === 'lifesteal')   value = +(rand(1, 3) * mul / 100).toFixed(4)    // 1-3%
    else if (stat === 'resist_ctrl') value = +(rand(2, 5) * mul / 100).toFixed(4)    // 2-5%
    else if (stat === 'spirit')      value = Math.floor(0.5 * lvBase * mul * 0.3)    // 神识：30% 同档基础
    else if (stat === 'atk')         value = Math.floor(2 * lvBase * mul * 0.3)
    else if (stat === 'def')         value = Math.floor(1.5 * lvBase * mul * 0.3)
    else if (stat === 'max_hp')      value = Math.floor(8 * lvBase * mul * 0.3)
    else if (stat === 'spd')         value = Math.floor(1 * lvBase * mul * 0.3)
    sub_stats.push({ stat, value })
  }

  const namePool = NAMES_BY_SLOT[slot]
  const baseName = namePool[Math.floor(Math.random() * namePool.length)]
  const name = `${RARITY_DISPLAY[rarity]}·${baseName}`

  return {
    name,
    slot,
    rarity,
    tier: 1,
    primary_stat: primary,
    sub_stats: sub_stats.length > 0 ? sub_stats : null,
  }
}

// 宝箱开装备：随机选 slot + 按宝箱品质决定 rarity（高品宝箱有概率开出更高品质）
export function rollChildEquipFromBox(boxRarity: ChildRarity, childLevel: number): ReturnType<typeof generateChildEquipment> {
  // 槽位均匀随机
  const slots: ChildSlot[] = ['weapon', 'robe', 'amulet1', 'amulet2']
  const slot = slots[Math.floor(Math.random() * slots.length)]

  // 品质：以 boxRarity 为基线，10% 概率升一级（红品宝箱仍然只能开红品）
  const ladder: ChildRarity[] = ['white', 'green', 'blue', 'purple', 'gold', 'red']
  let idx = ladder.indexOf(boxRarity)
  if (Math.random() < 0.10 && idx < 5) idx++
  return generateChildEquipment(slot, ladder[idx], childLevel)
}
