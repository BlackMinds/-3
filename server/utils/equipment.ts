import { getPool } from '~/server/database/db'

import { rand } from '~/server/utils/random'
import {
  EQUIP_PRIMARY_BASE, EQUIP_PRIMARY_V4, EQUIP_SUB_POOL_V4,
  RARITY_STAT_MUL, ENHANCE_MUL_PER_LEVEL, RARITY_SUB_COUNT_V4,
  getEquipTierWeight, getEquipPrimaryValue2, getSubStatAxisWeight,
} from '~/shared/balance'

export async function consumeSpecialItem(charId: number, pillId: string): Promise<boolean> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT id, count FROM character_pills WHERE character_id = $1 AND pill_id = $2 AND count > 0 LIMIT 1',
    [charId, pillId]
  )
  if (rows.length === 0) return false
  await pool.query('UPDATE character_pills SET count = count - 1 WHERE id = $1', [rows[0].id])
  await pool.query('DELETE FROM character_pills WHERE id = $1 AND count <= 0', [rows[0].id])
  return true
}

// 副属性池（掉落/洗练/升品/合成全部走这里）
// 分类：
//   FLAT     — 固定值，跟装备 tier 走（tierMul × qualityMul）；后期贬值，充当"垃圾词条"，允许同件装备重复出现
//   PERCENT  — 百分比类，只乘 qualityMul，不随 tier 膨胀
// weight — 加权抽取概率（不是概率，是相对权重）
//   20 = 垃圾档（flat 基础属性、资源类）          - 大概率出
//   10 = 中档   （百分比基础、五行、命中）          - 中等概率
//    5 = 好词条 （会心/会伤/吸血/闪避/破甲）       - 难出，神器的组成
export const SUB_STAT_POOL = [
  // flat（垃圾/凑数，允许同件装备重复出现）
  { stat: 'ATK',            min: 3,  max: 20,  weight: 20 },
  { stat: 'DEF',            min: 2,  max: 15,  weight: 20 },
  { stat: 'HP',             min: 30, max: 200, weight: 20 }, // 2026-05-04: ×2 配合境界血量右移
  { stat: 'SPD',            min: 1,  max: 8,   weight: 20 },
  { stat: 'SPIRIT',         min: 1,  max: 6,   weight: 20 },
  { stat: 'SPIRIT_DENSITY', min: 1,  max: 4,   weight: 20 },
  { stat: 'LUCK',           min: 1,  max: 4,   weight: 20 },
  // 百分比属性（中档）
  { stat: 'ATK_PCT',        min: 1,  max: 3,   weight: 10 },
  { stat: 'DEF_PCT',        min: 1,  max: 3,   weight: 10 },
  { stat: 'HP_PCT',         min: 2,  max: 8,   weight: 10 }, // 2026-05-04: ×2 配合境界血量右移
  { stat: 'SPD_PCT',        min: 1,  max: 2,   weight: 10 },
  { stat: 'ACCURACY',       min: 1,  max: 2,   weight: 10 }, // v3.4: max 3→2 (-33%)
  { stat: 'METAL_DMG',      min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2（配合 ceil 让 tier 分档体感更明显）
  { stat: 'WOOD_DMG',       min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2
  { stat: 'WATER_DMG',      min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2
  { stat: 'FIRE_DMG',       min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2
  { stat: 'EARTH_DMG',      min: 2,  max: 4,   weight: 10 }, // v3.6: min 1→2
  // 好词条（v3.7：weight 10→5 回滚到 v3.0 之前，神器再度稀有）
  { stat: 'CRIT_RATE',      min: 2,  max: 3,   weight: 5 },
  { stat: 'CRIT_DMG',       min: 2,  max: 6,   weight: 5 },
  { stat: 'LIFESTEAL',      min: 1,  max: 1,   weight: 5 }, // max=1 顶死，靠 ceil 让 t10 自然分档为 2
  { stat: 'DODGE',          min: 1,  max: 1,   weight: 5 },
  { stat: 'ARMOR_PEN',      min: 2,  max: 5,   weight: 5 },
]

// 固定值类副属性（会按 tier 高速缩放）
export const SUB_STAT_FLAT = new Set(['ATK', 'DEF', 'HP', 'SPD', 'SPIRIT'])

// 好词条（会心/会伤/吸血/闪避/破甲）— tier 浮动最低，防引擎 cap 撞顶
export const SUB_STAT_GOOD = new Set(['CRIT_RATE', 'CRIT_DMG', 'LIFESTEAL', 'DODGE', 'ARMOR_PEN'])

// 副属性数量按品质
export const RARITY_SUB_COUNT: Record<string, number> = {
  white: 0, green: 1, blue: 2, purple: 3, gold: 4, red: 4,
}

/**
 * 副属性 tier 浮动系数（v3.5：让 t 级在副属性上真正分档）
 *   FLAT     — +10%/tier，t10 = 1.9×（满档继续按 tier 缩放，flat 后期靠 tier 撑）
 *   GOOD     — +4%/tier， t10 = 1.36×（会心/会伤/吸血/闪避/破甲）
 *   其余 PCT — +6%/tier， t10 = 1.54×（PCT/五行/命中/SPIRIT_DENSITY/LUCK）
 *
 * v3.8.4 (2026-05-06)：百分比类（GOOD + PCT）T11+ 截断在 T10 上限
 *   背景：T11~T15 加入后单条破甲飙到 18、火系强化到 13，百分比叠在角色属性上膨胀过快；
 *   FLAT 仍按 tier 缩放（这是 flat 后期翻身的唯一杠杆，不能动）。
 */
function getTierMul(stat: string, tier: number): number {
  if (SUB_STAT_FLAT.has(stat)) return 1 + (tier - 1) * 0.10
  const capped = Math.min(tier, 10)
  if (SUB_STAT_GOOD.has(stat)) return 1 + (capped - 1) * 0.04
  return 1 + (capped - 1) * 0.06
}

/**
 * 统一副属性数值生成
 * v3.6: 终值改为 Math.ceil，让 GOOD 类（如 LIFESTEAL/DODGE max=1）的 tier 倍率不再被 floor 截断
 */
export function rollSubStatValue(stat: string, min: number, max: number, rarityIdx: number, tier: number): number {
  const qualityMul = 1 + rarityIdx * 0.15
  const tierMul = getTierMul(stat, tier)
  const base = Math.floor(Math.random() * (max - min + 1)) + min
  return Math.max(1, Math.ceil(base * qualityMul * tierMul))
}

/**
 * 按权重抽取一条副属性（从可用列表中）
 */
function weightedPick<T extends { weight: number }>(pool: T[]): T {
  const total = pool.reduce((a, b) => a + b.weight, 0)
  let r = Math.random() * total
  for (const item of pool) {
    r -= item.weight
    if (r <= 0) return item
  }
  return pool[pool.length - 1]
}

/**
 * 生成一组副属性
 * 按 weight 加权：垃圾词条(flat/资源)高频出，好词条(会心/吸血)低频出 — 神器需要多条好词条才能成型
 * v3.7: FLAT 类（ATK/DEF/HP/SPD/SPIRIT）允许同件装备重复出现，进一步拉大方差
 */
export function rollSubStats(rarityIdx: number, tier: number, count: number): { stat: string; value: number }[] {
  const subs: { stat: string; value: number }[] = []
  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    // FLAT 类不进 used，可重复抽取；其他类一件装备只能出一条
    const available = SUB_STAT_POOL.filter(s => SUB_STAT_FLAT.has(s.stat) || !used.has(s.stat))
    if (available.length === 0) break
    const pick = weightedPick(available)
    if (!SUB_STAT_FLAT.has(pick.stat)) used.add(pick.stat)
    subs.push({ stat: pick.stat, value: rollSubStatValue(pick.stat, pick.min, pick.max, rarityIdx, tier) })
  }
  return subs
}

// =====================================================================
// v4.0 装备生成（神兵锻造总纲 PDF）
// =====================================================================
// - 主属性双轨：属性1 受强化 / 属性2 不受强化
// - 副词条按"部位 × 词条位"分桶，稀有度决定开放到第几位
// - 双轴权重：%类:固定 = 4:6，伤害:生存功能 = 4:6
// - 老装备走老路（rollSubStats / 单 primary_stat）；v4.0 函数仅用于新装备

export const RARITY_IDX_MAP: Record<string, number> = {
  white: 0, green: 1, blue: 2, purple: 3, gold: 4, red: 5,
}

// v4.0 副词条数值范围（min/max）
// 老池里有的复用，新增 SPIRIT_PCT、CTRL_*、STATUS_*、五行抗性 5 种
export const SUB_STAT_RANGE_V4: Record<string, [number, number]> = {
  ATK: [3, 20], DEF: [2, 15], HP: [30, 200], SPD: [1, 8], SPIRIT: [1, 6],
  ATK_PCT: [1, 3], DEF_PCT: [1, 3], HP_PCT: [2, 8], SPD_PCT: [1, 2], SPIRIT_PCT: [1, 3],
  ACCURACY: [1, 2], DODGE: [1, 1], LIFESTEAL: [1, 1], ARMOR_PEN: [2, 5],
  CRIT_RATE: [2, 3], CRIT_DMG: [2, 6],
  LUCK: [1, 4], SPIRIT_DENSITY: [1, 4],
  METAL_DMG: [2, 4], WOOD_DMG: [2, 4], WATER_DMG: [2, 4], FIRE_DMG: [2, 4], EARTH_DMG: [2, 4],
  METAL_RES: [2, 4], WOOD_RES: [2, 4], WATER_RES: [2, 4], FIRE_RES: [2, 4], EARTH_RES: [2, 4],
  CTRL_CHANCE: [1, 2], CTRL_RES: [1, 2],
}

const FLAT_V4 = new Set(['ATK','DEF','HP','SPD','SPIRIT'])
const GOOD_V4 = new Set(['CRIT_RATE','CRIT_DMG','LIFESTEAL','DODGE','ARMOR_PEN'])

function getTierMulV4(stat: string, tier: number): number {
  if (FLAT_V4.has(stat)) return 1 + (tier - 1) * 0.10
  const capped = Math.min(tier, 10)
  if (GOOD_V4.has(stat)) return 1 + (capped - 1) * 0.04
  return 1 + (capped - 1) * 0.06
}

function rollSubValueV4(stat: string, rarityIdx: number, tier: number): number {
  const range = SUB_STAT_RANGE_V4[stat] || [1, 3]
  const qualityMul = 1 + rarityIdx * 0.15
  const tierMul = getTierMulV4(stat, tier)
  const base = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0]
  return Math.max(1, Math.ceil(base * qualityMul * tierMul))
}

/**
 * v4.0 装备主属性生成（属性1 + 属性2）
 * @param slotKey   v4.0 槽位 key（weapon/armor/helmet/boots/treasure/amulet/necklace/pendant/ring_water/ring_fire/bracelet）
 * @param subType   子类（武器=weaponType / 法宝='phys'|'magic' / 护符='crit_rate'|'crit_dmg' / 其他='_'）
 * @param rarity    白/绿/蓝/紫/金/红
 * @param tier      装备 T 级
 */
export function decideEquipPrimariesV4(
  slotKey: string,
  subType: string,
  rarity: string,
  tier: number,
): { primary_stat: string; primary_value: number; primary_stat_2: string | null; primary_value_2: number | null } {
  const config = EQUIP_PRIMARY_V4[slotKey]?.[subType]
  if (!config) {
    // 兜底（不该走到，外层应已传对 slotKey/subType）
    return { primary_stat: 'ATK', primary_value: 1, primary_stat_2: null, primary_value_2: null }
  }
  const rarityIdx = RARITY_IDX_MAP[rarity] ?? 0
  const rarityMul = RARITY_STAT_MUL[rarityIdx] || 1
  const tierWeight = getEquipTierWeight(tier)

  // 属性1：受强化（生成时 enhance_level=0，强化由 enhance.post.ts 推动）
  const base1 = EQUIP_PRIMARY_BASE[config.primary1] ?? 1
  const value1 = Math.max(1, Math.floor(base1 * tierWeight * rarityMul))

  // 属性2：不受强化
  let stat2: string | null = null
  let value2: number | null = null
  if (config.primary2) {
    stat2 = config.primary2
    value2 = getEquipPrimaryValue2(stat2, tier, rarityIdx)
  }
  return { primary_stat: config.primary1, primary_value: value1, primary_stat_2: stat2, primary_value_2: value2 }
}

/**
 * v4.0 副词条生成
 * 按部位 × 词条位分桶，稀有度截断（白0/绿1/蓝2/紫2/金3/红4）
 * 双轴权重抽取：%类:固定 = 4:6，伤害:生存功能 = 4:6
 * 同件装备允许同名词条重复（PDF "支持基础属性堆叠"）
 */
export function rollSubStatsV4(
  slotKey: string,
  rarity: string,
  tier: number,
): { stat: string; value: number }[] {
  const subCount = RARITY_SUB_COUNT_V4[rarity] ?? 0
  if (subCount === 0) return []
  const pool = EQUIP_SUB_POOL_V4[slotKey]
  if (!pool) return []
  const rarityIdx = RARITY_IDX_MAP[rarity] ?? 0

  const subs: { stat: string; value: number }[] = []
  for (let i = 0; i < subCount; i++) {
    const candidates = pool[i]
    if (!candidates || candidates.length === 0) continue
    // 双轴权重抽取
    const weights = candidates.map(s => getSubStatAxisWeight(s))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    let stat = candidates[0]
    for (let j = 0; j < candidates.length; j++) {
      r -= weights[j]
      if (r <= 0) { stat = candidates[j]; break }
    }
    subs.push({ stat, value: rollSubValueV4(stat, rarityIdx, tier) })
  }
  return subs
}

// consumeSpecialItem is exported from server/utils/consumeSpecialItem.ts (Nuxt auto-imports it)

export async function getCharId(userId: any): Promise<{ id: number } | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT id FROM characters WHERE user_id = $1',
    [userId]
  )
  return rows.length > 0 ? rows[0] : null
}

// 装备出售基础价
// 实际价 = base × tier × getEnhanceSellMul(enhance_level)
// 自动出售/背包满转售/团队战利品转售时 enhance_level 为 0，可忽略加成
// 阶差 ×3.33/×3/×2.67/×2.5/×3，跨度 200×；高端不再暴利、低端不再废柴
export const EQUIP_SELL_PRICES: Record<string, number> = {
  white: 15, green: 50, blue: 150, purple: 400, gold: 1000, red: 3000,
}

// 强化售价倍率（阶梯）：+0~+5 每级 +0.10，+5~+10 每级 +0.20，+10~+15 每级 +0.30
// WHY: 原线性 (1+enh×0.10) 满级仅 ×2.5，远低于 +15 装备实际属性增益；中后段加速以贴近真实价值
const ENHANCE_SELL_MUL = [
  1.0, 1.1, 1.2, 1.3, 1.4, 1.5,
  1.7, 1.9, 2.1, 2.3, 2.5,
  2.8, 3.1, 3.4, 3.7, 4.0,
]
export function getEnhanceSellMul(enh: number | null | undefined): number {
  if (!Number.isFinite(enh as number) || (enh as number) <= 0) return 1.0
  const i = Math.min(Math.floor(enh as number), 15)
  return ENHANCE_SELL_MUL[i]
}

// ============================================
// 装备方案 / Loadout helpers
// 玩家有 5 套方案（loadout_id 1~5），character_equipment.slot 反映"当前激活方案下的穿戴"
// equip/unequip 时同步写当前激活方案；卖装备时清掉所有方案的引用
// 新角色或老库未回填的角色都用 ON CONFLICT DO NOTHING 懒创建
// ============================================
export async function ensureLoadouts(charId: number): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO character_equipment_loadouts (character_id, loadout_id, slots)
     VALUES ($1, 1, '{}'::jsonb), ($1, 2, '{}'::jsonb), ($1, 3, '{}'::jsonb),
            ($1, 4, '{}'::jsonb), ($1, 5, '{}'::jsonb)
     ON CONFLICT (character_id, loadout_id) DO NOTHING`,
    [charId]
  )
}

export async function getActiveLoadoutId(charId: number): Promise<number> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT COALESCE(active_loadout, 1) AS active FROM characters WHERE id = $1',
    [charId]
  )
  const v = rows[0]?.active ?? 1
  return v >= 1 && v <= 5 ? v : 1
}

// 设置当前激活方案某槽位的装备 id（equipId=null 表示清空该槽位）
export async function syncLoadoutSlot(
  charId: number,
  loadoutId: number,
  slot: string,
  equipId: number | null
): Promise<void> {
  const pool = getPool()
  if (equipId == null) {
    await pool.query(
      `INSERT INTO character_equipment_loadouts (character_id, loadout_id, slots, updated_at)
       VALUES ($1, $2, '{}'::jsonb, NOW())
       ON CONFLICT (character_id, loadout_id) DO UPDATE SET
         slots = character_equipment_loadouts.slots - $3::text,
         updated_at = NOW()`,
      [charId, loadoutId, slot]
    )
  } else {
    await pool.query(
      `INSERT INTO character_equipment_loadouts (character_id, loadout_id, slots, updated_at)
       VALUES ($1, $2, jsonb_build_object($3::text, $4::int), NOW())
       ON CONFLICT (character_id, loadout_id) DO UPDATE SET
         slots = character_equipment_loadouts.slots || jsonb_build_object($3::text, $4::int),
         updated_at = NOW()`,
      [charId, loadoutId, slot, equipId]
    )
  }
}

// 从所有方案中移除引用了 equipIds 的 slot key（卖装备 / 删装备时调）
export async function removeEquipsFromAllLoadouts(
  charId: number,
  equipIds: number[]
): Promise<void> {
  if (!equipIds || equipIds.length === 0) return
  const pool = getPool()
  await pool.query(
    `UPDATE character_equipment_loadouts
     SET slots = COALESCE((
       SELECT jsonb_object_agg(k, v)
       FROM jsonb_each(slots) AS s(k, v)
       WHERE NOT ((v)::text::int = ANY($2::int[]))
     ), '{}'::jsonb), updated_at = NOW()
     WHERE character_id = $1`,
    [charId, equipIds]
  )
}
