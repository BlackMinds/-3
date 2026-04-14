// 队长发起战斗：将房间状态切换为 fighting，并触发战斗计算
// 为了简化前端，战斗计算直接在此接口内完成
import { getPool } from '~/server/database/db'
import { buildEquippedSkillInfo, type BattlerStats } from '~/server/engine/battleEngine'
import { getRealmBonusAtLevel } from '~/server/engine/realmData'
import { getSectLevelConfig, getSectSkill, calcSectSkillEffect } from '~/server/engine/sectData'
import { getSecretRealm, getDailyCountByRealm } from '~/server/engine/secretRealmData'
import { runTeamBattle, getTeamExpBonus, type TeamPlayerInput } from '~/server/engine/teamBattleEngine'
import { getCharacterByUserId, ensureDailyReset, getRoomDetail } from '~/server/utils/team'
import { generateSecretRealmDrops, distributeEquipments } from '~/server/utils/secretRealmDrops'
import { checkAchievements } from '~/server/engine/achievementData'

// 构建单个玩家的战斗属性（简化版 buildPlayerStats，来自 battle/fight.post.ts）
async function buildPlayerBattleStats(char: any): Promise<{
  stats: BattlerStats
  equippedSkills: ReturnType<typeof buildEquippedSkillInfo>
  expBonusPercent: number
  luckPercent: number
}> {
  const pool = getPool()
  const { rows: equipRows } = await pool.query('SELECT * FROM character_equipment WHERE character_id = $1', [char.id])
  const { rows: skillRows } = await pool.query('SELECT * FROM character_skills WHERE character_id = $1 AND equipped = TRUE', [char.id])
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
  let critDmg = Number(char.crit_dmg || 1.5)
  let dodge = Number(char.dodge || 0)
  let lifesteal = Number(char.lifesteal || 0)

  // 等级加成
  const lv = char.level || 1
  for (let i = 1; i < lv; i++) {
    if (i <= 50) { maxHp += 5; atk += 2; def += 1; spd += 1 }
    else if (i <= 100) { maxHp += 10; atk += 4; def += 2; spd += 2 }
    else if (i <= 150) { maxHp += 20; atk += 8; def += 4; spd += 3 }
    else { maxHp += 40; atk += 15; def += 8; spd += 5 }
  }

  // 境界加成
  const realmBonus = getRealmBonusAtLevel(char.realm_tier || 1, char.realm_stage || 1)
  maxHp += realmBonus.hp; atk += realmBonus.atk; def += realmBonus.def; spd += realmBonus.spd
  critRate += realmBonus.crit_rate; critDmg += realmBonus.crit_dmg; dodge += realmBonus.dodge

  const WEAPON_BONUS: Record<string, Record<string, number>> = {
    sword: { ATK_pct: 5, CRIT_RATE_flat: 3 },
    blade: { ATK_pct: 10, CRIT_DMG_flat: 15 },
    spear: { ATK_pct: 3, SPD_pct: 12, LIFESTEAL_flat: 3 },
    fan: { ATK_pct: 3, SPIRIT_pct: 25 },
  }

  let armorPen = 0, accuracy = 0, spirit = Number(char.spirit || 10), spiritDensity = 0, luck = 0
  const elementDmg = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }
  let weaponAtkPct = 0, weaponSpdPct = 0, weaponSpiritPct = 0
  let weaponCritRateFlat = 0, weaponCritDmgFlat = 0, weaponLifestealFlat = 0

  for (const eq of equipRows) {
    if (!eq.slot) continue
    const enhLv = eq.enhance_level || 0
    const primary = Math.floor(eq.primary_value * (1 + enhLv * 0.08))
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
      else if (sub.stat === 'SPIRIT_DENSITY') spiritDensity += sub.value
      else if (sub.stat === 'LUCK') luck += sub.value
    }
  }

  if (weaponAtkPct > 0) atk = Math.floor(atk * (1 + weaponAtkPct / 100))
  if (weaponSpdPct > 0) spd = Math.floor(spd * (1 + weaponSpdPct / 100))
  if (weaponSpiritPct > 0) spirit = Math.floor(spirit * (1 + weaponSpiritPct / 100))
  critRate += weaponCritRateFlat / 100
  critDmg += weaponCritDmgFlat / 100
  lifesteal += weaponLifestealFlat / 100

  // 丹药
  for (const buff of buffRows) {
    if (buff.expire_time && new Date(buff.expire_time).getTime() <= Date.now()) continue
    const qf = Number(buff.quality_factor) || 1.0
    if (buff.pill_id === 'atk_pill_1') atk = Math.floor(atk * (1 + 0.15 * qf))
    if (buff.pill_id === 'def_pill_1') def = Math.floor(def * (1 + 0.15 * qf))
    if (buff.pill_id === 'hp_pill_1') maxHp = Math.floor(maxHp * (1 + 0.20 * qf))
    if (buff.pill_id === 'crit_pill_1') critRate += 0.08 * qf
    if (buff.pill_id === 'full_pill_1') {
      atk = Math.floor(atk * (1 + 0.10 * qf))
      def = Math.floor(def * (1 + 0.10 * qf))
      maxHp = Math.floor(maxHp * (1 + 0.10 * qf))
    }
  }

  // 洞府
  let expBonusPercent = 0
  for (const cave of caveRows) {
    if (cave.building_id === 'martial_hall' && cave.level > 0) expBonusPercent += 5 + (cave.level - 1) * 2
  }

  // 境界百分比
  if (realmBonus.hp_pct > 0) maxHp = Math.floor(maxHp * (1 + realmBonus.hp_pct / 100))
  if (realmBonus.atk_pct > 0) atk = Math.floor(atk * (1 + realmBonus.atk_pct / 100))
  if (realmBonus.def_pct > 0) def = Math.floor(def * (1 + realmBonus.def_pct / 100))

  // 永久加成
  const permAtkPct = Number(char.permanent_atk_pct || 0)
  const permDefPct = Number(char.permanent_def_pct || 0)
  const permHpPct = Number(char.permanent_hp_pct || 0)
  if (permAtkPct > 0) atk = Math.floor(atk * (1 + permAtkPct / 100))
  if (permDefPct > 0) def = Math.floor(def * (1 + permDefPct / 100))
  if (permHpPct > 0) maxHp = Math.floor(maxHp * (1 + permHpPct / 100))

  // 宗门加成
  if (char._sectLevel) {
    const sectCfg = getSectLevelConfig(char._sectLevel)
    atk = Math.floor(atk * (1 + sectCfg.atkBonus))
    def = Math.floor(def * (1 + sectCfg.defBonus))
    expBonusPercent += sectCfg.expBonus * 100
  }
  if (char._sectSkills && Array.isArray(char._sectSkills)) {
    for (const ss of char._sectSkills) {
      const skillCfg = getSectSkill(ss.skill_key)
      if (!skillCfg) continue
      const effects = calcSectSkillEffect(skillCfg, ss.level)
      if (effects.spirit_percent) spirit += Math.floor(spirit * effects.spirit_percent / 100)
      if (effects.hp_percent) maxHp = Math.floor(maxHp * (1 + effects.hp_percent / 100))
      if (effects.armor_pen_percent) armorPen += Math.floor(armorPen * effects.armor_pen_percent / 100) + Math.floor(effects.armor_pen_percent)
      if (effects.all_percent) {
        atk = Math.floor(atk * (1 + effects.all_percent / 100))
        def = Math.floor(def * (1 + effects.all_percent / 100))
        maxHp = Math.floor(maxHp * (1 + effects.all_percent / 100))
        spd = Math.floor(spd * (1 + effects.all_percent / 100))
      }
    }
  }

  const stats: BattlerStats = {
    name: char.name, maxHp, hp: maxHp, atk, def, spd,
    crit_rate: critRate, crit_dmg: critDmg, dodge, lifesteal,
    element: char.spiritual_root,
    resists: {
      metal: Number(char.resist_metal || 0), wood: Number(char.resist_wood || 0),
      water: Number(char.resist_water || 0), fire: Number(char.resist_fire || 0),
      earth: Number(char.resist_earth || 0), ctrl: Number(char.resist_ctrl || 0),
    },
    spiritualRoot: char.spiritual_root,
    armorPen, accuracy, elementDmg, spirit,
  }
  const equippedSkills = buildEquippedSkillInfo(skillRows)
  return { stats, equippedSkills, expBonusPercent: expBonusPercent + spiritDensity, luckPercent: luck }
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

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

    // 校验每日次数
    for (const m of allMembers) {
      const ensured = await ensureDailyReset(m.id, m)
      const max = getDailyCountByRealm(ensured.realm_tier || 1)
      if ((ensured.sr_daily_count || 0) >= max) {
        return { code: 400, message: `${m.name} 今日次数已用完` }
      }
    }

    // 锁定房间，进入战斗
    await pool.query(`UPDATE team_rooms SET status = 'fighting', started_at = NOW() WHERE id = $1`, [roomId])

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
    const totalBaseExp = Math.floor(avgMonsterPower * baseExpUnit * 1.2) // 经验不分摊，1.2x 组队加成

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

      // ========== 生成装备/灵草/功法掉落（战斗胜利才给） ==========
      let drops = { equipments: [] as any[], bossEquipments: [] as any[], herbs: [] as any[], skillPages: [] as string[] }
      if (result.won) {
        // 聚合全队的功法背包（用于权重递减掉落）
        const allOwnedSkills: Record<string, number> = {}
        for (const m of allMembers) {
          const { rows: invRows } = await pool.query(
            'SELECT skill_id, count FROM character_skill_inventory WHERE character_id = $1', [m.id]
          )
          for (const row of invRows) {
            allOwnedSkills[row.skill_id] = (allOwnedSkills[row.skill_id] || 0) + row.count
          }
        }
        drops = generateSecretRealmDrops(
          realm.dropTier, difficulty,
          result.killedMonsters.map(k => ({ element: k.element, isBoss: k.isBoss })),
          allMembers.length,
          allOwnedSkills,
        )
      }

      // 装备分配（波次和 Boss 装备合并一次分配，保证每人至少 1 件保底）
      const contribList = result.contributions.map(c => ({ characterId: c.characterId, contribution: c.contribution }))
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

      // 功法残页随机分配（每人按概率）
      const playerSkillPages = new Map<number, string[]>()
      for (const c of contribList) playerSkillPages.set(c.characterId, [])
      for (const sp of drops.skillPages) {
        const idx = Math.floor(Math.random() * contribList.length)
        playerSkillPages.get(contribList[idx].characterId)!.push(sp)
      }

      // 按贡献计算每个人的实际奖励 + 保存装备/灵草/功法
      const rewards: any[] = []
      for (const c of result.contributions) {
        const stoneRatio = 0.4 + 0.6 * c.contribution
        const myStone = Math.floor(totalBaseStone * stoneRatio * rewardMul * ratingMul)
        const myExp = Math.floor(totalBaseExp * rewardMul * ratingMul * (1 + expTeamBonus))
        const myPoints = Math.floor(basePoints * stoneRatio)
        const member = charMap.get(c.characterId)

        // --- 保存装备到 character_equipment ---
        const equipIds: number[] = []
        const equipList = playerEquips.get(c.characterId) || []
        for (const eq of equipList) {
          const { rows: eqRows } = await client.query(
            `INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, base_slot, req_level, enhance_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)
             RETURNING id`,
            [c.characterId, eq.name, eq.rarity, eq.primary_stat, eq.primary_value, eq.sub_stats, eq.set_id, eq.tier, eq.weapon_type, eq.base_slot, eq.req_level]
          )
          equipIds.push(eqRows[0].id)
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

        // --- 保存功法残页到 character_skill_inventory ---
        const pageList = playerSkillPages.get(c.characterId) || []
        for (const sp of pageList) {
          await client.query(
            `INSERT INTO character_skill_inventory (character_id, skill_id, count)
             VALUES ($1, $2, 1)
             ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
            [c.characterId, sp]
          )
        }

        await client.query(
          `INSERT INTO secret_realm_contributions (battle_id, character_id, damage_dealt, healing_done, damage_taken, contribution)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [battleId, c.characterId, c.damageDealt, c.healingDone, c.damageTaken, c.contribution]
        )
        // --- 升级检查（同 battle/fight.post.ts 的逻辑） ---
        let newLevel = member?.level || 1
        let newLevelExp = Number(member?.level_exp || 0) + myExp
        while (newLevel < 200) {
          let reqExp: number
          if (newLevel <= 30) reqExp = Math.floor(80 * Math.pow(newLevel, 1.3))
          else if (newLevel <= 80) reqExp = Math.floor(120 * Math.pow(newLevel, 1.4))
          else if (newLevel <= 150) reqExp = Math.floor(200 * Math.pow(newLevel, 1.45))
          else reqExp = Math.floor(350 * Math.pow(newLevel, 1.5))
          if (newLevelExp >= reqExp) { newLevelExp -= reqExp; newLevel++ }
          else break
        }

        await client.query(
          `INSERT INTO secret_realm_rewards (battle_id, character_id, spirit_stone, exp_gained, level_exp, realm_points, equipment_ids, extra_drops)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [battleId, c.characterId, myStone, myExp, newLevelExp, myPoints,
            JSON.stringify(equipIds),
            JSON.stringify({ herbs: herbList, skill_pages: pageList })]
        )

        // 更新角色（含等级）
        await client.query(
          `UPDATE characters SET
             spirit_stone = spirit_stone + $1,
             cultivation_exp = cultivation_exp + $2,
             level_exp = $3,
             level = $4,
             realm_points = realm_points + $5,
             sr_daily_count = sr_daily_count + 1,
             sr_daily_date = CURRENT_DATE,
             last_online = NOW()
           WHERE id = $6`,
          [myStone, myExp, newLevelExp, newLevel, myPoints, c.characterId]
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
          skill_pages: pageList,
          level_up: newLevel > (member?.level || 1) ? newLevel : null,
        })

        // --- 成就触发（异步不阻塞） ---
        if (result.won) {
          checkAchievements(c.characterId, 'battle_count', 1).catch(() => {})
          checkAchievements(c.characterId, 'total_stone', myStone).catch(() => {})
          checkAchievements(c.characterId, 'total_exp', myExp).catch(() => {})
          const bossCount = result.killedMonsters.filter(k => k.isBoss).length
          if (bossCount > 0) checkAchievements(c.characterId, 'boss_kill', bossCount).catch(() => {})
          for (const eq of equipList) {
            const key = `equip_${eq.rarity}`
            checkAchievements(c.characterId, key, 1).catch(() => {})
          }
          if (pageList.length > 0) checkAchievements(c.characterId, 'skill_pages', pageList.length).catch(() => {})
          if (newLevel > (member?.level || 1)) checkAchievements(c.characterId, 'char_level', newLevel).catch(() => {})
        }
      }

      // 首通记录
      if (result.won) {
        await client.query(
          `INSERT INTO secret_realm_clears (character_id, secret_realm_id, difficulty, best_rating, clear_count)
           SELECT tm.character_id, $1, $2, $3, 1 FROM team_members tm WHERE tm.room_id = $4
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
          [realmId, difficulty, result.rating, roomId]
        )
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
    return { code: 500, message: '服务器错误：' + (e.message || e) }
  }
})
