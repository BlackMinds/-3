import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../database/db';
import { RowDataPacket } from 'mysql2';

const router = Router();

// 注册
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ code: 400, message: '用户名和密码不能为空' });
    }

    if (username.length < 2 || username.length > 16) {
      return res.json({ code: 400, message: '用户名长度2-16位' });
    }

    if (password.length < 6 || password.length > 32) {
      return res.json({ code: 400, message: '密码长度6-32位' });
    }

    // 检查用户名是否已存在
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return res.json({ code: 400, message: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 插入用户
    await pool.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );

    res.json({ code: 200, message: '注册成功' });
  } catch (error) {
    console.error('注册失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ code: 400, message: '用户名和密码不能为空' });
    }

    // 查找用户
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, password, status FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.json({ code: 400, message: '用户名或密码错误' });
    }

    const user = rows[0];

    if (user.status === 0) {
      return res.json({ code: 403, message: '账号已被封禁' });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ code: 400, message: '用户名或密码错误' });
    }

    // 更新最后登录时间
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // 生成JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'xiantu_secret_key_2026',
      { expiresIn: '7d' }
    );

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      },
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.json({ code: 500, message: '服务器错误' });
  }
});

export default router;
