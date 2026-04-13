# Nuxt + Vercel 重构方案

> 日期: 2026-04-13
> 状态: 方案设计中
> 目标: 将 Vue 3 + Express 双项目重构为 Nuxt 3 单项目，部署到 Vercel

---

## 一、现状分析

| 项目 | 当前 | 目标 |
|------|------|------|
| 前端 | Vue 3 + Vite (client/) | Nuxt 3 (统一项目) |
| 后端 | Express 5 (server/) | Nuxt Server Routes (serverless) |
| 数据库 | 本地 MySQL 8.0 + mysql2 | Vercel Postgres (Neon) + pg |
| 部署 | 手动启动两个进程 | Vercel 一键部署 |
| 定时任务 | `setInterval` / `setTimeout` (sect cron) | GitHub Actions 定时触发 API |
| 头像上传 | base64 存 DB | 保持不变（已兼容 serverless） |

---

## 二、Vercel Serverless 约束

| 约束 | 影响 | 应对 |
|------|------|------|
| **无持久进程** | Express `app.listen()` 不存在，setInterval 不可用 | Nuxt Server Routes + GitHub Actions cron |
| **函数执行时限** | Hobby 10s / Pro 60s | 战斗 API 单次计算够用（同步计算） |
| **无本地文件系统** | 不能写临时文件 | 头像已用 base64 存 DB，无影响 |
| **冷启动** | 首次请求慢 500ms-2s | Neon serverless driver 支持无连接池模式 |
| **无 WebSocket** | 当前没用到 | 无影响 |

---

## 三、项目结构设计

```
game/                              # Nuxt 3 项目根目录
├── nuxt.config.ts                 # Nuxt 配置
├── app.vue                        # 根组件
├── pages/                         # 文件路由（替代 vue-router）
│   ├── index.vue                  # / → 游戏主页（原 Game.vue）
│   ├── login.vue                  # /login
│   └── create.vue                 # /create
├── components/                    # 组件拆分（从 Game.vue 294KB 拆出）
│   ├── battle/                    # 历练标签
│   │   ├── BattleTab.vue
│   │   ├── BattleLog.vue
│   │   └── BattleStats.vue
│   ├── character/                 # 角色标签
│   │   ├── CharacterTab.vue
│   │   └── EquipmentPanel.vue
│   ├── alchemy/                   # 炼丹标签
│   │   ├── AlchemyTab.vue
│   │   └── HerbInventory.vue
│   ├── skills/                    # 功法标签
│   │   └── SkillsTab.vue
│   ├── cave/                      # 洞府标签
│   │   ├── CaveTab.vue
│   │   └── HerbPlots.vue
│   ├── sect/                      # 宗门标签
│   │   └── SectTab.vue
│   └── common/                    # 公共组件
│       ├── Toast.vue
│       ├── Modal.vue
│       └── TopBar.vue
├── composables/                   # 组合式函数
│   └── useApi.ts                  # 封装 $fetch + 鉴权
├── stores/                        # Pinia stores（基本保留）
│   ├── user.ts                    # → 改用 useCookie 替代 localStorage
│   └── game.ts                    # → 保留，微调 API 调用
├── game/                          # 游戏静态数据（直接迁移）
│   ├── types.ts
│   ├── data.ts
│   ├── skillData.ts
│   ├── equipData.ts
│   ├── pillData.ts
│   ├── herbData.ts
│   ├── caveData.ts
│   └── sectData.ts
├── middleware/                     # Nuxt 路由中间件（替代 router guard）
│   └── auth.ts                    # 鉴权守卫
├── server/                        # Nuxt Server Routes（替代 Express）
│   ├── api/                       # API 路由（自动映射为 /api/xxx）
│   │   ├── auth/
│   │   │   ├── register.post.ts
│   │   │   └── login.post.ts
│   │   ├── character/
│   │   │   ├── info.get.ts
│   │   │   ├── create.post.ts
│   │   │   └── avatar.post.ts
│   │   ├── game/
│   │   │   ├── data.get.ts
│   │   │   ├── save-rewards.post.ts
│   │   │   ├── update-character.post.ts
│   │   │   ├── cultivate.post.ts
│   │   │   ├── offline-start.post.ts
│   │   │   ├── offline-status.get.ts
│   │   │   └── offline-claim.post.ts
│   │   ├── battle/
│   │   │   └── fight.post.ts
│   │   ├── skill/
│   │   │   ├── inventory.get.ts
│   │   │   ├── equipped.get.ts
│   │   │   ├── save-equipped.post.ts
│   │   │   ├── upgrade.post.ts
│   │   │   └── add.post.ts
│   │   ├── equipment/
│   │   │   ├── list.get.ts
│   │   │   ├── add.post.ts
│   │   │   ├── equip.post.ts
│   │   │   ├── unequip.post.ts
│   │   │   ├── sell.post.ts
│   │   │   └── enhance.post.ts
│   │   ├── pill/
│   │   │   ├── inventory.get.ts
│   │   │   ├── herbs.get.ts
│   │   │   ├── add-herb.post.ts
│   │   │   ├── craft.post.ts
│   │   │   ├── use.post.ts
│   │   │   ├── buffs.get.ts
│   │   │   └── consume-buff.post.ts
│   │   ├── cave/
│   │   │   ├── info.get.ts
│   │   │   ├── upgrade.post.ts
│   │   │   ├── finish-upgrade.post.ts
│   │   │   ├── collect.post.ts
│   │   │   ├── collect-all.post.ts
│   │   │   ├── plots.get.ts
│   │   │   ├── plant.post.ts
│   │   │   ├── harvest.post.ts
│   │   │   ├── harvest-all.post.ts
│   │   │   └── clear-plot.post.ts
│   │   ├── sect/
│   │   │   ├── create.post.ts
│   │   │   ├── info.get.ts
│   │   │   └── ... (约25个文件)
│   │   ├── ranking/
│   │   │   └── [...].get.ts
│   │   ├── achievement/
│   │   │   └── [...].ts
│   │   ├── cron/                  # GitHub Actions 触发的定时任务入口
│   │   │   ├── daily-reset.post.ts
│   │   │   ├── weekly-reset.post.ts
│   │   │   └── boss-expire.post.ts
│   │   └── health.get.ts
│   ├── engine/                    # 游戏引擎（直接迁移）
│   │   ├── battleEngine.ts
│   │   ├── skillData.ts
│   │   ├── realmData.ts
│   │   ├── achievementData.ts
│   │   ├── sectData.ts
│   │   └── equipNameData.ts
│   ├── database/
│   │   └── db.ts                  # PostgreSQL 连接（Neon serverless）
│   ├── middleware/
│   │   └── auth.ts                # Server 中间件（JWT 验证）
│   └── utils/
│       └── auth.ts                # JWT 工具函数
├── assets/
│   └── style.css                  # 水墨暗色主题
├── public/                        # 静态资源
├── .github/
│   └── workflows/
│       └── cron.yml               # GitHub Actions 定时任务
├── vercel.json                    # Vercel 部署配置
├── .env                           # 环境变量
└── package.json
```

---

## 四、PostgreSQL 迁移

### 4.1 为什么选 PostgreSQL

- Vercel 原生集成 Vercel Postgres（底层 Neon），零配置绑定
- Neon 提供 serverless driver（`@neondatabase/serverless`），无需连接池，冷启动极快
- 免费额度: 0.5GB 存储 + 190 计算小时/月，个人项目够用
- 如果后续需要更多容量，可以直接用独立 Neon 账号（免费层 10GB）

### 4.2 驱动选型

```
mysql2 → @neondatabase/serverless（推荐）或 pg
```

`@neondatabase/serverless` 基于 HTTP/WebSocket 协议，天然适配 serverless 环境，无需传统 TCP 连接池。

```typescript
// server/database/db.ts
import { neon } from '@neondatabase/serverless'

export function getDb() {
  const config = useRuntimeConfig()
  return neon(config.databaseUrl)
}

// 使用方式（每次调用都是独立 HTTP 请求，无需连接管理）
const sql = getDb()
const [user] = await sql`SELECT * FROM users WHERE id = ${userId}`
```

如果需要事务支持（部分复杂接口需要），可以用 `@neondatabase/serverless` 的 Pool：

```typescript
import { Pool } from '@neondatabase/serverless'

let pool: Pool | null = null

export function getPool() {
  if (!pool) {
    const config = useRuntimeConfig()
    pool = new Pool({ connectionString: config.databaseUrl })
  }
  return pool
}

// 事务示例
const client = await getPool().connect()
try {
  await client.query('BEGIN')
  await client.query('UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2', [cost, charId])
  await client.query('INSERT INTO character_pills ...')
  await client.query('COMMIT')
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  client.release()
}
```

### 4.3 SQL 语法迁移清单

对现有代码全面审计后，需要改动的 MySQL 特有语法如下：

#### 高优先级（大量使用，必须改）

**1. `ON DUPLICATE KEY UPDATE` → `ON CONFLICT ... DO UPDATE`（30+ 处）**

这是改动量最大的部分，涉及 8 个路由文件。

```sql
-- MySQL（当前）
INSERT INTO character_skill_inventory (character_id, skill_id, count)
VALUES (?, ?, 1)
ON DUPLICATE KEY UPDATE count = count + 1

-- PostgreSQL（目标）
INSERT INTO character_skill_inventory (character_id, skill_id, count)
VALUES ($1, $2, 1)
ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1
```

涉及文件和大致数量：
| 文件 | 实例数 |
|------|--------|
| `routes/sect.ts` | ~20 |
| `routes/battle.ts` | ~3 |
| `routes/cave.ts` | ~2 |
| `routes/game.ts` | ~2 |
| `routes/pill.ts` | ~2 |
| `routes/skill.ts` | ~2 |
| `routes/achievement.ts` | ~2 |
| `engine/achievementData.ts` | ~1 |

**2. 占位符 `?` → `$1, $2, $3...`（全部 SQL 查询）**

mysql2 使用 `?` 占位符，pg/neon 使用 `$N` 编号占位符。这是每条 SQL 都要改的。

```sql
-- MySQL
SELECT * FROM characters WHERE user_id = ? AND id = ?

-- PostgreSQL
SELECT * FROM characters WHERE user_id = $1 AND id = $2
```

> 也可以选择使用 neon 的 tagged template 语法 `` sql`SELECT * FROM characters WHERE user_id = ${userId}` `` 来避免手动编号，但这需要改所有查询的调用方式。

**3. `AUTO_INCREMENT` → `SERIAL` / `GENERATED ALWAYS AS IDENTITY`（11 张表）**

```sql
-- MySQL
id INT AUTO_INCREMENT PRIMARY KEY

-- PostgreSQL
id SERIAL PRIMARY KEY
-- 或更现代的写法:
id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

#### 中优先级（少量使用）

**4. `ENUM` 类型（9 个字段）**

```sql
-- MySQL
spiritual_root ENUM('metal','wood','water','fire','earth')
role ENUM('leader','vice_leader','elder','inner','outer')

-- PostgreSQL 方案 A: 创建 ENUM 类型
CREATE TYPE spiritual_root_enum AS ENUM ('metal','wood','water','fire','earth');
ALTER TABLE characters ALTER COLUMN spiritual_root TYPE spiritual_root_enum;

-- PostgreSQL 方案 B: 用 VARCHAR + CHECK 约束（更灵活，推荐）
spiritual_root VARCHAR(10) CHECK (spiritual_root IN ('metal','wood','water','fire','earth'))
```

涉及字段：
- `characters.spiritual_root` — 5 值
- `character_skills.skill_type` — 3 值
- `character_equipment.rarity` — 6 值
- `character_equipment.base_slot` — 7 值
- `character_equipment.weapon_type` — 5 值
- `sects.join_mode` — 2 值
- `sect_members.role` — 5 值
- `sect_applications.status` — 3 值
- `sect_bosses.status` — 3 值

**5. `IF()` 函数 → `CASE WHEN`（2 处）**

```sql
-- MySQL
completed_at = IF(? AND completed_at IS NULL, NOW(), completed_at)
completed = IF(current_count + ? >= target_count, 1, completed)

-- PostgreSQL
completed_at = CASE WHEN $1 AND completed_at IS NULL THEN NOW() ELSE completed_at END
completed = CASE WHEN current_count + $1 >= target_count THEN 1 ELSE completed END
```

**6. `FIELD()` 排序 → `CASE` 排序（1 处）**

```sql
-- MySQL
ORDER BY FIELD(sm.role, 'leader','vice_leader','elder','inner','outer')

-- PostgreSQL
ORDER BY CASE sm.role
  WHEN 'leader' THEN 1
  WHEN 'vice_leader' THEN 2
  WHEN 'elder' THEN 3
  WHEN 'inner' THEN 4
  WHEN 'outer' THEN 5
END
```

**7. `ON UPDATE CURRENT_TIMESTAMP` → 触发器（1 处）**

```sql
-- MySQL
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

-- PostgreSQL: 需要创建触发器
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON sects
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
```

#### 低优先级（语法兼容或微调）

**8. `DATE_ADD` / `DATE_SUB` → 区间运算（3 处）**

```sql
-- MySQL
DATE_ADD(NOW(), INTERVAL 24 HOUR)
DATE_SUB(NOW(), INTERVAL 48 HOUR)

-- PostgreSQL
NOW() + INTERVAL '24 hours'
NOW() - INTERVAL '48 hours'
```

**9. `TINYINT` → `SMALLINT` 或 `BOOLEAN`（10+ 字段）**

```sql
-- MySQL
equipped TINYINT(1) DEFAULT 0
completed TINYINT(1) DEFAULT 0

-- PostgreSQL（语义为布尔值的改 BOOLEAN）
equipped BOOLEAN DEFAULT FALSE
completed BOOLEAN DEFAULT FALSE
```

> 注意: 代码中用 `0/1` 判断的地方需要改为 `true/false`，或在查询时做类型转换。

**10. `JSON` → `JSONB`（建议）**

```sql
-- MySQL
sub_stats JSON DEFAULT NULL

-- PostgreSQL（JSONB 支持索引和更高效的查询）
sub_stats JSONB DEFAULT NULL
```

`JSON.stringify()` / `JSON.parse()` 在应用层不变，pg 驱动会自动处理 JSONB 序列化。

#### 完全兼容（无需修改）

以下语法在 PostgreSQL 中完全兼容，无需改动：
- `NOW()` / `CURRENT_TIMESTAMP`
- `GREATEST()` / `LEAST()`
- `COALESCE()`
- `FLOOR()` 等数学函数
- `JOIN` / `LEFT JOIN`
- `ORDER BY ... DESC`
- `LIMIT N`
- `LIKE`
- `GROUP BY` + 聚合函数
- `BIGINT` / `DECIMAL(p,s)`

### 4.4 建表脚本迁移示例

以 `characters` 表为例，展示完整的 MySQL → PostgreSQL 转换：

```sql
-- ========== MySQL 原始 ==========
CREATE TABLE characters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(20) NOT NULL,
  spiritual_root ENUM('metal','wood','water','fire','earth') NOT NULL,
  realm_tier INT DEFAULT 1,
  realm_stage INT DEFAULT 1,
  cultivation_exp BIGINT DEFAULT 0,
  level INT DEFAULT 1,
  level_exp BIGINT DEFAULT 0,
  max_hp INT DEFAULT 200,
  hp INT DEFAULT 200,
  atk INT DEFAULT 20,
  def INT DEFAULT 10,
  spd INT DEFAULT 10,
  crit_rate DECIMAL(5,4) DEFAULT 0.0500,
  crit_dmg DECIMAL(5,4) DEFAULT 1.5000,
  dodge DECIMAL(5,4) DEFAULT 0.0300,
  spirit_stone BIGINT DEFAULT 0,
  current_map VARCHAR(30) DEFAULT 'green_bamboo_forest',
  avatar MEDIUMTEXT DEFAULT NULL,
  offline_start DATETIME DEFAULT NULL,
  offline_map VARCHAR(30) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_name (name)
);

-- ========== PostgreSQL 目标 ==========
CREATE TABLE characters (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  name VARCHAR(20) NOT NULL UNIQUE,
  spiritual_root VARCHAR(10) NOT NULL CHECK (spiritual_root IN ('metal','wood','water','fire','earth')),
  realm_tier INT DEFAULT 1,
  realm_stage INT DEFAULT 1,
  cultivation_exp BIGINT DEFAULT 0,
  level INT DEFAULT 1,
  level_exp BIGINT DEFAULT 0,
  max_hp INT DEFAULT 200,
  hp INT DEFAULT 200,
  atk INT DEFAULT 20,
  def INT DEFAULT 10,
  spd INT DEFAULT 10,
  crit_rate DECIMAL(5,4) DEFAULT 0.0500,
  crit_dmg DECIMAL(5,4) DEFAULT 1.5000,
  dodge DECIMAL(5,4) DEFAULT 0.0300,
  spirit_stone BIGINT DEFAULT 0,
  current_map VARCHAR(30) DEFAULT 'green_bamboo_forest',
  avatar TEXT DEFAULT NULL,
  offline_start TIMESTAMP DEFAULT NULL,
  offline_map VARCHAR(30) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

主要差异：
- `INT AUTO_INCREMENT` → `SERIAL`
- `ENUM(...)` → `VARCHAR + CHECK`
- `MEDIUMTEXT` → `TEXT`（PostgreSQL 的 TEXT 无长度限制）
- `DATETIME` → `TIMESTAMP`
- `UNIQUE KEY name (col)` → `UNIQUE` 直接加在列定义上
- `FOREIGN KEY` 可以内联写

### 4.5 查询层改造策略

两种方案：

**方案 A: 最小改动 — 用 pg 库，手动改占位符**

保持 `pool.query(sql, params)` 模式不变，只把 `?` 改成 `$N`。

```typescript
// 之前 (mysql2)
const [rows] = await pool.query(
  'SELECT * FROM characters WHERE user_id = ? AND id = ?',
  [userId, charId]
)

// 之后 (pg)
const { rows } = await pool.query(
  'SELECT * FROM characters WHERE user_id = $1 AND id = $2',
  [userId, charId]
)
```

改动点：每条 SQL 的 `?` → `$N`，结果从 `[rows]` 解构改为 `{ rows }`。

**方案 B: 用 neon tagged template（更简洁，推荐）**

```typescript
// 之后 (neon serverless)
const sql = getDb()
const rows = await sql`SELECT * FROM characters WHERE user_id = ${userId} AND id = ${charId}`
```

优点：无需手动编号占位符，代码更简洁。
缺点：所有查询都要重写为 tagged template 语法。

**建议: 方案 A**，改动量可控且机械化（可以批量替换），方案 B 虽然更优雅但重写量太大。

### 4.6 数据迁移

从本地 MySQL 导出数据到 Neon PostgreSQL：

```bash
# 1. MySQL 导出为 CSV
mysqldump -u root -p xiantu_game --tab=/tmp/export --fields-terminated-by=','

# 2. 或者用 pgloader 自动迁移（推荐，自动处理类型转换）
pgloader mysql://root:pass@localhost/xiantu_game \
         postgresql://user:pass@ep-xxx.neon.tech/neondb

# 3. 或手动: 先建表，再用 COPY 导入
psql $DATABASE_URL -f migration-postgres.sql   # 建表
# 然后逐表导入数据
```

---

## 五、GitHub Actions 定时任务

### 5.1 现有定时任务分析

当前 `server/src/routes/sect.ts` 中的 `startSectCronJobs()` 包含 3 个定时任务：

| 任务 | 当前实现 | 频率 | 作用 |
|------|---------|------|------|
| Boss 过期检查 | `setInterval(..., 60000)` | 每 60 秒 | 过期 24h 未击杀的 Boss，返还 50% 资金 |
| 每日捐献重置 | `setTimeout` 递归调度 | 每天 00:00:05 | `sect_members.daily_donated = 0` |
| 每周贡献重置 | `setTimeout` 递归调度 | 每周一 00:00:10 | `sect_members.weekly_contribution = 0` + 生成周常任务 |

### 5.2 GitHub Actions 方案

用 GitHub Actions 的 `schedule` 事件定时触发，通过 HTTP 请求调用 Vercel 上的 cron API 接口。
通过环境变量 `CRON_SECRET` 做鉴权，防止外部随意调用。

```yaml
# .github/workflows/cron.yml
name: Scheduled Tasks

on:
  schedule:
    # Boss 过期检查 — 每 10 分钟（GitHub Actions 最低精度约 5 分钟）
    - cron: '*/10 * * * *'
    # 每日重置 — 每天 UTC 16:00（北京 00:00）
    - cron: '0 16 * * *'
    # 每周重置 — 每周一 UTC 16:00（北京 00:00）
    - cron: '0 16 * * 1'
  workflow_dispatch:  # 支持手动触发，方便调试

env:
  APP_URL: ${{ secrets.APP_URL }}          # 如 https://xiantu.vercel.app
  CRON_SECRET: ${{ secrets.CRON_SECRET }}  # 与 Vercel 环境变量一致

jobs:
  boss-expire:
    if: github.event.schedule == '*/10 * * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Check expired bosses
        run: |
          curl -s -X POST "$APP_URL/api/cron/boss-expire" \
            -H "Authorization: Bearer $CRON_SECRET" \
            -H "Content-Type: application/json"

  daily-reset:
    if: github.event.schedule == '0 16 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Daily donation reset
        run: |
          curl -s -X POST "$APP_URL/api/cron/daily-reset" \
            -H "Authorization: Bearer $CRON_SECRET" \
            -H "Content-Type: application/json"

  weekly-reset:
    if: github.event.schedule == '0 16 * * 1' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Weekly contribution reset
        run: |
          curl -s -X POST "$APP_URL/api/cron/weekly-reset" \
            -H "Authorization: Bearer $CRON_SECRET" \
            -H "Content-Type: application/json"
```

### 5.3 Cron API 接口实现

```typescript
// server/api/cron/boss-expire.post.ts
export default defineEventHandler(async (event) => {
  // 鉴权: 校验 CRON_SECRET
  const authHeader = getHeader(event, 'authorization')
  const config = useRuntimeConfig()
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const { rows: expired } = await pool.query(`
    UPDATE sect_bosses SET status = 'expired'
    WHERE status = 'active' AND expires_at < NOW()
    RETURNING sect_id, boss_key
  `)

  // 返还 50% 发起费用
  for (const boss of expired) {
    const refund = getBossCost(boss.boss_key) * 0.5
    await pool.query('UPDATE sects SET fund = fund + $1 WHERE id = $2', [refund, boss.sect_id])
  }

  return { ok: true, expired: expired.length }
})
```

```typescript
// server/api/cron/daily-reset.post.ts
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  const config = useRuntimeConfig()
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  // 1. 重置每日捐献额度
  await pool.query('UPDATE sect_members SET daily_donated = 0')

  // 2. 清理过期 buff
  await pool.query('DELETE FROM character_buffs WHERE expire_time < NOW()')

  return { ok: true }
})
```

```typescript
// server/api/cron/weekly-reset.post.ts
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  const config = useRuntimeConfig()
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  // 1. 重置周贡献
  await pool.query('UPDATE sect_members SET weekly_contribution = 0')

  // 2. 为每个宗门生成新的周常任务
  const { rows: sects } = await pool.query('SELECT id, level FROM sects')
  for (const sect of sects) {
    await generateWeeklyTask(sect.id, sect.level)
  }

  return { ok: true }
})
```

### 5.4 JWT 鉴权中间件更新

cron 接口使用独立的 `CRON_SECRET` 鉴权，不走 JWT 中间件：

```typescript
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)

  // 跳过: 登录注册、健康检查、cron 接口
  if (url.pathname.startsWith('/api/auth/') ||
      url.pathname === '/api/health' ||
      url.pathname.startsWith('/api/cron/')) return

  if (!url.pathname.startsWith('/api/')) return

  // ... JWT 校验逻辑不变
})
```

### 5.5 GitHub Actions vs Vercel Cron 对比

| 项目 | GitHub Actions | Vercel Cron |
|------|---------------|-------------|
| 频率限制 | 无限制（免费 2000 分钟/月） | Hobby: 每天 1 次 / Pro: 自定义 |
| 最小间隔 | 约 5 分钟（实际可能有延迟） | Pro 可到 1 分钟 |
| 鉴权方式 | 自定义 Bearer Token | Vercel 内置 CRON_SECRET |
| 调试 | `workflow_dispatch` 手动触发 | 只能等调度 |
| 可见性 | GitHub Actions 面板可看日志 | Vercel 函数日志 |
| 付费 | 免费额度很大 | Hobby 太受限 |

**结论**: GitHub Actions 更灵活，免费额度充足，且支持手动触发调试，适合本项目。

### 5.6 Boss 过期精度问题

当前 `setInterval` 每 60 秒检查一次。GitHub Actions 最小间隔约 5 分钟，且实际调度可能有 5-15 分钟延迟。

**影响**: Boss 过期可能延迟最多 ~25 分钟。对游戏体验影响不大（Boss 本身 24 小时有效期）。

**如果需要更高精度**: 可以在每次用户访问 `/api/sect/boss/list` 时顺带检查过期，做"懒过期"：

```typescript
// server/api/sect/boss/list.get.ts
export default defineEventHandler(async (event) => {
  // 先清理过期 Boss（懒执行）
  await pool.query(`
    UPDATE sect_bosses SET status = 'expired'
    WHERE status = 'active' AND expires_at < NOW()
  `)

  // 再查询 Boss 列表
  const { rows } = await pool.query(...)
  return { code: 200, data: rows }
})
```

这样 GitHub Actions 负责定期兜底 + 返还资金，用户请求时负责即时状态更新，两者配合。

---

## 六、核心改造点（非数据库部分）

### 6.1 API 路由迁移规则

```
Express                          →  Nuxt Server Route
─────────────────────────────────────────────────────
req.body                         →  await readBody(event)
req.query                        →  getQuery(event)
req.params                       →  getRouterParams(event)
req.userId                       →  event.context.userId
res.json({...})                  →  return {...}
res.status(N).json({...})        →  throw createError({ statusCode: N, message: '...' })
```

### 6.2 前端 API 调用改造

去掉 axios，用 Nuxt 内置 `$fetch`：

```typescript
// composables/useApi.ts
export function useApi() {
  const userStore = useUserStore()

  return $fetch.create({
    baseURL: '/api',
    headers: () => ({
      Authorization: userStore.token ? `Bearer ${userStore.token}` : ''
    }),
    onResponseError({ response }) {
      if (response.status === 401) {
        userStore.logout()
        navigateTo('/login')
      }
    }
  })
}
```

### 6.3 路由守卫迁移

```typescript
// middleware/auth.ts (Nuxt route middleware)
export default defineNuxtRouteMiddleware((to) => {
  const userStore = useUserStore()
  if (!userStore.isLoggedIn) {
    return navigateTo('/login')
  }
})
```

### 6.4 用户状态存储改造

`localStorage` → `useCookie`：

```typescript
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const tokenCookie = useCookie('token', { maxAge: 7 * 24 * 3600 })
  const token = ref(tokenCookie.value || '')
  const isLoggedIn = computed(() => !!token.value)

  function setLogin(data: { token: string; username: string }) {
    token.value = data.token
    tokenCookie.value = data.token
  }

  function logout() {
    token.value = ''
    tokenCookie.value = null
  }

  return { token, isLoggedIn, setLogin, logout }
})
```

---

## 七、Game.vue 拆分策略

当前 `Game.vue` 有 **294KB**，必须拆分。按标签页拆为独立组件：

| 组件 | 内容 | 估算行数 |
|------|------|---------|
| `components/battle/BattleTab.vue` | 地图选择、战斗控制、离线挂机 | ~800 |
| `components/battle/BattleLog.vue` | 战斗日志滚动区 | ~200 |
| `components/battle/BattleStats.vue` | 战斗统计弹窗 | ~200 |
| `components/character/CharacterTab.vue` | 角色属性面板 + 境界突破 | ~500 |
| `components/character/EquipmentPanel.vue` | 装备穿戴/强化/背包 | ~600 |
| `components/skills/SkillsTab.vue` | 功法装备/升级/背包 | ~500 |
| `components/alchemy/AlchemyTab.vue` | 炼丹/丹药/buff | ~600 |
| `components/alchemy/HerbInventory.vue` | 灵草库存展示 | ~200 |
| `components/cave/CaveTab.vue` | 洞府建筑/升级/产出 | ~400 |
| `components/cave/HerbPlots.vue` | 灵田地块种植/收获 | ~300 |
| `components/sect/SectTab.vue` | 宗门系统 | ~800 |
| `components/common/TopBar.vue` | 顶栏（角色信息/资源/按钮） | ~200 |
| `components/common/Modal.vue` | 通用弹窗容器 | ~100 |
| `components/common/Toast.vue` | Toast 提示 | ~100 |
| `pages/index.vue` | 标签页容器 + 标签切换 | ~200 |

拆分原则：
- 每个标签页一个主组件，内部复杂子区域再拆
- 共享状态通过 Pinia store 传递，不用 props 层层透传
- 弹窗系统统一用 `provide/inject` 或独立 composable 管理

---

## 八、Nuxt 配置

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,                    // SPA 模式，游戏不需要 SSR
  devtools: { enabled: true },

  modules: ['@pinia/nuxt'],

  css: ['~/assets/style.css'],

  runtimeConfig: {
    // 仅服务端可访问（不暴露给前端）
    databaseUrl: process.env.DATABASE_URL,     // Neon PostgreSQL 连接串
    jwtSecret: process.env.JWT_SECRET,
    cronSecret: process.env.CRON_SECRET,
  },

  nitro: {
    preset: 'vercel',
  },
})
```

### 环境变量

```env
# .env（本地开发）
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
JWT_SECRET=xiantu_secret_key_2026
CRON_SECRET=your_random_cron_secret_here

# Vercel 环境变量（部署时配置）
# DATABASE_URL → Vercel Postgres 自动注入，或手动配 Neon 连接串
# JWT_SECRET → Settings > Environment Variables
# CRON_SECRET → Settings > Environment Variables

# GitHub Actions Secrets（仓库 Settings > Secrets）
# APP_URL → https://your-app.vercel.app
# CRON_SECRET → 与 Vercel 环境变量一致
```

---

## 九、迁移步骤

| 阶段 | 内容 | 说明 |
|------|------|------|
| **1. 脚手架** | 初始化 Nuxt 项目，配好 TS / Pinia / CSS | 先跑通空项目 |
| **2. 数据库** | 编写 PostgreSQL 建表脚本，在 Neon 建库 | 从 migration.sql 逐表转换 |
| **3. 静态数据** | 迁移 `game/` 目录（types / data / skillData 等 8 个文件） | 纯复制，零改动 |
| **4. Server 引擎** | 迁移 `server/engine/` 6个文件 + 新建 `database/db.ts` | 引擎逻辑不涉及 SQL，无需改 |
| **5. Auth API** | 迁移 auth 路由 + JWT server middleware | 先跑通登录注册（SQL 改 pg 语法） |
| **6. 核心 API** | 迁移 game / battle / character 路由 | 最高频接口，SQL 全部改 pg |
| **7. 剩余 API** | 迁移 skill / equipment / pill / cave / ranking / achievement | 按模块逐个推进 |
| **8. 宗门 API** | 迁移 sect 路由（最复杂，1685行，~20个 ON DUPLICATE KEY） | 单独一个阶段 |
| **9. 前端页面** | Login → CreateCharacter → Game（拆分组件） | 最大工作量 |
| **10. Store 适配** | user.ts 改 cookie / game.ts 微调 API 调用方式 | 配合前端 |
| **11. Cron 任务** | 创建 3 个 cron API + `.github/workflows/cron.yml` | 替代 setInterval |
| **12. 联调部署** | 本地联调 → Vercel 预览部署 → 数据迁移 → 验收 | 最终上线 |

---

## 十、风险评估

| 风险 | 等级 | 说明 | 缓解措施 |
|------|------|------|---------|
| SQL 迁移遗漏 | **高** | 30+ 处 ON DUPLICATE KEY、全部占位符、ENUM 等需逐一改动 | 建立检查清单，每改一个文件跑一遍测试 |
| Game.vue 拆分 | **高** | 294KB 单文件，内部状态耦合严重 | 先理清数据流，按标签页逐个抽离 |
| TINYINT→BOOLEAN | **中** | 代码中大量 `if (row.completed)` 式判断，MySQL 的 0/1 和 PG 的 true/false 行为不同 | 统一改为 BOOLEAN，代码中确保用布尔判断 |
| GitHub Actions cron 延迟 | **低** | schedule 实际触发可能延迟 5-15 分钟 | Boss 过期用"懒检查"兜底，日/周任务延迟无影响 |
| Neon 冷启动 | **低** | serverless 数据库首次查询略慢 | Neon 冷启动 ~500ms，可接受 |
| 数据迁移 | **低** | MySQL → PostgreSQL 数据导入 | 用 pgloader 自动处理类型映射 |

---

## 十一、待确认决策点

### Q1: SSR vs SPA
- **建议 SPA** (`ssr: false`)，游戏无 SEO 需求，迁移成本最低
可以

### Q2: PostgreSQL ENUM 处理方式
- **方案 A**: 创建 PostgreSQL ENUM 类型（严格，需要 ALTER TYPE 才能加值）
- **方案 B**: VARCHAR + CHECK 约束（灵活，推荐）
方案B

### Q3: 查询改造方式
- **方案 A**: 保持 `pool.query(sql, params)` 模式，`?` 改 `$N`（最小改动，推荐）
- **方案 B**: 全部改 neon tagged template `` sql`...${var}` ``（更简洁但重写量大）
方案A

### Q4: 是否保留旧项目目录
- **方案 A**: 在 game/ 下新建 nuxt/ 子目录，旧项目保留
- **方案 B**: 新开分支，直接在 game/ 下重构，替换 client/ + server/
方案B