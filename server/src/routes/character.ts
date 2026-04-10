import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// 灵根对应的初始属性加成（基于 system-realm.json 设计）
const ROOT_BONUS: Record<string, {
  max_hp: number; hp: number; atk: number; def: number; spd: number;
  crit_rate: number; crit_dmg: number;
  resist_field: string;
}> = {
  metal: { max_hp: 500, hp: 500, atk: 58, def: 30, spd: 50, crit_rate: 0.05, crit_dmg: 1.50, resist_field: 'resist_metal' },
  wood:  { max_hp: 575, hp: 575, atk: 50, def: 30, spd: 50, crit_rate: 0.05, crit_dmg: 1.50, resist_field: 'resist_wood' },
  water: { max_hp: 500, hp: 500, atk: 50, def: 35, spd: 50, crit_rate: 0.05, crit_dmg: 1.50, resist_field: 'resist_water' },
  fire:  { max_hp: 500, hp: 500, atk: 50, def: 30, spd: 50, crit_rate: 0.05, crit_dmg: 1.70, resist_field: 'resist_fire' },
  earth: { max_hp: 550, hp: 550, atk: 50, def: 33, spd: 50, crit_rate: 0.05, crit_dmg: 1.50, resist_field: 'resist_earth' },
};

// 查询当前用户是否有角色
router.get('/info', authMiddleware, async (req: AuthRequest, res: Response) => {
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
    console.error('查询角色失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 创建角色
router.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, spiritual_root } = req.body;

    if (!name || !spiritual_root) {
      return res.json({ code: 400, message: '道号和灵根不可为空' });
    }

    if (name.length < 2 || name.length > 8) {
      return res.json({ code: 400, message: '道号长度2-8个字' });
    }

    const validRoots = ['metal', 'wood', 'water', 'fire', 'earth'];
    if (!validRoots.includes(spiritual_root)) {
      return res.json({ code: 400, message: '无效的灵根类型' });
    }

    // 检查是否已有角色
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM characters WHERE user_id = ?',
      [req.userId]
    );

    if (existing.length > 0) {
      return res.json({ code: 400, message: '已有角色，不可重复创建' });
    }

    // 检查角色名是否重复
    const [nameTaken] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM characters WHERE name = ?',
      [name]
    );

    if (nameTaken.length > 0) {
      return res.json({ code: 400, message: '此道号已被占用' });
    }

    // 计算初始属性
    const bonus = ROOT_BONUS[spiritual_root];

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO characters (
        user_id, name, spiritual_root,
        realm_tier, realm_stage, cultivation_exp,
        max_hp, hp, atk, def, spd,
        crit_rate, crit_dmg,
        ${bonus.resist_field},
        spirit_stone, current_map
      ) VALUES (?, ?, ?, 1, 1, 0, ?, ?, ?, ?, ?, ?, ?, 0.15, 500, 'qingfeng_valley')`,
      [
        req.userId, name, spiritual_root,
        bonus.max_hp, bonus.hp, bonus.atk, bonus.def, bonus.spd,
        bonus.crit_rate, bonus.crit_dmg,
      ]
    );

    // 查询刚创建的角色返回
    const [newChar] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM characters WHERE id = ?',
      [result.insertId]
    );

    res.json({ code: 200, message: '角色创建成功', data: newChar[0] });
  } catch (error) {
    console.error('创建角色失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 上传头像
router.post('/avatar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { avatar } = req.body;
    if (!avatar || typeof avatar !== 'string') {
      return res.json({ code: 400, message: '头像数据无效' });
    }
    // 限制大小 500KB (base64)
    if (avatar.length > 500000) {
      return res.json({ code: 400, message: '头像文件过大(最大500KB)' });
    }
    await pool.query(
      'UPDATE characters SET avatar = ? WHERE user_id = ?',
      [avatar, req.userId]
    );
    res.json({ code: 200, message: '头像已更新' });
  } catch (error) {
    console.error('上传头像失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

export default router;
