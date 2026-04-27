// 天道造化：抽奖 & 事件结算核心逻辑

import type { Pool } from 'pg'
import { getPool } from '~/server/database/db'
import { rand } from '~/server/utils/random'
import { applyCultivationExp, getExpRequired } from '~/server/utils/realm'
import {
  RANDOM_EVENTS,
  EVENT_MAP,
  RARITY_DISTRIBUTION,
  WINNER_COOLDOWN_MS,
  getStoneFloor,
  type EventRarity,
  type RandomEvent,
  type EventEffect,
} from '~/server/engine/randomEventData'
import { generateSecretRealmEquip, generateSecretRealmHerb } from '~/server/utils/secretRealmDrops'
import { PILL_RECIPES } from '~/game/pillData'

// ===================== 1. 候选池与抽奖 =====================

export interface Candidate {
  id: number
  name: string
  sect_id: number | null
  realm_tier: number
  realm_stage: number
  cultivation_exp: number
  spirit_stone: number
  created_at: Date
  event_last_won_at: Date | null
}

export async function pickCandidates(pool: Pool): Promise<Candidate[]> {
  const cooldownBefore = new Date(Date.now() - WINNER_COOLDOWN_MS)

  const { rows } = await pool.query(
    `SELECT id, name, sect_id, realm_tier, realm_stage, cultivation_exp, spirit_stone,
            created_at, event_last_won_at
       FROM characters
      WHERE event_last_won_at IS NULL OR event_last_won_at < $1`,
    [cooldownBefore]
  )
  return rows as Candidate[]
}

// 从候选池中按权重抽一人（目前固定权重 100，后续可接入福缘副属性）
export function pickWinner(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null
  // 长期未中奖加权：event_last_won_at 超过 7 天 → 权重 ×2
  const now = Date.now()
  const weights = candidates.map(c => {
    const last = c.event_last_won_at ? c.event_last_won_at.getTime() : 0
    const daysSince = last === 0 ? 999 : (now - last) / (24 * 60 * 60 * 1000)
    return daysSince >= 7 ? 200 : 100
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

// 按稀有度分布挑一档
function pickRarity(): EventRarity {
  const total = RARITY_DISTRIBUTION.common + RARITY_DISTRIBUTION.rare +
                RARITY_DISTRIBUTION.epic + RARITY_DISTRIBUTION.legendary
  let r = Math.random() * total
  if ((r -= RARITY_DISTRIBUTION.common) < 0) return 'common'
  if ((r -= RARITY_DISTRIBUTION.rare) < 0) return 'rare'
  if ((r -= RARITY_DISTRIBUTION.epic) < 0) return 'epic'
  return 'legendary'
}

// 根据玩家状态筛选可用事件池，再按稀有度抽一个事件
export function pickEvent(winner: Candidate): RandomEvent {
  const rarity = pickRarity()
  // 在目标档位中筛选满足条件的事件
  let pool = RANDOM_EVENTS.filter(e => {
    if (e.rarity !== rarity) return false
    if (e.requires?.inSect && !winner.sect_id) return false
    return true
  })
  // 兜底：档位空池时，放宽到全池（同样满足条件）
  if (pool.length === 0) {
    pool = RANDOM_EVENTS.filter(e => !e.requires?.inSect || winner.sect_id)
  }
  return pool[rand(0, pool.length - 1)]
}

// ===================== 2. 事件效果落库 =====================

const HERB_POOL = ['common_herb', 'metal_herb', 'wood_herb', 'water_herb', 'fire_herb', 'earth_herb']
const HERB_QUALITY_BY_TIER = ['white', 'white', 'green', 'green', 'blue', 'blue', 'purple', 'purple', 'gold']

export interface RewardDetail {
  summary: string[]             // 人类可读的奖励清单（用于弹窗和广播）
  stoneDelta: number
  cultDelta: number
  permHpPctDelta: number
  contribDelta: number
  equipment?: { name: string; rarity: string }
  material?: { name: string; quality: string; count: number }
  materialLost?: { name: string; count: number }
  pill?: { name: string }
  skill?: { id: string }
  skillUpgraded?: { id: string; level: number }
  breakthroughs: number
}

// 把一个事件的所有 effects 应用到玩家身上，返回实际生效的奖励明细
export async function applyEventEffects(
  pool: Pool,
  winner: Candidate,
  event: RandomEvent
): Promise<RewardDetail> {
  const tier = winner.realm_tier || 1
  const stage = winner.realm_stage || 1
  const reward: RewardDetail = {
    summary: [],
    stoneDelta: 0,
    cultDelta: 0,
    permHpPctDelta: 0,
    contribDelta: 0,
    breakthroughs: 0,
  }

  for (const eff of event.effects) {
    await applySingleEffect(pool, winner, eff, tier, stage, reward)
  }

  // 一次性写入 characters 表（累加）
  const updates: string[] = []
  const params: any[] = []
  let p = 1
  if (reward.stoneDelta !== 0) {
    updates.push(`spirit_stone = GREATEST(spirit_stone + $${p}, $${p + 1})`)
    // 下限保护：至少保留 getStoneFloor(tier)
    params.push(reward.stoneDelta, getStoneFloor(tier))
    p += 2
  }
  if (reward.cultDelta !== 0) {
    // 先加再过 applyCultivationExp 统一处理突破
    const newExp = Math.max(0, Number(winner.cultivation_exp || 0) + reward.cultDelta)
    const br = applyCultivationExp(newExp, tier, stage)
    reward.breakthroughs = br.breakthroughs
    updates.push(`cultivation_exp = $${p}`)
    updates.push(`realm_tier = $${p + 1}`)
    updates.push(`realm_stage = $${p + 2}`)
    params.push(br.cultivation_exp, br.realm_tier, br.realm_stage)
    p += 3
  }
  if (reward.permHpPctDelta !== 0) {
    updates.push(`permanent_hp_pct = permanent_hp_pct + $${p}`)
    params.push(reward.permHpPctDelta)
    p += 1
  }

  if (updates.length > 0) {
    params.push(winner.id)
    await pool.query(
      `UPDATE characters SET ${updates.join(', ')} WHERE id = $${p}`,
      params
    )
  }

  // 宗门贡献单独写
  if (reward.contribDelta !== 0 && winner.sect_id) {
    await pool.query(
      `UPDATE sect_members
          SET contribution = contribution + $1,
              total_contribution = total_contribution + $1,
              weekly_contribution = weekly_contribution + $1
        WHERE character_id = $2`,
      [reward.contribDelta, winner.id]
    )
  }

  return reward
}

async function applySingleEffect(
  pool: Pool,
  winner: Candidate,
  eff: EventEffect,
  tier: number,
  stage: number,
  reward: RewardDetail
): Promise<void> {
  switch (eff.kind) {
    case 'stones_add_t2': {
      const delta = eff.coef * tier * tier
      reward.stoneDelta += delta
      reward.summary.push(`灵石 +${delta.toLocaleString()}`)
      return
    }
    case 'stones_add_linear': {
      const delta = eff.coef * tier
      reward.stoneDelta += delta
      reward.summary.push(`灵石 +${delta.toLocaleString()}`)
      return
    }
    case 'stones_sub_pct': {
      const floor = getStoneFloor(tier)
      const current = Number(winner.spirit_stone || 0)
      const wanted = Math.floor(current * eff.pct / 100)
      const actualSub = Math.max(0, Math.min(wanted, current - floor))
      reward.stoneDelta -= actualSub
      reward.summary.push(`灵石 -${actualSub.toLocaleString()}`)
      return
    }
    case 'stones_sub_t2': {
      const floor = getStoneFloor(tier)
      const current = Number(winner.spirit_stone || 0)
      const wanted = eff.coef * tier * tier
      const actualSub = Math.max(0, Math.min(wanted, current - floor))
      reward.stoneDelta -= actualSub
      reward.summary.push(`灵石 -${actualSub.toLocaleString()}`)
      return
    }
    case 'cult_add_pct': {
      const req = getExpRequired(tier, stage)
      const delta = Math.floor(req * eff.pct / 100)
      reward.cultDelta += delta
      reward.summary.push(`修为 +${delta.toLocaleString()}`)
      return
    }
    case 'cult_sub_pct': {
      const req = getExpRequired(tier, stage)
      const wanted = Math.floor(req * eff.pct / 100)
      const current = Number(winner.cultivation_exp || 0)
      // 修为下限：不能为负，但允许回到当前境界 0
      const actualSub = Math.min(wanted, current)
      reward.cultDelta -= actualSub
      reward.summary.push(`修为 -${actualSub.toLocaleString()}`)
      return
    }
    case 'perm_hp_pct': {
      reward.permHpPctDelta += eff.pct
      reward.summary.push(`气血永久 +${eff.pct}%`)
      return
    }
    case 'material_add': {
      const count = rand(eff.min, eff.max)
      const herbId = HERB_POOL[rand(0, HERB_POOL.length - 1)]
      const quality = HERB_QUALITY_BY_TIER[Math.min(tier - 1, HERB_QUALITY_BY_TIER.length - 1)]
      await pool.query(
        `INSERT INTO character_materials (character_id, material_id, quality, count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (character_id, material_id, quality) DO UPDATE SET count = character_materials.count + $5`,
        [winner.id, herbId, quality, count, count]
      )
      const herbName = HERB_NAME_MAP[herbId] || herbId
      reward.material = { name: herbName, quality, count }
      reward.summary.push(`${QUALITY_NAME_MAP[quality] || ''}${herbName} ×${count}`)
      return
    }
    case 'material_sub': {
      const wanted = rand(eff.min, eff.max)
      // 查玩家库存，随机挑一种扣除
      const { rows } = await pool.query(
        `SELECT id, material_id, quality, count FROM character_materials
          WHERE character_id = $1 AND count > 0
          ORDER BY RANDOM() LIMIT 1`,
        [winner.id]
      )
      if (rows.length === 0) {
        reward.summary.push('灵草 -0（库存为空）')
        return
      }
      const row = rows[0]
      const actualSub = Math.min(wanted, Number(row.count))
      await pool.query(
        `UPDATE character_materials SET count = count - $1 WHERE id = $2`,
        [actualSub, row.id]
      )
      const herbName = HERB_NAME_MAP[row.material_id] || row.material_id
      reward.materialLost = { name: herbName, count: actualSub }
      reward.summary.push(`${herbName} -${actualSub}`)
      return
    }
    case 'pill_add': {
      // 按 tier 挑一颗丹药
      const pool1 = PILL_RECIPES.filter((p: any) => p.tierRequired <= Math.min(tier, eff.tier + 2))
      const candidates = pool1.length > 0 ? pool1 : PILL_RECIPES.filter((p: any) => p.tierRequired <= 1)
      const pill = candidates[rand(0, candidates.length - 1)]
      await pool.query(
        `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
         VALUES ($1, $2, 1, 1.0)
         ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
        [winner.id, pill.id]
      )
      reward.pill = { name: pill.name }
      reward.summary.push(`${pill.name} ×1`)
      return
    }
    case 'equipment_add': {
      const equip = generateEventEquip(tier, eff.difficulty, eff.isBoss, eff.forceWeapon || false)
      await pool.query(
        `INSERT INTO character_equipment
           (character_id, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, base_slot, req_level, enhance_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
        [
          winner.id, equip.name, equip.rarity, equip.primary_stat, equip.primary_value,
          equip.sub_stats, equip.set_id, equip.tier, equip.weapon_type, equip.base_slot, equip.req_level,
        ]
      )
      reward.equipment = { name: equip.name, rarity: equip.rarity }
      reward.summary.push(`装备【${equip.name}】`)
      return
    }
    case 'skill_add': {
      // 随机给一个功法碎片（基于 tier 池）
      const pools: Record<number, string[]> = {
        1: ['wind_blade', 'vine_whip', 'ice_palm', 'flame_sword', 'quake_fist', 'body_refine', 'flame_body'],
        3: ['fire_rain', 'frost_nova', 'earth_shield', 'golden_bell', 'swift_step', 'iron_skin'],
        5: ['sword_storm', 'twin_flame', 'spring_heal', 'blood_fury', 'wood_heal', 'mirror_water'],
        7: ['metal_burst', 'life_drain', 'storm_blade', 'heaven_heal', 'dao_heart'],
      }
      let poolArr = pools[1]
      if (tier >= 7) poolArr = pools[7]
      else if (tier >= 5) poolArr = pools[5]
      else if (tier >= 3) poolArr = pools[3]
      const skillId = poolArr[rand(0, poolArr.length - 1)]
      await pool.query(
        `INSERT INTO character_skill_inventory (character_id, skill_id, count)
         VALUES ($1, $2, 1)
         ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
        [winner.id, skillId]
      )
      reward.skill = { id: skillId }
      reward.summary.push(`功法【${skillId}】×1`)
      return
    }
    case 'equipped_skill_exp': {
      // 随机挑一条已装备功法，level +1（上限 5）——level 以 inventory 为唯一真相
      const { rows } = await pool.query(
        `SELECT cs.id, cs.skill_id, COALESCE(csi.level, cs.level, 1) AS level
           FROM character_skills cs
           LEFT JOIN character_skill_inventory csi
                  ON csi.character_id = cs.character_id AND csi.skill_id = cs.skill_id
          WHERE cs.character_id = $1 AND cs.equipped = TRUE
            AND COALESCE(csi.level, cs.level, 1) < 5
          ORDER BY RANDOM() LIMIT 1`,
        [winner.id]
      )
      if (rows.length === 0) {
        reward.summary.push('功法顿悟（已满级或未装备）')
        return
      }
      const row = rows[0]
      const newLevel = Number(row.level) + 1
      // 写 inventory（主权） + 同步所有同 skill_id 的 skills 镜像
      await pool.query(
        `UPDATE character_skill_inventory SET level = $1 WHERE character_id = $2 AND skill_id = $3`,
        [newLevel, winner.id, row.skill_id]
      )
      await pool.query(
        `UPDATE character_skills SET level = $1 WHERE character_id = $2 AND skill_id = $3`,
        [newLevel, winner.id, row.skill_id]
      )
      reward.skillUpgraded = { id: row.skill_id, level: newLevel }
      reward.summary.push(`功法【${row.skill_id}】升至 ${newLevel} 级`)
      return
    }
    case 'sect_contrib_add': {
      const delta = eff.coef * tier
      reward.contribDelta += delta
      reward.summary.push(`宗门贡献 +${delta}`)
      return
    }
  }
}

// ===================== 3. 装备生成辅助 =====================

function generateEventEquip(
  tier: number,
  difficulty: 1 | 2 | 3,
  isBoss: boolean,
  forceWeapon: boolean
): any {
  if (!forceWeapon) return generateSecretRealmEquip(tier, difficulty, isBoss, null)
  // 重试直到生成武器槽位
  for (let i = 0; i < 30; i++) {
    const eq = generateSecretRealmEquip(tier, difficulty, isBoss, null)
    if (eq.base_slot === 'weapon') return eq
  }
  return generateSecretRealmEquip(tier, difficulty, isBoss, null)
}

// ===================== 4. 文案渲染 =====================

export function renderTemplate(
  template: string,
  playerName: string,
  sectName: string | null
): string {
  return template
    .replace(/\{player\}/g, playerName)
    .replace(/\{sect\}/g, sectName || '某宗门')
}

// ===================== 5. 日志 & 广播入库 =====================

export async function saveEventLogAndBroadcast(
  pool: Pool,
  winner: Candidate,
  event: RandomEvent,
  reward: RewardDetail
): Promise<{ logId: number; broadcastText: string }> {
  // 取宗门名（如果事件涉及宗门）
  let sectName: string | null = null
  if (winner.sect_id) {
    const { rows } = await pool.query('SELECT name FROM sects WHERE id = $1', [winner.sect_id])
    if (rows.length > 0) sectName = rows[0].name
  }

  // 写事件日志
  const { rows: logRows } = await pool.query(
    `INSERT INTO character_event_log (character_id, event_id, rarity, is_positive, reward, claimed)
     VALUES ($1, $2, $3, $4, $5, FALSE)
     RETURNING id`,
    [winner.id, event.id, event.rarity, event.isPositive, JSON.stringify(reward)]
  )
  const logId = logRows[0].id as number

  // 更新玩家的中奖标记
  await pool.query(
    `UPDATE characters
        SET event_last_won_at = NOW(),
            event_pending_id = $1
      WHERE id = $2`,
    [logId, winner.id]
  )

  // 渲染广播
  const narration = renderTemplate(event.template, winner.name, sectName)
  const suffix = buildRewardSuffix(reward, event)
  const broadcastText = suffix ? `${narration}（${suffix}）` : narration

  await pool.query(
    `INSERT INTO world_broadcast
       (log_id, character_id, character_name, sect_id, event_id, rarity, is_positive, rendered_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [logId, winner.id, winner.name, winner.sect_id, event.id, event.rarity, event.isPositive, broadcastText]
  )

  return { logId, broadcastText }
}

// 为广播拼一个奖励摘要尾缀（只取最显眼的一两项）
function buildRewardSuffix(reward: RewardDetail, event: RandomEvent): string {
  const parts: string[] = []
  if (reward.equipment) parts.push(`喜得【${reward.equipment.name}】`)
  else if (reward.breakthroughs > 0) parts.push(`修为大进 ${reward.breakthroughs} 重小境界`)
  else if (reward.permHpPctDelta > 0) parts.push(`气血永久 +${reward.permHpPctDelta}%`)
  else if (reward.skill) parts.push(`得功法一卷`)
  else if (reward.skillUpgraded) parts.push(`功法精进至 ${reward.skillUpgraded.level} 级`)
  else if (reward.pill) parts.push(`得${reward.pill.name}一枚`)
  else if (reward.material) parts.push(`${reward.material.name} ×${reward.material.count}`)
  else if (!event.isPositive && reward.stoneDelta < 0) parts.push(`损失灵石 ${Math.abs(reward.stoneDelta).toLocaleString()}`)
  else if (reward.stoneDelta > 0) parts.push(`灵石 +${reward.stoneDelta.toLocaleString()}`)
  else if (reward.cultDelta < 0) parts.push(`修为略损`)
  return parts.slice(0, 2).join('，')
}

// ===================== 6. 名称映射 =====================

const HERB_NAME_MAP: Record<string, string> = {
  common_herb: '灵草',
  metal_herb: '锐金草',
  wood_herb: '青木叶',
  water_herb: '玄水苔',
  fire_herb: '赤焰花',
  earth_herb: '厚土参',
  spirit_grass: '仙灵草',
}

const QUALITY_NAME_MAP: Record<string, string> = {
  white: '凡品',
  green: '灵品',
  blue: '玄品',
  purple: '地品',
  gold: '天品',
  red: '仙品',
}

// ===================== 7. 辅助：按 event_id 取配置 =====================

export function getEvent(id: string): RandomEvent | null {
  return EVENT_MAP[id] || null
}
