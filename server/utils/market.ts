import { getPool } from '~/server/database/db'
import type { PoolClient } from 'pg'
import { sendMail, type EquipmentSnapshot, type MailAttachment } from '~/server/utils/mail'

// ============================================
// 坊市常量（与 design/system-market.md §八 对应）
// ============================================
export const MARKET_TAX_RATE = 0.10
export const MARKET_PRICE_FLOOR_RATIO = 0.30
export const MARKET_PRICE_CEILING_RATIO = 3.0
export const MARKET_LISTING_DURATION_HOURS = 48
export const MARKET_CANCEL_FEE_RATIO = 0.05
export const MARKET_MAX_ACTIVE_LISTINGS = 10
export const MARKET_MAX_DAILY_LISTINGS = 20
export const MARKET_MAX_DAILY_TRADE_COUNT = 30
export const MARKET_MAX_DAILY_TRADE_AMOUNT = 5_000_000
export const MARKET_BROADCAST_THRESHOLD = 1_000_000
export const MARKET_ENTRY_REALM_TIER = 2
export const MARKET_ENTRY_LEVEL = 30
export const MARKET_ENTRY_REGISTER_DAYS = 1

export const MARKET_ALLOWED_RARITIES = new Set(['purple', 'gold', 'red'])
export const MARKET_MIN_TIER = 3

// ============================================
// 归一化键：eq:{base_slot}:{rarity}:{tier}:{enhance_level}
// 装备词条/觉醒效果/套装不进入键，参考价按"同槽位同品质同 tier 同强化等级"聚合
// ============================================
export function buildCategoryKey(eq: {
  base_slot?: string | null
  slot?: string | null
  rarity: string
  tier: number
  enhance_level?: number | null
}): string {
  const slot = eq.base_slot || eq.slot || 'unknown'
  const enh = eq.enhance_level ?? 0
  return `eq:${slot}:${eq.rarity}:${eq.tier}:${enh}`
}

// ============================================
// 基础参考价（按归一化键查表，未命中则按公式兜底）
// 规则简化：base = 售价系数 × tier × (1 + enh × 0.10) × 8
// 之所以乘 8：装备售价是回收价（玩家卖给系统），坊市流通价应显著高于回收价
// ============================================
const RARITY_SELL_BASE: Record<string, number> = {
  purple: 300, gold: 1500, red: 6000,
}

export function computeBasePrice(rarity: string, tier: number, enhance: number): number {
  const base = RARITY_SELL_BASE[rarity]
  if (!base) return 0
  return Math.floor(base * tier * (1 + enhance * 0.10) * 8)
}

// 取参考价：先查 market_reference_price，未命中则查 market_base_price，最后兜底公式
export async function getReferencePrice(
  categoryKey: string,
  fallback: { rarity: string; tier: number; enhance: number },
  client?: PoolClient
): Promise<{ price: number; method: 'historical' | 'base' | 'computed' }> {
  const pool = getPool()
  const runner = client || pool

  const { rows: refRows } = await runner.query(
    `SELECT ref_price, calc_method FROM market_reference_price WHERE category_key = $1`,
    [categoryKey]
  )
  if (refRows.length > 0) {
    return { price: Number(refRows[0].ref_price), method: refRows[0].calc_method }
  }

  const { rows: baseRows } = await runner.query(
    `SELECT base_price FROM market_base_price WHERE category_key = $1`,
    [categoryKey]
  )
  if (baseRows.length > 0) {
    return { price: Number(baseRows[0].base_price), method: 'base' }
  }

  return {
    price: computeBasePrice(fallback.rarity, fallback.tier, fallback.enhance),
    method: 'computed',
  }
}

// ============================================
// 准入校验（§4.3）
// 返回 null 表示通过，否则返回拒绝消息
// ============================================
export async function checkAccessGate(charId: number): Promise<string | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT c.realm_tier, c.level, u.created_at AS user_created_at
       FROM characters c
       JOIN users u ON u.id = c.user_id
      WHERE c.id = $1`,
    [charId]
  )
  if (rows.length === 0) return '角色不存在'
  const r = rows[0]

  const ageMs = Date.now() - new Date(r.user_created_at).getTime()
  const ageDays = ageMs / 86400_000
  if (ageDays < MARKET_ENTRY_REGISTER_DAYS) {
    return `账号注册不足 ${MARKET_ENTRY_REGISTER_DAYS} 天，暂不可使用坊市`
  }
  if ((r.realm_tier ?? 0) < MARKET_ENTRY_REALM_TIER) {
    return '境界未达筑基期，仅可浏览坊市'
  }
  if ((r.level ?? 0) < MARKET_ENTRY_LEVEL) {
    return '等级未达 30 级，仅可浏览坊市'
  }
  return null
}

// ============================================
// 获取或创建当日额度行
// ============================================
export async function getOrCreateDailyQuota(
  client: PoolClient,
  characterId: number
): Promise<{ listing_count: number; buy_count: number; sell_count: number; buy_amount: number; sell_amount: number }> {
  const { rows } = await client.query(
    `INSERT INTO market_daily_quota (character_id, quota_date)
     VALUES ($1, CURRENT_DATE)
     ON CONFLICT (character_id, quota_date) DO UPDATE SET character_id = EXCLUDED.character_id
     RETURNING listing_count, buy_count, sell_count, buy_amount, sell_amount`,
    [characterId]
  )
  return {
    listing_count: rows[0].listing_count,
    buy_count: rows[0].buy_count,
    sell_count: rows[0].sell_count,
    buy_amount: Number(rows[0].buy_amount),
    sell_amount: Number(rows[0].sell_amount),
  }
}

// ============================================
// 构造装备快照（用于挂单的 item_snapshot 与邮件附件）
// ============================================
export function snapshotEquipment(eq: any): EquipmentSnapshot {
  return {
    name: eq.name,
    base_slot: eq.base_slot ?? eq.slot ?? null,
    weapon_type: eq.weapon_type ?? null,
    rarity: eq.rarity,
    primary_stat: eq.primary_stat,
    primary_value: eq.primary_value,
    sub_stats: eq.sub_stats || null,
    awaken_effect: eq.awaken_effect || null,
    set_id: eq.set_id || null,
    enhance_level: eq.enhance_level ?? 0,
    req_level: eq.req_level ?? 1,
    tier: eq.tier ?? 1,
  }
}

// ============================================
// 通过邮件向卖家发灵石、向买家发装备
// ============================================
export async function dispatchSaleMails(
  client: PoolClient,
  params: {
    sellerId: number
    buyerId: number
    snapshot: EquipmentSnapshot
    sellerReceived: number
    totalPrice: number
    listingId: number
  }
): Promise<void> {
  const { sellerId, buyerId, snapshot, sellerReceived, totalPrice, listingId } = params

  // 卖家：灵石 + 成交通知
  await sendMail(
    {
      characterId: sellerId,
      category: 'market',
      title: '坊市成交',
      content: `您挂售的「${snapshot.name}」已成交，扣除税费后到账 ${sellerReceived.toLocaleString()} 灵石（成交价 ${totalPrice.toLocaleString()}）。`,
      attachments: [{ type: 'spirit_stone', amount: sellerReceived }],
      refType: 'market_listing',
      refId: listingId,
    },
    client
  )

  // 买家：装备
  await sendMail(
    {
      characterId: buyerId,
      category: 'market',
      title: '坊市购入',
      content: `您从坊市购入「${snapshot.name}」，附件领取后即可使用。`,
      attachments: [{ type: 'equipment', snapshot } as MailAttachment],
      refType: 'market_listing',
      refId: listingId,
    },
    client
  )
}

// ============================================
// 通过邮件把装备退回（取消 / 过期）
// ============================================
export async function dispatchReturnMail(
  client: PoolClient,
  params: { characterId: number; snapshot: EquipmentSnapshot; reason: 'cancelled' | 'expired'; listingId: number }
): Promise<void> {
  const { characterId, snapshot, reason, listingId } = params
  const titleMap = { cancelled: '坊市下架', expired: '坊市挂单到期' }
  const contentMap = {
    cancelled: `您主动下架了「${snapshot.name}」，装备已通过邮件退回。`,
    expired: `您挂售的「${snapshot.name}」 48 小时内未成交，已自动下架并退回。`,
  }
  await sendMail(
    {
      characterId,
      category: 'market',
      title: titleMap[reason],
      content: contentMap[reason],
      attachments: [{ type: 'equipment', snapshot } as MailAttachment],
      refType: 'market_listing',
      refId: listingId,
    },
    client
  )
}
