// 子女业务工具函数 - 设计文档 5.x

import type { Pool } from 'pg'
import { rand } from '~/server/utils/random'
import {
  rollTalentByAptitude,
  CHILD_TALENTS,
  type ChildAptitude,
  type ChildTalent,
} from '~/server/engine/childTalentData'
import { pickInnateSkill, type ChildSkill } from '~/server/engine/childSkillData'
import { QUALITY_TRAITS, type CompanionQuality, type SpiritualRoot, ALL_ROOTS } from '~/server/engine/companionData'

// ============================================================
// 类型
// ============================================================

export interface ChildRow {
  id: number
  character_id: number
  parent_companion_id: number | null
  name: string
  gender: 'male' | 'female'
  avatar_id: string
  aptitude: number
  spiritual_root: string
  awakened: boolean
  level: number
  level_exp: number
  realm_tier: number
  realm_stage: number
  stage: string
  max_hp: number
  atk: number
  def: number
  spd: number
  crit_rate: number
  crit_dmg: number
  dodge: number
  lifesteal: number
  spirit: number
  resist_ctrl: number
  is_battling: boolean
  has_left_home: boolean
  last_visit_at: Date | null
  permanent_buff_pct: number
  feed_count_today: number
  feed_date: Date | null
  awakened_talents: any[]
  learned_skills: any[]
  born_at: Date
}

// ============================================================
// 资质 / 灵根 生成
// ============================================================

// 资质名
export const APTITUDE_NAMES = ['凡品', '下品', '中品', '上品', '极品', '仙品', '圣品']

// 玩家本体资质 → 数字（默认 = 道侣品质上限-1，简化处理）
// 实际游戏可能由 character.aptitude 字段决定
export function generateChildAptitude(
  playerAptitude: number,
  companionQuality: CompanionQuality
): { aptitude: ChildAptitude; awakened: boolean } {
  const ceiling = companionQuality                // 上限 = 道侣品质 (0-5)
  const floor = Math.max(0, Math.floor(playerAptitude * 0.5))   // 下限 = 玩家资质 50%
  const base = rand(floor, ceiling)
  // 5% 概率血脉觉醒（突破上限 +1，最高到圣品 6）
  if (Math.random() < 0.05 && base < 6) {
    return { aptitude: (base + 1) as ChildAptitude, awakened: true }
  }
  return { aptitude: base as ChildAptitude, awakened: false }
}

// 五行灵根继承
export function generateChildElement(
  playerElement: SpiritualRoot,
  companionElement: SpiritualRoot
): { root: SpiritualRoot | 'mixed'; isDual: boolean } {
  const r = Math.random()
  if (r < 0.45) return { root: playerElement, isDual: false }
  if (r < 0.90) return { root: companionElement, isDual: false }
  if (r < 0.99) return { root: ALL_ROOTS[Math.floor(Math.random() * 5)], isDual: false }
  // 1% 双灵根/混灵
  return { root: 'mixed', isDual: true }
}

// 多胎滚动（按道侣品质）
export function rollPregnantCount(companionQuality: CompanionQuality): number {
  const traits = QUALITY_TRAITS[companionQuality]
  const r = Math.random()
  if (r < traits.tripletChance) return 3
  if (r < traits.tripletChance + traits.twinChance) return 2
  return 1
}

// 名字生成
const MALE_FIRST = ['凌', '风', '清', '云', '逸', '尘', '霖', '辰', '凡', '玄']
const FEMALE_FIRST = ['雪', '月', '兰', '柔', '璃', '澜', '凝', '婉', '绾', '怜']
const SECOND = ['儿', '心', '音', '舒', '怡', '宁', '羽', '宸', '琪', '泽']

export function generateChildName(
  parentSurname: string,
  gender: 'male' | 'female'
): string {
  const pool1 = gender === 'male' ? MALE_FIRST : FEMALE_FIRST
  const f = pool1[Math.floor(Math.random() * pool1.length)]
  const s = SECOND[Math.floor(Math.random() * SECOND.length)]
  // 简化：取父姓 + 名 (2 字)
  return `${parentSurname[0] || '清'}${f}${s}`.slice(0, 8)
}

// ============================================================
// 子女属性计算
// ============================================================

// 资质 → 属性倍率（参考 5.5.2）
const APTITUDE_MULTIPLIER = [1.0, 1.3, 1.6, 2.0, 2.5, 3.0, 5.0]
// 资质 → 等级上限（2026-05-12 小夏调整）：拉高梯度，圣品对齐玩家本体上限 400
export const APTITUDE_LEVEL_CAP = [100, 150, 200, 250, 300, 350, 400]
export function getChildLevelCap(aptitude: number): number {
  return APTITUDE_LEVEL_CAP[Math.min(Math.max(aptitude, 0), 6)] || 100
}

// 资质 → 会心率/会心伤害/闪避 浮动范围（出生时随机一次锁定，升级不会重滚）
// 同资质子女会有"天生体质"差异，运气好可以多 30~50% 多余面板属性
const APTITUDE_CRIT_RATE: Array<[number, number]> = [
  [0.03, 0.05],  // 凡 3-5%
  [0.05, 0.08],  // 下 5-8%
  [0.08, 0.12],  // 中 8-12%
  [0.12, 0.16],  // 上 12-16%
  [0.16, 0.22],  // 极 16-22%
  [0.22, 0.28],  // 仙 22-28%
  [0.30, 0.40],  // 圣 30-40%
]
const APTITUDE_CRIT_DMG: Array<[number, number]> = [
  [1.00, 1.10],  // 凡 100-110%
  [1.10, 1.30],  // 下 110-130%
  [1.30, 1.50],  // 中 130-150%
  [1.60, 1.85],  // 上 160-185%
  [2.00, 2.30],  // 极 200-230%
  [2.50, 2.85],  // 仙 250-285%
  [3.20, 3.60],  // 圣 320-360%
]
const APTITUDE_DODGE: Array<[number, number]> = [
  [0.00, 0.01],  // 凡 0-1%
  [0.01, 0.03],  // 下 1-3%
  [0.03, 0.05],  // 中 3-5%
  [0.05, 0.08],  // 上 5-8%
  [0.08, 0.12],  // 极 8-12%
  [0.12, 0.16],  // 仙 12-16%
  [0.18, 0.22],  // 圣 18-22%
]
function rollRange(r: [number, number]): number {
  return +(r[0] + Math.random() * (r[1] - r[0])).toFixed(4)
}
// 阶段 → 出战属性百分比
const STAGE_MULTIPLIER: Record<string, number> = {
  infant: 0,        // 婴幼期不能出战
  child: 0,         // 童年期不能出战
  youth: 0.5,       // 少年 50%（2026-05-13 上调，原 30%，让体验期更早有存在感）
  adult_youth: 0.8, // 青年 80%（2026-05-13 上调，原 60%）
  adult: 1.0,       // 成年 100%
  grown: 1.0,       // 已离家 (回家时按 1.0)
}

export function calcChildBaseStats(
  aptitude: ChildAptitude,
  level: number
): {
  maxHp: number; atk: number; def: number; spd: number
  critRate: number; critDmg: number; dodge: number; lifesteal: number
  spirit: number; resistCtrl: number
} {
  const mul = APTITUDE_MULTIPLIER[aptitude] || 1
  const aptIdx = Math.min(Math.max(aptitude, 0), 6)
  // 基础四属性：按 level + 资质倍率成长（2026-05-12 调整：hp↑ atk↑ def↑ spd↓）
  // 二级属性会心率/会心伤害/闪避：浮动范围，**仅出生时滚一次**（详见上方 APTITUDE_CRIT_* 表）
  // 神识/控抗：依然按 level 成长（修仙叙事属性，不影响战斗 cap）
  return {
    maxHp: Math.floor(200 + level * 250 * mul),
    atk: Math.floor(20 + level * 22 * mul),
    def: Math.floor(15 + level * 10 * mul),
    spd: Math.floor(30 + level * 2.5 * mul),
    critRate: rollRange(APTITUDE_CRIT_RATE[aptIdx]),
    critDmg: rollRange(APTITUDE_CRIT_DMG[aptIdx]),
    dodge: rollRange(APTITUDE_DODGE[aptIdx]),
    lifesteal: 0,                                              // 默认 0，靠装备/天赋获取
    spirit: Math.floor(5 + level * 0.5 * mul),
    resistCtrl: +(0.05 + level * 0.0005 * mul).toFixed(4),
  }
}

// 阶段判定
export function getStageByLevel(level: number): string {
  if (level <= 10) return 'infant'
  if (level <= 30) return 'child'
  if (level <= 60) return 'youth'
  if (level <= 99) return 'adult_youth'
  return 'adult'
}

// 计算子女出战时的属性贡献（仅按阶段倍率缩水，2026-05-13 起去除 70% cap）
// 注：实际战斗已不调此函数，fight.post.ts 自行装配；保留以备脚本/快照使用。
export function calcChildBattleStats(
  child: ChildRow,
  _parentAtk: number,
  _parentDef: number,
  _parentMaxHp: number,
  _parentSpd: number
) {
  const stageMul = STAGE_MULTIPLIER[child.stage] || 0
  if (stageMul === 0) {
    return { atk: 0, def: 0, maxHp: 0, spd: 0, active: false }
  }
  return {
    atk: Math.floor(child.atk * stageMul),
    def: Math.floor(child.def * stageMul),
    maxHp: Math.floor(child.max_hp * stageMul),
    spd: Math.floor(child.spd * stageMul),
    active: true,
  }
}

// ============================================================
// 数据库操作
// ============================================================

export async function getChildrenByCharacter(pool: Pool, characterId: number): Promise<ChildRow[]> {
  const { rows } = await pool.query(
    'SELECT * FROM children WHERE character_id = $1 ORDER BY born_at DESC',
    [characterId]
  )
  return rows as ChildRow[]
}

export async function getChildById(pool: Pool, id: number, characterId: number): Promise<ChildRow | null> {
  const { rows } = await pool.query(
    'SELECT * FROM children WHERE id = $1 AND character_id = $2',
    [id, characterId]
  )
  return (rows[0] as ChildRow) || null
}

export async function countChildren(pool: Pool, characterId: number): Promise<number> {
  // 含已离家：总子女上限 5（在家 + 离家 合计），2026-05-11 小夏调整
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM children WHERE character_id = $1',
    [characterId]
  )
  return rows[0]?.cnt || 0
}

// 创建一个新子女（出生时调用）
export interface BirthInputs {
  characterId: number
  parentCompanionId: number
  parentSurname: string                 // 玩家姓
  playerAptitude: number
  playerElement: SpiritualRoot
  companionQuality: CompanionQuality
  companionElement: SpiritualRoot
}

export async function birthChild(
  client: any,
  inputs: BirthInputs
): Promise<{ child: ChildRow; talent: ChildTalent; skill: ChildSkill }> {
  const gender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female'
  const aptInfo = generateChildAptitude(inputs.playerAptitude, inputs.companionQuality)
  const rootInfo = generateChildElement(inputs.playerElement, inputs.companionElement)
  const name = generateChildName(inputs.parentSurname, gender)
  const baseStats = calcChildBaseStats(aptInfo.aptitude, 1)

  // 觉醒第一个天赋（20 级时获得，但出生时滚一次预留）
  const firstTalent = rollTalentByAptitude(aptInfo.aptitude)
  const innateSkill = pickInnateSkill(rootInfo.root, aptInfo.aptitude)

  const avatarId = `child_${gender}_${aptInfo.aptitude}`

  const { rows } = await client.query(
    `INSERT INTO children (
      character_id, parent_companion_id, name, gender, avatar_id,
      aptitude, spiritual_root, awakened,
      level, max_hp, atk, def, spd, stage,
      crit_rate, crit_dmg, dodge, lifesteal, spirit, resist_ctrl,
      learned_skills
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11, $12, 'infant',
              $13, $14, $15, $16, $17, $18, $19::jsonb)
    RETURNING *`,
    [
      inputs.characterId,
      inputs.parentCompanionId,
      name,
      gender,
      avatarId,
      aptInfo.aptitude,
      rootInfo.isDual ? 'mixed' : rootInfo.root,
      aptInfo.awakened,
      baseStats.maxHp,
      baseStats.atk,
      baseStats.def,
      baseStats.spd,
      baseStats.critRate,
      baseStats.critDmg,
      baseStats.dodge,
      baseStats.lifesteal,
      baseStats.spirit,
      baseStats.resistCtrl,
      JSON.stringify([{ skill_id: innateSkill.id, level: 1, type: 'innate' }]),
    ]
  )

  return { child: rows[0] as ChildRow, talent: firstTalent, skill: innateSkill }
}

// ============================================================
// 喂养升级
// ============================================================

const FEED_HERB_EXP: Record<string, number> = {
  // 复用 character_materials 中的灵草（按 quality 给经验）
  white: 50,
  green: 200,
  blue: 500,
  purple: 2000,
  gold: 10000,
  red: 30000,
}

export async function feedChild(
  pool: Pool,
  childId: number,
  characterId: number,
  herbId: string,
  herbQuality: string
): Promise<{ ok: boolean; message: string; data?: any }> {
  const child = await getChildById(pool, childId, characterId)
  if (!child) return { ok: false, message: '子女不存在' }

  const today = new Date().toISOString().slice(0, 10)
  const feedDate = child.feed_date ? String(child.feed_date).slice(0, 10) : ''
  const feedCnt = feedDate === today ? child.feed_count_today : 0
  if (feedCnt >= 5) return { ok: false, message: '今日喂养上限 5 次' }

  // 检查灵草库存
  const { rows: invRows } = await pool.query(
    `SELECT count FROM character_materials
      WHERE character_id = $1 AND material_id = $2 AND quality = $3`,
    [characterId, herbId, herbQuality]
  )
  const stock = invRows[0]?.count || 0
  if (stock < 1) return { ok: false, message: '灵草不足' }

  const expGain = FEED_HERB_EXP[herbQuality] || 50

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE character_materials SET count = count - 1
        WHERE character_id = $1 AND material_id = $2 AND quality = $3`,
      [characterId, herbId, herbQuality]
    )
    // 加经验、升级、换阶段
    const newExp = child.level_exp + expGain
    let newLevel = child.level
    let remainExp = newExp
    const levelCap = getChildLevelCap(child.aptitude)  // 按资质走 50/80/100/130/160/200/999
    while (remainExp >= newLevel * 100 && newLevel < levelCap) {  // 简化升级公式：lvl * 100 经验
      remainExp -= newLevel * 100
      newLevel++
    }
    const newStage = getStageByLevel(newLevel)
    const newStats = calcChildBaseStats(child.aptitude as ChildAptitude, newLevel)

    // 天赋觉醒（design 5.6.3）：每 20 级 1 个，最多 7 个槽位 (20/40/60/80/100/120/140)
    const TALENT_LEVELS = [20, 40, 60, 80, 100, 120, 140]
    const existingTalents = Array.isArray(child.awakened_talents) ? child.awakened_talents : []
    const newAwakened: Array<{ level: number; talent_id: string; rarity: string }> = [...existingTalents]
    for (const lv of TALENT_LEVELS) {
      // 已跨过该等级且尚未觉醒该槽位
      if (newLevel >= lv && !existingTalents.some((t: any) => t.level === lv)) {
        const t = rollTalentByAptitude(child.aptitude as ChildAptitude)
        newAwakened.push({ level: lv, talent_id: t.id, rarity: t.rarity })
      }
    }
    const newTalentsCount = newAwakened.length - existingTalents.length

    // 升级时不重滚 crit_rate/crit_dmg/dodge（出生时锁定），只刷新 level 相关的基础 4 + spirit + resist_ctrl
    await client.query(
      `UPDATE children SET
        level = $1, level_exp = $2, stage = $3,
        max_hp = $4, atk = $5, def = $6, spd = $7,
        spirit = $8, resist_ctrl = $9,
        feed_count_today = $10, feed_date = $11::date,
        awakened_talents = $12::jsonb
       WHERE id = $13`,
      [newLevel, remainExp, newStage,
       newStats.maxHp, newStats.atk, newStats.def, newStats.spd,
       newStats.spirit, newStats.resistCtrl,
       feedCnt + 1, today, JSON.stringify(newAwakened), childId]
    )
    await client.query('COMMIT')
    const newTalentNames = newAwakened.slice(existingTalents.length).map((t: any) => {
      const def = CHILD_TALENTS.find(x => x.id === t.talent_id)
      return def ? `${def.name}(${def.rarity})` : t.talent_id
    })
    const msg = newTalentsCount > 0
      ? `经验 +${expGain}，觉醒天赋：${newTalentNames.join(' / ')}`
      : `经验 +${expGain}`

    // 成就触发：子女成年（升级到 100 级）
    if (child.level < 100 && newLevel >= 100) {
      const { checkAchievements } = await import('~/server/engine/achievementData')
      checkAchievements(characterId, 'child_adult', 1).catch(() => {})
    }

    return { ok: true, message: msg, data: { level: newLevel, stage: newStage, expGain, newTalents: newTalentsCount } }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
