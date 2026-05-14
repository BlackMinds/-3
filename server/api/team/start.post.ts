// 队长发起战斗：将房间状态切换为 fighting，并触发战斗计算
// 为了简化前端，战斗计算直接在此接口内完成
import { getPool } from '~/server/database/db'
import { buildEquippedSkillInfo, type BattlerStats } from '~/server/engine/battleEngine'
import { getRealmBonusAtLevel } from '~/server/engine/realmData'
import { getSectLevelConfig, getSectSkill, calcSectSkillEffect } from '~/server/engine/sectData'
import { getSecretRealm } from '~/server/engine/secretRealmData'
import { runTeamBattle, getTeamExpBonus, type TeamPlayerInput } from '~/server/engine/teamBattleEngine'
import { aggregateEquipmentSetInfo } from '~/server/engine/equipSetData'
import { getCharacterByUserId, ensureDailyReset, getRoomDetail, getSrDailyMax, SR_DAILY_FAIL_PROTECT } from '~/server/utils/team'
import { generateSecretRealmDrops, generateSecretRealmEquip, distributeEquipments, distributeAwakenItems, distributeEnhanceStones } from '~/server/utils/secretRealmDrops'
import { checkAchievements } from '~/server/engine/achievementData'
import { applyCultivationExp, applyLevelExp } from '~/server/utils/realm'
import { EQUIP_SELL_PRICES } from '~/server/utils/equipment'
import { WEAPON_BONUS, PLAYER_CAPS, EQUIP_BAG_LIMIT, COMPANION_SEAL_PCT } from '~/shared/balance'

// 构建单个玩家的战斗属性（简化版 buildPlayerStats，来自 battle/fight.post.ts）
async function buildPlayerBattleStats(char: any): Promise<{
  stats: BattlerStats
  equippedSkills: ReturnType<typeof buildEquippedSkillInfo>
  expBonusPercent: number
  luckPercent: number
}> {
  const pool = getPool()
  const { rows: equipRows } = await pool.query('SELECT * FROM character_equipment WHERE character_id = $1', [char.id])
  const { rows: skillRows } = await pool.query('SELECT * FROM character_skills WHERE character_id = $1 AND equipped = TRUE ORDER BY skill_type, slot_index', [char.id])
  const { rows: buffRows } = await pool.query('SELECT * FROM character_buffs WHERE character_id = $1 AND (expire_time > NOW() OR remaining_fights > 0)', [char.id])
  const { rows: caveRows } = await pool.query('SELECT * FROM character_cave WHERE character_id = $1', [char.id])

  // 宗门加成
  if (char.sect_id) {
    const { rows: sRows } = await pool.query('SELECT level FROM sects WHERE id = $1', [char.sect_id])
    if (sRows.length > 0) char._sectLevel = sRows[0].level
    const { rows: ssRows } = await pool.query('SELECT skill_key, level FROM sect_skills WHERE character_id = $1 AND frozen = FALSE', [char.id])
    char._sectSkills = ssRows
  }

  let atk = Number(char.atk)
  let def = Number(char.def)
  let maxHp = Number(char.max_hp)
  let spd = Number(char.spd)
  let critRate = Number(char.crit_rate || 0.05)
  let critDmg = Number(char.crit_dmg || 1.0)
  let dodge = Number(char.dodge || 0)
  let lifesteal = Number(char.lifesteal || 0)

  // 等级加成
  const lv = char.level || 1
  for (let i = 1; i < lv; i++) {
    if (i <= 50) { maxHp += 10; atk += 2; def += 1; spd += 1 }
    else if (i <= 100) { maxHp += 20; atk += 4; def += 2; spd += 2 }
    else if (i <= 150) { maxHp += 40; atk += 8; def += 4; spd += 3 }
    else { maxHp += 80; atk += 15; def += 8; spd += 5 }
  }

  // 境界加成
  const realmBonus = getRealmBonusAtLevel(char.realm_tier || 1, char.realm_stage || 1)
  maxHp += realmBonus.hp; atk += realmBonus.atk; def += realmBonus.def; spd += realmBonus.spd
  critRate += realmBonus.crit_rate; critDmg += realmBonus.crit_dmg; dodge += realmBonus.dodge

  // 武器类型加成已从 shared/balance.ts 导入

  let armorPen = 0, accuracy = 0, spirit = Number(char.spirit || 10), spiritDensity = 0, luck = 0
  const elementDmg = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }
  // v4.0 装备贡献的五行抗性 + 控制抗性 + 控制概率（小数 0.05 = 5%）
  const equipResist = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 }
  let equipCtrlChance = 0
  let weaponAtkPct = 0, weaponSpdPct = 0, weaponSpiritPct = 0
  let weaponCritRateFlat = 0, weaponCritDmgFlat = 0, weaponLifestealFlat = 0
  let equipAtkPct = 0, equipDefPct = 0, equipHpPct = 0, equipSpdPct = 0
  // v3.7 加法池：所有非功法被动 % 累加（小数, 0.10=10%），最后一次乘
  let nonPassiveAtkPct = 0, nonPassiveDefPct = 0, nonPassiveHpPct = 0, nonPassiveSpdPct = 0

  // v4.0 主属性 stat → 累加器分发（属性1 受强化 / 属性2 不受强化）
  // 含五行强化（饰品主属性）、SPIRIT_PCT（法宝物理向）、ATK_PCT/ARMOR_PEN（兵器属性2）等
  const applyEquipPrimary = (stat: string, value: number) => {
    if (stat === 'ATK') atk += value
    else if (stat === 'DEF') def += value
    else if (stat === 'HP') maxHp += value
    else if (stat === 'SPD') spd += value
    else if (stat === 'CRIT_RATE') critRate += value / 100
    else if (stat === 'CRIT_DMG') critDmg += value / 100
    else if (stat === 'SPIRIT') spirit += value
    else if (stat === 'ATK_PCT') equipAtkPct += value
    else if (stat === 'SPIRIT_PCT') weaponSpiritPct += value
    else if (stat === 'ARMOR_PEN') armorPen += value
    else if (stat === 'METAL_DMG') elementDmg.metal += value
    else if (stat === 'WOOD_DMG')  elementDmg.wood  += value
    else if (stat === 'WATER_DMG') elementDmg.water += value
    else if (stat === 'FIRE_DMG')  elementDmg.fire  += value
    else if (stat === 'EARTH_DMG') elementDmg.earth += value
  }

  // 双修副本：附灵静态加成累加器（运行时触发类 hooks 因 teamBattleEngine 不支持暂留 TODO）
  let awakenAtkPct = 0, awakenDefPct = 0, awakenHpPct = 0, awakenSpdPct = 0
  // v3.9：主修噬灵 — 来源 1) 戒指附灵 aw_main_lifesteal 2) 主修功法 innateMain.mainSkillLifesteal
  let mainSkillLifesteal = 0

  for (const eq of equipRows) {
    if (!eq.slot) continue

    // === 附灵静态加成（V4/V5 通用，必须在 V5 跳过前）===
    // teamBattleEngine 不消费 awakenState，所以 burnOnHit/chainAttack/reflectPct 等运行时触发类暂时失效
    // TODO: 双修副本接入完整 awakenState 需要在 teamBattleEngine 里织入 hooks
    const aw = typeof eq.awaken_effect === 'string' ? JSON.parse(eq.awaken_effect) : eq.awaken_effect
    if (aw && aw.stat) {
      const v = Number(aw.value) || 0
      switch (aw.stat) {
        // 静态属性加成 — 直接累加
        case 'lifesteal':     lifesteal += v; break
        case 'critRate':      critRate += v; break
        case 'critDmg':       critDmg += v; break
        case 'dodge':         dodge += v; break
        case 'spirit':        spirit += v; break
        case 'atkPct':        awakenAtkPct += v; break
        case 'defPct':        awakenDefPct += v; break
        case 'hpPct':         awakenHpPct  += v; break
        case 'spdPct':        awakenSpdPct += v; break
        case 'harmonyPct':
          awakenAtkPct += v; awakenDefPct += v; awakenHpPct += v; break
        // v3.9 主修噬灵（戒指 aw_main_lifesteal）
        case 'mainSkillLifesteal':
          mainSkillLifesteal += v; break
        // 五行元素伤害（小数 → ×100 进 elementDmg）
        case 'FIRE_DMG_PCT':  elementDmg.fire  += v * 100; break
        case 'METAL_DMG_PCT': elementDmg.metal += v * 100; break
        case 'WATER_DMG_PCT': elementDmg.water += v * 100; break
        case 'WOOD_DMG_PCT':  elementDmg.wood  += v * 100; break
        case 'EARTH_DMG_PCT': elementDmg.earth += v * 100; break
        // 命中 / 抗性
        case 'accuracyBonus': accuracy += v; break
        case 'ctrlResist':    equipResist.ctrl += v; break
        case 'allResistBonus':
          equipResist.metal += v; equipResist.wood += v; equipResist.water += v
          equipResist.fire  += v; equipResist.earth += v
          break
        // 运行时触发类暂不接（reflectPct/burnOnHit/chainAttack 等）— teamBattleEngine 不消费
      }
    }

    const enhLv = eq.enhance_level || 0
    // 属性1：受强化
    applyEquipPrimary(eq.primary_stat, Math.floor(eq.primary_value * (1 + enhLv * 0.10)))
    // 属性2：不受强化（v4.0 新增，老装备 NULL 跳过）
    if (eq.primary_stat_2 && eq.primary_value_2) {
      applyEquipPrimary(eq.primary_stat_2, eq.primary_value_2)
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
      else if (sub.stat === 'SPIRIT_DENSITY') spiritDensity += sub.value
      else if (sub.stat === 'LUCK') luck += sub.value
      else if (sub.stat === 'ATK_PCT') equipAtkPct += sub.value
      else if (sub.stat === 'DEF_PCT') equipDefPct += sub.value
      else if (sub.stat === 'HP_PCT') equipHpPct += sub.value
      else if (sub.stat === 'SPD_PCT') equipSpdPct += sub.value
      else if (sub.stat === 'SPIRIT_PCT') weaponSpiritPct += sub.value      // v4.0 神识%
      // v4.0 五行抗性 → resists.{metal/wood/water/fire/earth}（teamBattleEngine 已用作 DOT/元素减伤）
      else if (sub.stat === 'METAL_RES') equipResist.metal += sub.value / 100
      else if (sub.stat === 'WOOD_RES')  equipResist.wood  += sub.value / 100
      else if (sub.stat === 'WATER_RES') equipResist.water += sub.value / 100
      else if (sub.stat === 'FIRE_RES')  equipResist.fire  += sub.value / 100
      else if (sub.stat === 'EARTH_RES') equipResist.earth += sub.value / 100
      // v4.0 控制抗性 → resists.ctrl（teamBattleEngine 已用作 freeze/stun/root 抵抗）
      else if (sub.stat === 'CTRL_RES') equipResist.ctrl += sub.value / 100
      // v4.0 控制概率 → ctrlChance（teamBattleEngine.applyDebuffDps 处加成）
      else if (sub.stat === 'CTRL_CHANCE') equipCtrlChance += sub.value / 100
    }
  }

  // 武器+装备 % → 加法池
  nonPassiveAtkPct += (weaponAtkPct + equipAtkPct) / 100
  nonPassiveDefPct += equipDefPct / 100
  nonPassiveHpPct  += equipHpPct / 100
  nonPassiveSpdPct += (weaponSpdPct + equipSpdPct) / 100
  if (weaponSpiritPct > 0) spirit = Math.floor(spirit * (1 + weaponSpiritPct / 100))
  critRate += weaponCritRateFlat / 100
  critDmg += weaponCritDmgFlat / 100
  lifesteal += weaponLifestealFlat / 100

  // 附灵静态加成 → 加法池
  nonPassiveAtkPct += awakenAtkPct
  nonPassiveDefPct += awakenDefPct
  nonPassiveHpPct  += awakenHpPct
  nonPassiveSpdPct += awakenSpdPct

  // 丹药 → 加法池（保留 team 原有的简化数值 0.15/0.20/0.10）
  for (const buff of buffRows) {
    if (buff.expire_time && new Date(buff.expire_time).getTime() <= Date.now()) continue
    const qf = Number(buff.quality_factor) || 1.0
    if (buff.pill_id === 'atk_pill_1') nonPassiveAtkPct += 0.15 * qf
    if (buff.pill_id === 'def_pill_1') nonPassiveDefPct += 0.15 * qf
    if (buff.pill_id === 'hp_pill_1')  nonPassiveHpPct  += 0.20 * qf
    if (buff.pill_id === 'full_pill_1') {
      nonPassiveAtkPct += 0.10 * qf
      nonPassiveDefPct += 0.10 * qf
      nonPassiveHpPct  += 0.10 * qf
    }
  }

  // 洞府
  let expBonusPercent = 0
  for (const cave of caveRows) {
    if (cave.building_id === 'martial_hall' && cave.level > 0) expBonusPercent += 5 + (cave.level - 1) * 2
  }

  // 境界百分比 → 加法池
  if (realmBonus.hp_pct > 0) nonPassiveHpPct  += realmBonus.hp_pct / 100
  if (realmBonus.atk_pct > 0) nonPassiveAtkPct += realmBonus.atk_pct / 100
  if (realmBonus.def_pct > 0) nonPassiveDefPct += realmBonus.def_pct / 100

  // 永久加成 → 加法池
  const permAtkPct = Number(char.permanent_atk_pct || 0)
  const permDefPct = Number(char.permanent_def_pct || 0)
  const permHpPct = Number(char.permanent_hp_pct || 0)
  if (permAtkPct > 0) nonPassiveAtkPct += permAtkPct / 100
  if (permDefPct > 0) nonPassiveDefPct += permDefPct / 100
  if (permHpPct > 0) nonPassiveHpPct  += permHpPct / 100

  // 宗门加成 → 加法池
  if (char._sectLevel) {
    const sectCfg = getSectLevelConfig(char._sectLevel)
    nonPassiveAtkPct += sectCfg.atkBonus
    nonPassiveDefPct += sectCfg.defBonus
    expBonusPercent += sectCfg.expBonus * 100
  }
  if (char._sectSkills && Array.isArray(char._sectSkills)) {
    for (const ss of char._sectSkills) {
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
  }

  // 道侣仙缘印记 — 四维 +2%~+12%（与 fight.post.ts / 面板 mainStats 同口径）
  {
    const { rows: compRows } = await pool.query(
      `SELECT seal_level FROM companions WHERE character_id = $1 AND is_official = TRUE LIMIT 1`,
      [char.id]
    )
    if (compRows[0]?.seal_level > 0) {
      const sealPct = COMPANION_SEAL_PCT[Math.min(compRows[0].seal_level, 5)] || 0
      if (sealPct > 0) {
        nonPassiveAtkPct += sealPct
        nonPassiveDefPct += sealPct
        nonPassiveHpPct  += sealPct
        nonPassiveSpdPct += sealPct
      }
    }
  }

  // 加法池一次乘（不含功法被动 — teamBattleEngine 把功法 % 加进同池后再一次乘）
  const _flatAtk = atk, _flatDef = def, _flatHp = maxHp, _flatSpd = spd
  atk   = Math.floor(_flatAtk * (1 + nonPassiveAtkPct))
  def   = Math.floor(_flatDef * (1 + nonPassiveDefPct))
  maxHp = Math.floor(_flatHp  * (1 + nonPassiveHpPct))
  spd   = Math.floor(_flatSpd * (1 + nonPassiveSpdPct))

  // 先构建 equippedSkills，便于合并主修 innateMain.mainSkillLifesteal
  const equippedSkills = buildEquippedSkillInfo(skillRows)
  const innateMainLs = (equippedSkills?.activeSkill as any)?.innateMain?.mainSkillLifesteal || 0
  if (innateMainLs > 0) mainSkillLifesteal += innateMainLs

  // 玩家属性硬上限 (v3.0 从 shared/balance.ts 读取, 与 battle/fight.post.ts 保持一致)
  const stats: BattlerStats = {
    name: char.name, maxHp, hp: maxHp, atk, def, spd,
    crit_rate: Math.min(PLAYER_CAPS.critRate, critRate),
    crit_dmg: Math.min(PLAYER_CAPS.critDmg, critDmg),
    dodge: Math.min(PLAYER_CAPS.dodge, dodge),
    lifesteal: Math.min(PLAYER_CAPS.lifesteal, lifesteal),
    element: char.spiritual_root,
    // v4.0：DB 字段 + 装备副词条汇总（cap 70% 在 teamBattleEngine 内做）
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
    armorPen: Math.min(PLAYER_CAPS.armorPen, armorPen),
    accuracy: Math.min(PLAYER_CAPS.accuracy, accuracy),
    elementDmg, spirit,
    // v1 套装：已穿戴件数 + 主武器类型，teamBattleEngine 调用 buildSetEffects 解析
    ...aggregateEquipmentSetInfo(equipRows),
    // v3.7 加法池：teamBattleEngine 把功法 % 加进同池后一次乘
    _flatAtk, _flatDef, _flatHp, _flatSpd,
    _pctSumAtk: nonPassiveAtkPct, _pctSumDef: nonPassiveDefPct,
    _pctSumHp: nonPassiveHpPct,   _pctSumSpd: nonPassiveSpdPct,
    // v3.9 主修噬灵（teamBattleEngine.applySetDamage 在主修攻击命中时按 maxHp×系数回血）
    mainSkillLifesteal,
  } as any
  return { stats, equippedSkills, expBonusPercent: expBonusPercent + spiritDensity, luckPercent: luck }
}

export default defineEventHandler(async (event) => {
  let lockedRoomId: number | null = null
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    // 僵死房间清理：fighting 超过 5 分钟视为崩溃残留，回退到 waiting
    // 战斗本应在秒级完成，超过 5 分钟必然是异常
    await pool.query(
      `UPDATE team_rooms SET status = 'waiting', started_at = NULL
       WHERE status = 'fighting' AND started_at < NOW() - INTERVAL '5 minutes'`
    )

    // 查询所在房间
    const { rows: mRows } = await pool.query(
      `SELECT tm.*, tr.id AS room_id, tr.status, tr.secret_realm_id, tr.difficulty, tr.leader_id
       FROM team_members tm
       JOIN team_rooms tr ON tm.room_id = tr.id
       WHERE tm.character_id = $1 AND tr.status = 'waiting'`,
      [char.id]
    )
    if (mRows.length === 0) return { code: 400, message: '你不在任何等待中的房间' }
    const membership = mRows[0]
    if (!membership.is_leader) return { code: 403, message: '只有队长可以发起战斗' }
    const roomId: number = membership.room_id
    const realmId: string = membership.secret_realm_id
    const difficulty: 1 | 2 | 3 = membership.difficulty

    const realm = getSecretRealm(realmId)
    if (!realm) return { code: 400, message: '秘境数据错误' }

    // 校验所有成员都已准备
    const { rows: allMembers } = await pool.query(
      `SELECT tm.*, c.* FROM team_members tm
       JOIN characters c ON tm.character_id = c.id
       WHERE tm.room_id = $1
       ORDER BY tm.is_leader DESC, tm.join_time ASC`,
      [roomId]
    )
    if (allMembers.length < 1) return { code: 400, message: '队伍人数不足' }
    const notReady = allMembers.filter(m => !m.is_leader && !m.is_ready)
    if (notReady.length > 0) {
      return { code: 400, message: `还有 ${notReady.length} 人未准备` }
    }

    // 每人是否有次数（决定是否发奖励 / 扣次数 / 记首通）—— "带人"模式允许无次数队员参战但不拿奖励
    const hasQuotaMap = new Map<number, boolean>()
    for (const m of allMembers) {
      const ensured = await ensureDailyReset(m.id, m)
      const max = getSrDailyMax(ensured)
      hasQuotaMap.set(m.id, (ensured.sr_daily_count || 0) < max)
    }
    // 至少需要一个有次数的人才能开战（否则全队带人没意义，多半是误操作）
    if (![...hasQuotaMap.values()].some(v => v)) {
      return { code: 400, message: '队伍中没有任何人今日还有秘境次数' }
    }

    // 锁定房间，进入战斗（条件 UPDATE：仅 waiting 状态可被锁定，防并发重复发起）
    const { rowCount: locked } = await pool.query(
      `UPDATE team_rooms SET status = 'fighting', started_at = NOW() WHERE id = $1 AND status = 'waiting'`,
      [roomId]
    )
    if (!locked) return { code: 400, message: '房间已被锁定或已结束，请刷新后重试' }
    lockedRoomId = roomId

    // 构建每个玩家的战斗属性
    const playerInputs: TeamPlayerInput[] = []
    let totalExpBonusPercent = 0
    let totalLuckPercent = 0
    const charMap = new Map<number, any>()
    for (const m of allMembers) {
      const { stats, equippedSkills, expBonusPercent, luckPercent } = await buildPlayerBattleStats(m)
      playerInputs.push({
        characterId: m.id,
        name: m.name,
        stats,
        equippedSkills,
        spiritualRoot: m.spiritual_root,
        sectId: m.sect_id || null,
      })
      totalExpBonusPercent += expBonusPercent
      totalLuckPercent += luckPercent
      charMap.set(m.id, m)
    }

    // 跑战斗
    const result = runTeamBattle(realm, difficulty, playerInputs)

    // ========== 结算奖励 ==========
    const cfg = realm.difficulties[difficulty]
    // 基础战力：用 SR 对应 tier 的平均怪物灵石+经验 × 波数 × 难度倍率
    const avgMonsterPower = cfg.waves.reduce((s, w) => s + w.monsterCount, 0) // 总怪物数量
    const baseStoneUnit = 50 * realm.dropTier * realm.dropTier // 每只约 T^2 * 50 灵石
    const baseExpUnit = 100 * realm.dropTier * realm.dropTier

    const rewardFactor = cfg.rewardMul * 1.5 // 1.5x 组队加成
    const totalBaseStone = Math.floor(avgMonsterPower * baseStoneUnit * rewardFactor)
    // v3.4.3: 秘境经验整体 ×0.7（1.2 → 0.84），修为/等级双经验同步缩
    // v2026-05-14: 经验/积分不再按贡献分摊，每人全额（贡献仅作战报展示）
    const totalBaseExp = Math.floor(avgMonsterPower * baseExpUnit * 0.84)

    // 失败只给 30%
    const rewardMul = result.won ? 1 : 0.3
    // 评分加成
    let ratingMul = 1.0
    if (result.rating === 'S') ratingMul = 1.5
    else if (result.rating === 'A') ratingMul = 1.25

    const basePoints = Math.floor(cfg.basePoints * rewardMul * ratingMul)
    // 宗门之力经验加成
    const expTeamBonus = getTeamExpBonus(playerInputs)

    // 记录战斗 + 贡献 + 奖励
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: bRows } = await client.query(
        `INSERT INTO secret_realm_battles (room_id, secret_realm_id, difficulty, result, waves_cleared, total_turns, rating, battle_log, finished_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id`,
        [roomId, realmId, difficulty, result.won ? 'victory' : 'defeat', result.wavesCleared, result.totalTurns, result.rating, JSON.stringify(result.logs)]
      )
      const battleId = bRows[0].id

      // ========== 生成装备/灵草/附灵掉落（战斗胜利才给）==========
      // v2026-05-14: 秘境不再掉落功法残页
      let drops = { equipments: [] as any[], bossEquipments: [] as any[], herbs: [] as any[], awakenStones: 0, rerollStones: 0, enhanceStones: 0 }
      // 实际能拿奖励的人数（带人模式下，无次数队员不在分配名单，保底也按这个算）
      // 之前用 allMembers.length 会让"3 人带 1 人"的场景按 4 件保底全砸给那 1 个有次数的人 → 装备暴增
      const quotaCount = [...hasQuotaMap.values()].filter(v => v).length
      if (result.won) {
        drops = generateSecretRealmDrops(
          realm.dropTier, difficulty,
          result.killedMonsters.map(k => ({ element: k.element, isBoss: k.isBoss })),
          quotaCount,
        )
        // v3.4: S 评级团队奖励 — 额外送 1 件红装（由 distributeEquipments 随机派发）
        if (result.rating === 'S' && result.killedMonsters.length > 0) {
          const randomKill = result.killedMonsters[Math.floor(Math.random() * result.killedMonsters.length)]
          drops.bossEquipments.push(
            generateSecretRealmEquip(realm.dropTier, difficulty, false, randomKill.element, 5)
          )
        }
      }

      // 装备分配（仅分给有次数的队员；无次数的"带队"玩家不在分配名单）
      const contribList = result.contributions
        .filter(c => hasQuotaMap.get(c.characterId))
        .map(c => ({ characterId: c.characterId, contribution: c.contribution }))
      const allEquips = [...drops.equipments, ...drops.bossEquipments]
      const playerEquips = distributeEquipments(allEquips, contribList)

      // 灵草均分（同品质同类型聚合）
      const herbsPerPlayer = Math.floor(drops.herbs.length / contribList.length)
      const herbRemainder = drops.herbs.length % contribList.length
      const playerHerbs = new Map<number, any[]>()
      contribList.forEach((c, i) => {
        const count = herbsPerPlayer + (i < herbRemainder ? 1 : 0)
        playerHerbs.set(c.characterId, drops.herbs.slice(i * herbsPerPlayer, i * herbsPerPlayer + count))
      })
      // 修正切片
      {
        let offset = 0
        for (let i = 0; i < contribList.length; i++) {
          const count = herbsPerPlayer + (i < herbRemainder ? 1 : 0)
          playerHerbs.set(contribList[i].characterId, drops.herbs.slice(offset, offset + count))
          offset += count
        }
      }

      // 附灵道具分配：附灵石按人头均分，灵枢玉每件均匀随机
      const playerAwakenItems = distributeAwakenItems(drops.awakenStones, drops.rerollStones, contribList)
      // 强化石分配：按人头均分（对应 realm.dropTier，仅 T4+ 秘境会有产出）
      const playerEnhanceStones = distributeEnhanceStones(drops.enhanceStones, contribList)

      // 写入个人奖励 + 保存装备/灵草（v2026-05-14: 经验/积分每人全额，不再按贡献分摊；秘境不再掉落功法残页）
      const rewards: any[] = []
      for (const c of result.contributions) {
        const hasQuota = hasQuotaMap.get(c.characterId) ?? false
        const member = charMap.get(c.characterId)

        // 无次数的"带队"玩家：只写战斗贡献用于战报，不发任何奖励、不扣次数、不记首通、不触发成就
        if (!hasQuota) {
          await client.query(
            `INSERT INTO secret_realm_contributions (battle_id, character_id, damage_dealt, healing_done, damage_taken, contribution)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [battleId, c.characterId, c.damageDealt, c.healingDone, c.damageTaken, c.contribution]
          )
          rewards.push({
            character_id: c.characterId,
            name: c.name,
            spirit_stone: 0,
            exp_gained: 0,
            realm_points: 0,
            contribution: c.contribution,
            damage_dealt: c.damageDealt,
            healing_done: c.healingDone,
            damage_taken: c.damageTaken,
            equipments: [],
            herbs: [],
            awaken_items: { awaken_stone: 0, awaken_reroll: 0 },
            level_up: null,
            no_quota: true,
          })
          continue
        }

        // 试错保护：每天前 SR_DAILY_FAIL_PROTECT 次失败不扣次数（按玩家自身累计失败数判断）
        const todayFail = Number(member?.sr_daily_fail || 0)
        const isWin = result.won
        const isFailProtected = !isWin && todayFail < SR_DAILY_FAIL_PROTECT
        const countInc = isFailProtected ? 0 : 1
        const failInc = isWin ? 0 : 1

        // v2026-05-14: 不再按贡献分摊，每人全额（贡献仅作战报展示）
        void totalBaseStone
        const myStone = 0 // 怪物掉落灵石已停发
        const myExp = Math.floor(totalBaseExp * rewardMul * ratingMul * (1 + expTeamBonus))
        const myPoints = basePoints

        // --- 保存装备到 character_equipment（背包满 → 按基础售价转灵石） ---
        const equipIds: number[] = []
        const equipList = playerEquips.get(c.characterId) || []
        const { rows: bagRows } = await client.query(
          'SELECT COUNT(*)::int AS cnt FROM character_equipment WHERE character_id = $1 AND slot IS NULL',
          [c.characterId]
        )
        let bagCount: number = bagRows[0]?.cnt || 0
        let bagOverflowGain = 0
        for (const eq of equipList) {
          if (bagCount >= EQUIP_BAG_LIMIT) {
            bagOverflowGain += Math.floor((EQUIP_SELL_PRICES[eq.rarity] || 10) * (eq.tier || 1))
            continue
          }
          const { rows: eqRows } = await client.query(
            `INSERT INTO character_equipment (
               character_id, name, rarity, primary_stat, primary_value,
               primary_stat_2, primary_value_2, sub_stats, set_id, tier,
               weapon_type, base_slot, req_level, enhance_level,
               equipment_version, wuxing_prefix, wuxing_affixes, legendary_set_id, is_boss_treasure
             ) VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, $8, $9, $10,
               $11, $12, $13, 0,
               $14, $15, $16, $17, $18
             ) RETURNING id`,
            [
              c.characterId, eq.name, eq.rarity, eq.primary_stat, eq.primary_value,
              eq.primary_stat_2 || null, eq.primary_value_2 || null, eq.sub_stats, eq.set_id, eq.tier,
              eq.weapon_type, eq.base_slot, eq.req_level,
              eq.equipment_version ?? 4, eq.wuxing_prefix ?? null, eq.wuxing_affixes ?? null, eq.legendary_set_id ?? null, eq.is_boss_treasure ?? false,
            ]
          )
          equipIds.push(eqRows[0].id)
          bagCount++
        }
        if (bagOverflowGain > 0) {
          await client.query('UPDATE characters SET spirit_stone = LEAST(70000000000, spirit_stone + $1) WHERE id = $2', [bagOverflowGain, c.characterId])
        }

        // --- 保存灵草到 character_materials ---
        const herbList = playerHerbs.get(c.characterId) || []
        for (const h of herbList) {
          await client.query(
            `INSERT INTO character_materials (character_id, material_id, quality, count)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (character_id, material_id, quality) DO UPDATE SET count = character_materials.count + $5`,
            [c.characterId, h.herb_id, h.quality, h.count, h.count]
          )
        }

        // --- 保存附灵道具到 character_pills（与 SECT_ITEM_INFO 其他道具一致）---
        const awakenItemShare = playerAwakenItems.get(c.characterId) || { awaken_stone: 0, awaken_reroll: 0 }
        for (const [itemId, cnt] of Object.entries(awakenItemShare)) {
          if (cnt > 0) {
            await client.query(
              `INSERT INTO character_pills (character_id, pill_id, quality_factor, count)
               VALUES ($1, $2, 1.0, $3)
               ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + $3`,
              [c.characterId, itemId, cnt]
            )
          }
        }

        // 强化石入库（对应 realm.dropTier）
        const stoneShare = playerEnhanceStones.get(c.characterId) || 0
        if (stoneShare > 0 && realm.dropTier >= 4) {
          const stoneId = `enhance_stone_t${realm.dropTier}`
          await client.query(
            `INSERT INTO character_pills (character_id, pill_id, quality_factor, count)
             VALUES ($1, $2, 1.0, $3)
             ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + $3`,
            [c.characterId, stoneId, stoneShare]
          )
        }

        await client.query(
          `INSERT INTO secret_realm_contributions (battle_id, character_id, damage_dealt, healing_done, damage_taken, contribution)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [battleId, c.characterId, c.damageDealt, c.healingDone, c.damageTaken, c.contribution]
        )
        // --- 升级检查（统一使用 realm.ts 工具，与前端公式一致） ---
        const lvResult = applyLevelExp(Number(member?.level_exp || 0) + myExp, member?.level || 1)
        const newLevel = lvResult.level
        const newLevelExp = lvResult.level_exp

        await client.query(
          `INSERT INTO secret_realm_rewards (battle_id, character_id, spirit_stone, exp_gained, level_exp, realm_points, equipment_ids, extra_drops)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [battleId, c.characterId, myStone, myExp, newLevelExp, myPoints,
            JSON.stringify(equipIds),
            JSON.stringify({ herbs: herbList, enhance_stones: stoneShare > 0 ? { tier: realm.dropTier, count: stoneShare } : null })]
        )

        // 累加 cultivation_exp 并自动扣除突破
        const newExpTotal = Number(member?.cultivation_exp || 0) + myExp
        const br = applyCultivationExp(newExpTotal, member?.realm_tier || 1, member?.realm_stage || 1)

        // 更新角色（含等级+境界）
        await client.query(
          `UPDATE characters SET
             spirit_stone = LEAST(70000000000, spirit_stone + $1),
             cultivation_exp = $2,
             realm_tier = $3,
             realm_stage = $4,
             level_exp = $5,
             level = $6,
             realm_points = realm_points + $7,
             sr_daily_count = sr_daily_count + $8,
             sr_daily_fail = sr_daily_fail + $9,
             sr_daily_date = CURRENT_DATE,
             last_online = NOW()
           WHERE id = $10`,
          [myStone, br.cultivation_exp, br.realm_tier, br.realm_stage, newLevelExp, newLevel, myPoints, countInc, failInc, c.characterId]
        )

        rewards.push({
          character_id: c.characterId,
          name: c.name,
          spirit_stone: myStone,
          exp_gained: myExp,
          realm_points: myPoints,
          contribution: c.contribution,
          damage_dealt: c.damageDealt,
          healing_done: c.healingDone,
          damage_taken: c.damageTaken,
          equipments: equipList.map(e => ({ id: null, name: e.name, rarity: e.rarity, tier: e.tier, base_slot: e.base_slot })),
          herbs: herbList,
          awaken_items: awakenItemShare,
          enhance_stones: stoneShare > 0 ? { tier: realm.dropTier, count: stoneShare } : null,
          level_up: newLevel > (member?.level || 1) ? newLevel : null,
          fail_protected: isFailProtected,
        })

        // --- 成就触发（异步不阻塞） ---
        if (result.won) {
          checkAchievements(c.characterId, 'battle_count', 1).catch(() => {})
          checkAchievements(c.characterId, 'total_exp', myExp).catch(() => {})
          const bossCount = result.killedMonsters.filter(k => k.isBoss).length
          if (bossCount > 0) checkAchievements(c.characterId, 'boss_kill', bossCount).catch(() => {})
          for (const eq of equipList) {
            const key = `equip_${eq.rarity}`
            checkAchievements(c.characterId, key, 1).catch(() => {})
          }
          if (newLevel > (member?.level || 1)) checkAchievements(c.characterId, 'char_level', newLevel).catch(() => {})
        }
      }

      // 首通记录（仅给有次数的队员记；带人玩家不计入）
      if (result.won) {
        for (const m of allMembers) {
          if (!hasQuotaMap.get(m.id)) continue
          await client.query(
            `INSERT INTO secret_realm_clears (character_id, secret_realm_id, difficulty, best_rating, clear_count)
             VALUES ($1, $2, $3, $4, 1)
             ON CONFLICT (character_id, secret_realm_id, difficulty) DO UPDATE SET
               clear_count = secret_realm_clears.clear_count + 1,
               best_rating = CASE
                 WHEN secret_realm_clears.best_rating IS NULL THEN EXCLUDED.best_rating
                 WHEN EXCLUDED.best_rating = 'S' THEN 'S'
                 WHEN secret_realm_clears.best_rating = 'S' THEN 'S'
                 WHEN EXCLUDED.best_rating = 'A' THEN 'A'
                 WHEN secret_realm_clears.best_rating = 'A' THEN 'A'
                 ELSE EXCLUDED.best_rating
               END`,
            [m.id, realmId, difficulty, result.rating]
          )
        }
      }

      // 关闭房间
      await client.query(`UPDATE team_rooms SET status = 'finished', finished_at = NOW() WHERE id = $1`, [roomId])

      await client.query('COMMIT')

      return {
        code: 200,
        data: {
          battle_id: battleId,
          result: result.won ? 'victory' : 'defeat',
          waves_cleared: result.wavesCleared,
          total_waves: cfg.waves.length,
          total_turns: result.totalTurns,
          rating: result.rating,
          logs: result.logs,
          team_buffs: result.teamBuffs,
          rewards,
        },
      }
    } catch (e) {
      await client.query('ROLLBACK')
      // 错误时恢复房间状态
      await pool.query(`UPDATE team_rooms SET status = 'waiting', started_at = NULL WHERE id = $1`, [roomId])
      throw e
    } finally {
      client.release()
    }
  } catch (e: any) {
    console.error('秘境战斗失败:', e)
    // 兜底回滚房间状态：避免 fighting 永久卡死
    // （内层 catch 已处理事务内场景，这里覆盖事务外的异常路径）
    if (lockedRoomId) {
      await getPool().query(
        `UPDATE team_rooms SET status = 'waiting', started_at = NULL WHERE id = $1 AND status = 'fighting'`,
        [lockedRoomId]
      ).catch(() => {})
    }
    return { code: 500, message: '服务器错误：' + (e.message || e) }
  }
})
