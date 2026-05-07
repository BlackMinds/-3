# 万界仙途 - Nuxt 全栈版

放置修仙 RPG 网页游戏，Nuxt 3 全栈架构（SPA + Nitro Server），部署于 Vercel。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Nuxt 3 (Vue 3 + Nitro) |
| 语言 | TypeScript |
| 状态管理 | Pinia (`@pinia/nuxt`) |
| 数据库 | PostgreSQL（本地 / Neon Serverless） |
| 鉴权 | JWT (`jsonwebtoken`) + `bcryptjs` |
| 部署 | Vercel（Nitro preset：`vercel`） |
| 定时任务 | GitHub Actions → `/api/cron/*` |
| 渲染模式 | SPA（`ssr: false`） |

## 项目结构

```
game/
├── app.vue                      # 根组件
├── nuxt.config.ts               # Nuxt 配置（SPA + Vercel preset）
├── package.json
├── tsconfig.json
├── vercel.json                  # Vercel 部署配置
├── .env.example                 # 环境变量模板
│
├── pages/                       # 文件路由
│   ├── login.vue                # 登录/注册（水墨风）
│   ├── create.vue               # 角色创建（灵根 + 道号）
│   ├── index.vue                # 主界面（标签页 + 弹窗系统，主入口）
│   ├── sect-war.vue             # 宗门战独立页
│   └── spirit-vein.vue          # 灵脉独立页
│
├── stores/                      # Pinia 状态
│   ├── user.ts                  # 鉴权（JWT Cookie）
│   ├── game.ts                  # 角色 / 战斗 / 离线 / 地图
│   ├── team.ts                  # 组队秘境
│   ├── tower.ts                 # 通天塔
│   └── event.ts                 # 随机事件 / 世界广播
│
├── composables/
│   └── useApi.ts                # `$fetch` 封装（自动携带 Token）
│
├── middleware/
│   └── auth.ts                  # 客户端路由守卫
│
├── shared/                      # 前后端共享常量
│   ├── arenaRanks.ts            # 道台段位定义
│   └── balance.ts               # 全局数值平衡（v3）
│
├── game/                        # 前端共享游戏静态数据
│   ├── types.ts                 # 类型定义
│   ├── data.ts                  # 地图 / 境界 / 灵根 / 五行
│   ├── battleEngine.ts          # 战斗类型 + 状态机
│   ├── skillData.ts             # 功法数据（主修/神通/被动）
│   ├── equipData.ts             # 装备槽位 / 副属性 / 品质
│   ├── equipSetData.ts          # 套装效果
│   ├── awakenData.ts            # 装备觉醒
│   ├── herbData.ts              # 灵草分级
│   ├── pillData.ts              # 丹药配方
│   ├── caveData.ts              # 洞府建筑
│   ├── sectData.ts              # 宗门静态数据
│   ├── sectItems.ts             # 宗门道具元数据
│   └── items.ts                 # 杂项道具
│
├── components/
│   ├── BattleReplay.vue         # 战斗回放
│   ├── EquipDetail.vue          # 装备详情
│   ├── EventPopup.vue           # 随机事件弹窗
│   ├── MailDrawer.vue           # 邮件抽屉
│   ├── MarketDrawer.vue         # 市场抽屉
│   ├── RedeemCodeModal.vue      # 兑换码
│   ├── RosterSlot.vue           # 阵容槽位
│   ├── SecretRealmModal.vue     # 组队秘境
│   ├── SecretRealmShop.vue      # 秘境商店
│   └── WorldBroadcastPanel.vue  # 世界广播
│
├── assets/
│   └── style.css                # 水墨暗色主题全局样式
│
├── server/                      # Nuxt Server（Nitro）
│   ├── middleware/
│   │   └── auth.ts              # JWT 鉴权中间件
│   ├── database/
│   │   ├── db.ts                # PostgreSQL 连接池（pg）
│   │   └── migration.sql        # 建表脚本（55 张业务表 + 迁移登记表）
│   ├── engine/                  # 游戏引擎（纯逻辑，服务端权威）
│   │   ├── battleEngine.ts      # 单人完整战斗引擎
│   │   ├── multiBattleEngine.ts # 多人战斗（PvP / Boss）
│   │   ├── teamBattleEngine.ts  # 组队秘境战斗
│   │   ├── towerEngine.ts       # 通天塔战斗
│   │   ├── towerData.ts         # 100 层数据
│   │   ├── towerTraits.ts       # 通天塔特质 / hook
│   │   ├── secretRealmData.ts   # 秘境关卡
│   │   ├── secretShopData.ts    # 秘境商店
│   │   ├── randomEventData.ts   # 随机事件
│   │   ├── achievementData.ts   # 成就检测
│   │   ├── realmData.ts         # 境界进阶
│   │   ├── sectData.ts          # 宗门等级 / Boss / 商品 / 任务
│   │   ├── skillData.ts         # 服务端功法数据
│   │   ├── equipNameData.ts     # 装备名称生成
│   │   └── equipSetData.ts      # 服务端套装数据
│   ├── utils/                   # 业务工具函数
│   │   ├── achievement.ts       # 成就初始化
│   │   ├── battleSnapshot.ts    # 战斗快照（防作弊）
│   │   ├── cave.ts              # 洞府辅助
│   │   ├── craftSession.ts      # 炼丹会话
│   │   ├── equipment.ts         # 装备随机 / 道具消耗
│   │   ├── expCap.ts            # 经验上限
│   │   ├── mail.ts              # 邮件工具
│   │   ├── market.ts            # 市场工具
│   │   ├── offlineMapData.ts    # 离线挂机地图常量
│   │   ├── random.ts            # 加权随机
│   │   ├── randomEvent.ts       # 随机事件结算
│   │   ├── realm.ts             # 境界辅助
│   │   ├── secretRealmDrops.ts  # 秘境掉落
│   │   ├── sect.ts              # 宗门辅助
│   │   ├── sectWarEngine.ts     # 宗门战引擎
│   │   ├── sectWarOdds.ts       # 宗门战赔率
│   │   ├── spiritVein.ts        # 灵脉辅助
│   │   ├── spiritVeinEngine.ts  # 灵脉占领 / 突袭
│   │   └── team.ts              # 组队工具
│   └── api/                     # API 路由（详见下文）
│
├── design/                      # 游戏设计文档（按需读取）
├── scripts/                     # 迁移 / 种子 / 调试脚本
├── test/                        # 战斗模拟器（sim-*.ts）
├── tools/                       # 一次性运维脚本
├── public/                      # 静态资源
├── .github/workflows/cron.yml   # GitHub Actions 定时触发
└── _legacy/                     # 旧版 Vue3 + Express + MySQL 代码（仅参考）
```

## API 接口总览

> 总计 130+ 端点。鉴权由 `server/middleware/auth.ts` 自动校验 JWT，未登录端点仅 `auth/*` 与 `health`。

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

### 游戏数据 `/api/game`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /data | 完整角色数据 |
| POST | /save-rewards | 保存战斗奖励 |
| POST | /update-character | 更新角色状态 |
| POST | /breakthrough | 境界突破 |
| POST | /use-permanent-stat | 使用道果结晶 |
| POST | /use-breakthrough-pill | 使用突破丹 |
| POST | /offline-start | 开始离线挂机 |
| GET | /offline-status | 离线收益预估 |
| POST | /offline-claim | 领取离线收益 |

### 战斗 `/api/battle`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /fight | 服务端完整战斗计算 |
| POST | /dummy | 木桩输出测试 |

### 功法 `/api/skill`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /inventory | 功法背包 |
| GET | /equipped | 已装备功法 |
| POST | /save-equipped | 保存装备 |
| POST | /upgrade | 升级功法 |
| POST | /add | 添加功法 |
| POST | /sell | 出售功法 |
| POST | /use-universal-page | 使用万能残页 |

### 装备 `/api/equipment`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /list | 装备列表 |
| POST | /add | 添加装备 |
| POST | /equip | 穿戴 |
| POST | /unequip | 卸下 |
| POST | /sell | 出售 |
| POST | /sell-batch | 批量出售 |
| POST | /toggle-lock | 切换锁定 |
| POST | /enhance | 强化（+10 上限） |
| POST | /reroll-sub-stats | 鉴定符重随副属性 |
| POST | /upgrade-rarity | 升品（太古精魂） |
| POST | /craft-set-fragment | 套装碎片合成 |
| POST | /awaken | 装备觉醒 |
| POST | /loadout/switch | 切换配装方案 |

### 炼丹 `/api/pill`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /inventory | 丹药背包 |
| GET | /herbs | 灵草背包 |
| GET | /unlocked | 已解锁配方 |
| POST | /add-herb | 添加灵草 |
| POST | /craft | 炼丹（同步） |
| POST | /craft-start | 启动异步炼丹会话 |
| POST | /use | 使用丹药 |
| GET | /buffs | 当前 buff |
| POST | /consume-buff | 扣减 buff |

### 洞府 `/api/cave`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /info | 洞府建筑 |
| POST | /upgrade | 建造 / 升级 |
| POST | /finish-upgrade | 完成建造 |
| POST | /collect | 领取产出 |
| POST | /collect-all | 一键领取 |
| GET | /plots | 灵田地块 |
| POST | /plant | 种植 |
| POST | /plant-all | 一键种植 |
| POST | /harvest | 收获 |
| POST | /harvest-all | 一键收获 |
| POST | /clear-plot | 清理地块 |

### 宗门 `/api/sect`（基础）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /create | 创建宗门 |
| GET | /info | 宗门信息 |
| GET | /search | 搜索 |
| GET | /list | 列表 |
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
| POST | /impeach | 弹劾宗主 |
| POST | /update-settings | 修改设置 |
| GET | /tab-meta | 标签页元数据（红点等） |

### 宗门任务 `/api/sect/tasks`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /daily | 每日任务 |
| POST | /daily/claim | 领取日常奖励 |
| GET | /weekly | 周常任务 |
| POST | /weekly/claim | 领取周常奖励 |

### 宗门 Boss `/api/sect/boss`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /list | Boss 列表 |
| POST | /start | 发起 Boss 战 |
| POST | /fight | 挑战 Boss |
| GET | /rank/:bossId | Boss 伤害排名 |
| POST | /claim/:bossId | 领取奖励 |

### 宗门商店 / 功法 `/api/sect`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /shop/list | 商店列表 |
| POST | /shop/buy | 购买 |
| GET | /skills | 宗门功法列表 |
| POST | /skills/learn | 学习 |
| POST | /skills/upgrade | 升级 |

### 宗门战 `/api/sect/war`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /season | 当前赛季 |
| GET | /match | 当期对阵 |
| GET | /match-detail | 对阵详情 |
| GET | /battle-meta | 战斗元数据 |
| GET | /roster | 出战名单 |
| GET | /mvp-rank | MVP 排行 |
| POST | /register | 报名 |
| DELETE | /register | 取消报名 |
| POST | /bet | 下注 |
| GET | /bet-my | 我的下注 |

### 通天塔 `/api/tower`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /info | 塔层进度 |
| POST | /challenge | 挑战指定层 |
| POST | /sweep | 扫荡 |
| GET | /battles | 战斗记录 |
| GET | /floor/:n | 单层详情 |

### 道场 PK `/api/pk`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /challenge | 发起挑战 |
| GET | /history | 战绩 |
| GET | /quota | 剩余次数 |

### 组队秘境 `/api/team`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /create | 创建房间 |
| POST | /join | 加入 |
| POST | /leave | 离开 |
| POST | /kick | 踢人 |
| POST | /ready | 准备 |
| POST | /start | 开打 |
| GET | /my-room | 我所在房间 |
| GET | /rooms | 房间列表 |
| GET | /realms | 秘境列表 |
| GET | /room/:id | 房间详情 |
| GET | /battles | 我的战斗列表 |
| GET | /battles/latest | 最新战斗 |
| GET | /battles/:id | 战斗详情 |
| GET | /shop/list | 秘境商店列表 |
| POST | /shop/buy | 购买 |

### 灵脉 `/api/spirit-vein`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /map | 灵脉图 |
| GET | /node | 节点详情 |
| GET | /cd | 冷却信息 |
| GET | /jackpot | 全球奖池 |
| POST | /raid | 突袭节点 |
| POST | /guard | 上守 |
| POST | /guard-leave | 下守 |

### 市场 `/api/market`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /listings | 在售挂单 |
| GET | /my-listings | 我的挂单 |
| GET | /my-transactions | 我的成交 |
| GET | /reference-price | 参考价 |
| POST | /list | 上架 |
| POST | /buy | 购买 |
| POST | /cancel | 撤单 |

### 邮件 `/api/mail`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /list | 邮件列表 |
| GET | /unread-count | 未读数 |
| POST | /read | 标记已读 |
| POST | /claim | 领取附件 |
| POST | /claim-all | 一键领取 |
| POST | /delete | 删除 |

### 随机事件 / 世界广播 `/api/event`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /pending | 待处理事件 |
| POST | /claim | 领取事件奖励 |
| GET | /broadcast | 拉取世界广播 |
| GET | /poll | 长轮询合并接口 |

### 排行榜 `/api/ranking`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /realm | 境界 |
| GET | /level | 等级 |
| GET | /wealth | 灵石 |
| GET | /sect | 宗门 |
| GET | /arena | 道场段位 |
| GET | /heaven | 通天塔 |
| GET | /heaven-detail | 通天塔层详情 |

### 成就 `/api/achievement`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /list | 成就列表 |
| POST | /claim | 领取奖励 |
| POST | /title | 佩戴称号 |

### 兑换码 `/api/redeem`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /use | 使用兑换码 |

### 定时任务 `/api/cron`（由 GitHub Actions 触发，需 `CRON_SECRET`）
| 方法 | 路径 | 频率 | 说明 |
|------|------|------|------|
| POST | /boss-expire | 每 10 分钟 | Boss 过期 + 退款 |
| POST | /daily-reset | 每天 00:00 | 重置日常 + 清理过期 buff |
| POST | /weekly-reset | 每周一 00:00 | 重置周贡献 |
| POST | /arena-tick | 每小时 | 道场段位结算 |
| POST | /market-expire | 定时 | 市场挂单过期 |
| POST | /sect-war-tick | 高频 | 宗门战推进 |
| POST | /spirit-vein-tick | 高频 | 灵脉占领结算 |
| POST | /random-event-tick | 高频 | 随机事件刷新 |
| POST | /dev-run-sect-war | 手动 | 调试：触发宗门战 |
| POST | /dev-spirit-vein-surge | 手动 | 调试：灵脉爆发 |

### 通用
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |

## 数据库

PostgreSQL，55 张业务表 + 1 张迁移登记表（`_schema_migrations`）。建表脚本：`server/database/migration.sql`。

### 核心域表

| 域 | 表 |
|----|----|
| 账号 / 角色 | `users`, `characters` |
| 功法 | `character_skills`, `character_skill_inventory` |
| 装备 | `character_equipment`, `character_equipment_loadouts` |
| 炼丹 | `character_pills`, `character_unlocked_recipes`, `character_buffs`, `character_materials` |
| 洞府 | `character_cave`, `character_cave_plots` |
| 成就 / 历练 | `character_achievements`, `character_event_log`, `character_map_visits` |
| 邮件 / 广播 | `mails`, `world_broadcast`, `timed_buffs` |
| 宗门 | `sects`, `sect_members`, `sect_applications`, `sect_daily_tasks`, `sect_weekly_tasks`, `sect_weekly_claims`, `sect_bosses`, `sect_boss_damage`, `sect_shop_purchases`, `sect_skills` |
| 宗门战 | `sect_war_season`, `sect_war_registration`, `sect_war_match`, `sect_war_battle`, `sect_war_bet` |
| 组队秘境 | `team_rooms`, `team_members`, `secret_realm_battles`, `secret_realm_contributions`, `secret_realm_rewards`, `secret_realm_clears`, `realm_shop_purchases` |
| 灵脉 | `spirit_vein_node`, `spirit_vein_occupation`, `spirit_vein_guard`, `spirit_vein_cooldown`, `spirit_vein_surge_log`, `spirit_vein_raid`, `spirit_vein_daily_raid_count`, `spirit_vein_jackpot` |
| 通天塔 | `tower_battles`, `tower_clears`, `tower_purple_drops` |
| PvP | `pk_records` |
| 市场 | `market_listings`, `market_transactions`, `market_reference_price`, `market_base_price`, `market_daily_quota`, `market_risk_log` |
| 兑换码 | `redeem_codes`, `redeem_code_claims` |
| 异步制作 | `craft_sessions` |
| 系统 | `_schema_migrations` |

### 功法等级单一真相源约定

- `character_skill_inventory.level` 是**权威值**（读取 / 判满级以它为准）。
- `character_skills.level` 仅作镜像，由写入点全量同步（`UPDATE ... WHERE character_id AND skill_id`）。
- **禁止**在 `character_skills` 上做 `level + 1` 单行自增，会产生镜像分裂（历史 Bug：前端 Lv.1 但报已满级）。
- 涉及文件：`server/api/skill/{upgrade,equipped,save-equipped}.ts`、`server/utils/{battleSnapshot,achievement,randomEvent}.ts`、`server/api/battle/fight.post.ts`。

### 初始化

```bash
psql -U postgres -c "CREATE DATABASE xiantu_game;"
psql -U postgres -d xiantu_game -f server/database/migration.sql
# 后续增量迁移由 npm run migrate 驱动（scripts/migrate.mjs）
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
| `DATABASE_URL` | PostgreSQL 连接串 | 是 |
| `JWT_SECRET` | JWT 签名密钥 | 是 |
| `CRON_SECRET` | 定时任务鉴权密钥 | 部署时 |

## 本地开发

```bash
# 前置：Node.js >= 22, PostgreSQL >= 14

npm install
cp .env.example .env                 # 填入数据库 / JWT / CRON 密钥

psql -U postgres -c "CREATE DATABASE xiantu_game;"
psql -U postgres -d xiantu_game -f server/database/migration.sql

npm run dev                          # http://localhost:3000
```

`npm run build` 会先执行 `node scripts/migrate.mjs --soft-fail` 再 `nuxt build`，CI 环境无库时不会阻塞构建。

## 常用脚本

```bash
npm run dev          # 开发服务器
npm run build        # 构建（含数据库迁移）
npm run preview      # 预览生产产物
npm run migrate      # 仅执行数据库迁移
npm run generate     # 静态生成（不常用）
```

`scripts/` 下还提供测试种子、数值校验、并发压测等脚本（`seed-test-accounts.mjs`、`balanced-battle.mjs`、`concurrency-test.mjs` 等）。`test/sim-*.ts` 为战斗模拟器，用于数值平衡验证。

## Vercel 部署

```bash
npm run build
npx vercel deploy --prebuilt
```

Vercel 环境变量：`DATABASE_URL`、`JWT_SECRET`、`CRON_SECRET`。云数据库推荐 [Neon](https://neon.tech)（免费层 10GB），通过 Neon SQL Editor 执行 `server/database/migration.sql` 后将连接串填入 Vercel。

GitHub Actions 触发 cron 需要 Repo Secrets：`APP_URL`（Vercel 部署地址）+ `CRON_SECRET`（与 Vercel 环境变量一致）。

## 核心模块

| 模块 | 说明 |
|------|------|
| 登录 / 创角 | JWT 鉴权，五行灵根 + 道号 |
| 修炼成长 | Lv.1~200，8 大境界（练气→飞升），段位递增属性 |
| 地图历练 | 25 张地图（T1~T10），波次战斗，1% Boss 概率 |
| 战斗系统 | 服务端权威，10 种 debuff + 8 种 buff，怪物 AI / 狂暴 / 五行 |
| 功法系统 | 主修 + 神通 + 被动，Lv.5 上限，每级 +15% |
| 装备系统 | 7 槽 6 品质 15 副属性，强化 / 升品 / 套装 / 觉醒 / 配装方案 |
| 炼丹系统 | 7 灵草 × 6 品质，配方解锁，时间制 buff |
| 洞府系统 | 7 座建筑 + 灵田种植，离线产出累积 |
| 宗门系统 | 10 级宗门，贡献度，日常 / 周常，Boss、商店、宗门功法 |
| 宗门战 | 赛季制对阵 + 押注 + MVP 排行 |
| 通天塔 | 100 层，特质 hook，扫荡机制 |
| 组队秘境 | 房间制，多人协作 BOSS，伤害贡献分润 |
| 道场 PK | 段位排行，每日次数 |
| 灵脉 | 节点占领 / 守卫 / 突袭 / 全球奖池 |
| 市场 | 玩家挂单交易，参考价 / 风控 / 限额 |
| 邮件 / 广播 | 系统邮件附件领取，世界广播 |
| 随机事件 | 历练触发，多分支选择 |
| 离线挂机 | 最长 10 小时，需 ≥10 分钟才能领取 |
| 排行榜 | 境界 / 等级 / 灵石 / 宗门 / 道场 / 通天塔 |
| 成就 / 称号 | 多维度成就追踪 + 称号佩戴 |
| 兑换码 | 礼包码核销 |

## 战斗数据流

```
前端：点击开始历练 → game.startBattle()
  → POST /api/battle/fight
  → 后端：聚合角色属性 + 装备 + 套装 + 觉醒 + 功法 + buff + 洞府 + 宗门加成
  → 后端：生成 1-5 怪，battleEngine 完整模拟
  → 后端：经验 / 灵石 / 等级 / 掉落 / 成就 / 事件 直接落库
  → 返回：战斗日志 + 最新角色快照
  → 前端：逐条播放（每秒一条）+ 同步血条
  → 前端：日志播完 → 刷新显示 → 进入下一场
```

服务端权威设计：所有数值计算在 `server/engine/*Engine.ts` 完成，前端仅负责渲染。`server/utils/battleSnapshot.ts` 在战斗前生成快照对账，防止越权改属性。

## 文档索引

- 设计文档：`design/`（按模块拆分，`README.json` 为索引）
- 数值平衡：`design/balance-intent-v3.md`、`design/sim-report-v3.md`、`shared/balance.ts`
- 单系统设计：`design/system-*.md` / `system-*.json`
- 架构迁移记录：`design/refactor-nuxt-vercel.md`
- 项目进度：`design/project-progress.md`

## 旧版迁移

本项目从 Vue 3 + Express 5 + MySQL 架构迁移而来，旧代码保留在 `_legacy/` 仅供参考。

| 变更 | 旧版 | 新版 |
|------|------|------|
| 前端框架 | Vue 3 + Vite | Nuxt 3（内置 Vite） |
| 后端框架 | Express 5 | Nuxt Server Routes（Nitro） |
| 数据库 | MySQL 8.0 | PostgreSQL |
| 驱动 | mysql2 | pg |
| 路由 | Vue Router | 文件路由（`pages/`） |
| 状态存储 | localStorage | useCookie |
| API 调用 | Axios | `$fetch` |
| 定时任务 | setInterval | GitHub Actions |
| 部署 | 手动双进程 | Vercel 一键 |
