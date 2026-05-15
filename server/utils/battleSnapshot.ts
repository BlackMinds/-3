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
import { buildEquippedSkillInfo, type BattlerStats, type EquippedSkillInfo, type PlayerAwakenState } from '~/server/engine/battleEngine'
import { aggregateEquipmentSetInfo } from '~/server/engine/equipSetData'
import { WEAPON_BONUS, COMPANION_SEAL_PCT } from '~/shared/balance'
import { computeV5EquipmentDelta, getDominantSkillWuxing } from '~/server/utils/equipmentAggregateV5'

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
      WHERE cs.character_id = $1 AND cs.equipped = TRUE
      ORDER BY cs.skill_type, cs.slot_index`,
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

  // 7. 道侣仙缘印记（与 fight.post.ts / 面板 mainStats 同口径）
  let companionSealPct = 0
  {
    const { rows: compRows } = await pool.query(
      `SELECT seal_level FROM companions WHERE character_id = $1 AND is_official = TRUE LIMIT 1`,
      [characterId]
    )
    if (compRows[0]?.seal_level > 0) {
      companionSealPct = COMPANION_SEAL_PCT[Math.min(compRows[0].seal_level, 5)] || 0
    }
  }

  // ===== 开始构建属性 =====
  let atk = Number(char.atk)
  let def = Number(char.def)
  let maxHp = Number(char.max_hp)
  let spd = Number(char.spd)
  let critRate = Number(char.crit_rate || 0.05)
  let critDmg = Number(char.crit_dmg || 1.0)
  let dodge = Number(char.dodge || 0)
  let lifesteal = Number(char.lifesteal || 0)
  let spirit = 10
  let armorPen = 0, accuracy = 0
  const elementDmg = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }
  // v4.0 装备贡献的五行抗性 + 控制抗性 + 控制概率（小数 0.05 = 5%）
  const equipResist = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 }
  let equipCtrlChance = 0

  // 等级加成
  const lv = char.level || 1
  for (let i = 1; i < lv; i++) {
    if (i <= 50)       { maxHp += 30;  atk += 2;  def += 1; spd += 1 }
    else if (i <= 100) { maxHp += 60;  atk += 4;  def += 2; spd += 2 }
    else if (i <= 150) { maxHp += 120; atk += 8;  def += 4; spd += 3 }
    else               { maxHp += 240; atk += 15; def += 8; spd += 5 }
  }

  // 境界加成
  const realmTier = char.realm_tier || 1
  const realmStage = char.realm_stage || 1
  const realmBonus = getRealmBonusAtLevel(realmTier, realmStage)
  maxHp += realmBonus.hp
  atk += realmBonus.atk
  def += realmBonus.def
  spd += realmBonus.spd

  // 装备 - 主属性 + 武器百分比 + 副属性
  let weaponAtkPct = 0, weaponSpdPct = 0, weaponSpiritPct = 0
  let weaponCritRateFlat = 0, weaponCritDmgFlat = 0, weaponLifestealFlat = 0
  let equipAtkPct = 0, equipDefPct = 0, equipHpPct = 0, equipSpdPct = 0
  // v3.7 反伤流派 PvP 对齐：装备副属性 REFLECT_PCT + 附灵 reflectPct (明镜甲/玄镜佩) 汇入 equipReflectPct
  let equipReflectPct = 0
  // V5 DOT 增伤副属性（小数 0.05=5%），multiBattleEngine 透传到 dotAmpPct
  let equipDotDmgPct = 0
  // v3.7 加法池：所有非功法被动 % 累加（小数, 0.10=10%），最后统一一次乘
  let nonPassiveAtkPct = 0, nonPassiveDefPct = 0, nonPassiveHpPct = 0, nonPassiveSpdPct = 0

  // v4.0: 主属性 stat → 各累加器（支持 primary_stat_1 受强化、primary_stat_2 不受强化）
  // 含五行强化、SPIRIT_PCT、ATK_PCT 等新增 stat key
  const applyPrimary = (stat: string, value: number) => {
    if (stat === 'ATK') atk += value
    else if (stat === 'DEF') def += value
    else if (stat === 'HP') maxHp += value
    else if (stat === 'SPD') spd += value
    else if (stat === 'CRIT_RATE') critRate += value / 100
    else if (stat === 'CRIT_DMG') critDmg += value / 100
    else if (stat === 'SPIRIT') spirit += value
    else if (stat === 'ATK_PCT') equipAtkPct += value         // v4.0 兵器/法宝属性2
    else if (stat === 'SPIRIT_PCT') weaponSpiritPct += value  // v4.0 法宝物理向属性2
    else if (stat === 'ARMOR_PEN') armorPen += value          // v4.0 兵器剑枪属性2
    else if (stat === 'METAL_DMG') elementDmg.metal += value  // v4.0 饰品（金项链）主属性
    else if (stat === 'WOOD_DMG')  elementDmg.wood  += value  // v4.0 饰品（玉佩）主属性
    else if (stat === 'WATER_DMG') elementDmg.water += value
    else if (stat === 'FIRE_DMG')  elementDmg.fire  += value
    else if (stat === 'EARTH_DMG') elementDmg.earth += value
  }

  // 附灵运行时状态（与 fight.post.ts 同名累加器对齐，最终塞进 stats.awaken）
  // 必须在 V5 聚合前声明，因为 V5 的 dmgReductionPct / skill_dmg_pct 也会写入 awaken
  const awaken: PlayerAwakenState = {}

  // === V5 装备聚合（design/system-equipment-v5-0-2.json）— 与 V4 并存 ===
  const v5Delta = computeV5EquipmentDelta(equipRows, char.spiritual_root ?? null, getDominantSkillWuxing(equippedSkills))
  atk += v5Delta.atk;  def += v5Delta.def;  maxHp += v5Delta.maxHp;  spd += v5Delta.spd;  spirit += v5Delta.spirit
  critRate += v5Delta.critRate;  critDmg += v5Delta.critDmg;  lifesteal += v5Delta.lifesteal;  dodge += v5Delta.dodge
  armorPen += v5Delta.armorPen;  accuracy += v5Delta.accuracy
  equipAtkPct += v5Delta.equipAtkPct;  equipDefPct += v5Delta.equipDefPct;  equipHpPct += v5Delta.equipHpPct;  equipSpdPct += v5Delta.equipSpdPct
  weaponSpiritPct += v5Delta.weaponSpiritPct
  equipReflectPct += v5Delta.equipReflectPct
  elementDmg.metal += v5Delta.elementDmg.metal
  elementDmg.wood  += v5Delta.elementDmg.wood
  elementDmg.water += v5Delta.elementDmg.water
  elementDmg.fire  += v5Delta.elementDmg.fire
  elementDmg.earth += v5Delta.elementDmg.earth
  // V5 专属 stat：lifestealAllPct + resistAllPct 接到 BattlerStats 标准字段
  lifesteal += v5Delta.lifestealAllPct
  equipResist.metal += v5Delta.resistAllPct
  equipResist.wood  += v5Delta.resistAllPct
  equipResist.water += v5Delta.resistAllPct
  equipResist.fire  += v5Delta.resistAllPct
  equipResist.earth += v5Delta.resistAllPct
  // V5 DOT 增伤 / 减伤 → 透传到 PvP fighter（与 fight.post.ts 口径一致）
  if (v5Delta.dotDmgPct > 0) equipDotDmgPct += v5Delta.dotDmgPct
  if (v5Delta.dmgReductionPct > 0) awaken.damageReduction = Math.min(0.20, (awaken.damageReduction || 0) + v5Delta.dmgReductionPct)
  // 元始天尊套装效果（1 件 +10% 攻防血神识身法）
  let v5SkillCdMinus = 0, v5RefreshShortestCdChance = 0, v5StunAllChance = 0, v5StunTurns = 0
  for (const eff of v5Delta.legendarySetEffects) {
    const e = eff.effect as any
    if (typeof e.atk_pct === 'number') nonPassiveAtkPct += e.atk_pct
    if (typeof e.def_pct === 'number') nonPassiveDefPct += e.def_pct
    if (typeof e.hp_pct === 'number')  nonPassiveHpPct  += e.hp_pct
    if (typeof e.spd_pct === 'number') nonPassiveSpdPct += e.spd_pct
    if (typeof e.spirit_pct === 'number' && e.spirit_pct > 0) spirit = Math.floor(spirit * (1 + e.spirit_pct))
    // 3 件套：神通伤害 +10%（走 mainSkillMultBonus 通道）
    if (typeof e.skill_dmg_pct === 'number' && e.skill_dmg_pct > 0) {
      awaken.mainSkillMultBonus = (awaken.mainSkillMultBonus || 0) + e.skill_dmg_pct
    }
    // 5 件套：神通 CD-1 + 10% 概率刷新最短 CD
    if (typeof e.skill_cd_minus === 'number') v5SkillCdMinus = Math.max(v5SkillCdMinus, e.skill_cd_minus)
    if (typeof e.refresh_shortest_cd_chance === 'number') v5RefreshShortestCdChance = Math.max(v5RefreshShortestCdChance, e.refresh_shortest_cd_chance)
    // 7 件套：10% 全体眩晕 1 回合（无视免控必中）
    if (typeof e.stun_all_chance === 'number') v5StunAllChance = Math.max(v5StunAllChance, e.stun_all_chance)
    if (typeof e.stun_turns === 'number') v5StunTurns = Math.max(v5StunTurns, e.stun_turns)
  }
  // 灵根共鸣 → 加法池
  if (v5Delta.lingenBonusPct > 0) {
    nonPassiveAtkPct += v5Delta.lingenBonusPct
    nonPassiveDefPct += v5Delta.lingenBonusPct
    nonPassiveHpPct  += v5Delta.lingenBonusPct
    if (spirit > 0) spirit = Math.floor(spirit * (1 + v5Delta.lingenBonusPct))
  }
  // === V5 装备聚合结束 ===

  let awakenAtkPct = 0, awakenDefPct = 0, awakenHpPct = 0, awakenSpdPct = 0

  for (const eq of equipRows) {
    if (!eq.slot) continue

    // === 附灵聚合（V4/V5 通用）===
    // 必须在 V5 跳过判断前，V5 装备的反伤/会心/burn 等 awaken hook 才能在 PK/宗门战/灵脉生效
    const aw = typeof eq.awaken_effect === 'string' ? JSON.parse(eq.awaken_effect) : eq.awaken_effect
    if (aw && aw.stat) {
      const v = Number(aw.value) || 0
      const meta = aw.meta || null
      switch (aw.stat) {
        // 属性加成类
        case 'lifesteal':          lifesteal += v; break
        case 'critRate':           critRate += v; break
        case 'critDmg':            critDmg += v; break
        case 'dodge':              dodge += v; break
        case 'spirit':             spirit += v; break
        case 'atkPct':             awakenAtkPct += v; break
        case 'defPct':             awakenDefPct += v; break
        case 'hpPct':              awakenHpPct  += v; break
        case 'spdPct':             awakenSpdPct += v; break
        case 'harmonyPct':
          awakenAtkPct += v; awakenDefPct += v; awakenHpPct += v; break
        // 五行·X 元素伤害（value 是 0-1 小数，elementDmg 用百分比值）
        case 'FIRE_DMG_PCT':       elementDmg.fire  += v * 100; break
        case 'METAL_DMG_PCT':      elementDmg.metal += v * 100; break
        case 'WATER_DMG_PCT':      elementDmg.water += v * 100; break
        case 'WOOD_DMG_PCT':       elementDmg.wood  += v * 100; break
        case 'EARTH_DMG_PCT':      elementDmg.earth += v * 100; break
        // 命中
        case 'accuracyBonus':      accuracy += v; break
        // 控制抗性 / 五系抗性（accumulate 后统一加到 equipResist）
        case 'ctrlResist':         equipResist.ctrl += v; break
        case 'allResistBonus':
          equipResist.metal += v; equipResist.wood += v; equipResist.water += v
          equipResist.fire  += v; equipResist.earth += v
          break
        // 反伤副词条/附灵
        case 'reflectPct':         equipReflectPct += v; break
        // 运行时触发 / 受击触发（由 multiBattleEngine.awakenState 通道消费）
        case 'armorPenPct':        awaken.armorPenPct = (awaken.armorPenPct || 0) + v; break
        case 'poisonOnHitTaken':   awaken.poisonOnHitTaken = Math.max(awaken.poisonOnHitTaken || 0, v); break
        case 'burnOnHitTaken':     awaken.burnOnHitTaken   = Math.max(awaken.burnOnHitTaken || 0, v); break
        case 'reflectOnCrit':      awaken.reflectOnCrit    = Math.max(awaken.reflectOnCrit || 0, v); break
        case 'burnOnHitChance':    awaken.burnOnHitChance   = (awaken.burnOnHitChance || 0) + v; break
        case 'poisonOnHitChance':  awaken.poisonOnHitChance = (awaken.poisonOnHitChance || 0) + v; break
        case 'bleedOnHitChance':   awaken.bleedOnHitChance  = (awaken.bleedOnHitChance || 0) + v; break
        case 'chainAttackChance':  awaken.chainAttackChance = (awaken.chainAttackChance || 0) + v; break
        case 'executeBonus':       awaken.executeBonus      = (awaken.executeBonus || 0) + v; break
        case 'lowHpAtkBonus':      awaken.lowHpAtkBonus     = (awaken.lowHpAtkBonus || 0) + v; break
        case 'lowHpDefBonus':      awaken.lowHpDefBonus     = (awaken.lowHpDefBonus || 0) + v; break
        case 'damageReduction':    awaken.damageReduction   = Math.min(0.20, (awaken.damageReduction || 0) + v); break
        case 'critTakenReduction': awaken.critTakenReduction = Math.min(0.50, (awaken.critTakenReduction || 0) + v); break
        case 'regenPerTurn':       awaken.regenPerTurn      = (awaken.regenPerTurn || 0) + v; break
        case 'cleanseInterval':
          if (v > 0) awaken.cleanseInterval = awaken.cleanseInterval ? Math.min(awaken.cleanseInterval, v) : v
          break
        case 'frenzyOpening':      awaken.frenzyOpening      = (awaken.frenzyOpening || 0) + v; break
        case 'vsBossBonus':        awaken.vsBossBonus        = (awaken.vsBossBonus || 0) + v; break
        case 'vsEliteBonus':       awaken.vsEliteBonus       = (awaken.vsEliteBonus || 0) + v; break
        case 'debuffDurationBonus':awaken.debuffDurationBonus = (awaken.debuffDurationBonus || 0) + v; break
        // 灵戒主修功法附灵
        case 'mainSkillMultBonus':  awaken.mainSkillMultBonus  = (awaken.mainSkillMultBonus || 0) + v; break
        case 'mainSkillCritRate':   awaken.mainSkillCritRate   = (awaken.mainSkillCritRate || 0) + v; break
        case 'mainSkillArmorPen':   awaken.mainSkillArmorPen   = (awaken.mainSkillArmorPen || 0) + v; break
        case 'mainSkillLifesteal':  awaken.mainSkillLifesteal  = (awaken.mainSkillLifesteal || 0) + v; break
        case 'mainSkillBleedAmp':
          awaken.mainSkillBleedAmp = v; awaken.mainSkillBleedAmpElem = meta?.requireElement; break
        case 'mainSkillPoisonAmp':
          awaken.mainSkillPoisonAmp = v; awaken.mainSkillPoisonAmpElem = meta?.requireElement; break
        case 'mainSkillFreezeChance':
          awaken.mainSkillFreezeChance = v; awaken.mainSkillFreezeChanceElem = meta?.requireElement; break
        case 'mainSkillBurnDuration':
          awaken.mainSkillBurnDuration = v; awaken.mainSkillBurnDurationElem = meta?.requireElement; break
        case 'mainSkillBurnAmp':
          awaken.mainSkillBurnAmp = v; awaken.mainSkillBurnAmpElem = meta?.requireElement; break
        case 'mainSkillBrittleAmp':
          awaken.mainSkillBrittleAmp = v; awaken.mainSkillBrittleAmpElem = meta?.requireElement; break
        case 'mainSkillChainChance': awaken.mainSkillChainChance = (awaken.mainSkillChainChance || 0) + v; break
        case 'mainSkillCritCdCut':   awaken.mainSkillCritCdCut   = true; break
        case 'mainSkillExecute':
          awaken.mainSkillExecuteBonus = v; awaken.mainSkillExecuteThr = meta?.threshold ?? 0.20; break
      }
    }

    if (eq.equipment_version === 5) continue  // V5 装备已由 computeV5EquipmentDelta 聚合，跳过 V4 主属/副属
    const enhLv = eq.enhance_level || 0
    // 属性1：受强化（base × (1 + 0.10 × enhLv)）
    const primary1 = Math.floor(eq.primary_value * (1 + enhLv * 0.10))
    applyPrimary(eq.primary_stat, primary1)
    // 属性2：不受强化（v4.0 新增，老装备 NULL）
    if (eq.primary_stat_2 && eq.primary_value_2) {
      applyPrimary(eq.primary_stat_2, eq.primary_value_2)
    }

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
      else if (sub.stat === 'SPIRIT_PCT') weaponSpiritPct += sub.value     // v4.0 神识%
      else if (sub.stat === 'REFLECT_PCT') equipReflectPct += sub.value / 100
      // v4.0 五行抗性 → resists.{metal/wood/water/fire/earth}（battleEngine 已用作 DOT/元素减伤）
      else if (sub.stat === 'METAL_RES') equipResist.metal += sub.value / 100
      else if (sub.stat === 'WOOD_RES')  equipResist.wood  += sub.value / 100
      else if (sub.stat === 'WATER_RES') equipResist.water += sub.value / 100
      else if (sub.stat === 'FIRE_RES')  equipResist.fire  += sub.value / 100
      else if (sub.stat === 'EARTH_RES') equipResist.earth += sub.value / 100
      // v4.0 控制抗性 → resists.ctrl（battleEngine 已用作 freeze/stun/root 抵抗）
      else if (sub.stat === 'CTRL_RES') equipResist.ctrl += sub.value / 100
      // v4.0 控制概率 → ctrlChance（battleEngine status apply 处加成）
      else if (sub.stat === 'CTRL_CHANCE') equipCtrlChance += sub.value / 100
    }
    // v3.7 反伤附灵 reflectPct 已在循环顶部统一处理（V4/V5 通用），此处不再重复
  }

  // 武器 + 装备副属性百分比 → 加法池
  nonPassiveAtkPct += (weaponAtkPct + equipAtkPct) / 100
  nonPassiveDefPct += equipDefPct / 100
  nonPassiveHpPct  += equipHpPct / 100
  nonPassiveSpdPct += (weaponSpdPct + equipSpdPct) / 100
  if (weaponSpiritPct > 0) spirit = Math.floor(spirit * (1 + weaponSpiritPct / 100))
  critRate += weaponCritRateFlat / 100
  critDmg += weaponCritDmgFlat / 100
  lifesteal += weaponLifestealFlat / 100

  // 附灵静态加成（atkPct/defPct/hpPct/spdPct/harmonyPct）→ 加法池
  nonPassiveAtkPct += awakenAtkPct
  nonPassiveDefPct += awakenDefPct
  nonPassiveHpPct  += awakenHpPct
  nonPassiveSpdPct += awakenSpdPct

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
    // 加法池：flat 进 flat 段，pct 进非功法 % 池
    atk   += pillAtkFlat
    def   += pillDefFlat
    maxHp += pillHpFlat
    nonPassiveAtkPct += pillAtkPct
    nonPassiveDefPct += pillDefPct
    nonPassiveHpPct  += pillHpPct
    nonPassiveSpdPct += pillSpdPct
    critRate += pillCritFlat
  }

  // 境界百分比 → 加法池
  if (realmBonus.hp_pct > 0) nonPassiveHpPct  += realmBonus.hp_pct / 100
  if (realmBonus.atk_pct > 0) nonPassiveAtkPct += realmBonus.atk_pct / 100
  if (realmBonus.def_pct > 0) nonPassiveDefPct += realmBonus.def_pct / 100

  // 永久属性 → 加法池
  const permAtkPct = Number(char.permanent_atk_pct || 0)
  const permDefPct = Number(char.permanent_def_pct || 0)
  const permHpPct = Number(char.permanent_hp_pct || 0)
  if (permAtkPct > 0) nonPassiveAtkPct += permAtkPct / 100
  if (permDefPct > 0) nonPassiveDefPct += permDefPct / 100
  if (permHpPct > 0) nonPassiveHpPct  += permHpPct / 100

  // 宗门等级加成 → 加法池
  if (sectLevel > 0) {
    const sectCfg = getSectLevelConfig(sectLevel)
    nonPassiveAtkPct += sectCfg.atkBonus
    nonPassiveDefPct += sectCfg.defBonus
  }

  // 宗门功法 → 加法池（spirit/armorPen 不在 4 项池里，保留原处理）
  for (const ss of sectSkills) {
    const skillCfg = getSectSkill(ss.skill_key)
    if (!skillCfg) continue
    const effects = calcSectSkillEffect(skillCfg, ss.level)
    if (effects.spirit_percent) spirit += Math.floor(spirit * effects.spirit_percent / 100)
    if (effects.hp_percent) nonPassiveHpPct += effects.hp_percent / 100
    if (effects.armor_pen_percent) armorPen += Math.floor(effects.armor_pen_percent)
    if (effects.all_percent) {
      nonPassiveAtkPct += effects.all_percent / 100
      nonPassiveDefPct += effects.all_percent / 100
      nonPassiveHpPct  += effects.all_percent / 100
      nonPassiveSpdPct += effects.all_percent / 100
    }
  }

  // ===== timed_buffs 合并（同 stat_key 累加） → 加法池 =====
  const timedAgg: Record<string, number> = {}
  for (const b of timedBuffs) {
    timedAgg[b.stat_key] = (timedAgg[b.stat_key] || 0) + Number(b.stat_value)
  }
  if (timedAgg.atk_pct) nonPassiveAtkPct += timedAgg.atk_pct / 100
  if (timedAgg.def_pct) nonPassiveDefPct += timedAgg.def_pct / 100
  if (timedAgg.hp_pct)  nonPassiveHpPct  += timedAgg.hp_pct / 100
  if (timedAgg.spd_pct) nonPassiveSpdPct += timedAgg.spd_pct / 100
  if (timedAgg.crit_rate) critRate += timedAgg.crit_rate / 100

  // 道侣仙缘印记 — 四维 +2%~+12%（与 fight.post.ts / 面板 mainStats 同口径）
  if (companionSealPct > 0) {
    nonPassiveAtkPct += companionSealPct
    nonPassiveDefPct += companionSealPct
    nonPassiveHpPct  += companionSealPct
    nonPassiveSpdPct += companionSealPct
  }

  // 加法池一次乘（不含功法被动 — buildPvpFighter 把功法 % 加进 _pctSum 后再一次乘）
  const _flatAtk = atk, _flatDef = def, _flatHp = maxHp, _flatSpd = spd
  atk   = Math.floor(_flatAtk * (1 + nonPassiveAtkPct))
  def   = Math.floor(_flatDef * (1 + nonPassiveDefPct))
  maxHp = Math.floor(_flatHp  * (1 + nonPassiveHpPct))
  spd   = Math.floor(_flatSpd * (1 + nonPassiveSpdPct))

  const stats: BattlerStats = {
    name: char.name,
    maxHp, hp: maxHp,
    atk, def, spd,
    crit_rate: critRate, crit_dmg: critDmg,
    dodge, lifesteal,
    element: char.spiritual_root,
    // v4.0：DB 字段 + 装备副词条汇总（cap 70% 在 battleEngine 内做）
    resists: {
      metal: Number(char.resist_metal || 0) + equipResist.metal,
      wood:  Number(char.resist_wood  || 0) + equipResist.wood,
      water: Number(char.resist_water || 0) + equipResist.water,
      fire:  Number(char.resist_fire  || 0) + equipResist.fire,
      earth: Number(char.resist_earth || 0) + equipResist.earth,
      ctrl:  Number(char.resist_ctrl  || 0) + equipResist.ctrl,
    },
    // v4.0：装备 CTRL_CHANCE 副词条 → 玩家施加 status 时加成
    ctrlChance: equipCtrlChance,
    spiritualRoot: char.spiritual_root,
    armorPen, accuracy, elementDmg,
    spirit,
    // v3.7 反伤流派 PvP 对齐：透传给 multiBattleEngine.buildPvpFighter
    equipReflectPct,
    // V5 DOT 增伤：透传给 multiBattleEngine.buildPvpFighter → dotAmpPct
    equipDotDmgPct,
    // v1 套装：已穿戴件数 + 主武器类型，buildPvpFighter 调用 buildSetEffects 解析
    ...aggregateEquipmentSetInfo(equipRows),
    // v3.7 加法池：flat 段总和 + 非功法 % 之和（小数, 0.10=10%）
    // buildPvpFighter 把功法 % 加进同池后一次乘
    _flatAtk, _flatDef, _flatHp, _flatSpd,
    _pctSumAtk: nonPassiveAtkPct, _pctSumDef: nonPassiveDefPct,
    _pctSumHp: nonPassiveHpPct,   _pctSumSpd: nonPassiveSpdPct,
    // 附灵运行时状态：buildPvpFighter 从 s.awaken.* 透传到 awakenState
    awaken,
    // V5 元始天尊 5/7 件套触发性效果：multiBattleEngine 在战斗循环中读取
    v5SkillCdMinus,
    v5RefreshShortestCdChance,
    v5StunAllChance,
    v5StunTurns,
  } as any

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
