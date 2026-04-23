/**
 * 战力快照工具 —— 为宗门战/灵脉潮汐等异步玩法提供独立的战斗属性构建
 *
 * 与 server/api/battle/fight.post.ts 中的 buildPlayerStats 相比：
 * - 支持 forbidPills 参数（宗门战单挑禁丹药）
 * - 合并 timed_buffs 表（玩法 Buff）
 * - 只使用官方 API（SQL + 公共工具），不依赖 fight.post.ts 的私有闭包
 * - 简化省去了部分附灵"运行时触发"效果，主属性对齐
 *
 * 对战双方都用同一套公式，保证公平；PvP 战力 vs PvE 战力可能有 ±5% 偏差。
 */

import { getPool } from '~/server/database/db'
import { getRealmBonusAtLevel } from '~/server/engine/realmData'
import { getSectLevelConfig, getSectSkill, calcSectSkillEffect } from '~/server/engine/sectData'
import { buildEquippedSkillInfo, type BattlerStats, type EquippedSkillInfo } from '~/server/engine/battleEngine'
import { WEAPON_BONUS } from '~/shared/balance'

export interface SnapshotOptions {
  forbidPills?: boolean       // 禁用战斗中丹药 (宗门战单挑用)
  includeTimedBuffs?: boolean // 合并 timed_buffs (默认 true)
}

export interface CharacterSnapshot {
  characterId: number
  name: string
  stats: BattlerStats
  equippedSkills: EquippedSkillInfo
  powerScore: number  // 战力综合值，用于匹配与赔率计算
}

export async function buildCharacterSnapshot(
  characterId: number,
  options: SnapshotOptions = {}
): Promise<CharacterSnapshot | null> {
  const forbidPills = !!options.forbidPills
  const includeTimedBuffs = options.includeTimedBuffs !== false
  const pool = getPool()

  // 1. 角色基础数据
  const { rows: charRows } = await pool.query('SELECT * FROM characters WHERE id = $1', [characterId])
  if (charRows.length === 0) return null
  const char = charRows[0]

  // 2. 装备
  const { rows: equipRows } = await pool.query(
    `SELECT * FROM character_equipment WHERE character_id = $1 AND slot IS NOT NULL`,
    [characterId]
  )

  // 3. 技能（level 以 inventory 为唯一真相，character_skills.level 只是镜像）
  const { rows: skillRows } = await pool.query(
    `SELECT cs.id, cs.character_id, cs.skill_id, cs.skill_type, cs.slot_index,
            cs.equipped, cs.created_at,
            COALESCE(csi.level, cs.level, 1) AS level
       FROM character_skills cs
       LEFT JOIN character_skill_inventory csi
              ON csi.character_id = cs.character_id AND csi.skill_id = cs.skill_id
      WHERE cs.character_id = $1 AND cs.equipped = TRUE`,
    [characterId]
  )
  const equippedSkills = buildEquippedSkillInfo(skillRows)

  // 4. 丹药 buff（可禁用）
  const { rows: buffRows } = forbidPills
    ? { rows: [] as any[] }
    : await pool.query(
        `SELECT * FROM character_buffs WHERE character_id = $1
          AND (expire_time IS NULL OR expire_time > NOW())`,
        [characterId]
      )

  // 5. timed_buffs（玩法 Buff）
  const timedBuffs: { stat_key: string; stat_value: number }[] = includeTimedBuffs
    ? (
        await pool.query(
          `SELECT stat_key, stat_value FROM timed_buffs
            WHERE character_id = $1 AND expires_at > NOW()`,
          [characterId]
        )
      ).rows
    : []

  // 6. 宗门等级 & 宗门功法
  let sectLevel = 0
  let sectSkills: { skill_key: string; level: number }[] = []
  if (char.sect_id) {
    const { rows: sectRows } = await pool.query('SELECT level FROM sects WHERE id = $1', [char.sect_id])
    sectLevel = sectRows[0]?.level || 0
    // 宗门功法按角色存储（每个角色独立学习/升级）
    const { rows: ssRows } = await pool.query(
      `SELECT skill_key, level FROM sect_skills WHERE character_id = $1`,
      [characterId]
    )
    sectSkills = ssRows
  }

  // ===== 开始构建属性 =====
  let atk = Number(char.atk)
  let def = Number(char.def)
  let maxHp = Number(char.max_hp)
  let spd = Number(char.spd)
  let critRate = Number(char.crit_rate || 0.05)
  let critDmg = Number(char.crit_dmg || 1.5)
  let dodge = Number(char.dodge || 0)
  let lifesteal = Number(char.lifesteal || 0)
  let spirit = 10
  let armorPen = 0, accuracy = 0
  const elementDmg = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }

  // 等级加成
  const lv = char.level || 1
  for (let i = 1; i < lv; i++) {
    if (i <= 50)       { maxHp += 5;  atk += 2;  def += 1; spd += 1 }
    else if (i <= 100) { maxHp += 10; atk += 4;  def += 2; spd += 2 }
    else if (i <= 150) { maxHp += 20; atk += 8;  def += 4; spd += 3 }
    else               { maxHp += 40; atk += 15; def += 8; spd += 5 }
  }

  // 境界加成
  const realmTier = char.realm_tier || 1
  const realmStage = char.realm_stage || 1
  const realmBonus = getRealmBonusAtLevel(realmTier, realmStage)
  maxHp += realmBonus.hp
  atk += realmBonus.atk
  def += realmBonus.def
  spd += realmBonus.spd
  critRate += realmBonus.crit_rate
  critDmg += realmBonus.crit_dmg
  dodge += realmBonus.dodge

  // 装备 - 主属性 + 武器百分比 + 副属性
  let weaponAtkPct = 0, weaponSpdPct = 0, weaponSpiritPct = 0
  let weaponCritRateFlat = 0, weaponCritDmgFlat = 0, weaponLifestealFlat = 0
  let equipAtkPct = 0, equipDefPct = 0, equipHpPct = 0, equipSpdPct = 0

  for (const eq of equipRows) {
    if (!eq.slot) continue
    const enhLv = eq.enhance_level || 0
    const primary = Math.floor(eq.primary_value * (1 + enhLv * 0.10))
    if (eq.primary_stat === 'ATK') atk += primary
    else if (eq.primary_stat === 'DEF') def += primary
    else if (eq.primary_stat === 'HP') maxHp += primary
    else if (eq.primary_stat === 'SPD') spd += primary
    else if (eq.primary_stat === 'CRIT_RATE') critRate += primary / 100
    else if (eq.primary_stat === 'SPIRIT') spirit += primary

    if (eq.weapon_type && WEAPON_BONUS[eq.weapon_type]) {
      const wb = WEAPON_BONUS[eq.weapon_type]
      if (wb.ATK_pct) weaponAtkPct += wb.ATK_pct
      if (wb.SPD_pct) weaponSpdPct += wb.SPD_pct
      if (wb.SPIRIT_pct) weaponSpiritPct += wb.SPIRIT_pct
      if (wb.CRIT_RATE_flat) weaponCritRateFlat += wb.CRIT_RATE_flat
      if (wb.CRIT_DMG_flat) weaponCritDmgFlat += wb.CRIT_DMG_flat
      if (wb.LIFESTEAL_flat) weaponLifestealFlat += wb.LIFESTEAL_flat
    }

    const subs = typeof eq.sub_stats === 'string' ? JSON.parse(eq.sub_stats) : (eq.sub_stats || [])
    for (const sub of subs) {
      if (sub.stat === 'ATK') atk += sub.value
      else if (sub.stat === 'DEF') def += sub.value
      else if (sub.stat === 'HP') maxHp += sub.value
      else if (sub.stat === 'SPD') spd += sub.value
      else if (sub.stat === 'CRIT_RATE') critRate += sub.value / 100
      else if (sub.stat === 'CRIT_DMG') critDmg += sub.value / 100
      else if (sub.stat === 'LIFESTEAL') lifesteal += sub.value / 100
      else if (sub.stat === 'DODGE') dodge += sub.value / 100
      else if (sub.stat === 'ARMOR_PEN') armorPen += sub.value
      else if (sub.stat === 'ACCURACY') accuracy += sub.value
      else if (sub.stat === 'METAL_DMG') elementDmg.metal += sub.value
      else if (sub.stat === 'WOOD_DMG') elementDmg.wood += sub.value
      else if (sub.stat === 'WATER_DMG') elementDmg.water += sub.value
      else if (sub.stat === 'FIRE_DMG') elementDmg.fire += sub.value
      else if (sub.stat === 'EARTH_DMG') elementDmg.earth += sub.value
      else if (sub.stat === 'SPIRIT') spirit += sub.value
      else if (sub.stat === 'ATK_PCT') equipAtkPct += sub.value
      else if (sub.stat === 'DEF_PCT') equipDefPct += sub.value
      else if (sub.stat === 'HP_PCT') equipHpPct += sub.value
      else if (sub.stat === 'SPD_PCT') equipSpdPct += sub.value
    }
  }

  // 武器 + 装备副属性百分比（合并一次乘法）
  const totalAtkPct = weaponAtkPct + equipAtkPct
  const totalSpdPct = weaponSpdPct + equipSpdPct
  if (totalAtkPct > 0) atk = Math.floor(atk * (1 + totalAtkPct / 100))
  if (equipDefPct > 0) def = Math.floor(def * (1 + equipDefPct / 100))
  if (equipHpPct > 0) maxHp = Math.floor(maxHp * (1 + equipHpPct / 100))
  if (totalSpdPct > 0) spd = Math.floor(spd * (1 + totalSpdPct / 100))
  if (weaponSpiritPct > 0) spirit = Math.floor(spirit * (1 + weaponSpiritPct / 100))
  critRate += weaponCritRateFlat / 100
  critDmg += weaponCritDmgFlat / 100
  lifesteal += weaponLifestealFlat / 100

  // 丹药 buff（除非 forbidPills）
  if (!forbidPills) {
    const PILL_PCT_CAP = 0.40
    let pillAtkPct = 0, pillDefPct = 0, pillHpPct = 0, pillSpdPct = 0
    let pillAtkFlat = 0, pillDefFlat = 0, pillHpFlat = 0
    let pillCritFlat = 0
    for (const buff of buffRows) {
      if (buff.expire_time && new Date(buff.expire_time).getTime() <= Date.now()) continue
      const qf = Number(buff.quality_factor) || 1.0
      switch (buff.pill_id) {
        case 'basic_atk_pill':  pillAtkFlat  += 20  * qf; break
        case 'basic_def_pill':  pillDefFlat  += 15  * qf; break
        case 'basic_hp_pill':   pillHpFlat   += 300 * qf; break
        case 'basic_crit_pill': pillCritFlat += 0.03 * qf; break
        case 'atk_pill_1':      pillAtkPct   += 0.06 * qf; break
        case 'def_pill_1':      pillDefPct   += 0.06 * qf; break
        case 'hp_pill_1':       pillHpPct    += 0.08 * qf; break
        case 'elite_atk_pill':  pillAtkPct   += 0.10 * qf; break
        case 'elite_def_pill':  pillDefPct   += 0.10 * qf; break
        case 'elite_hp_pill':   pillHpPct    += 0.12 * qf; break
        case 'crit_pill_1':     pillCritFlat += 0.05 * qf; break
        case 'full_pill_1':
          pillAtkPct += 0.06 * qf
          pillDefPct += 0.06 * qf
          pillHpPct  += 0.06 * qf
          break
      }
    }
    pillAtkPct = Math.min(pillAtkPct, PILL_PCT_CAP)
    pillDefPct = Math.min(pillDefPct, PILL_PCT_CAP)
    pillHpPct  = Math.min(pillHpPct,  PILL_PCT_CAP)
    pillSpdPct = Math.min(pillSpdPct, PILL_PCT_CAP)
    atk   = Math.floor((atk   + pillAtkFlat) * (1 + pillAtkPct))
    def   = Math.floor((def   + pillDefFlat) * (1 + pillDefPct))
    maxHp = Math.floor((maxHp + pillHpFlat)  * (1 + pillHpPct))
    spd   = Math.floor(spd * (1 + pillSpdPct))
    critRate += pillCritFlat
  }

  // 境界百分比
  if (realmBonus.hp_pct > 0) maxHp = Math.floor(maxHp * (1 + realmBonus.hp_pct / 100))
  if (realmBonus.atk_pct > 0) atk = Math.floor(atk * (1 + realmBonus.atk_pct / 100))
  if (realmBonus.def_pct > 0) def = Math.floor(def * (1 + realmBonus.def_pct / 100))

  // 永久属性
  const permAtkPct = Number(char.permanent_atk_pct || 0)
  const permDefPct = Number(char.permanent_def_pct || 0)
  const permHpPct = Number(char.permanent_hp_pct || 0)
  if (permAtkPct > 0) atk = Math.floor(atk * (1 + permAtkPct / 100))
  if (permDefPct > 0) def = Math.floor(def * (1 + permDefPct / 100))
  if (permHpPct > 0) maxHp = Math.floor(maxHp * (1 + permHpPct / 100))

  // 宗门等级加成
  if (sectLevel > 0) {
    const sectCfg = getSectLevelConfig(sectLevel)
    atk = Math.floor(atk * (1 + sectCfg.atkBonus))
    def = Math.floor(def * (1 + sectCfg.defBonus))
  }

  // 宗门功法
  for (const ss of sectSkills) {
    const skillCfg = getSectSkill(ss.skill_key)
    if (!skillCfg) continue
    const effects = calcSectSkillEffect(skillCfg, ss.level)
    if (effects.spirit_percent) spirit += Math.floor(spirit * effects.spirit_percent / 100)
    if (effects.hp_percent) maxHp = Math.floor(maxHp * (1 + effects.hp_percent / 100))
    if (effects.armor_pen_percent) armorPen += Math.floor(effects.armor_pen_percent)
    if (effects.all_percent) {
      atk = Math.floor(atk * (1 + effects.all_percent / 100))
      def = Math.floor(def * (1 + effects.all_percent / 100))
      maxHp = Math.floor(maxHp * (1 + effects.all_percent / 100))
      spd = Math.floor(spd * (1 + effects.all_percent / 100))
    }
  }

  // ===== timed_buffs 合并（同 stat_key 累加）=====
  const timedAgg: Record<string, number> = {}
  for (const b of timedBuffs) {
    timedAgg[b.stat_key] = (timedAgg[b.stat_key] || 0) + Number(b.stat_value)
  }
  if (timedAgg.atk_pct) atk = Math.floor(atk * (1 + timedAgg.atk_pct / 100))
  if (timedAgg.def_pct) def = Math.floor(def * (1 + timedAgg.def_pct / 100))
  if (timedAgg.hp_pct) maxHp = Math.floor(maxHp * (1 + timedAgg.hp_pct / 100))
  if (timedAgg.spd_pct) spd = Math.floor(spd * (1 + timedAgg.spd_pct / 100))
  if (timedAgg.crit_rate) critRate += timedAgg.crit_rate / 100

  const stats: BattlerStats = {
    name: char.name,
    maxHp, hp: maxHp,
    atk, def, spd,
    crit_rate: critRate, crit_dmg: critDmg,
    dodge, lifesteal,
    element: char.spiritual_root,
    resists: {
      metal: Number(char.resist_metal || 0),
      wood: Number(char.resist_wood || 0),
      water: Number(char.resist_water || 0),
      fire: Number(char.resist_fire || 0),
      earth: Number(char.resist_earth || 0),
      ctrl: Number(char.resist_ctrl || 0),
    },
    spiritualRoot: char.spiritual_root,
    armorPen, accuracy, elementDmg,
    spirit,
  }

  // 战力综合评分（用于匹配/赔率）
  const powerScore = Math.floor(atk * 2 + def * 2 + maxHp * 0.3 + spd * 1.5 + spirit * 1 + critRate * 500 + critDmg * 200)

  return { characterId, name: char.name, stats, equippedSkills, powerScore }
}

/**
 * 批量构建快照
 */
export async function buildCharacterSnapshots(
  characterIds: number[],
  options: SnapshotOptions = {}
): Promise<CharacterSnapshot[]> {
  const results: CharacterSnapshot[] = []
  for (const id of characterIds) {
    const snap = await buildCharacterSnapshot(id, options)
    if (snap) results.push(snap)
  }
  return results
}
