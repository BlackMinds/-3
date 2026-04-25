# 万界仙途 - Nuxt 全栈版

放置修仙 RPG 网页游戏，基于 Nuxt 3 全栈架构，部署于 Vercel。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Nuxt 3 (Vue 3 + Nitro) |
| 语言 | TypeScript |
| 状态管理 | Pinia |
| 数据库 | PostgreSQL (本地 / Neon Serverless) |
| 鉴权 | JWT (jsonwebtoken) + bcryptjs |
| 部署 | Vercel (Nitro preset: vercel) |
| 定时任务 | GitHub Actions → Cron API |
| 模式 | SPA (`ssr: false`) |

## 项目结构

```
game/
├── app.vue                        # 根组件
├── nuxt.config.ts                 # Nuxt 配置
├── package.json
├── vercel.json                    # Vercel 部署配置
├── .env.example                   # 环境变量模板
│
├── pages/                         # 文件路由（3 页）
│   ├── login.vue                  # 登录/注册（水墨风）
│   ├── create.vue                 # 角色创建（灵根选择 + 道号）
│   └── index.vue                  # 游戏主界面（6 标签页 + 弹窗系统）
│
├── stores/                        # Pinia 状态管理
│   ├── user.ts                    # 用户鉴权（JWT Cookie）
│   └── game.ts                    # 游戏状态（战斗/角色/地图/离线）
│
├── composables/
│   └── useApi.ts                  # $fetch 封装（自动携带 Token）
│
├── middleware/
│   └── auth.ts                    # 客户端路由守卫
│
├── game/                          # 游戏静态数据（前端共享）
│   ├── types.ts                   # TypeScript 类型定义
│   ├── data.ts                    # 25 张地图、8 大境界、灵根、五行
│   ├── battleEngine.ts            # 战斗类型定义 + 状态设置器
│   ├── skillData.ts               # 46 个功法数据
│   ├── equipData.ts               # 装备系统（7 槽位、15 种副属性）
│   ├── pillData.ts                # 丹药配方（9 丹方）
│   ├── herbData.ts                # 灵草分级（7 种 × 6 品质）
│   ├── caveData.ts                # 洞府建筑（7 座）
│   ├── sectData.ts                # 宗门静态数据
│   └── sectItems.ts               # 宗门道具元数据
│
├── assets/
│   └── style.css                  # 水墨暗色主题全局样式
│
├── server/                        # Nuxt Server (Nitro)
│   ├── middleware/
│   │   └── auth.ts                # JWT 鉴权中间件
│   ├── database/
│   │   ├── db.ts                  # PostgreSQL 连接池 (pg)
│   │   └── migration.sql          # 建表脚本（21 张表）
│   ├── engine/                    # 游戏引擎（纯逻辑）
│   │   ├── battleEngine.ts        # 完整战斗引擎（波次/debuff/buff/AI）
│   │   ├── skillData.ts           # 46 功法服务端数据
│   │   ├── realmData.ts           # 境界进阶数据
│   │   ├── achievementData.ts     # 成就检测逻辑
│   │   ├── sectData.ts            # 宗门等级/Boss/商品/任务数据
│   │   └── equipNameData.ts       # 装备名称生成
│   ├── utils/                     # 共享工具函数
│   │   ├── sect.ts                # 宗门辅助（任务/贡献度/签到）
│   │   ├── achievement.ts         # 成就初始化
│   │   ├── equipment.ts           # 装备辅助（随机/消耗道具）
│   │   ├── cave.ts                # 洞府辅助（建筑/灵田/产出）
│   │   └── offlineMapData.ts      # 离线挂机地图常量
│   └── api/                       # API 路由（93 个端点）
│       ├── auth/                  # 注册/登录 (2)
│       ├── character/             # 角色/头像/洗髓 (4)
│       ├── game/                  # 数据/保存/闭关/离线 (9)
│       ├── battle/                # 战斗 (1)
│       ├── skill/                 # 功法背包/装备/升级 (6)
│       ├── equipment/             # 装备穿戴/强化/升品 (9)
│       ├── pill/                  # 炼丹/灵草/buff (7)
│       ├── cave/                  # 洞府/灵田/种植 (10)
│       ├── sect/                  # 宗门系统 (32)
│       │   ├── boss/              # Boss 战
│       │   ├── shop/              # 商店
│       │   ├── skills/            # 宗门功法
│       │   └── tasks/             # 日常/周常任务
│       ├── ranking/               # 排行榜 (4)
│       ├── achievement/           # 成就 (3)
│       ├── cron/                  # 定时任务入口 (3)
│       └── health.get.ts          # 健康检查
│
├── .github/workflows/
│   └── cron.yml                   # GitHub Actions 定时触发
│
└── design/                        # 游戏设计文档
```

## API 接口总览

### 认证 `/api/auth`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /register | 注册 |
| POST | /login | 登录，返回 JWT |

### 角色 `/api/character`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /info | 查询角色 |
| POST | /create | 创建角色（灵根 + 道号） |
| POST | /avatar | 上传头像（base64） |
| POST | /reset-root | 洗髓丹重置灵根 |

### 游戏 `/api/game`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /data | 获取完整角色数据 |
| POST | /save-rewards | 保存战斗奖励 |
| POST | /update-character | 更新角色状态 |
| POST | /cultivate | 闭关修炼 |
| POST | /offline-start | 开始离线挂机 |
| GET | /offline-status | 查询离线状态 |
| POST | /offline-claim | 领取离线收益 |
| POST | /use-permanent-stat | 使用道果结晶 |
| POST | /use-breakthrough-pill | 使用突破丹 |

### 战斗 `/api/battle`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /fight | 服务端完整战斗计算 |

### 功法 `/api/skill`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /inventory | 功法背包 |
| GET | /equipped | 已装备功法 |
| POST | /save-equipped | 保存装备 |
| POST | /upgrade | 升级功法 |
| POST | /add | 添加功法 |
| POST | /use-universal-page | 万能残页 |

### 装备 `/api/equipment`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /list | 装备列表 |
| POST | /add | 添加装备 |
| POST | /equip | 穿戴 |
| POST | /unequip | 卸下 |
| POST | /sell | 出售 |
| POST | /enhance | 强化（+10 上限） |
| POST | /reroll-sub-stats | 鉴定符重随副属性 |
| POST | /upgrade-rarity | 升品（太古精魂） |
| POST | /craft-set-fragment | 套装碎片合成 |

### 炼丹 `/api/pill`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /inventory | 丹药背包 |
| GET | /herbs | 灵草背包 |
| POST | /add-herb | 添加灵草 |
| POST | /craft | 炼丹 |
| POST | /use | 使用丹药 |
| GET | /buffs | 当前 buff |
| POST | /consume-buff | 扣减 buff |

### 洞府 `/api/cave`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /info | 建筑信息 |
| POST | /upgrade | 升级建筑 |
| POST | /finish-upgrade | 完成建造 |
| POST | /collect | 领取产出 |
| POST | /collect-all | 一键领取 |
| GET | /plots | 灵田地块 |
| POST | /plant | 种植 |
| POST | /harvest | 收获 |
| POST | /harvest-all | 一键收获 |
| POST | /clear-plot | 清理地块 |

### 宗门 `/api/sect`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /create | 创建宗门 |
| GET | /info | 宗门信息 |
| GET | /search | 搜索宗门 |
| GET | /list | 宗门列表 |
| POST | /apply | 申请加入 |
| GET | /applications | 待审批列表 |
| POST | /approve | 批准 |
| POST | /reject | 拒绝 |
| POST | /kick | 踢出 |
| POST | /leave | 退出 |
| POST | /appoint | 任命职位 |
| POST | /donate | 捐献灵石 |
| POST | /sign-in | 每日签到 |
| GET | /rank | 贡献排行 |
| POST | /upgrade | 宗门升级 |
| POST | /dissolve | 解散 |
| POST | /transfer | 转让宗主 |
| POST | /update-settings | 修改设置 |
| GET | /tasks/daily | 每日任务 |
| POST | /tasks/daily/claim | 领取日常奖励 |
| GET | /tasks/weekly | 周常任务 |
| POST | /tasks/weekly/claim | 领取周常奖励 |
| GET | /boss/list | Boss 列表 |
| POST | /boss/start | 发起 Boss 战 |
| POST | /boss/fight | 挑战 Boss |
| GET | /boss/rank/:id | Boss 伤害排名 |
| POST | /boss/claim/:id | 领取 Boss 奖励 |
| GET | /shop/list | 商店列表 |
| POST | /shop/buy | 购买商品 |
| GET | /skills | 宗门功法列表 |
| POST | /skills/learn | 学习宗门功法 |
| POST | /skills/upgrade | 升级宗门功法 |

### 排行榜 `/api/ranking`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /realm | 境界排行 |
| GET | /level | 等级排行 |
| GET | /wealth | 灵石排行 |
| GET | /sect | 宗门排行 |

### 成就 `/api/achievement`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /list | 成就列表 |
| POST | /claim | 领取奖励 |
| POST | /title | 佩戴称号 |

### 定时任务 `/api/cron`（GitHub Actions 触发）
| 方法 | 路径 | 频率 | 说明 |
|------|------|------|------|
| POST | /boss-expire | 每 10 分钟 | Boss 过期 + 退款 |
| POST | /daily-reset | 每天 00:00 | 重置捐献 + 清理过期 buff |
| POST | /weekly-reset | 每周一 00:00 | 重置周贡献 |

## 数据库

### PostgreSQL（21 张表）

| 表 | 用途 |
|----|------|
| users | 账号 |
| characters | 角色（属性/境界/等级/货币/宗门/永久加成） |
| character_skills | 已装备功法 |
| character_skill_inventory | 功法背包 |
| character_equipment | 装备（槽位/品质/副属性/强化等级） |
| character_pills | 丹药背包 |
| character_buffs | 激活 buff |
| character_cave | 洞府建筑 |
| character_cave_plots | 灵田地块 |
| character_materials | 灵草背包（分品质） |
| character_achievements | 成就进度 |
| sects | 宗门 |
| sect_members | 宗门成员 |
| sect_applications | 宗门申请 |
| sect_daily_tasks | 每日任务 |
| sect_weekly_tasks | 周常任务 |
| sect_weekly_claims | 周常领取记录 |
| sect_bosses | 宗门 Boss |
| sect_boss_damage | Boss 伤害记录 |
| sect_shop_purchases | 商店购买记录 |
| sect_skills | 宗门功法 |

### 初始化

```bash
# 创建数据库
psql -U postgres -c "CREATE DATABASE xiantu_game;"

# 执行建表
psql -U postgres -d xiantu_game -f server/database/migration.sql
```

## 环境变量

```env
# .env
DATABASE_URL=postgresql://postgres:123456@localhost:5432/xiantu_game
JWT_SECRET=xiantu_secret_key_2026
CRON_SECRET=your_random_cron_secret_here
```

| 变量 | 说明 | 必需 |
|------|------|------|
| DATABASE_URL | PostgreSQL 连接串 | 是 |
| JWT_SECRET | JWT 签名密钥 | 是 |
| CRON_SECRET | 定时任务鉴权密钥 | 部署时 |

## 本地开发

```bash
# 前置要求
# - Node.js >= 22
# - PostgreSQL >= 14

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库信息

# 3. 初始化数据库
psql -U postgres -c "CREATE DATABASE xiantu_game;"
psql -U postgres -d xiantu_game -f server/database/migration.sql

# 4. 启动开发服务器
npm run dev
# → http://localhost:3000
```

## Vercel 部署

### 一键部署

```bash
# 构建
npm run build

# 部署（需先安装 Vercel CLI: npm i -g vercel）
npx vercel deploy --prebuilt
```

### 环境变量配置

在 Vercel Dashboard → Settings → Environment Variables 中添加：

| 变量 | 值 |
|------|-----|
| DATABASE_URL | Neon/Vercel Postgres 连接串 |
| JWT_SECRET | 自定义密钥 |
| CRON_SECRET | 自定义密钥 |

### 云数据库（推荐 Neon）

1. 注册 [Neon](https://neon.tech)（免费层 10GB）
2. 创建项目，获取连接串
3. 通过 Neon SQL Editor 执行 `server/database/migration.sql`
4. 将连接串配置到 Vercel 环境变量

### GitHub Actions 定时任务

在仓库 Settings → Secrets and variables → Actions 中添加：

| Secret | 说明 |
|--------|------|
| APP_URL | Vercel 部署 URL（如 `https://xiantu.vercel.app`） |
| CRON_SECRET | 与 Vercel 环境变量一致 |

## 核心功能

| 模块 | 说明 |
|------|------|
| 登录/注册 | JWT 鉴权，水墨风登录页 |
| 角色创建 | 五行灵根选择 + 道号 |
| 等级系统 | Lv.1~200，打怪升级，按段递增属性 |
| 境界系统 | 练气→筑基→金丹→元婴→化神→渡劫→大乘→飞升 |
| 地图历练 | 25 张地图（T1~T10），每波 1-5 只怪 |
| 战斗系统 | 服务端计算，10 种 debuff + 8 种 buff，防作弊 |
| 功法系统 | 46 个功法（6 主修 + 21 神通 + 19 被动），Lv5 上限 |
| 装备系统 | 7 槽位，6 品质，15 种副属性，强化 +10 |
| 炼丹系统 | 7 种灵草 × 6 品质，品质系数影响丹药效果 |
| 洞府系统 | 7 座建筑，灵田种植，产出累积 |
| 宗门系统 | 10 级宗门，贡献度，日常/周常任务，Boss 战，商店，宗门功法 |
| 离线挂机 | 最长 10 小时，100% 效率，需挂机 ≥ 10 分钟才能领取 |
| 排行榜 | 境界/等级/灵石/宗门排行 |
| 成就系统 | 多维度成就追踪 + 称号 |

## 战斗数据流

```
前端: 点击开始历练 → store.startBattle()
  → POST /api/battle/fight
  → 后端: 读取角色属性 + 装备 + 功法 + buff + 洞府 + 宗门加成
  → 后端: 生成 1-5 只怪物，完整战斗引擎计算
  → 后端: 经验/灵石/等级/掉落直接入库
  → 返回: 战斗日志 + 最新角色数据
  → 前端: 逐条播放日志（每秒一条）+ 同步血条
  → 前端: 日志播完 → 更新显示 → 下一场
```

## 从旧版迁移

本项目从 Vue 3 + Express 5 + MySQL 架构迁移而来：

| 变更 | 旧版 | 新版 |
|------|------|------|
| 前端框架 | Vue 3 + Vite | Nuxt 3 (内置 Vite) |
| 后端框架 | Express 5 | Nuxt Server Routes (Nitro) |
| 数据库 | MySQL 8.0 | PostgreSQL |
| ORM/驱动 | mysql2 | pg |
| 路由 | Vue Router | 文件路由 (pages/) |
| 状态存储 | localStorage | useCookie |
| API 调用 | Axios | $fetch |
| 定时任务 | setInterval | GitHub Actions |
| 部署 | 手动双进程 | Vercel 一键部署 |

旧版代码保留在 `_legacy/` 目录供参考。
