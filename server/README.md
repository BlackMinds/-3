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
│   └── migration.sql     # 数据库建表/迁移脚本
├── middleware/
│   └── auth.ts           # JWT 鉴权中间件
└── routes/
    ├── auth.ts           # 登录/注册
    ├── character.ts      # 角色查询/创建/头像上传
    ├── game.ts           # 游戏数据/战斗奖励/角色更新
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
| POST | /save-rewards | 保存战斗奖励(修为/灵石/等级经验/功法) | 是 |
| POST | /update-character | 更新角色状态(境界突破/升级) | 是 |

### 功法 `/api/skill`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /inventory | 功法背包 | 是 |
| GET | /equipped | 已装备功法(含等级) | 是 |
| POST | /save-equipped | 保存装备状态 | 是 |
| POST | /upgrade | 升级功法(Lv5上限) | 是 |
| POST | /add | 添加功法 | 是 |

### 装备 `/api/equipment`
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /list | 装备列表 | 是 |
| POST | /add | 添加装备(含武器类型/等级限制) | 是 |
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
| POST | /craft | 炼丹(灵草数组+品质系数) | 是 |
| POST | /use | 使用丹药(同种覆盖) | 是 |
| GET | /buffs | 当前buff | 是 |
| POST | /consume-buff | 战斗后扣减buff | 是 |

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

## 数据库

### 库名: `xiantu_game`

| 表名 | 用途 |
|------|------|
| users | 账号 |
| characters | 角色(属性/境界/等级/货币/头像) |
| character_equipment | 装备(含base_slot/weapon_type/req_level/enhance_level) |
| character_skills | 已装备功法(含等级) |
| character_skill_inventory | 功法背包 |
| character_pills | 丹药背包(含quality_factor) |
| character_buffs | 激活buff(含quality_factor) |
| character_cave | 洞府建筑 |
| character_cave_plots | 灵田地块 |
| character_materials | 灵草背包(分品质) |

### 初始化
```bash
mysql -u root -p < src/database/migration.sql
```

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

## 环境要求
- Node.js >= 18
- MySQL 8.0
