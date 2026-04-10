import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'xiantu_secret_key_2026') as { id: number };
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期' });
  }
}
