import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';

const router = Router();

function getChar(req: AuthRequest) {
  return pool.query<RowDataPacket[]>('SELECT * FROM characters WHERE user_id = ?', [req.userId]);
}

// 获取丹药背包(分品质系数)
router.get('/inventory', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const [pills] = await pool.query<RowDataPacket[]>(
      'SELECT id, pill_id, count, quality_factor FROM character_pills WHERE character_id = ? AND count > 0 ORDER BY pill_id, quality_factor DESC',
      [charRows[0].id]
    );

    res.json({ code: 200, data: pills });
  } catch (error) {
    console.error('获取丹药失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 添加灵草到背包(战斗掉落)
router.post('/add-herb', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { herb_id, quality, count } = req.body;
    if (!herb_id || !quality || !count) return res.json({ code: 400, message: '参数错误' });

    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    await pool.query(
      `INSERT INTO character_materials (character_id, material_id, quality, count)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE count = count + ?`,
      [charRows[0].id, herb_id, quality, count, count]
    );

    res.json({ code: 200 });
  } catch (error) {
    console.error('添加灵草失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 获取灵草背包(所有种类和品质)
router.get('/herbs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT material_id as herb_id, quality, count FROM character_materials WHERE character_id = ? AND count > 0 ORDER BY material_id, quality",
      [charRows[0].id]
    );

    res.json({ code: 200, data: rows });
  } catch (error) {
    console.error('获取灵草失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 灵草品质倍率
const QUALITY_MUL: Record<string, number> = {
  white: 1.00, green: 1.20, blue: 1.50, purple: 2.00, gold: 3.00, red: 5.00,
};

// 炼丹 (新版: 接收灵草数组)
// 参数: { pill_id, cost, success_rate, herbs_used: [{herb_id, quality, count}] }
router.post('/craft', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { pill_id, cost, success_rate, herbs_used } = req.body;
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const char = charRows[0];

    if (!Array.isArray(herbs_used) || herbs_used.length === 0) {
      return res.json({ code: 400, message: '灵草参数错误' });
    }

    // 校验灵草是否够
    for (const h of herbs_used) {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT count FROM character_materials WHERE character_id = ? AND material_id = ? AND quality = ?',
        [char.id, h.herb_id, h.quality]
      );
      const have = rows.length > 0 ? rows[0].count : 0;
      if (have < h.count) {
        return res.json({ code: 400, message: `${h.herb_id}(${h.quality}) 不足,需要 ${h.count}(当前 ${have})` });
      }
    }

    // 计算品质系数
    let totalCount = 0;
    let totalWeight = 0;
    for (const h of herbs_used) {
      const mul = QUALITY_MUL[h.quality] || 1.0;
      totalCount += h.count;
      totalWeight += mul * h.count;
    }
    const qualityFactor = totalCount > 0 ? Math.round((totalWeight / totalCount) * 100) / 100 : 1.0;

    // 灵石消耗按品质系数调整
    const actualCost = Math.floor(cost * qualityFactor);

    if (char.spirit_stone < actualCost) {
      return res.json({ code: 400, message: `灵石不足,需要 ${actualCost}(品质加成)` });
    }

    // 扣灵石
    await pool.query(
      'UPDATE characters SET spirit_stone = spirit_stone - ? WHERE id = ?',
      [actualCost, char.id]
    );

    // 扣灵草(不管成功失败都扣)
    for (const h of herbs_used) {
      await pool.query(
        'UPDATE character_materials SET count = count - ? WHERE character_id = ? AND material_id = ? AND quality = ?',
        [h.count, char.id, h.herb_id, h.quality]
      );
    }

    // 判断成功
    const success = Math.random() < success_rate;

    if (success) {
      // 添加丹药(同品质系数合并)
      await pool.query(
        `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
         VALUES (?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE count = count + 1`,
        [char.id, pill_id, qualityFactor]
      );
    }

    res.json({
      code: 200,
      data: {
        success,
        quality_factor: qualityFactor,
        new_spirit_stone: Number(char.spirit_stone) - actualCost,
      },
    });
  } catch (error) {
    console.error('炼丹失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 使用丹药
// 参数: { pill_id, quality_factor, pill_type, exp_gain, buff_duration }
router.post('/use', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { pill_id, quality_factor, pill_type, exp_gain, buff_duration } = req.body;
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const char = charRows[0];
    const qf = Number(quality_factor) || 1.0;

    // 检查是否有该品质的丹药
    const [pillRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_pills WHERE character_id = ? AND pill_id = ? AND quality_factor = ? AND count > 0',
      [char.id, pill_id, qf]
    );

    if (pillRows.length === 0) {
      return res.json({ code: 400, message: '丹药不足' });
    }

    // 扣丹药
    await pool.query(
      'UPDATE character_pills SET count = count - 1 WHERE character_id = ? AND pill_id = ? AND quality_factor = ?',
      [char.id, pill_id, qf]
    );

    // 突破丹药: 加修为(按品质系数)
    if (pill_type === 'breakthrough' && exp_gain) {
      const finalExp = Math.floor(exp_gain * qf);
      await pool.query(
        'UPDATE characters SET cultivation_exp = cultivation_exp + ? WHERE id = ?',
        [finalExp, char.id]
      );
    }

    // 战斗丹药: 按品质系数决定持续时间(小时)
    if (pill_type === 'battle') {
      // 品质→小时: 1.0→1h, 1.2→2h, 1.5→2h, 2.0→3h, 3.0→5h, 5.0→8h
      const hours = Math.min(8, Math.max(1, Math.round(qf * 1.6)));
      const expireTime = new Date(Date.now() + hours * 3600 * 1000);
      await pool.query(
        'DELETE FROM character_buffs WHERE character_id = ? AND pill_id = ?',
        [char.id, pill_id]
      );
      await pool.query(
        'INSERT INTO character_buffs (character_id, pill_id, remaining_fights, quality_factor, expire_time) VALUES (?, ?, 0, ?, ?)',
        [char.id, pill_id, qf, expireTime]
      );
    }

    res.json({ code: 200, message: '使用成功', data: { quality_factor: qf } });
  } catch (error) {
    console.error('使用丹药失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 获取当前buff
router.get('/buffs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const [buffs] = await pool.query<RowDataPacket[]>(
      'SELECT id, pill_id, remaining_fights, quality_factor, expire_time FROM character_buffs WHERE character_id = ? AND (expire_time > NOW() OR remaining_fights > 0)',
      [charRows[0].id]
    );

    res.json({ code: 200, data: buffs });
  } catch (error) {
    console.error('获取buff失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 战斗后扣减buff次数
router.post('/consume-buff', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await getChar(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    await pool.query(
      'UPDATE character_buffs SET remaining_fights = remaining_fights - 1 WHERE character_id = ? AND remaining_fights > 0',
      [charRows[0].id]
    );

    // 清理过期buff
    await pool.query(
      'DELETE FROM character_buffs WHERE character_id = ? AND remaining_fights <= 0',
      [charRows[0].id]
    );

    res.json({ code: 200, message: 'ok' });
  } catch (error) {
    console.error('扣减buff失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

export default router;
