# 万界仙途 — 服务端（Nuxt Nitro）

> 这是 Nuxt 3 全栈项目的**服务端目录索引**。项目整体技术栈、启动方式、部署方式见根目录 [`../README.md`](../README.md)。
> 本文件只列出 `server/` 内部的子目录职责，方便新人定位代码。

## 目录结构

```
server/
├── middleware/
│   ├── auth.ts           # 玩家 JWT 鉴权（拦截除 /api/auth/ /api/cron/ /api/admin/ 之外的 /api/*）
│   └── admin-auth.ts     # GM 后台鉴权（独立 ADMIN_JWT_SECRET，拦 /api/admin/*）
│
├── database/
│   ├── db.ts             # pg.Pool 单例（Neon Postgres，max=20）
│   └── migration.sql     # 全量幂等 DDL（IF NOT EXISTS / ON CONFLICT 兜底）
│
├── engine/               # 战斗引擎与静态游戏数据（服务端权威，防作弊）
│   ├── battleEngine.ts        # 单挑/挂机/历练 主引擎
│   ├── duoBattleEngine.ts     # 真双人战斗（玩家 + 子女出战）
│   ├── multiBattleEngine.ts   # 多目标战斗
│   ├── teamBattleEngine.ts    # 秘境组队战斗
│   ├── towerEngine.ts         # 通天塔
│   ├── skillData.ts           # 功法数据（与 game/skillData.ts 应保持镜像，Phase 5 会合并到 shared/）
│   ├── achievementData.ts     # 成就规则
│   ├── companionData.ts       # 道侣数据
│   ├── secretRealmData.ts     # 秘境关卡
│   ├── towerData.ts           # 通天塔层数据
│   └── ...
│
├── utils/                # 业务工具函数（无副作用的纯函数 + 部分含 SQL 的 helper）
│   ├── equipment.ts / equipment-v5.ts   # V4/V5 装备掉落与计算
│   ├── companion.ts / childAssist.ts    # 道侣 / 子女出战
│   ├── battleSnapshot.ts                # 战前角色快照
│   ├── achievement.ts / mail.ts / ...
│
└── api/                  # Nuxt 文件路由（HTTP 端点）
    ├── auth/             # 登录注册
    ├── character/        # 角色 CRUD
    ├── battle/           # 战斗（fight, dummy）
    ├── tower/            # 通天塔
    ├── equipment/        # 装备穿戴/强化/分解/锻造
    ├── skill/            # 功法
    ├── pill/             # 炼丹
    ├── cave/             # 洞府/灵田
    ├── sect/             # 宗门
    ├── team/             # 秘境组队
    ├── companion/        # 道侣 / 怀胎 / 红尘
    ├── child/            # 子女
    ├── pk/               # 斗法
    ├── market/           # 坊市
    ├── ranking/          # 风云榜
    ├── achievement/      # 成就
    ├── event/            # 随机事件 / 世界广播
    ├── spirit-vein/      # 灵脉
    ├── expedition/       # 历练
    ├── mail/             # 邮件
    ├── redeem/           # 兑换码
    ├── admin/            # GM 后台（独立鉴权）
    └── cron/             # 定时任务（由 .github/workflows/cron.yml 触发）
```

## API 鉴权约定

所有 `/api/*` 接口走两层中间件，按字母序执行：

1. `admin-auth.ts` — 仅放行 `/api/admin/*`；其它路径直接 return 让 `auth.ts` 处理。
2. `auth.ts` — 跳过 `/api/auth/*`、`/api/health`、`/api/cron/*`、`/api/admin/*`，其余强制 JWT。

业务侧从 `event.context.userId` / `event.context.adminId` 取调用方。

## Cron 任务

定时任务清单见 `.github/workflows/cron.yml`，每个 endpoint 通过 `Authorization: Bearer ${CRON_SECRET}` 鉴权。

| 频率 | 触发的 endpoint |
|------|------|
| 每 10 分钟 | `/api/cron/boss-expire` |
| 每天 北京 00:00 | `daily-reset`、`child-visit-home`、`companion-conceive-claim`、`child-grow` |
| 每天 北京 12:00 | `arena-tick` |
| 北京 08:00–23:30 / 30 分钟 | `random-event-tick` |
| 每周一 北京 00:00 | `weekly-reset` |

## 关键资源新增/删除时的同步清单

详见根目录 `.claude/CLAUDE.md` 的「关键资源新增/删除时的同步清单」一节。计划中 Phase 5 会把数据搬到 `shared/data/`，让 CI 接管这块校验。
