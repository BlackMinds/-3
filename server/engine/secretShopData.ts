// 秘境积分商店数据
// 消耗 characters.realm_points，周限购，周一刷新

export type RealmShopCategory = 'enhance_stone' | 'awaken' | 'breakthrough'

export interface RealmShopItem {
  key: string
  name: string
  description: string
  cost: number           // 秘境积分价格（exchangeFrom 存在时不使用，置 0）
  weeklyLimit: number
  category: RealmShopCategory
  /** 解锁所需境界 tier（1=练气 2=筑基 3=金丹 4=元婴 5=化神 6=渡劫 7=大乘 8=飞升）*/
  reqRealmTier: number
  /** 解锁所需等级 */
  reqLevel: number
  /** 入库到 character_pills 的 pill_id */
  pillId: string
  /** 道具兑换型条目：消耗 qty 个 pillId 道具兑换 1 件本商品（不扣 realm_points） */
  exchangeFrom?: { pillId: string; qty: number }
}

export const REALM_SHOP_ITEMS: RealmShopItem[] = [
  // —— 强化石（T4 起，每档对应玩家可打到的秘境）——
  { key: 'rs_enhance_t4',  name: '强化石·T4',  description: '强化 T4 装备每次消耗 1 个',  cost: 500,   weeklyLimit: 10, category: 'enhance_stone', reqRealmTier: 3, reqLevel: 40,  pillId: 'enhance_stone_t4'  },
  { key: 'rs_enhance_t5',  name: '强化石·T5',  description: '强化 T5 装备每次消耗 1 个',  cost: 1000,  weeklyLimit: 10, category: 'enhance_stone', reqRealmTier: 4, reqLevel: 65,  pillId: 'enhance_stone_t5'  },
  { key: 'rs_enhance_t6',  name: '强化石·T6',  description: '强化 T6 装备每次消耗 1 个',  cost: 1800,  weeklyLimit: 8,  category: 'enhance_stone', reqRealmTier: 4, reqLevel: 65,  pillId: 'enhance_stone_t6'  },
  { key: 'rs_enhance_t7',  name: '强化石·T7',  description: '强化 T7 装备每次消耗 1 个',  cost: 3000,  weeklyLimit: 8,  category: 'enhance_stone', reqRealmTier: 5, reqLevel: 100, pillId: 'enhance_stone_t7'  },
  { key: 'rs_enhance_t8',  name: '强化石·T8',  description: '强化 T8 装备每次消耗 1 个',  cost: 5000,  weeklyLimit: 5,  category: 'enhance_stone', reqRealmTier: 5, reqLevel: 100, pillId: 'enhance_stone_t8'  },
  { key: 'rs_enhance_t9',  name: '强化石·T9',  description: '强化 T9 装备每次消耗 1 个',  cost: 8000,  weeklyLimit: 5,  category: 'enhance_stone', reqRealmTier: 6, reqLevel: 150, pillId: 'enhance_stone_t9'  },
  { key: 'rs_enhance_t10', name: '强化石·T10', description: '强化 T10 装备每次消耗 1 个', cost: 15000, weeklyLimit: 3,  category: 'enhance_stone', reqRealmTier: 7, reqLevel: 185, pillId: 'enhance_stone_t10' },
  { key: 'rs_enhance_t11', name: '强化石·T11', description: '强化 T11 装备每次消耗 1 个', cost: 28000, weeklyLimit: 2,  category: 'enhance_stone', reqRealmTier: 8, reqLevel: 215, pillId: 'enhance_stone_t11' },
  { key: 'rs_enhance_t12', name: '强化石·T12', description: '强化 T12 装备每次消耗 1 个', cost: 50000, weeklyLimit: 2,  category: 'enhance_stone', reqRealmTier: 9, reqLevel: 240, pillId: 'enhance_stone_t12' },

  // —— 附灵石（全阶段稀缺）——
  { key: 'rs_awaken_stone',           name: '附灵石',      description: '为蓝+品装备附加一条随机附灵',          cost: 2500, weeklyLimit: 3,  category: 'awaken', reqRealmTier: 2, reqLevel: 15, pillId: 'awaken_stone' },
  { key: 'rs_awaken_reroll',          name: '灵枢玉',      description: '重新随机一件装备的附灵（保证与原附灵不同）', cost: 2500, weeklyLimit: 100, category: 'awaken', reqRealmTier: 2, reqLevel: 15, pillId: 'awaken_reroll' },
  // —— 道具兑换：10 附灵石 → 1 灵枢玉（不消耗秘境积分）——
  { key: 'rs_awaken_reroll_exchange', name: '灵枢玉',      description: '消耗 10 个附灵石兑换 1 个灵枢玉（不消耗秘境积分）', cost: 0,    weeklyLimit: 10, category: 'awaken', reqRealmTier: 2, reqLevel: 15, pillId: 'awaken_reroll', exchangeFrom: { pillId: 'awaken_stone', qty: 10 } },

  // —— 突破丹（不叠加，高覆盖低）——
  { key: 'rs_small_breakthrough', name: '小突破丹', description: '下次突破成功率 +10%（一次性，不叠加）', cost: 1500, weeklyLimit: 3, category: 'breakthrough', reqRealmTier: 2, reqLevel: 15, pillId: 'small_breakthrough_pill' },
  { key: 'rs_big_breakthrough',   name: '突破丹',   description: '下次突破成功率 +25%（一次性，高覆盖低）', cost: 4000, weeklyLimit: 2, category: 'breakthrough', reqRealmTier: 3, reqLevel: 40, pillId: 'big_breakthrough_pill' },
]

export function getRealmShopItem(key: string): RealmShopItem | undefined {
  return REALM_SHOP_ITEMS.find(i => i.key === key)
}

/** 判断角色是否满足解锁条件 */
export function isRealmShopItemUnlocked(item: RealmShopItem, realmTier: number, level: number): boolean {
  return realmTier >= item.reqRealmTier && level >= item.reqLevel
}

// —— 突破丹等级映射（高覆盖低逻辑用）——
// 三种突破丹共用 characters.breakthrough_boost_pct 字段，使用时 pct = max(current, incoming)
export const BREAKTHROUGH_PILL_PCT: Record<string, number> = {
  small_breakthrough_pill: 10,
  breakthrough_boost:      20,
  big_breakthrough_pill:   25,
}

export const BREAKTHROUGH_PILL_NAMES: Record<string, string> = {
  small_breakthrough_pill: '小突破丹',
  breakthrough_boost:      '宗门突破丹',
  big_breakthrough_pill:   '突破丹',
}
