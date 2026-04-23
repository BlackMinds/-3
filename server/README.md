# 万界仙途 - 后端服务

放置修仙RPG网页游戏后端,基于 Express 5 + TypeScript + MySQL 构建。

## 技术栈

- **框架**: Express 5
- **语言**: TypeScript (ts-node + nodemon 热重载)
- **数据库**: MySQL 8.0 (mysql2/promise 连接池)
- **鉴权**: JWT (jsonwebtoken) + bcryptjs 密码加密
- **配置**: dotenv 环境变量

## 项目结构

```
src/
├── app.ts                # 应用入口(Express 配置、路由注册)
├── database/
│   ├── db.ts             # MySQL 连接池
│   ├── init.sql          # 初始化脚本
│   └── migration.sql     # 数据库建表/迁移脚本
├── engine/               # 战斗引擎(服务端计算,防作弊)
│   ├── battleEngine.ts   # 完整战斗引擎(波次战斗/debuff/buff/怪物AI/技能系统)
│   └── skillData.ts      # 46个功法数据(6主修+21神通+19被动)
├── middleware/
│   └── auth.ts           # JWT 鉴权中间件
└── routes/
    ├── auth.ts           # 登录/注册
    ├── character.ts      # 角色查询/创建/头像上传
    ├── game.ts           # 游戏数据/角色更新/离线挂机
    ├── battle.ts         # 战斗API(服务端计算+25张地图+掉落生成)
    ├── skill.ts          # 功法背包/装备/升级
    ├── equipment.ts      # 装备背包/穿戴/强化/出售
    ├── pill.ts           # 炼丹/灵草/丹药/buff
    └── cave.ts           # 洞府建筑/灵田地块/升级/产出
```

## API 接口

### 认证 `/api/auth`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | /register | 注册 | 否 |
| POST | /login | 登录 | 否 |

### 角色 `/api/character`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /info | 查询角色 | 是 |
| POST | /create | 创建角色 | 是 |
| POST | /avatar | 上传头像(base64) | 是 |

### 游戏 `/api/game`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /data | 获取完整角色数据 | 是 |
| POST | /save-rewards | 保存战斗奖励 | 是 |
| POST | /update-character | 更新角色状态(境界突破/升级) | 是 |
| POST | /cultivate | 闭关修炼(消耗灵石获得修为) | 是 |
| POST | /offline-start | 开始离线挂机 | 是 |
| GET | /offline-status | 查询离线挂机状态和预估收益 | 是 |
| POST | /offline-claim | 结束离线并领取收益 | 是 |

### 战斗 `/api/battle`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | /fight | 执行一波战斗(服务端完整计算) | 是 |

战斗防作弊机制:
- 所有战斗计算在服务端完成,前端仅展示日志
- 同一角色 1.5 秒冷却,防止并发刷经验
- 离线挂机中禁止在线战斗
- 经验/灵石/掉落全部服务端入库

### 功法 `/api/skill`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /inventory | 功法背包 | 是 |
| GET | /equipped | 已装备功法(含等级) | 是 |
| POST | /save-equipped | 保存装备状态 | 是 |
| POST | /upgrade | 升级功法(Lv5上限,每级+15%) | 是 |
| POST | /add | 添加功法 | 是 |

### 装备 `/api/equipment`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /list | 装备列表 | 是 |
| POST | /add | 添加装备 | 是 |
| POST | /equip | 穿戴(校验等级+槽位) | 是 |
| POST | /unequip | 卸下 | 是 |
| POST | /sell | 出售(含强化加成) | 是 |
| POST | /enhance | 强化(+10上限,+6起有失败退级) | 是 |

### 炼丹 `/api/pill`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /inventory | 丹药背包(分品质系数) | 是 |
| GET | /herbs | 灵草背包(分种类品质) | 是 |
| POST | /add-herb | 添加灵草(战斗掉落) | 是 |
| POST | /craft | 炼丹(灵草+灵石,失败全扣) | 是 |
| POST | /use | 使用丹药(时间制buff,1-8小时) | 是 |
| GET | /buffs | 当前buff(含过期检查) | 是 |
| POST | /consume-buff | 扣减buff | 是 |

### 洞府 `/api/cave`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /info | 洞府建筑 | 是 |
| POST | /upgrade | 建造/升级 | 是 |
| POST | /finish-upgrade | 完成建造 | 是 |
| POST | /collect | 领取产出 | 是 |
| POST | /collect-all | 一键领取 | 是 |
| GET | /plots | 灵田地块 | 是 |
| POST | /plant | 种植 | 是 |
| POST | /harvest | 收获(随机品质) | 是 |
| POST | /harvest-all | 一键收获 | 是 |
| POST | /clear-plot | 清理地块 | 是 |

### 通用
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |

## 战斗引擎 (`src/engine/`)

服务端完整战斗引擎,从前端 battleEngine.ts 移植:
- **波次战斗**: 1-5只怪同时出现,1%概率Boss
- **46个功法**: 6主修 + 21神通(AOE/多段/多目标/治疗/buff) + 19被动
- **10种debuff**: 灼烧/中毒/流血/冻结/眩晕/减速/脆弱/降攻/束缚/封印
- **8种buff**: 攻击/防御/速度/暴击/护盾/回血/反弹/免疫
- **怪物AI**: 按tier分层技能池,Boss低血量狂暴,优先回复/攻击选择
- **属性系统**: 破甲/命中/闪避/吸血/五行抗性/控制抗性/元素强化/神识/灵气浓度
- **功法等级**: Lv1-5,每级+15%效果(倍率/debuff概率/buff数值/被动加成)

## 数据库

### 库名: `xiantu_game`

| 表名 | 用途 |
|------|------|
| users | 账号(用户名/密码/状态) |
| characters | 角色(属性/境界/等级/货币/头像/离线状态) |
| character_equipment | 装备(base_slot/weapon_type/req_level/enhance_level/sub_stats) |
| character_skills | 已装备功法(active/divine/passive,level 为镜像) |
| character_skill_inventory | 功法背包(skill_id + count + level,**等级唯一真相源**) |
| character_pills | 丹药背包(pill_id + quality_factor + count) |
| character_buffs | 激活buff(pill_id + quality_factor + expire_time) |
| character_cave | 洞府建筑(building_id + level + 升级/领取时间) |
| character_cave_plots | 灵田地块(plot_index + herb_id + 种植时间) |
| character_materials | 灵草背包(material_id + quality + count) |

### 初始化
```bash
mysql -u root -p < src/database/migration.sql
```

### 功法等级单一真相源约定

- `character_skill_inventory.level` 是**权威值**（读/判满以它为准）
- `character_skills.level` 只作镜像，由写入点全量同步过来
- 写入规则：
  - 写 inventory：`UPDATE ... WHERE character_id AND skill_id`（单行）
  - 同步 skills 镜像：`UPDATE ... WHERE character_id AND skill_id`（不带 slot，所有同 skill_id 行一起同步，兼容历史脏数据）
  - **禁止**在 skills 上做 `level + 1` 单行自增（会产生镜像分裂）
- 读取规则：
  - 对外返回 level 的接口/查询统一用 `COALESCE(csi.level, cs.level, 1)` 的 JOIN 取值
  - 历史 bug：曾出现 "前端显示 Lv.1 但点升报已满级" 的镜像分裂，根因就是 `character_skills` 单行自增导致同 skill_id 多行 level 不一致
- 涉及文件：`server/api/skill/{upgrade,equipped,save-equipped}.ts`、`server/utils/{battleSnapshot,achievement,randomEvent}.ts`、`server/api/battle/fight.post.ts`

## 环境变量 (.env)
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=xiantu_game
JWT_SECRET=xiantu_secret_key_2026
PORT=3001
```

## 启动
```bash
npm install
npm run dev        # 开发模式 http://localhost:3001
npm run build      # 编译
npm run start      # 生产模式
```

## 测试
```bash
npx ts-node src/test-battle.ts       # 46技能×100场战斗测试
npx ts-node src/test-skill-level.ts  # 功法升级效果验证
npx ts-node src/test-attributes.ts   # 14项属性生效验证
```

## 环境要求
- Node.js >= 18
- MySQL 8.0
