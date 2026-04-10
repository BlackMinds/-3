import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// 获取角色已装备的功法
router.get('/equipped', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM characters WHERE user_id = ?',
      [req.userId]
    );

    if (charRows.length === 0) {
      return res.json({ code: 400, message: '角色不存在' });
    }

    const [skills] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_skills WHERE character_id = ? AND equipped = 1',
      [charRows[0].id]
    );

    res.json({ code: 200, data: skills });
  } catch (error) {
    console.error('获取功法失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 获取功法背包
router.get('/inventory', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM characters WHERE user_id = ?',
      [req.userId]
    );

    if (charRows.length === 0) {
      return res.json({ code: 400, message: '角色不存在' });
    }

    const [inventory] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_skill_inventory WHERE character_id = ?',
      [charRows[0].id]
    );

    res.json({ code: 200, data: inventory });
  } catch (error) {
    console.error('获取背包失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 保存装备功法
router.post('/save-equipped', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { equipped } = req.body;

    const [charRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM characters WHERE user_id = ?',
      [req.userId]
    );

    if (charRows.length === 0) {
      return res.json({ code: 400, message: '角色不存在' });
    }

    const charId = charRows[0].id;

    // 读取已有装备的等级,后续保留
    const [oldEquipped] = await pool.query<RowDataPacket[]>(
      'SELECT skill_id, skill_type, slot_index, level FROM character_skills WHERE character_id = ?',
      [charId]
    );
    const oldLevelMap: Record<string, number> = {};
    for (const row of oldEquipped) {
      oldLevelMap[`${row.skill_type}_${row.slot_index}_${row.skill_id}`] = row.level;
    }

    // 先清空旧装备
    await pool.query('DELETE FROM character_skills WHERE character_id = ?', [charId]);

    // 插入新装备(保留同槽位同 skill 的等级)
    if (Array.isArray(equipped) && equipped.length > 0) {
      for (const item of equipped) {
        const key = `${item.skill_type}_${item.slot_index}_${item.skill_id}`;
        const level = oldLevelMap[key] || 1;
        await pool.query(
          'INSERT INTO character_skills (character_id, skill_id, skill_type, slot_index, level) VALUES (?, ?, ?, ?, ?)',
          [charId, item.skill_id, item.skill_type, item.slot_index, level]
        );
      }
    }

    res.json({ code: 200, message: '装备保存成功' });
  } catch (error) {
    console.error('保存装备失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 升级已装备的功法
// 参数: { skill_id, skill_type, slot_index }
router.post('/upgrade', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { skill_id, skill_type, slot_index } = req.body;

    const [charRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM characters WHERE user_id = ?',
      [req.userId]
    );

    if (charRows.length === 0) {
      return res.json({ code: 400, message: '角色不存在' });
    }

    const charId = charRows[0].id;

    // 查询已装备的功法
    const [equipped] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_skills WHERE character_id = ? AND skill_id = ? AND skill_type = ? AND slot_index = ?',
      [charId, skill_id, skill_type, slot_index]
    );

    if (equipped.length === 0) {
      return res.json({ code: 400, message: '功法未装备' });
    }

    const currentLevel = equipped[0].level;
    if (currentLevel >= 5) {
      return res.json({ code: 400, message: '已满级' });
    }

    // 升级消耗:每升一级需要 N 个同名功法残页 (level)
    const needPages = currentLevel;

    const [pages] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_skill_inventory WHERE character_id = ? AND skill_id = ?',
      [charId, skill_id]
    );

    const havePages = pages.length > 0 ? pages[0].count : 0;
    if (havePages < needPages) {
      return res.json({ code: 400, message: `需要 ${needPages} 个 ${skill_id} 残页(当前 ${havePages})` });
    }

    // 扣残页
    await pool.query(
      'UPDATE character_skill_inventory SET count = count - ? WHERE character_id = ? AND skill_id = ?',
      [needPages, charId, skill_id]
    );

    // 升级
    await pool.query(
      'UPDATE character_skills SET level = level + 1 WHERE id = ?',
      [equipped[0].id]
    );

    res.json({
      code: 200,
      message: '升级成功',
      data: { newLevel: currentLevel + 1 },
    });
  } catch (error) {
    console.error('升级功法失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 添加功法到背包
router.post('/add', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { skill_id } = req.body;

    const [charRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM characters WHERE user_id = ?',
      [req.userId]
    );

    if (charRows.length === 0) {
      return res.json({ code: 400, message: '角色不存在' });
    }

    await pool.query(
      `INSERT INTO character_skill_inventory (character_id, skill_id, count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE count = count + 1`,
      [charRows[0].id, skill_id]
    );

    res.json({ code: 200, message: '功法已添加' });
  } catch (error) {
    console.error('添加功法失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

export default router;
