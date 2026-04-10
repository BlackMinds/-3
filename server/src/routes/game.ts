import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// 获取完整角色游戏数据
router.get('/data', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM characters WHERE user_id = ?',
      [req.userId]
    );

    if (rows.length === 0) {
      return res.json({ code: 200, data: null, message: '未创建角色' });
    }

    res.json({ code: 200, data: rows[0] });
  } catch (error) {
    console.error('获取游戏数据失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 保存战斗奖励（客户端定期上报）
router.post('/save-rewards', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { exp_gained, spirit_stone_gained, level_exp_gained, current_map, skills_gained } = req.body;

    if (typeof exp_gained !== 'number' || typeof spirit_stone_gained !== 'number') {
      return res.json({ code: 400, message: '参数错误' });
    }

    // 防作弊：单次上报限制
    const maxExp = 10000000;
    const maxStone = 50000000;
    const safeExp = Math.min(Math.max(0, Math.floor(exp_gained)), maxExp);
    const safeStone = Math.min(Math.max(0, Math.floor(spirit_stone_gained)), maxStone);
    const safeLevelExp = Math.min(Math.max(0, Math.floor(level_exp_gained || 0)), maxExp);

    const [charRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM characters WHERE user_id = ?',
      [req.userId]
    );

    if (charRows.length === 0) {
      return res.json({ code: 400, message: '角色不存在' });
    }

    await pool.query(
      `UPDATE characters
       SET cultivation_exp = cultivation_exp + ?,
           spirit_stone = spirit_stone + ?,
           level_exp = level_exp + ?,
           current_map = ?,
           last_online = NOW()
       WHERE user_id = ?`,
      [safeExp, safeStone, safeLevelExp, current_map || 'qingfeng_valley', req.userId]
    );

    // 保存掉落的功法
    if (Array.isArray(skills_gained) && skills_gained.length > 0) {
      for (const skillId of skills_gained) {
        await pool.query(
          `INSERT INTO character_skill_inventory (character_id, skill_id, count)
           VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE count = count + 1`,
          [charRows[0].id, skillId]
        );
      }
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    console.error('保存奖励失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 修炼闭关（消耗灵石获取修为）
router.post('/cultivate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { hours } = req.body;
    if (!hours || hours < 1 || hours > 8) {
      return res.json({ code: 400, message: '修炼时间1-8小时' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM characters WHERE user_id = ?',
      [req.userId]
    );

    if (rows.length === 0) {
      return res.json({ code: 400, message: '角色不存在' });
    }

    const char = rows[0];
    const costPerHour = 100 * char.realm_tier;
    const totalCost = costPerHour * hours;

    if (char.spirit_stone < totalCost) {
      return res.json({ code: 400, message: `灵石不足，需要${totalCost}灵石` });
    }

    const expGain = Math.floor(50 * char.realm_tier * hours * (1 + char.realm_stage * 0.1));

    await pool.query(
      `UPDATE characters
       SET spirit_stone = spirit_stone - ?,
           cultivation_exp = cultivation_exp + ?,
           last_online = NOW()
       WHERE user_id = ?`,
      [totalCost, expGain, req.userId]
    );

    // 返回更新后的数据
    const [updated] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM characters WHERE user_id = ?',
      [req.userId]
    );

    res.json({
      code: 200,
      message: `闭关${hours}小时，消耗${totalCost}灵石，获得${expGain}修为`,
      data: updated[0],
    });
  } catch (error) {
    console.error('修炼失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 更新角色状态（境界突破后）
router.post('/update-character', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { realm_tier, realm_stage, max_hp, atk, def, spd, level, level_exp } = req.body;

    await pool.query(
      `UPDATE characters
       SET realm_tier = ?, realm_stage = ?, max_hp = ?, atk = ?, def = ?, spd = ?,
           level = COALESCE(?, level), level_exp = COALESCE(?, level_exp),
           last_online = NOW()
       WHERE user_id = ?`,
      [realm_tier, realm_stage, max_hp, atk, def, spd, level || null, level_exp !== undefined ? level_exp : null, req.userId]
    );

    res.json({ code: 200, message: '角色状态已更新' });
  } catch (error) {
    console.error('更新角色失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// ===== 离线挂机地图数据(简化版,只需要平均经验/灵石) =====
const OFFLINE_MAP_DATA: Record<string, { avgExp: number; avgStone: number; tier: number }> = {
  qingfeng_valley:      { avgExp: 17,      avgStone: 10,       tier: 1 },
  misty_swamp:          { avgExp: 30,      avgStone: 15,       tier: 1 },
  sunset_mountain:      { avgExp: 110,     avgStone: 60,       tier: 2 },
  jade_bamboo_forest:   { avgExp: 123,     avgStone: 60,       tier: 2 },
  iron_ore_cave:        { avgExp: 140,     avgStone: 60,       tier: 2 },
  myriad_demon_mountain:{ avgExp: 550,     avgStone: 200,      tier: 3 },
  thunderpeak:          { avgExp: 650,     avgStone: 200,      tier: 3 },
  ancient_ruins:        { avgExp: 800,     avgStone: 250,      tier: 3 },
  dark_sea:             { avgExp: 2700,    avgStone: 800,      tier: 4 },
  soul_forest:          { avgExp: 2900,    avgStone: 800,      tier: 4 },
  desert_of_sands:      { avgExp: 3300,    avgStone: 900,      tier: 4 },
  purgatory:            { avgExp: 13000,   avgStone: 5000,     tier: 5 },
  frozen_abyss:         { avgExp: 14700,   avgStone: 5000,     tier: 5 },
  demon_battlefield:    { avgExp: 18300,   avgStone: 6000,     tier: 5 },
  tribulation_wasteland:{ avgExp: 66700,   avgStone: 20000,    tier: 6 },
  void_rift:            { avgExp: 71700,   avgStone: 20000,    tier: 6 },
  celestial_mountain:   { avgExp: 256700,  avgStone: 120000,   tier: 7 },
  nether_realm:         { avgExp: 360000,  avgStone: 120000,   tier: 7 },
  immortal_realm:       { avgExp: 1100000, avgStone: 600000,   tier: 8 },
  chaos_origin:         { avgExp: 2570000, avgStone: 1000000,  tier: 8 },
  void_holy_land:       { avgExp: 6500000, avgStone: 1200000,  tier: 9 },
  hongmeng_realm:       { avgExp: 7500000, avgStone: 1200000,  tier: 9 },
  myriad_battlefield:   { avgExp: 8500000, avgStone: 1500000,  tier: 9 },
  dao_trial:            { avgExp: 20000000,avgStone: 5000000,  tier: 10 },
  eternal_peak:         { avgExp: 30000000,avgStone: 8000000,  tier: 10 },
};

// 开始离线挂机
router.post('/offline-start', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM characters WHERE user_id = ?', [req.userId]);
    if (rows.length === 0) return res.json({ code: 400, message: '角色不存在' });
    const char = rows[0];
    if (char.offline_start) return res.json({ code: 400, message: '已在离线挂机中' });
    await pool.query('UPDATE characters SET offline_start = NOW() WHERE id = ?', [char.id]);
    res.json({ code: 200, message: '开始离线挂机', data: { startTime: new Date().toISOString() } });
  } catch (error) {
    console.error('开始离线失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 查询离线状态
router.get('/offline-status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM characters WHERE user_id = ?', [req.userId]);
    if (rows.length === 0) return res.json({ code: 200, data: null });
    const char = rows[0];
    if (!char.offline_start) return res.json({ code: 200, data: null });

    const startTime = new Date(char.offline_start).getTime();
    const now = Date.now();
    const offlineMin = Math.min((now - startTime) / 60000, 720);
    const mapId = char.current_map || 'qingfeng_valley';
    const mapData = OFFLINE_MAP_DATA[mapId];
    if (!mapData) return res.json({ code: 200, data: null });

    const battlesPerMin = 12;
    const monstersPerBattle = 3;
    const totalBattles = Math.floor(offlineMin * battlesPerMin);
    const totalKills = totalBattles * monstersPerBattle;
    const efficiency = 0.70;

    res.json({
      code: 200,
      data: {
        offlineMinutes: Math.floor(offlineMin),
        mapName: mapId,
        totalBattles,
        totalKills,
        expGained: Math.floor(totalKills * mapData.avgExp * efficiency),
        stoneGained: Math.floor(totalKills * mapData.avgStone * efficiency),
        equipCount: Math.min(Math.floor(totalKills * 0.08 * efficiency), 25),
        skillCount: Math.min(Math.floor(totalKills * 0.05 * efficiency), 10),
        herbCount: Math.min(Math.floor(totalKills * 0.10 * efficiency), 20),
        efficiency: Math.round(efficiency * 100),
        startTime: char.offline_start,
      },
    });
  } catch (error) {
    console.error('离线状态查询失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 结束离线挂机 + 领取收益
router.post('/offline-claim', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM characters WHERE user_id = ?', [req.userId]
    );
    if (rows.length === 0) return res.json({ code: 400, message: '角色不存在' });
    const char = rows[0];

    if (!char.offline_start) return res.json({ code: 400, message: '未在离线挂机中' });

    const startTime = new Date(char.offline_start).getTime();
    const now = Date.now();
    const offlineMin = Math.min((now - startTime) / 60000, 720);

    const mapId = char.current_map || 'qingfeng_valley';
    const mapData = OFFLINE_MAP_DATA[mapId];
    if (!mapData) return res.json({ code: 400, message: '地图数据错误' });

    const battlesPerMin = 12;
    const monstersPerBattle = 3;
    const totalKills = Math.floor(offlineMin * battlesPerMin) * monstersPerBattle;
    const efficiency = 0.70;

    const expGained = Math.floor(totalKills * mapData.avgExp * efficiency);
    const stoneGained = Math.floor(totalKills * mapData.avgStone * efficiency);
    const levelExpGained = expGained;

    // 更新角色数据 + 清除离线状态
    await pool.query(
      `UPDATE characters SET
        cultivation_exp = cultivation_exp + ?,
        spirit_stone = spirit_stone + ?,
        level_exp = level_exp + ?,
        offline_start = NULL,
        last_online = NOW()
      WHERE id = ?`,
      [expGained, stoneGained, levelExpGained, char.id]
    );

    // 检查升级
    let newLevel = char.level || 1;
    let newLevelExp = Number(char.level_exp || 0) + levelExpGained;
    let levelUps = 0;
    while (newLevel < 200) {
      let req: number;
      if (newLevel <= 30) req = Math.floor(80 * Math.pow(newLevel, 1.3));
      else if (newLevel <= 80) req = Math.floor(120 * Math.pow(newLevel, 1.4));
      else if (newLevel <= 150) req = Math.floor(200 * Math.pow(newLevel, 1.45));
      else req = Math.floor(350 * Math.pow(newLevel, 1.5));
      if (newLevelExp >= req) { newLevelExp -= req; newLevel++; levelUps++; }
      else break;
    }
    if (levelUps > 0) {
      await pool.query('UPDATE characters SET level = ?, level_exp = ? WHERE id = ?', [newLevel, newLevelExp, char.id]);
    }

    // 生成掉落装备(简化: 只生成数量, 不生成具体属性太多了)
    const equipCount = Math.floor(totalKills * 0.08 * efficiency);
    const skillCount = Math.floor(totalKills * 0.05 * efficiency);
    const herbCount = Math.floor(totalKills * 0.10 * efficiency);

    // 装备掉落: 按tier生成
    const rarities = ['white', 'green', 'blue', 'purple', 'gold', 'red'];
    const slotNames = ['兵器', '法袍', '法冠', '步云靴', '法宝', '灵戒', '灵佩'];
    const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant'];
    const rarityNames = ['凡器', '灵器', '法器', '灵宝', '仙器', '太古神器'];
    const weights: Record<number, number[]> = {
      1: [60,30,9,1,0,0], 2: [40,35,18,6,1,0], 3: [20,35,25,15,4.5,0.5],
      4: [5,25,30,25,13,2], 5: [0,10,30,35,22,3], 6: [0,0,20,40,35,5],
      7: [0,0,10,35,45,10], 8: [0,0,5,25,55,15], 9: [0,0,0,20,60,20], 10: [0,0,0,10,60,30],
    };
    const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_RATE', pendant: 'SPIRIT' };
    const primaryBases: Record<string, number> = { ATK: 30, DEF: 20, HP: 200, SPD: 15, CRIT_RATE: 3, SPIRIT: 8 };
    const statMuls = [1.0, 1.05, 1.10, 1.18, 1.25, 1.35];
    const tierReqLevels: Record<number, number> = { 1:1, 2:15, 3:35, 4:55, 5:80, 6:110, 7:140, 8:170, 9:185, 10:195 };

    // 批量插入装备(最多50个,防止太多)
    const actualEquipCount = Math.min(equipCount, 25);
    for (let i = 0; i < actualEquipCount; i++) {
      const w = weights[mapData.tier] || weights[1];
      const total = w.reduce((a: number, b: number) => a + b, 0);
      let r = Math.random() * total, idx = 0;
      for (let j = 0; j < w.length; j++) { r -= w[j]; if (r <= 0) { idx = j; break; } }
      const slotIdx = Math.floor(Math.random() * slots.length);
      const ps = primaryStats[slots[slotIdx]];
      const pv = Math.floor((primaryBases[ps] || 30) * mapData.tier * statMuls[idx]);
      await pool.query(
        `INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, tier, weapon_type, base_slot, req_level, enhance_level) VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, 0)`,
        [char.id, `${rarityNames[idx]}·${slotNames[slotIdx]}`, rarities[idx], ps, pv, mapData.tier,
         slots[slotIdx] === 'weapon' ? ['sword','blade','spear','fan'][Math.floor(Math.random()*4)] : null,
         slots[slotIdx], tierReqLevels[mapData.tier] || 1]
      );
    }

    // 功法掉落(最多20个)
    const skillPools: Record<number, string[]> = {
      1: ['wind_blade','vine_whip','ice_palm','flame_sword','quake_fist','body_refine','flame_body','water_flow','root_grip','metal_skin'],
      3: ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall'],
      5: ['sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury','wood_heal','mirror_water','crit_master','earth_fortitude','poison_body','fire_mastery'],
      7: ['metal_burst','quake_stomp','life_drain','inferno_burst','storm_blade','heaven_heal','water_mastery','battle_frenzy','heavenly_body','time_stop','heavenly_wrath','dao_heart','five_elements_harmony'],
    };
    let skillPool = skillPools[1];
    if (mapData.tier >= 7) skillPool = skillPools[7];
    else if (mapData.tier >= 5) skillPool = skillPools[5];
    else if (mapData.tier >= 3) skillPool = skillPools[3];

    const actualSkillCount = Math.min(skillCount, 10);
    for (let i = 0; i < actualSkillCount; i++) {
      const sid = skillPool[Math.floor(Math.random() * skillPool.length)];
      await pool.query(
        `INSERT INTO character_skill_inventory (character_id, skill_id, count) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE count = count + 1`,
        [char.id, sid]
      );
    }

    // 灵草掉落(最多30个)
    const herbIds = ['common_herb', 'metal_herb', 'wood_herb', 'water_herb', 'fire_herb', 'earth_herb'];
    const qualityOrder = ['white', 'green', 'blue', 'purple', 'gold'];
    const actualHerbCount = Math.min(herbCount, 20);
    for (let i = 0; i < actualHerbCount; i++) {
      const hid = herbIds[Math.floor(Math.random() * herbIds.length)];
      let qIdx = 0;
      const rr = Math.random();
      if (mapData.tier >= 7) qIdx = rr < 0.4 ? 4 : 3;
      else if (mapData.tier >= 5) qIdx = rr < 0.5 ? 3 : 2;
      else if (mapData.tier >= 3) qIdx = rr < 0.4 ? 2 : 1;
      else qIdx = rr < 0.2 ? 1 : 0;
      await pool.query(
        `INSERT INTO character_materials (character_id, material_id, quality, count) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE count = count + 1`,
        [char.id, hid, qualityOrder[qIdx]]
      );
    }

    // 返回最新角色
    const [updated] = await pool.query<RowDataPacket[]>('SELECT * FROM characters WHERE id = ?', [char.id]);

    res.json({
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
    });
  } catch (error) {
    console.error('领取离线收益失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

export default router;
