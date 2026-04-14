import { getPool } from '~/server/database/db'
import { OFFLINE_MAP_DATA } from '~/server/utils/offlineMapData'
import { checkAchievements } from '~/server/engine/achievementData'

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
    const offlineMin = Math.min((now - startTime) / 60000, 720)

    const mapId = char.current_map || 'qingfeng_valley'
    const mapData = OFFLINE_MAP_DATA[mapId]
    if (!mapData) return { code: 400, message: '地图数据错误' }

    const battlesPerMin = 12
    const monstersPerBattle = 3
    const totalKills = Math.floor(offlineMin * battlesPerMin) * monstersPerBattle
    const efficiency = 0.85 // 离线效率 70% → 85%

    const expGained = Math.floor(totalKills * mapData.avgExp * efficiency)
    const stoneGained = Math.floor(totalKills * mapData.avgStone * efficiency)
    const levelExpGained = expGained

    // 更新角色数据 + 清除离线状态
    await pool.query(
      `UPDATE characters SET
        cultivation_exp = cultivation_exp + $1,
        spirit_stone = spirit_stone + $2,
        level_exp = level_exp + $3,
        offline_start = NULL,
        last_online = NOW()
      WHERE id = $4`,
      [expGained, stoneGained, levelExpGained, char.id]
    )

    // 检查升级
    let newLevel = char.level || 1
    let newLevelExp = Number(char.level_exp || 0) + levelExpGained
    let levelUps = 0
    while (newLevel < 200) {
      let reqExp: number
      if (newLevel <= 30) reqExp = Math.floor(80 * Math.pow(newLevel, 1.3))
      else if (newLevel <= 80) reqExp = Math.floor(120 * Math.pow(newLevel, 1.4))
      else if (newLevel <= 150) reqExp = Math.floor(200 * Math.pow(newLevel, 1.45))
      else reqExp = Math.floor(350 * Math.pow(newLevel, 1.5))
      if (newLevelExp >= reqExp) { newLevelExp -= reqExp; newLevel++; levelUps++ }
      else break
    }
    if (levelUps > 0) {
      await pool.query('UPDATE characters SET level = $1, level_exp = $2 WHERE id = $3', [newLevel, newLevelExp, char.id])
    }

    // 生成掉落装备(简化: 只生成数量, 不生成具体属性太多了)
    const equipCount = Math.floor(totalKills * 0.08 * efficiency)
    const skillCount = Math.floor(totalKills * 0.05 * efficiency)
    const herbCount = Math.floor(totalKills * 0.10 * efficiency)

    // 装备掉落: 按tier生成
    const rarities = ['white', 'green', 'blue', 'purple', 'gold', 'red']
    const slotNames = ['兵器', '法袍', '法冠', '步云靴', '法宝', '灵戒', '灵佩']
    const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
    const rarityNames = ['凡器', '灵器', '法器', '灵宝', '仙器', '太古神器']
    const weights: Record<number, number[]> = {
      1: [60,30,9,1,0,0], 2: [40,35,18,6,1,0], 3: [20,35,25,15,4.5,0.5],
      4: [5,25,30,25,13,2], 5: [0,10,30,35,22,3], 6: [0,0,20,40,35,5],
      7: [0,0,10,35,45,10], 8: [0,0,5,25,55,15], 9: [0,0,0,20,60,20], 10: [0,0,0,10,60,30],
    }
    const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_RATE', pendant: 'SPIRIT' }
    const primaryBases: Record<string, number> = { ATK: 30, DEF: 20, HP: 200, SPD: 15, CRIT_RATE: 3, SPIRIT: 8 }
    const statMuls = [1.0, 1.05, 1.10, 1.18, 1.25, 1.35]
    const tierReqLevels: Record<number, number> = { 1:1, 2:15, 3:35, 4:55, 5:80, 6:110, 7:140, 8:170, 9:185, 10:195 }

    // 批量插入装备(最多25个)
    const actualEquipCount = Math.min(equipCount, 25)
    for (let i = 0; i < actualEquipCount; i++) {
      const w = weights[mapData.tier] || weights[1]
      const total = w.reduce((a: number, b: number) => a + b, 0)
      let r = Math.random() * total, idx = 0
      for (let j = 0; j < w.length; j++) { r -= w[j]; if (r <= 0) { idx = j; break } }
      const slotIdx = Math.floor(Math.random() * slots.length)
      const ps = primaryStats[slots[slotIdx]]
      const pv = Math.floor((primaryBases[ps] || 30) * mapData.tier * statMuls[idx])
      await pool.query(
        `INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, tier, weapon_type, base_slot, req_level, enhance_level)
         VALUES ($1, $2, $3, $4, $5, '[]', $6, $7, $8, $9, 0)`,
        [char.id, `${rarityNames[idx]}·${slotNames[slotIdx]}`, rarities[idx], ps, pv, mapData.tier,
         slots[slotIdx] === 'weapon' ? ['sword','blade','spear','fan'][Math.floor(Math.random()*4)] : null,
         slots[slotIdx], tierReqLevels[mapData.tier] || 1]
      )
    }

    // 功法掉落(最多10个)
    const skillPools: Record<number, string[]> = {
      1: ['wind_blade','vine_whip','ice_palm','flame_sword','quake_fist','body_refine','flame_body','water_flow','root_grip','metal_skin'],
      3: ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall'],
      5: ['sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury','wood_heal','mirror_water','crit_master','earth_fortitude','poison_body','fire_mastery'],
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

    // 灵草掉落(最多20个)
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

    // === 成就触发 ===
    const offlineHours = Math.floor(offlineMin / 60)
    if (offlineHours > 0) checkAchievements(char.id, 'offline_hours', offlineHours).catch(() => {})
    if (stoneGained >= 500000) checkAchievements(char.id, 'offline_rich', 1).catch(() => {})
    checkAchievements(char.id, 'total_stone', stoneGained).catch(() => {})
    checkAchievements(char.id, 'total_exp', expGained).catch(() => {})
    checkAchievements(char.id, 'char_level', newLevel).catch(() => {})
    checkAchievements(char.id, 'skill_pages', actualSkillCount).catch(() => {})

    // 返回最新角色
    const { rows: updated } = await pool.query('SELECT * FROM characters WHERE id = $1', [char.id])

    return {
      code: 200,
      data: {
        offlineMinutes: Math.floor(offlineMin),
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
