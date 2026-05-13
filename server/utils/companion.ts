// 道侣业务工具函数 - 设计文档 design/system-companion.md

import type { Pool } from 'pg'
import { rand } from '~/server/utils/random'
import {
  rollQuality,
  rollPersonality,
  rollSpiritualRoot,
  ROOT_NAMES,
  PERSONALITY_GIFT_PREFERENCE,
  UNIVERSAL_LOVED_GIFTS,
  ROMANCE_SCRIPTS,
  EXPEDITION_LOCATIONS,
  INTIMACY_CONFIG,
  SEAL_LEVEL_CONFIG,
  type CompanionQuality,
  type Personality,
  type SpiritualRoot,
  type ExpeditionLocation,
  type RomanceScript,
  type GiftReaction,
} from '~/server/engine/companionData'
import { GIFT_RECIPE_MAP, calcGiftIntimacy } from '~/server/engine/giftRecipeData'
import { COMPANION_SEAL_PCT } from '~/shared/balance'

// ============================================================
// 类型
// ============================================================

export interface CompanionRow {
  id: number
  character_id: number
  name: string
  quality: number
  spiritual_root: string
  personality: string
  avatar_id: string
  background_story: string | null
  preferred_gifts: string[]
  disliked_gifts: string[]
  intimacy: number
  is_official: boolean
  last_companion_settle: Date | null
  pregnant_until: Date | null
  pregnant_count: number
  seal_level: number
  encounter_story: string | null
  encountered_at: Date
  married_at: Date | null
  custom_avatar_url: string | null
}

export interface PendingEncounter {
  scriptId: string
  quality: CompanionQuality
  spiritualRoot: SpiritualRoot
  personality: Personality
  avatarId: string
  generatedName: string
  initialIntimacy: number  // 临时值，根据 4 选项最终决定
}

// ============================================================
// 邂逅生成
// ============================================================

// 候选名字池（按风格分组）
const NAMES_BY_STYLE: Record<string, string[]> = {
  '婉约清冷': ['玉灵儿', '苏倾雪', '林婉清', '柳眉烟', '沈幽兰'],
  '飒爽英气': ['霍倾城', '上官红', '楚妙音', '徐倾鸿', '燕飞琼'],
  '温柔贤淑': ['顾雪青', '夏知秋', '苏婉如', '宁素心', '陆瑶琴'],
  '知性博学': ['谢晚晴', '云清扬', '萧静月', '韩书瑶', '裴知微'],
  '素净纯真': ['白玉华', '溪沅', '姜小婵', '林月儿', '赵清歌'],
}

function pickNameByStyle(style: string): string {
  const pool = NAMES_BY_STYLE[style] || NAMES_BY_STYLE['婉约清冷']
  return pool[Math.floor(Math.random() * pool.length)]
}

// 按性格生成喜好/厌恶礼物（数组）
function generateGiftPreferences(personality: Personality): {
  preferred: string[]
  disliked: string[]
} {
  const pref = PERSONALITY_GIFT_PREFERENCE[personality]
  return {
    preferred: pref.loved.slice(),
    disliked: pref.disliked.slice(),
  }
}

// 选择一个邂逅剧情（启用的随机一个）
function pickRomanceScript(): RomanceScript {
  const enabled = ROMANCE_SCRIPTS.filter(s => s.enabled)
  return enabled[Math.floor(Math.random() * enabled.length)]
}

// 生成一个 pending 邂逅事件（不写库，由调用方决定是否落库）
export function generatePendingEncounter(location: ExpeditionLocation): PendingEncounter & {
  script: RomanceScript
} {
  const quality = rollQuality()
  const root = rollSpiritualRoot(location)
  const personality = rollPersonality()
  const script = pickRomanceScript()
  const name = pickNameByStyle(script.style)

  return {
    script,
    scriptId: script.id,
    quality,
    spiritualRoot: root,
    personality,
    avatarId: `companion_${quality}_${Math.floor(Math.random() * 5) + 1}`, // 占位
    generatedName: name,
    initialIntimacy: 0,
  }
}

// ============================================================
// 数据库操作 - 道侣
// ============================================================

export async function getCompanionsByCharacter(pool: Pool, characterId: number): Promise<CompanionRow[]> {
  const { rows } = await pool.query(
    `SELECT * FROM companions WHERE character_id = $1 ORDER BY is_official DESC, encountered_at DESC`,
    [characterId]
  )
  return rows as CompanionRow[]
}

export async function getCompanionById(pool: Pool, id: number, characterId: number): Promise<CompanionRow | null> {
  const { rows } = await pool.query(
    `SELECT * FROM companions WHERE id = $1 AND character_id = $2`,
    [id, characterId]
  )
  return (rows[0] as CompanionRow) || null
}

export async function getOfficialCompanion(pool: Pool, characterId: number): Promise<CompanionRow | null> {
  const { rows } = await pool.query(
    `SELECT * FROM companions WHERE character_id = $1 AND is_official = TRUE LIMIT 1`,
    [characterId]
  )
  return (rows[0] as CompanionRow) || null
}

// 取角色当前正式道侣的仙缘印记加成（小数，0.12 = 12%；无道侣则 0）
// 所有战斗入口（fight / tower / dummy / offline / battleSnapshot 等）共用
export async function getCompanionSealPct(pool: Pool, characterId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT seal_level FROM companions WHERE character_id = $1 AND is_official = TRUE LIMIT 1`,
    [characterId]
  )
  if (!rows[0]?.seal_level) return 0
  return COMPANION_SEAL_PCT[Math.min(rows[0].seal_level, 5)] || 0
}

export async function countUnmarriedCompanions(pool: Pool, characterId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM companions WHERE character_id = $1 AND is_official = FALSE`,
    [characterId]
  )
  return rows[0]?.cnt || 0
}

// 录入新邂逅道侣（A/B/D 选项触发）
export async function insertCompanion(
  pool: Pool,
  characterId: number,
  encounter: PendingEncounter,
  initialIntimacy: number
): Promise<CompanionRow> {
  const prefs = generateGiftPreferences(encounter.personality)
  const { rows } = await pool.query(
    `INSERT INTO companions (
      character_id, name, quality, spiritual_root, personality, avatar_id,
      preferred_gifts, disliked_gifts, intimacy, encounter_story
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
    RETURNING *`,
    [
      characterId,
      encounter.generatedName,
      encounter.quality,
      encounter.spiritualRoot,
      encounter.personality,
      encounter.avatarId,
      JSON.stringify(prefs.preferred),
      JSON.stringify(prefs.disliked),
      initialIntimacy,
      encounter.scriptId,
    ]
  )
  return rows[0] as CompanionRow
}

// ============================================================
// 亲密度变更
// ============================================================

export async function addIntimacy(
  pool: Pool,
  companionId: number,
  delta: number
): Promise<number> {
  const { rows } = await pool.query(
    `UPDATE companions SET intimacy = GREATEST(0, LEAST(8000, intimacy + $1))
     WHERE id = $2 RETURNING intimacy`,
    [delta, companionId]
  )
  return rows[0]?.intimacy || 0
}

// 检查今日已经送过的礼物总亲密度（不含一次性剧情奖励）
export async function getTodayGiftIntimacyTotal(pool: Pool, companionId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(intimacy_gained), 0)::int AS total
       FROM companion_gifts
      WHERE companion_id = $1 AND gifted_at::date = CURRENT_DATE`,
    [companionId]
  )
  return rows[0]?.total || 0
}

// ============================================================
// 礼物逻辑
// ============================================================

export interface GiftOutcome {
  reaction: GiftReaction
  intimacyGained: number
  intimacyTotal: number
  dailyRemaining: number
}

// 检查物品是否为可赠送礼物
export function isGiftItem(itemId: string): boolean {
  return itemId in GIFT_RECIPE_MAP
}

// 计算礼物反应（喜爱 / 厌恶 / 普通）
export function checkReaction(
  personality: Personality,
  giftId: string,
  preferredGifts: string[],
  dislikedGifts: string[]
): GiftReaction {
  if (UNIVERSAL_LOVED_GIFTS.includes(giftId)) return 'love'
  if (preferredGifts.includes(giftId)) return 'love'
  if (dislikedGifts.includes(giftId)) return 'dislike'
  // 兜底：从性格默认表查
  const pref = PERSONALITY_GIFT_PREFERENCE[personality]
  if (pref.loved.includes(giftId)) return 'love'
  if (pref.disliked.includes(giftId)) return 'dislike'
  return 'normal'
}

// 计算礼物的实际亲密度收益（含品质系数 + 性格匹配）
export function calcGiftReward(
  giftId: string,
  reaction: GiftReaction,
  ingredientQualityCoef: number = 1.0
): number {
  const recipe = GIFT_RECIPE_MAP[giftId]
  if (!recipe) return 0
  return calcGiftIntimacy(recipe, ingredientQualityCoef, reaction)
}

// ============================================================
// 仙缘印记
// ============================================================

export function getSealConfig(level: number) {
  return SEAL_LEVEL_CONFIG.find(c => c.level === level) || SEAL_LEVEL_CONFIG[0]
}

export function getNextSealConfig(currentLevel: number) {
  return SEAL_LEVEL_CONFIG.find(c => c.level === currentLevel + 1)
}

// ============================================================
// 阶段化解锁判定
// ============================================================

export function canMarry(intimacy: number): boolean {
  return intimacy >= INTIMACY_CONFIG.marryThreshold
}

export function canConceive(intimacy: number): boolean {
  return intimacy >= INTIMACY_CONFIG.conceiveThreshold
}

// ============================================================
// 工具：境界 → 灵根名（中文）
// ============================================================

export function rootDisplayName(root: SpiritualRoot): string {
  return ROOT_NAMES[root]
}

// 工具：本周编号（与 realm_shop_purchases 一致，年内 ISO 周数）
export function getWeekNumber(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
