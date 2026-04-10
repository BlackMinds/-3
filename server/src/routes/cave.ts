import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';

const router = Router();

// 洞府建筑配置(后端版本,与前端保持一致)
interface BuildingConfig {
  id: string;
  maxLevel: number;
  baseCost: number;
  costMul: number;
  baseTime: number;
  output?: { type: 'exp' | 'spirit_stone' | 'herb'; base: number; perLevelMul: number };
  prerequisite?: { buildingId: string; level: number };
}

const BUILDINGS: Record<string, BuildingConfig> = {
  spirit_array:    { id: 'spirit_array',    maxLevel: 20, baseCost: 1000,  costMul: 1.6, baseTime: 0,   output: { type: 'exp',          base: 50,  perLevelMul: 1.15 } },
  herb_field:      { id: 'herb_field',      maxLevel: 15, baseCost: 1500,  costMul: 1.7, baseTime: 0   },  // 改为地块容器
  treasure_pot:    { id: 'treasure_pot',    maxLevel: 20, baseCost: 2000,  costMul: 1.8, baseTime: 0,   output: { type: 'spirit_stone', base: 100, perLevelMul: 1.18 } },
  martial_hall:    { id: 'martial_hall',    maxLevel: 10, baseCost: 3000,  costMul: 2.0, baseTime: 60 },
  sutra_pavilion:  { id: 'sutra_pavilion',  maxLevel: 10, baseCost: 5000,  costMul: 2.0, baseTime: 120, prerequisite: { buildingId: 'spirit_array', level: 5 } },
  pill_room:       { id: 'pill_room',       maxLevel: 10, baseCost: 8000,  costMul: 2.0, baseTime: 180, prerequisite: { buildingId: 'herb_field', level: 5 } },
  forge_room:      { id: 'forge_room',      maxLevel: 10, baseCost: 10000, costMul: 2.0, baseTime: 300, prerequisite: { buildingId: 'sutra_pavilion', level: 5 } },
};

// 灵草配置(后端版,与前端 herbData.ts 一致)
const HERBS: Record<string, { id: string; element: string | null; unlockPlotMaxLevel: number }> = {
  common_herb:  { id: 'common_herb',  element: null,    unlockPlotMaxLevel: 1  },
  metal_herb:   { id: 'metal_herb',   element: 'metal', unlockPlotMaxLevel: 1  },
  wood_herb:    { id: 'wood_herb',    element: 'wood',  unlockPlotMaxLevel: 1  },
  water_herb:   { id: 'water_herb',   element: 'water', unlockPlotMaxLevel: 4  },
  fire_herb:    { id: 'fire_herb',    element: 'fire',  unlockPlotMaxLevel: 4  },
  earth_herb:   { id: 'earth_herb',   element: 'earth', unlockPlotMaxLevel: 7  },
  spirit_grass: { id: 'spirit_grass', element: null,    unlockPlotMaxLevel: 10 },
};

// 品质配置
const QUALITIES: Record<string, { id: string; multiplier: number; growMinutes: number; baseYield: number; unlockPlotLevel: number }> = {
  white:  { id: 'white',  multiplier: 1.00, growMinutes: 30,  baseYield: 3, unlockPlotLevel: 1  },
  green:  { id: 'green',  multiplier: 1.20, growMinutes: 60,  baseYield: 3, unlockPlotLevel: 1  },
  blue:   { id: 'blue',   multiplier: 1.50, growMinutes: 120, baseYield: 4, unlockPlotLevel: 4  },
  purple: { id: 'purple', multiplier: 2.00, growMinutes: 240, baseYield: 4, unlockPlotLevel: 7  },
  gold:   { id: 'gold',   multiplier: 3.00, growMinutes: 480, baseYield: 5, unlockPlotLevel: 10 },
  red:    { id: 'red',    multiplier: 5.00, growMinutes: 960, baseYield: 5, unlockPlotLevel: 13 },
};

// 根据灵田等级返回地块数和最高品质
function getPlotConfig(herbFieldLevel: number): { plotCount: number; maxQualityIndex: number } {
  if (herbFieldLevel <= 0) return { plotCount: 0, maxQualityIndex: -1 };
  const lv = Math.min(herbFieldLevel, 15);
  const qOrder = ['white', 'green', 'blue', 'purple', 'gold', 'red'];
  let plotCount = 2, maxQ = 'green';
  if (lv >= 13)      { plotCount = 6; maxQ = 'red';    }
  else if (lv >= 10) { plotCount = 5; maxQ = 'gold';   }
  else if (lv >= 7)  { plotCount = 4; maxQ = 'purple'; }
  else if (lv >= 4)  { plotCount = 3; maxQ = 'blue';   }
  return { plotCount, maxQualityIndex: qOrder.indexOf(maxQ) };
}

async function getHerbFieldLevel(charId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT level FROM character_cave WHERE character_id = ? AND building_id = 'herb_field'",
    [charId]
  );
  return rows.length > 0 ? rows[0].level : 0;
}

function getChar(req: AuthRequest) {
  return pool.query<RowDataPacket[]>('SELECT * FROM characters WHERE user_id = ?', [req.userId]);
}

function getUpgradeCost(b: BuildingConfig, level: number): number {
  return Math.floor(b.baseCost * Math.pow(b.costMul, level - 1));
}

function getUpgradeTime(b: BuildingConfig, level: number): number {
  if (level <= 5) return 0;
  return Math.floor(b.baseTime * Math.pow(1.5, level - 6));
}

function calcOutput(b: BuildingConfig, level: number, lastCollectTime: Date): number {
  if (!b.output) return 0;
  const now = Date.now();
  const elapsedMs = now - new Date(lastCollectTime).getTime();
  const elapsedHours = Math.min(elapsedMs / 3600000, 24);
  if (elapsedHours <= 0) return 0;
  const perHour = Math.floor(b.output.base * Math.pow(b.output.perLevelMul, level - 1));
  return Math.floor(perHour * elapsedHours);
}

// 获取洞府所有建筑
router.get('/info', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const [buildings] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_cave WHERE character_id = ?',
      [charRows[0].id]
    );

    res.json({ code: 200, data: buildings });
  } catch (error) {
    console.error('获取洞府失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 建造或升级建筑
router.post('/upgrade', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { building_id } = req.body;
    const config = BUILDINGS[building_id];
    if (!config) return res.json({ code: 400, message: '建筑不存在' });

    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const char = charRows[0];

    // 查询当前等级
    const [existRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_cave WHERE character_id = ? AND building_id = ?',
      [char.id, building_id]
    );

    const currentLevel = existRows.length > 0 ? existRows[0].level : 0;

    if (currentLevel >= config.maxLevel) {
      return res.json({ code: 400, message: '已满级' });
    }

    // 检查是否在升级中
    if (existRows.length > 0 && existRows[0].upgrade_finish_time) {
      const finishTime = new Date(existRows[0].upgrade_finish_time).getTime();
      if (finishTime > Date.now()) {
        return res.json({ code: 400, message: '建筑升级中,请稍后' });
      }
    }

    // 检查前置条件
    if (config.prerequisite) {
      const [preRows] = await pool.query<RowDataPacket[]>(
        'SELECT level FROM character_cave WHERE character_id = ? AND building_id = ?',
        [char.id, config.prerequisite.buildingId]
      );
      const preLevel = preRows.length > 0 ? preRows[0].level : 0;
      if (preLevel < config.prerequisite.level) {
        return res.json({ code: 400, message: `需要前置建筑等级 ${config.prerequisite.level}` });
      }
    }

    // 升级到下一级
    const nextLevel = currentLevel + 1;
    const cost = getUpgradeCost(config, nextLevel);
    const upgradeTime = getUpgradeTime(config, nextLevel);

    if (char.spirit_stone < cost) {
      return res.json({ code: 400, message: '灵石不足' });
    }

    // 扣灵石
    await pool.query('UPDATE characters SET spirit_stone = spirit_stone - ? WHERE id = ?', [cost, char.id]);

    // 计算升级完成时间
    const finishTime = upgradeTime > 0 ? new Date(Date.now() + upgradeTime * 1000) : null;

    if (existRows.length === 0) {
      // 第一次建造
      await pool.query(
        'INSERT INTO character_cave (character_id, building_id, level, last_collect_time, upgrade_finish_time) VALUES (?, ?, ?, NOW(), ?)',
        [char.id, building_id, finishTime ? currentLevel : nextLevel, finishTime]
      );
    } else {
      if (finishTime) {
        // 需要建造时间,记录完成时间,等到时间到再升级
        await pool.query(
          'UPDATE character_cave SET upgrade_finish_time = ? WHERE id = ?',
          [finishTime, existRows[0].id]
        );
      } else {
        // 即时升级
        await pool.query(
          'UPDATE character_cave SET level = ? WHERE id = ?',
          [nextLevel, existRows[0].id]
        );
      }
    }

    res.json({
      code: 200,
      message: finishTime ? `升级中,${upgradeTime}秒后完成` : '升级成功',
      data: { newLevel: finishTime ? currentLevel : nextLevel, finishTime, cost },
    });
  } catch (error) {
    console.error('升级建筑失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 完成建造(检查时间到了就升级)
router.post('/finish-upgrade', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { building_id } = req.body;
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_cave WHERE character_id = ? AND building_id = ?',
      [charRows[0].id, building_id]
    );

    if (rows.length === 0) return res.json({ code: 400, message: '建筑不存在' });

    const row = rows[0];
    if (!row.upgrade_finish_time) return res.json({ code: 400, message: '没有正在进行的升级' });

    const finishTime = new Date(row.upgrade_finish_time).getTime();
    if (finishTime > Date.now()) return res.json({ code: 400, message: '尚未完成' });

    await pool.query(
      'UPDATE character_cave SET level = level + 1, upgrade_finish_time = NULL WHERE id = ?',
      [row.id]
    );

    res.json({ code: 200, message: '升级完成', data: { newLevel: row.level + 1 } });
  } catch (error) {
    console.error('完成升级失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 领取建筑产出
router.post('/collect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { building_id } = req.body;
    const config = BUILDINGS[building_id];
    if (!config || !config.output) return res.json({ code: 400, message: '建筑无产出' });

    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const charId = charRows[0].id;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_cave WHERE character_id = ? AND building_id = ?',
      [charId, building_id]
    );

    if (rows.length === 0) return res.json({ code: 400, message: '建筑未建造' });

    const row = rows[0];
    const amount = calcOutput(config, row.level, row.last_collect_time);

    if (amount <= 0) return res.json({ code: 200, data: { amount: 0, type: config.output.type } });

    // 加到对应资源
    if (config.output.type === 'exp') {
      await pool.query('UPDATE characters SET cultivation_exp = cultivation_exp + ? WHERE id = ?', [amount, charId]);
    } else if (config.output.type === 'spirit_stone') {
      await pool.query('UPDATE characters SET spirit_stone = spirit_stone + ? WHERE id = ?', [amount, charId]);
    }

    // 更新领取时间
    await pool.query(
      'UPDATE character_cave SET last_collect_time = NOW() WHERE id = ?',
      [row.id]
    );

    res.json({ code: 200, data: { amount, type: config.output.type } });
  } catch (error) {
    console.error('领取产出失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 一键领取所有
router.post('/collect-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const charId = charRows[0].id;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_cave WHERE character_id = ?',
      [charId]
    );

    let totalExp = 0, totalStone = 0;

    for (const row of rows) {
      const config = BUILDINGS[row.building_id];
      if (!config || !config.output) continue;
      const amount = calcOutput(config, row.level, row.last_collect_time);
      if (amount <= 0) continue;

      if (config.output.type === 'exp') totalExp += amount;
      else if (config.output.type === 'spirit_stone') totalStone += amount;

      await pool.query('UPDATE character_cave SET last_collect_time = NOW() WHERE id = ?', [row.id]);
    }

    if (totalExp > 0) {
      await pool.query('UPDATE characters SET cultivation_exp = cultivation_exp + ? WHERE id = ?', [totalExp, charId]);
    }
    if (totalStone > 0) {
      await pool.query('UPDATE characters SET spirit_stone = spirit_stone + ? WHERE id = ?', [totalStone, charId]);
    }
    res.json({ code: 200, data: { totalExp, totalStone, totalHerb: 0 } });
  } catch (error) {
    console.error('一键领取失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// ===== 灵田地块系统 =====

// 获取所有地块
router.get('/plots', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const charId = charRows[0].id;
    const herbFieldLevel = await getHerbFieldLevel(charId);
    const { plotCount, maxQualityIndex } = getPlotConfig(herbFieldLevel);

    const [plots] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_cave_plots WHERE character_id = ? ORDER BY plot_index',
      [charId]
    );

    // 补全空地块
    const plotMap: any = {};
    for (const p of plots) plotMap[p.plot_index] = p;
    const result = [];
    for (let i = 0; i < plotCount; i++) {
      if (plotMap[i]) {
        const isMature = plotMap[i].mature_time && new Date(plotMap[i].mature_time).getTime() <= Date.now();
        result.push({ ...plotMap[i], is_mature: isMature });
      } else {
        result.push({ plot_index: i, herb_id: null, herb_quality: null, is_mature: false });
      }
    }

    res.json({
      code: 200,
      data: {
        plots: result,
        plotCount,
        maxQualityIndex,
        herbFieldLevel,
      },
    });
  } catch (error) {
    console.error('获取地块失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 种植 (品质在收获时随机决定,种植阶段使用基础生长时间)
router.post('/plant', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { plot_index, herb_id } = req.body;
    const herb = HERBS[herb_id];
    if (!herb) return res.json({ code: 400, message: '参数错误' });

    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const charId = charRows[0].id;
    const herbFieldLevel = await getHerbFieldLevel(charId);
    const { plotCount } = getPlotConfig(herbFieldLevel);

    if (plot_index < 0 || plot_index >= plotCount) {
      return res.json({ code: 400, message: '地块未解锁' });
    }

    // 检查种类
    if (herbFieldLevel < herb.unlockPlotMaxLevel) {
      return res.json({ code: 400, message: `灵田等级不足,需要${herb.unlockPlotMaxLevel}级` });
    }

    // 检查地块是否为空
    const [exist] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_cave_plots WHERE character_id = ? AND plot_index = ?',
      [charId, plot_index]
    );

    if (exist.length > 0 && exist[0].herb_id) {
      return res.json({ code: 400, message: '地块已占用' });
    }

    // 生长时间使用基础值(凡品),按灵田等级递减(每3级减5分钟)
    const baseGrowMinutes = Math.max(15, 30 - Math.floor(herbFieldLevel / 3) * 5);
    const matureTime = new Date(Date.now() + baseGrowMinutes * 60 * 1000);

    if (exist.length > 0) {
      await pool.query(
        'UPDATE character_cave_plots SET herb_id = ?, herb_quality = NULL, plant_time = NOW(), mature_time = ?, yield_count = 0 WHERE id = ?',
        [herb_id, matureTime, exist[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO character_cave_plots (character_id, plot_index, herb_id, herb_quality, plant_time, mature_time, yield_count) VALUES (?, ?, ?, NULL, NOW(), ?, 0)',
        [charId, plot_index, herb_id, matureTime]
      );
    }

    res.json({ code: 200, message: '种植成功', data: { mature_time: matureTime } });
  } catch (error) {
    console.error('种植失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 根据灵田等级随机生成品质和产量
function randomHarvestQuality(herbFieldLevel: number): { quality: string; count: number } {
  const { maxQualityIndex } = getPlotConfig(herbFieldLevel);
  const qOrder = ['white', 'green', 'blue', 'purple', 'gold', 'red'];

  // 灵田等级越高,品质权重越偏向高品质
  // Lv1-3: 80%凡品 20%灵品
  // Lv4-6: 50%凡品 35%灵品 15%玄品
  // Lv7-9: 25%凡品 35%灵品 25%玄品 15%地品
  // Lv10-12: 10%凡品 25%灵品 30%玄品 25%地品 10%天品
  // Lv13-15: 5%凡品 15%灵品 25%玄品 25%地品 20%天品 10%仙品
  let weights: number[];
  if (herbFieldLevel >= 13)      weights = [5, 15, 25, 25, 20, 10];
  else if (herbFieldLevel >= 10) weights = [10, 25, 30, 25, 10, 0];
  else if (herbFieldLevel >= 7)  weights = [25, 35, 25, 15, 0, 0];
  else if (herbFieldLevel >= 4)  weights = [50, 35, 15, 0, 0, 0];
  else                           weights = [80, 20, 0, 0, 0, 0];

  // 限制不超过最高品质
  for (let i = maxQualityIndex + 1; i < weights.length; i++) weights[i] = 0;

  // 加权随机
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let qIdx = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) { qIdx = i; break; }
  }

  // 品质对应基础产量
  const yields = [3, 3, 4, 4, 5, 5];
  return { quality: qOrder[qIdx], count: yields[qIdx] };
}

// 收获
router.post('/harvest', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { plot_index } = req.body;
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const charId = charRows[0].id;
    const herbFieldLevel = await getHerbFieldLevel(charId);

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_cave_plots WHERE character_id = ? AND plot_index = ?',
      [charId, plot_index]
    );

    if (rows.length === 0 || !rows[0].herb_id) {
      return res.json({ code: 400, message: '地块为空' });
    }

    const plot = rows[0];
    if (new Date(plot.mature_time).getTime() > Date.now()) {
      return res.json({ code: 400, message: '尚未成熟' });
    }

    // 收获时随机品质和产量
    const { quality, count } = randomHarvestQuality(herbFieldLevel);

    // 加到材料
    await pool.query(
      `INSERT INTO character_materials (character_id, material_id, quality, count)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE count = count + ?`,
      [charId, plot.herb_id, quality, count, count]
    );

    // 清空地块
    await pool.query(
      'UPDATE character_cave_plots SET herb_id = NULL, herb_quality = NULL, plant_time = NULL, mature_time = NULL, yield_count = 0 WHERE id = ?',
      [plot.id]
    );

    res.json({
      code: 200,
      data: { herb_id: plot.herb_id, quality, count },
    });
  } catch (error) {
    console.error('收获失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 清理地块
router.post('/clear-plot', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { plot_index } = req.body;
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    await pool.query(
      'UPDATE character_cave_plots SET herb_id = NULL, herb_quality = NULL, plant_time = NULL, mature_time = NULL, yield_count = 0 WHERE character_id = ? AND plot_index = ?',
      [charRows[0].id, plot_index]
    );

    res.json({ code: 200, message: '清理成功' });
  } catch (error) {
    console.error('清理失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 一键收获所有成熟地块
router.post('/harvest-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const charId = charRows[0].id;
    const herbFieldLevel = await getHerbFieldLevel(charId);
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_cave_plots WHERE character_id = ? AND herb_id IS NOT NULL',
      [charId]
    );

    const harvested: any[] = [];
    for (const plot of rows) {
      if (new Date(plot.mature_time).getTime() > Date.now()) continue;
      const { quality, count } = randomHarvestQuality(herbFieldLevel);
      await pool.query(
        `INSERT INTO character_materials (character_id, material_id, quality, count)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE count = count + ?`,
        [charId, plot.herb_id, quality, count, count]
      );
      await pool.query(
        'UPDATE character_cave_plots SET herb_id = NULL, herb_quality = NULL, plant_time = NULL, mature_time = NULL, yield_count = 0 WHERE id = ?',
        [plot.id]
      );
      harvested.push({ herb_id: plot.herb_id, quality, count });
    }

    res.json({ code: 200, data: { harvested } });
  } catch (error) {
    console.error('一键收获失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

export default router;
