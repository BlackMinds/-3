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

export default router;
