import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';

const router = Router();

function getCharId(req: AuthRequest) {
  return pool.query<RowDataPacket[]>('SELECT id FROM characters WHERE user_id = ?', [req.userId]);
}

// 获取所有装备（背包+已装备）
router.get('/list', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [charRows] = await getCharId(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_equipment WHERE character_id = ? ORDER BY slot IS NULL, rarity DESC, tier DESC',
      [charRows[0].id]
    );

    res.json({ code: 200, data: rows });
  } catch (error) {
    console.error('获取装备失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 添加装备（战斗掉落）
router.post('/add', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { slot: baseSlot, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, req_level } = req.body;
    const [charRows] = await getCharId(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    await pool.query(
      `INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, base_slot, req_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [charRows[0].id, name, rarity, primary_stat, primary_value, JSON.stringify(sub_stats || []), set_id || null, tier || 1, weapon_type || null, baseSlot || null, req_level || 1]
    );

    res.json({ code: 200, message: '装备已获得' });
  } catch (error) {
    console.error('添加装备失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 穿戴装备
router.post('/equip', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { equip_id, slot } = req.body;
    const [charRows] = await getCharId(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const charId = charRows[0].id;

    // 校验装备类型与槽位匹配
    const [eqRows] = await pool.query<RowDataPacket[]>(
      'SELECT base_slot, req_level FROM character_equipment WHERE id = ? AND character_id = ?',
      [equip_id, charId]
    );
    if (eqRows.length === 0) {
      return res.json({ code: 400, message: '装备不存在' });
    }
    if (eqRows[0].base_slot && eqRows[0].base_slot !== slot) {
      return res.json({ code: 400, message: '装备类型不匹配' });
    }
    // 校验等级
    const [charLvRows] = await pool.query<RowDataPacket[]>(
      'SELECT level FROM characters WHERE id = ?', [charId]
    );
    const charLv = charLvRows.length > 0 ? (charLvRows[0].level || 1) : 1;
    if (eqRows[0].req_level && charLv < eqRows[0].req_level) {
      return res.json({ code: 400, message: `等级不足,需要 Lv.${eqRows[0].req_level}` });
    }

    // 先把该槽位已有装备卸下
    await pool.query(
      'UPDATE character_equipment SET slot = NULL WHERE character_id = ? AND slot = ?',
      [charId, slot]
    );

    // 穿上新装备
    await pool.query(
      'UPDATE character_equipment SET slot = ? WHERE id = ? AND character_id = ?',
      [slot, equip_id, charId]
    );

    res.json({ code: 200, message: '装备成功' });
  } catch (error) {
    console.error('穿戴装备失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 卸下装备
router.post('/unequip', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { equip_id } = req.body;
    const [charRows] = await getCharId(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    await pool.query(
      'UPDATE character_equipment SET slot = NULL WHERE id = ? AND character_id = ?',
      [equip_id, charRows[0].id]
    );

    res.json({ code: 200, message: '已卸下' });
  } catch (error) {
    console.error('卸下装备失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 出售装备
router.post('/sell', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { equip_id } = req.body;
    const [charRows] = await getCharId(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const charId = charRows[0].id;

    const [equipRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_equipment WHERE id = ? AND character_id = ? AND slot IS NULL',
      [equip_id, charId]
    );

    if (equipRows.length === 0) return res.json({ code: 400, message: '装备不存在或已穿戴' });

    const sellPrices: Record<string, number> = { white: 10, green: 50, blue: 200, purple: 1000, gold: 5000, red: 20000 };
    const enhLv = equipRows[0].enhance_level || 0;
    const price = Math.floor((sellPrices[equipRows[0].rarity] || 10) * equipRows[0].tier * (1 + enhLv * 0.1));

    await pool.query('DELETE FROM character_equipment WHERE id = ?', [equip_id]);
    await pool.query('UPDATE characters SET spirit_stone = spirit_stone + ? WHERE id = ?', [price, charId]);

    res.json({ code: 200, message: `出售获得 ${price} 灵石`, data: { price } });
  } catch (error) {
    console.error('出售装备失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 装备强化
router.post('/enhance', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { equip_id } = req.body;
    const [charRows] = await getCharId(req);
    if (charRows.length === 0) return res.json({ code: 400, message: '角色不存在' });

    const charId = charRows[0].id;

    const [eqRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM character_equipment WHERE id = ? AND character_id = ?',
      [equip_id, charId]
    );

    if (eqRows.length === 0) return res.json({ code: 400, message: '装备不存在' });

    const eq = eqRows[0];

    if (!eq.slot) return res.json({ code: 400, message: '只能强化已穿戴的装备' });

    const currentLevel = eq.enhance_level || 0;

    if (currentLevel >= 10) {
      return res.json({ code: 400, message: '已达最大强化等级' });
    }

    // 消耗计算
    const baseCosts: Record<string, number> = {
      white: 50, green: 100, blue: 300, purple: 800, gold: 2000, red: 5000,
    };
    const baseCost = baseCosts[eq.rarity] || 300;
    const cost = Math.floor(baseCost * Math.pow(currentLevel + 2, 1.4));

    // 检查灵石
    const [charData] = await pool.query<RowDataPacket[]>(
      'SELECT spirit_stone FROM characters WHERE id = ?',
      [charId]
    );
    const currentStone = Number(charData[0].spirit_stone);
    if (currentStone < cost) {
      return res.json({ code: 400, message: `灵石不足,需要 ${cost}` });
    }

    // 扣灵石
    await pool.query(
      'UPDATE characters SET spirit_stone = spirit_stone - ? WHERE id = ?',
      [cost, charId]
    );

    // 成功率: +1~+5 必成功, +6起有失败率
    const nextLevel = currentLevel + 1;
    let successRate = 1.0;
    if (nextLevel === 6) successRate = 0.80;
    else if (nextLevel === 7) successRate = 0.70;
    else if (nextLevel === 8) successRate = 0.55;
    else if (nextLevel === 9) successRate = 0.40;
    else if (nextLevel === 10) successRate = 0.25;

    const success = Math.random() < successRate;

    if (!success) {
      // 失败退一级 (不会低于 +5)
      const fallLevel = Math.max(5, currentLevel - 1);
      await pool.query(
        'UPDATE character_equipment SET enhance_level = ? WHERE id = ?',
        [fallLevel, equip_id]
      );
      return res.json({
        code: 200,
        data: {
          success: false,
          cost,
          newLevel: fallLevel,
          oldLevel: currentLevel,
          newSpiritStone: currentStone - cost,
        },
      });
    }

    // 强化成功: 等级+1
    await pool.query(
      'UPDATE character_equipment SET enhance_level = ? WHERE id = ?',
      [nextLevel, equip_id]
    );

    // 副属性突破 (+5 和 +10 时)
    let breakthroughStat: string | null = null;
    let breakthroughOldVal = 0;
    let breakthroughNewVal = 0;

    if (nextLevel === 5 || nextLevel === 10) {
      let subStats = eq.sub_stats;
      if (typeof subStats === 'string') subStats = JSON.parse(subStats);
      if (Array.isArray(subStats) && subStats.length > 0) {
        const idx = Math.floor(Math.random() * subStats.length);
        breakthroughStat = subStats[idx].stat;
        breakthroughOldVal = subStats[idx].value;
        // 至少 +1,防止小数值 floor 后不变
        const boosted = Math.floor(subStats[idx].value * 1.3);
        subStats[idx].value = Math.max(boosted, subStats[idx].value + 1);
        breakthroughNewVal = subStats[idx].value;
        await pool.query(
          'UPDATE character_equipment SET sub_stats = ? WHERE id = ?',
          [JSON.stringify(subStats), equip_id]
        );
      }
    }

    res.json({
      code: 200,
      data: {
        success: true,
        cost,
        newLevel: nextLevel,
        newSpiritStone: currentStone - cost,
        breakthrough: breakthroughStat ? {
          stat: breakthroughStat,
          oldValue: breakthroughOldVal,
          newValue: breakthroughNewVal,
        } : null,
      },
    });
  } catch (error) {
    console.error('强化失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

export default router;
