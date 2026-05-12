// 红尘玉商店商品 - design/system-companion.md 3.7.2
// 注：design 原表的"种子"已改为发放灵草本体（灵田种植机制按等级解锁，种子是无意义中间态）
// "洗髓丹"原用于子女天赋重铸，但天赋重铸接口未实装，跳过该商品

export type RedJadeItemKind = 'material' | 'pill'
export type LimitPeriod = 'week' | 'month'

export interface RedJadeShopItem {
  id: string                                  // 商品 ID（同 itemId 简化）
  name: string                                // 显示名
  desc: string                                // 一句话用途
  price: number                               // 红尘玉
  limit: { type: LimitPeriod; count: number } // 周/月限购
  give: {
    itemId: string                            // 实际入库的物品 id
    qty: number                               // 数量
    kind: RedJadeItemKind                     // material → character_materials, pill → character_pills
    quality?: string                          // material 时的品质（默认 white）
  }
}

export const RED_JADE_SHOP_ITEMS: RedJadeShopItem[] = [
  {
    id: 'moonlight_orchid',
    name: '月光兰 ×5',
    desc: '中-上品礼物原料（凡品本体）',
    price: 200,
    limit: { type: 'week', count: 5 },
    give: { itemId: 'moonlight_orchid', qty: 5, kind: 'material', quality: 'white' },
  },
  {
    id: 'couple_lotus',
    name: '并蒂莲 ×5',
    desc: '上-极品礼物原料（凡品本体）',
    price: 800,
    limit: { type: 'week', count: 2 },
    give: { itemId: 'couple_lotus', qty: 5, kind: 'material', quality: 'white' },
  },
  {
    id: 'lifelong_grass',
    name: '长情草 ×5',
    desc: '极品礼物必需原料（凡品本体）',
    price: 2000,
    limit: { type: 'week', count: 1 },
    give: { itemId: 'lifelong_grass', qty: 5, kind: 'material', quality: 'white' },
  },
  {
    id: 'golden_lotus_dew',
    name: '金莲花露 ×1',
    desc: '求子怀胎门槛物品',
    price: 3000,
    limit: { type: 'week', count: 2 },
    give: { itemId: 'golden_lotus_dew', qty: 1, kind: 'material', quality: 'white' },
  },
  {
    id: 'awaken_stone',
    name: '附灵石 ×1',
    desc: '装备附灵（项目通用道具）',
    price: 300,
    limit: { type: 'week', count: 5 },
    give: { itemId: 'awaken_stone', qty: 1, kind: 'pill' },
  },
  {
    id: 'awaken_reroll',
    name: '灵枢玉 ×1',
    desc: '装备附灵重铸',
    price: 500,
    limit: { type: 'week', count: 3 },
    give: { itemId: 'awaken_reroll', qty: 1, kind: 'pill' },
  },
  {
    id: 'reset_root',
    name: '天道洗髓丹 ×1',
    desc: '子女天赋单槽重铸 / 玩家灵根定向转换',
    price: 1500,
    limit: { type: 'week', count: 2 },
    give: { itemId: 'reset_root', qty: 1, kind: 'pill' },
  },
  {
    id: 'fate_pill',
    name: '夺天造化丹 ×1',
    desc: '子女资质重铸（极昂贵，月限购）',
    price: 50000,
    limit: { type: 'month', count: 1 },
    give: { itemId: 'fate_pill', qty: 1, kind: 'pill' },
  },
  {
    id: 'parting_charm',
    name: '红尘解 ×1',
    desc: '正式道侣和离专属信物',
    price: 10000,
    limit: { type: 'month', count: 1 },
    give: { itemId: 'parting_charm', qty: 1, kind: 'pill' },
  },
]

export const RED_JADE_SHOP_MAP: Record<string, RedJadeShopItem> = {}
for (const it of RED_JADE_SHOP_ITEMS) RED_JADE_SHOP_MAP[it.id] = it

// period_key 计算：周用 ISO YYYYWW，月用 YYYYMM
export function getPeriodKey(type: LimitPeriod, date = new Date()): number {
  if (type === 'month') {
    return date.getFullYear() * 100 + (date.getMonth() + 1)
  }
  // ISO week
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return d.getUTCFullYear() * 100 + weekNo
}
