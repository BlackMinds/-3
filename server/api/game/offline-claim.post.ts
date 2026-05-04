import { getPool } from '~/server/database/db'
import { ALL_MAPS } from '~/server/api/battle/fight.post'
import { generateMonsterStats, runWaveBattle, makeHealerTemplate, type BattlerStats, type MonsterTemplate, type EquippedSkillInfo } from '~/server/engine/battleEngine'
import { checkAchievements } from '~/server/engine/achievementData'
import { applyCultivationExp, applyLevelExp } from '~/server/utils/realm'
import { EQUIP_PRIMARY_BASE, RARITY_STAT_MUL, RARITY_SUB_COUNT_RANGE, EQUIP_BAG_LIMIT } from '~/shared/balance'
import { rollSubStats, EQUIP_SELL_PRICES } from '~/server/utils/equipment'
import { rand } from '~/server/utils/random'
import { generateEquipName } from '~/server/engine/equipNameData'
import { rollEquipSet } from '~/server/engine/equipSetData'

/**
 * 离线挂机结算 v2：基于开始离线时的快照真打 N 场
 *
 * - simulateMin = min((now - offline_start)/60000, 600) 分钟（上限 10 小时）
 * - 离线效率 100%（与在线产出 1:1）
 * - 必须挂机至少 10 分钟才能结算
 * - 每分钟 1 场代表战（runWaveBattle），每场代表 12 次实际战斗的产出
 * - 5 连败提前 break，按当前累计发奖（避免低战力挂在高图也能领满）
 * - 不出 BOSS（按设计：BOSS 掉落特殊，不适合抽样外推）
 * - 装备/功法/灵草掉落数量 = 总击杀 × 现有比例
 */

const REPRESENTATIVE_BATTLES_PER_MIN = 12 // 每场代表战折算 12 次实际战斗（保持原产出曲线）
const MAX_OFFLINE_MIN = 600 // 上限 10 小时
const MIN_OFFLINE_MIN = 10  // 至少挂机 10 分钟才能结算
const LOSS_STREAK_LIMIT = 5
const EFFICIENCY = 1.0 // 离线效率 100%（与在线产出对齐）

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1', [event.context.userId]
    )
    if (rows.length === 0) return { code: 400, message: '角色不存在' }
    const char = rows[0]

    if (!char.offline_start) return { code: 400, message: '未在离线挂机中' }

    const startTime = new Date(char.offline_start).getTime()
    const now = Date.now()
    const simulateMin = Math.floor(Math.min((now - startTime) / 60000, MAX_OFFLINE_MIN))

    if (simulateMin < MIN_OFFLINE_MIN) {
      return { code: 400, message: `离线挂机至少需 ${MIN_OFFLINE_MIN} 分钟才能结算` }
    }

    const mapId = char.offline_map || char.current_map || 'qingfeng_valley'
    const mapData = ALL_MAPS[mapId]
    if (!mapData) return { code: 400, message: '地图数据错误' }

    // 反序列化快照（v1 老数据可能没 snapshot：fallback 到当前角色重新构建——但这里不便重建，
    // 直接给个安全默认：按"无装备弱角色"打，等于自然降到 0 收益，保护漏洞不会放出）
    let snapshot: any = null
    if (char.offline_snapshot) {
      snapshot = typeof char.offline_snapshot === 'string'
        ? JSON.parse(char.offline_snapshot)
        : char.offline_snapshot
    }
    if (!snapshot || !snapshot.playerStats || !snapshot.equippedSkills) {
      // 老数据兼容：清掉离线状态，提示玩家
      await pool.query(
        `UPDATE characters SET offline_start = NULL, offline_map = NULL, offline_snapshot = NULL, battle_end_at = NULL WHERE id = $1`,
        [char.id]
      )
      return { code: 400, message: '离线快照缺失（旧数据），已清除离线状态。请重新开始挂机。' }
    }

    const playerStatsBase: BattlerStats = snapshot.playerStats
    const equippedSkills: EquippedSkillInfo = snapshot.equippedSkills
    const expBonusPercent = Number(snapshot.expBonusPercent || 0)
    const luckPercent = Number(snapshot.luckPercent || 0)

    // === 真打 N 场 ===
    let wins = 0
    let losses = 0
    let lossStreak = 0
    let battlesRun = 0
    let cumulativeKilled = 0
    let cumulativeExpRaw = 0
    let cumulativeStoneRaw = 0

    for (let i = 0; i < simulateMin; i++) {
      // 生成 wave（与 fight.post.ts 一致：T1/T2 1-2 只，T3/T4 1-4 只，T5+ 2-4 只 + 必出 healer，不出 BOSS）
      let waveSize: number
      if (mapData.tier <= 2) waveSize = 1 + Math.floor(Math.random() * 2)
      else if (mapData.tier <= 4) waveSize = 1 + Math.floor(Math.random() * 4)
      else waveSize = 2 + Math.floor(Math.random() * 3)

      const useHealer = mapData.tier >= 5
      const normalCount = useHealer ? waveSize - 1 : waveSize
      const monsterList: { stats: BattlerStats; template: MonsterTemplate }[] = []
      for (let j = 0; j < normalCount; j++) {
        const m = mapData.monsters[rand(0, mapData.monsters.length - 1)]
        const template: MonsterTemplate = m
        monsterList.push({ stats: generateMonsterStats(template), template })
      }
      if (useHealer) {
        const avgPower = monsterList.length > 0
          ? Math.floor(monsterList.reduce((s, it) => s + it.template.power, 0) / monsterList.length)
          : (mapData.monsters[0]?.power || 100)
        const elem = mapData.monsters[0]?.element ?? null
        const healerTpl = makeHealerTemplate(mapData.tier, elem, avgPower)
        monsterList.push({ stats: generateMonsterStats(healerTpl), template: healerTpl })
      }

      // T2 怪物削弱（与 fight.post.ts 同步）
      if (mapData.tier === 2) {
        for (const it of monsterList) {
          it.stats.atk = Math.floor(it.stats.atk * 0.80)
          it.stats.maxHp = Math.floor(it.stats.maxHp * 0.90)
          it.stats.hp = it.stats.maxHp
        }
      }

      // 跑战斗（playerStats 浅拷贝避免 buff/debuff 累计）
      const result = runWaveBattle(
        { ...playerStatsBase, hp: playerStatsBase.maxHp },
        monsterList,
        equippedSkills
      )
      battlesRun++

      if (result.won) {
        wins++
        lossStreak = 0
        cumulativeKilled += result.monstersKilled.length
        cumulativeExpRaw += result.totalExp
        cumulativeStoneRaw += result.totalStone
      } else {
        losses++
        lossStreak++
        if (lossStreak >= LOSS_STREAK_LIMIT) break
      }
    }

    // === 收益折算：每场代表战 × 12 实际战斗 × efficiency × (1 + expBonus%) × (1 + luck%) ===
    const expMultiplier = REPRESENTATIVE_BATTLES_PER_MIN * EFFICIENCY * (1 + expBonusPercent / 100)
    const stoneMultiplier = REPRESENTATIVE_BATTLES_PER_MIN * EFFICIENCY * (1 + luckPercent / 100)
    const dropMultiplier = REPRESENTATIVE_BATTLES_PER_MIN * EFFICIENCY

    const totalKills = Math.floor(cumulativeKilled * dropMultiplier)
    const expGained = Math.floor(cumulativeExpRaw * expMultiplier)
    const stoneGained = Math.floor(cumulativeStoneRaw * stoneMultiplier)
    const levelExpGained = expGained

    // 累加 cultivation_exp 并扣除突破
    const newExpTotal = Number(char.cultivation_exp || 0) + expGained
    const br = applyCultivationExp(newExpTotal, char.realm_tier || 1, char.realm_stage || 1)

    await pool.query(
      `UPDATE characters SET
        cultivation_exp = $1,
        realm_tier = $2,
        realm_stage = $3,
        spirit_stone = spirit_stone + $4,
        level_exp = level_exp + $5,
        offline_start = NULL,
        offline_map = NULL,
        offline_snapshot = NULL,
        battle_end_at = NULL,
        last_online = NOW()
      WHERE id = $6`,
      [br.cultivation_exp, br.realm_tier, br.realm_stage, stoneGained, levelExpGained, char.id]
    )

    // 升级判定
    const lvResult = applyLevelExp(Number(char.level_exp || 0) + levelExpGained, char.level || 1)
    const newLevel = lvResult.level
    const levelUps = lvResult.levelUps
    if (levelUps > 0) {
      await pool.query('UPDATE characters SET level = $1, level_exp = $2 WHERE id = $3', [lvResult.level, lvResult.level_exp, char.id])
    }

    // === 装备/功法/灵草掉落（按总击杀 × 比例） ===
    const equipCount = Math.floor(totalKills * 0.08)
    const skillCount = Math.floor(totalKills * 0.02)
    const herbCount = Math.floor(totalKills * 0.10)

    // 装备掉落
    const rarities = ['white', 'green', 'blue', 'purple', 'gold', 'red']
    const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
    const weights: Record<number, number[]> = {
      1: [60,30,9,1,0,0], 2: [40,35,18,6,1,0], 3: [20,35,25,15,4.5,0.5],
      4: [5,25,30,25,13,2], 5: [0,10,30,35,22,3], 6: [0,0,20,40,35,5],
      7: [0,0,10,35,45,10], 8: [0,0,5,25,55,15], 9: [0,0,0,20,60,20], 10: [0,0,0,10,60,30],
      11: [0,0,0,5,55,40], 12: [0,0,0,0,45,55],
    }
    const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_DMG', pendant: 'SPIRIT' }
    const tierReqLevels: Record<number, number> = { 1:1, 2:15, 3:35, 4:55, 5:80, 6:110, 7:140, 8:170, 9:185, 10:195, 11:215, 12:240 }

    const actualEquipCount = Math.min(equipCount, 25)
    // 背包容量基线 + 满后转灵石返还（按基础售价）
    const { rows: bagCountRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM character_equipment WHERE character_id = $1 AND slot IS NULL',
      [char.id]
    )
    let bagCount: number = bagCountRows[0]?.cnt || 0
    let bagOverflowGain = 0
    for (let i = 0; i < actualEquipCount; i++) {
      const w = weights[mapData.tier] || weights[1]
      const total = w.reduce((a: number, b: number) => a + b, 0)
      let r = Math.random() * total, idx = 0
      for (let j = 0; j < w.length; j++) { r -= w[j]; if (r <= 0) { idx = j; break } }
      const slotIdx = Math.floor(Math.random() * slots.length)
      const ps = primaryStats[slots[slotIdx]]
      const pv = Math.max(1, Math.floor((EQUIP_PRIMARY_BASE[ps] || 30) * mapData.tier * RARITY_STAT_MUL[idx]))
      const [minSubs, maxSubs] = RARITY_SUB_COUNT_RANGE[idx] || [0, 0]
      const subCount = rand(minSubs, maxSubs)
      const subStats = subCount > 0 ? rollSubStats(idx, mapData.tier, subCount) : []
      const weaponType = slots[slotIdx] === 'weapon' ? ['sword','blade','spear','fan'][Math.floor(Math.random()*4)] : null
      // 套装注入：与主图战斗一致（白/绿不出，蓝~红按 5/10/20/35% 概率）
      const setKey = rollEquipSet(rarities[idx], 1.0)
      // 背包满 → 转灵石返还
      if (bagCount >= EQUIP_BAG_LIMIT) {
        bagOverflowGain += Math.floor((EQUIP_SELL_PRICES[rarities[idx]] || 10) * mapData.tier)
        continue
      }
      const equipName = generateEquipName(rarities[idx], slots[slotIdx], weaponType, mapData.tier, ps, null, '', setKey)
      await pool.query(
        `INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, base_slot, req_level, enhance_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
        [char.id, equipName, rarities[idx], ps, pv, JSON.stringify(subStats), setKey, mapData.tier, weaponType, slots[slotIdx], tierReqLevels[mapData.tier] || 1]
      )
      bagCount++
    }
    if (bagOverflowGain > 0) {
      await pool.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [bagOverflowGain, char.id])
    }

    // 功法掉落
    const skillPools: Record<number, string[]> = {
      1: ['wind_blade','vine_whip','ice_palm','flame_sword','quake_fist','body_refine','flame_body','water_flow','root_grip','metal_skin'],
      3: ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall'],
      5: ['sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury','wood_heal','mirror_water','venom_burst','bleed_storm','burn_inferno','poison_mist','crit_master','earth_fortitude','poison_body','fire_mastery','dot_amplifier','phantom_step','healing_spring'],
      7: ['metal_burst','quake_stomp','life_drain','inferno_burst','storm_blade','heaven_heal','water_mastery','battle_frenzy','heavenly_body','time_stop','heavenly_wrath','dao_heart','five_elements_harmony'],
    }
    let skillPool = skillPools[1]
    if (mapData.tier >= 7) skillPool = skillPools[7]
    else if (mapData.tier >= 5) skillPool = skillPools[5]
    else if (mapData.tier >= 3) skillPool = skillPools[3]

    const actualSkillCount = Math.min(skillCount, 10)
    for (let i = 0; i < actualSkillCount; i++) {
      const sid = skillPool[Math.floor(Math.random() * skillPool.length)]
      await pool.query(
        `INSERT INTO character_skill_inventory (character_id, skill_id, count)
         VALUES ($1, $2, 1)
         ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
        [char.id, sid]
      )
    }

    // 灵草掉落
    const herbIds = ['common_herb', 'metal_herb', 'wood_herb', 'water_herb', 'fire_herb', 'earth_herb']
    const qualityOrder = ['white', 'green', 'blue', 'purple', 'gold']
    const actualHerbCount = Math.min(herbCount, 20)
    for (let i = 0; i < actualHerbCount; i++) {
      const hid = herbIds[Math.floor(Math.random() * herbIds.length)]
      let qIdx = 0
      const rr = Math.random()
      if (mapData.tier >= 7) qIdx = rr < 0.4 ? 4 : 3
      else if (mapData.tier >= 5) qIdx = rr < 0.5 ? 3 : 2
      else if (mapData.tier >= 3) qIdx = rr < 0.4 ? 2 : 1
      else qIdx = rr < 0.2 ? 1 : 0
      await pool.query(
        `INSERT INTO character_materials (character_id, material_id, quality, count)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (character_id, material_id, quality) DO UPDATE SET count = character_materials.count + 1`,
        [char.id, hid, qualityOrder[qIdx]]
      )
    }

    // 成就
    const offlineHours = Math.floor(simulateMin / 60)
    if (offlineHours > 0) checkAchievements(char.id, 'offline_hours', offlineHours).catch(() => {})
    if (stoneGained >= 500000) checkAchievements(char.id, 'offline_rich', 1).catch(() => {})
    checkAchievements(char.id, 'total_stone', stoneGained).catch(() => {})
    checkAchievements(char.id, 'total_exp', expGained).catch(() => {})
    checkAchievements(char.id, 'char_level', newLevel).catch(() => {})
    checkAchievements(char.id, 'skill_pages', actualSkillCount).catch(() => {})

    const { rows: updated } = await pool.query('SELECT * FROM characters WHERE id = $1', [char.id])

    const winRate = battlesRun > 0 ? Math.round((wins / battlesRun) * 100) : 0
    const earlyStopped = lossStreak >= LOSS_STREAK_LIMIT

    return {
      code: 200,
      data: {
        offlineMinutes: simulateMin,
        battlesSimulated: battlesRun,
        winRate, // 0-100
        earlyStopped,
        totalKills,
        totalBattles: Math.floor(simulateMin * REPRESENTATIVE_BATTLES_PER_MIN), // UI 兼容字段
        expGained,
        stoneGained,
        levelUps,
        newLevel,
        equipCount: actualEquipCount,
        skillCount: actualSkillCount,
        herbCount: actualHerbCount,
        character: updated[0],
      },
    }
  } catch (error) {
    console.error('领取离线收益失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
