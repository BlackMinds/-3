import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import characterRouter from './routes/character';
import gameRouter from './routes/game';
import skillRouter from './routes/skill';
import equipmentRouter from './routes/equipment';
import pillRouter from './routes/pill';
import caveRouter from './routes/cave';
import battleRouter from './routes/battle';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 路由
app.use('/api/auth', authRouter);
app.use('/api/character', characterRouter);
app.use('/api/game', gameRouter);
app.use('/api/skill', skillRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/pill', pillRouter);
app.use('/api/cave', caveRouter);
app.use('/api/battle', battleRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ code: 200, message: '服务运行中' });
});

app.listen(PORT, () => {
  console.log(`[万界仙途] 服务启动成功 http://localhost:${PORT}`);
});

export default app;
