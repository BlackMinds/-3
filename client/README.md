# 万界仙途 - 前端客户端

放置修仙RPG网页游戏前端,基于 Vue 3 + TypeScript + Vite 构建。

## 技术栈

- **框架**: Vue 3 (Composition API + `<script setup>`)
- **构建工具**: Vite 5
- **语言**: TypeScript
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **HTTP**: Axios

## 项目结构

```
src/
├── api/                    # API 请求层
│   ├── request.ts          # Axios 实例
│   ├── auth.ts             # 登录/注册
│   ├── character.ts        # 角色/头像
│   ├── game.ts             # 游戏数据/保存/更新
│   └── skill.ts            # 功法
├── game/                   # 游戏核心逻辑(纯 TS)
│   ├── types.ts            # 类型定义
│   ├── data.ts             # 静态数据(25张地图、8大境界、灵根、五行)
│   ├── battleEngine.ts     # 战斗引擎(47功法、10种debuff、8种buff)
│   ├── skillData.ts        # 功法数据(6主修+14神通+19被动)
│   ├── equipData.ts        # 装备系统(7槽位、4武器类型、15种副属性、强化)
│   ├── pillData.ts         # 丹药数据(灵草品质系数)
│   ├── herbData.ts         # 灵草分级(7种×6品质)
│   └── caveData.ts         # 洞府建筑(7座)
├── stores/
│   ├── user.ts             # 登录状态
│   └── game.ts             # 游戏状态(战斗/等级/境界/洞府/丹药buff)
├── views/
│   ├── Login.vue           # 登录页
│   ├── CreateCharacter.vue # 角色创建
│   └── Game.vue            # 游戏主界面(5标签页)
├── router/index.ts
├── main.ts
├── style.css               # 水墨暗色主题
└── App.vue
```

## 核心功能

| 模块 | 说明 |
|------|------|
| 登录/注册 | JWT 鉴权,水墨风登录页 |
| 角色创建 | 五行灵根选择 + 道号,头像上传 |
| 等级系统 | Lv.1~200,打怪获得独立经验,按段递增属性 |
| 境界系统 | 练气→飞升,8大境界,管解锁内容 |
| 地图历练 | 25张地图(T1~T10),多怪波次(1-5只/波) |
| 战斗系统 | 回合制自动战斗,10种debuff,8种buff,灵根共鸣,五行抗性 |
| 功法系统 | 39个功法(6主修+14神通+19被动),Lv5上限,按tier掉落 |
| 装备系统 | 7槽位,4种武器类型(剑/刀/枪/扇),15种副属性,强化+10,等级限制 |
| 炼丹系统 | 灵草分级(7种×6品质),品质系数(1.0x~5.0x),丹药buff |
| 洞府系统 | 7座建筑,灵田地块种植,产出累积24h,战斗加成 |
| 数据持久化 | 战斗/境界/等级/装备/功法/炼丹全部实时同步 |

## 5 个标签页

1. **历练** — 选地图,多怪波次战斗,统计,掉落表
2. **角色** — 等级/属性/抗性/元素强化 + 装备穿戴/强化/背包
3. **炼丹** — 灵草库存,选品质炼丹,丹药buff
4. **功法** — 已装备(左) + 背包(右),升级,悬浮详情
5. **洞府** — 建筑升级,灵田种植/收获,帮助文档

## 战斗数据流

```
一波战斗(1-5只怪) → 逐个 runBattle
  → debuff/buff/灵根共鸣/元素抗性/破甲/命中
  → 血量延续到下一只
  → 全部打完 → 合并奖励
  → 等级经验 + 修为 + 灵石 + 掉落
  → checkLevelUp + checkBreakthrough
  → flushSave → 后端
```

## 启动

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 生产构建
```

## 环境要求
- Node.js >= 18
- 后端服务: http://localhost:3001

## 详细进度
见 `/design/project-progress.md`
