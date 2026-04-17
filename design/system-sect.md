# 宗门系统设计文档

> 版本: v1.0
> 日期: 2026-04-11
> 状态: 待开发

---

## 一、系统概述

### 1.1 设计目标

宗门是万界仙途的**核心社交系统**，解决三个问题：
1. **中后期灵石通胀** — T5+玩家灵石严重过剩，宗门提供大量灵石消耗点
2. **社交粘性不足** — 单机体验缺乏留存驱动力，宗门提供归属感和互助
3. **内容深度** — 宗门任务、BOSS、商店提供新的成长维度

### 1.2 核心循环

```
玩家战斗/闭关 → 获得灵石/修为
    ↓
捐献灵石/完成宗门任务 → 获得贡献度
    ↓
贡献度 → 兑换宗门商店独占道具 / 解锁宗门功法 / 提升宗门职位
    ↓
宗门等级提升 → 全员被动加成增强 → 战斗更强 → 更高地图
    ↓
更多灵石 → 继续投入宗门（正循环）
```

---

## 二、宗门基础

### 2.1 创建宗门

| 项目 | 说明 |
|------|------|
| 创建条件 | 境界 ≥ 金丹(T3)，等级 ≥ 50 |
| 创建费用 | 100,000 灵石 |
| 宗门名称 | 2-8字，不可重复，不可含特殊字符 |
| 宗门宣言 | 最多 50 字，可修改 |
| 初始人数上限 | 10 人 |
| 每人限加入 | 1 个宗门 |

### 2.2 加入宗门

| 项目 | 说明 |
|------|------|
| 加入条件 | 境界 ≥ 练气九层(T1)，等级 ≥ 10 |
| 申请方式 | 搜索宗门名称 → 申请加入 → 宗主/长老审批 |
| 自由加入 | 宗主可设置为"自由加入"，无需审批 |
| 冷却期 | 退出宗门后 24 小时内不可加入其他宗门 |
| 退出 | 自由退出，贡献度清零，已购买道具保留 |

### 2.3 宗门职位

| 职位 | 人数上限 | 权限 | 贡献度要求 |
|------|---------|------|-----------|
| 宗主 | 1 | 全部权限（踢人/审批/升级/设置/转让/解散） | 创建者 |
| 副宗主 | 1 | 审批/踢人(不可踢宗主)/发起宗门任务 | 50,000 贡献 |
| 长老 | 3 | 审批申请/发布公告 | 20,000 贡献 |
| 内门弟子 | 不限 | 捐献/任务/商店/宗门战斗 | 5,000 贡献 |
| 外门弟子 | 不限 | 捐献/商店(部分) | 默认 |

职位由宗主/副宗主手动任命，需满足贡献度要求。

---

## 三、宗门等级与建设

### 3.1 宗门等级

宗门共 **10 级**，通过消耗**宗门资金**升级。

| 等级 | 升级费用(灵石) | 人数上限 | 全员攻击加成 | 全员防御加成 | 全员修为加成 | 商店解锁 |
|------|--------------|---------|-----------|-----------|-----------|---------|
| 1 | — | 10 | +2% | +2% | +5% | 基础 |
| 2 | 500,000 | 15 | +4% | +4% | +8% | — |
| 3 | 1,500,000 | 20 | +6% | +6% | +12% | 进阶丹药 |
| 4 | 5,000,000 | 25 | +8% | +8% | +16% | — |
| 5 | 15,000,000 | 30 | +10% | +10% | +20% | 稀有功法 |
| 6 | 50,000,000 | 35 | +13% | +13% | +25% | 宗门套装 |
| 7 | 150,000,000 | 40 | +16% | +16% | +30% | — |
| 8 | 500,000,000 | 45 | +20% | +20% | +36% | 传说丹药 |
| 9 | 1,500,000,000 | 48 | +25% | +25% | +42% | — |
| 10 | 5,000,000,000 | 50 | +30% | +30% | +50% | 至尊道具 |

**设计依据**：
- 1-3级：T3-T4玩家联合即可达成（日均10万灵石×10人×几天）
- 5-6级：需要T6+核心成员持续投入（日均2000万×15人×数周）
- 8-10级：需要T8+大佬长期建设（日均数亿×多人×数月）

### 3.2 宗门资金

- **来源**：成员捐献灵石（全额计入宗门资金）
- **用途**：宗门升级、发起宗门Boss战、宗门建筑维护
- **捐献规则**：
  - 每次最低 1,000 灵石
  - 每日捐献上限：100,000 × 宗门等级（防止单人刷）
  - 捐献灵石的 **50%** 转化为个人贡献度

### 3.3 宗门被动加成（接入战斗引擎）

宗门加成作为独立 buff 层，在战斗引擎计算属性时叠加：

```typescript
// server/src/engine/battleEngine.ts 中接入
// 在计算玩家最终属性时：
finalAtk = baseAtk × (1 + sectAtkBonus)     // sectAtkBonus = 0.02 ~ 0.30
finalDef = baseDef × (1 + sectDefBonus)     // sectDefBonus = 0.02 ~ 0.30
expGain  = baseExp × (1 + sectExpBonus)     // sectExpBonus = 0.05 ~ 0.50
```

---

## 四、贡献度系统

### 4.1 获取途径

| 途径 | 贡献度 | 说明 |
|------|--------|------|
| 捐献灵石 | 灵石×50% | 捐 10,000 灵石 → 5,000 贡献 |
| 每日签到 | 100 + 宗门等级×20 | 每日一次 |
| 宗门日常任务 | 500~2,000 | 每日3个，详见任务系统 |
| 宗门Boss伤害 | 按伤害排名 | 详见Boss系统 |
| 宗门周常任务 | 3,000~10,000 | 每周1个，难度更高 |

### 4.2 消耗途径

| 途径 | 消耗 | 说明 |
|------|------|------|
| 宗门商店兑换 | 按道具定价 | 独占道具 |
| 职位晋升门槛 | 达标即可，不扣除 | 仅检查，不消耗 |
| 宗门功法学习 | 5,000~50,000 | 宗门独占功法 |

### 4.3 贡献度排行

- 宗门内按贡献度排名
- 每周日 00:00 结算**周贡献榜**，前3名额外奖励：
  - 第1名：3,000贡献 + 1个随机天品功法残页
  - 第2名：2,000贡献 + 1个随机地品功法残页
  - 第3名：1,000贡献 + 1个随机玄品功法残页

---

## 五、宗门任务

### 5.1 每日任务（每日刷新3个，完成任意即可）

| 任务类型 | 内容 | 奖励贡献 | 额外奖励 |
|---------|------|---------|---------|
| 历练修行 | 完成 N 场战斗 | 500 | 灵石×1000 |
| 灵草供奉 | 提交指定品质灵草 ×N | 800 | 随机灵草×2 |
| 闭关修炼 | 消耗 N 灵石闭关 | 600 | 修为×500 |
| 炼丹贡献 | 成功炼制 N 颗丹药 | 1,000 | 随机丹药×1 |
| 装备回收 | 出售 N 件装备 | 500 | 灵石×2000 |
| 击杀精英 | 击杀 N 只精英怪/Boss | 1,500 | 随机金色装备×1 |
| 洞府建设 | 领取洞府产出 N 次 | 600 | 灵石×1500 |

任务难度随宗门等级缩放：N = base × (1 + sectLevel × 0.1)

### 5.2 周常任务（每周一刷新1个）

| 任务类型 | 内容 | 奖励贡献 | 额外奖励 |
|---------|------|---------|---------|
| 万妖讨伐 | 全宗门累计击杀 50000 只怪 | 5,000 | 全员灵石×10000 |
| 资源征集 | 全宗门累计捐献 50万灵石 | 8,000 | 全员随机功法残页×1 |
| 炼丹大会 | 全宗门累计炼丹 2000 次 | 6,000 | 全员随机丹药×2 |
| 强化竞赛 | 全宗门累计强化 1500 次 | 5,000 | 全员金色装备*1 |

周常任务为**协作任务**，全体成员进度共享，完成后全员领取奖励。

---

## 六、宗门Boss

### 6.1 机制概述

- 宗主/副宗主发起，消耗**宗门资金**
- 全体成员可参战，每人每次Boss战**3条命**
- Boss为回合制战斗，使用现有战斗引擎，但Boss独立血条
- 所有成员的伤害累计到Boss身上，击杀后按伤害排名分配奖励
- Boss血量不回复，成员死亡后可以再次挑战（消耗1条命）

### 6.2 Boss列表

| Boss | 解锁宗门等级 | 发起费用(宗门资金) | Boss战力 | Boss血量 | 回合限制 |
|------|------------|------------------|---------|---------|---------|
| 妖兽·裂天虎 | 1 | 50,000 | 5,000 | 200,000 | 30回合/人 |
| 魔修·血煞尊者 | 3 | 200,000 | 30,000 | 2,000,000 | 30回合/人 |
| 古妖·九幽蛟龙 | 5 | 1,000,000 | 200,000 | 20,000,000 | 40回合/人 |
| 天魔·灭世魔君 | 7 | 5,000,000 | 1,500,000 | 200,000,000 | 40回合/人 |
| 远古·混沌兽 | 9 | 20,000,000 | 10,000,000 | 2,000,000,000 | 50回合/人 |

### 6.3 Boss奖励（击杀后按伤害排名）

| 排名 | 贡献度 | 灵石 | 特殊奖励 |
|------|--------|------|---------|
| 第1名(MVP) | 5,000 | Boss等级×50,000 | 宗门Boss专属装备(必得) |
| 第2-3名 | 3,000 | Boss等级×30,000 | 宗门Boss专属装备(50%概率) |
| 第4-10名 | 1,500 | Boss等级×15,000 | 随机金品装备(30%概率) |
| 参与奖 | 500 | Boss等级×5,000 | 随机紫品装备(20%概率) |

**宗门Boss专属装备特性**：
- 主属性比同品质普通装备**高20%**
- 自带**2-4条随机副属性**（ATK/DEF/HP/SPD/暴击率/暴击伤害/吸血/闪避/破甲/命中）
- 副属性数值按装备Tier和品质缩放

### 6.4 Boss冷却

- 同一Boss击杀后 **48小时** 冷却
- 不同Boss可同时存在
- 未击杀的Boss **24小时** 后消失，返还50%发起费用

---

## 七、宗门商店

### 7.1 商品列表

贡献度兑换，不消耗灵石。

#### 基础商品（宗门1级解锁）

| 商品 | 贡献度价格 | 每周限购 | 效果 |
|------|----------|---------|------|
| 宗门聚灵丹 | 1,000 | 5 | 修为+2,000 |
| 宗门灵石袋 | 2,000 | 3 | 获得 50,000 灵石 |
| 强化保护符 | 3,000 | 2 | 强化失败不退级(一次性) |
| 灵草种子礼包 | 1,500 | 3 | 随机3种灵草(蓝品质+) |

#### 进阶商品（宗门3级解锁）

| 商品 | 贡献度价格 | 每周限购 | 效果 |
|------|----------|---------|------|
| 宗门突破丹 | 5,000 | 2 | 突破成功率+20%(一次性) |
| 高级灵草包 | 4,000 | 2 | 随机3种灵草(紫品质+) |
| 装备鉴定符 | 3,000 | 3 | 重随装备1条副属性 |

#### 稀有商品（宗门5级解锁）

| 商品 | 贡献度价格 | 每周限购 | 效果 |
|------|----------|---------|------|
| 宗门秘法残页 | 10,000 | 1 | 指定地品功法残页×1 |
| 仙品灵草包 | 8,000 | 1 | 随机2种灵草(金品质+) |
| 强化大师符 | 6,000 | 1 | +7以下强化必成(一次性) |

#### 宗门套装碎片（宗门6级解锁）

| 商品 | 贡献度价格 | 每周限购 | 说明 |
|------|----------|---------|------|
| 宗门套装碎片 | 15,000 | 1 | 收集5个可合成宗门专属套装部件 |

#### 传说商品（宗门8级解锁）

| 商品 | 贡献度价格 | 每周限购 | 效果 |
|------|----------|---------|------|
| 天道洗髓丹 | 30,000 | 1 | 重置灵根属性 |
| 万能功法残页 | 20,000 | 1 | 可选择任意功法残页×1 |
| 极品装备宝箱 | 25,000 | 1 | 随机金品/红品装备×1 |

#### 至尊商品（宗门10级解锁）

| 商品 | 贡献度价格 | 每周限购 | 效果 |
|------|----------|---------|------|
| 太古精魂 | 50,000 | 1 | 装备可继续强化最高+12 |
| 道果结晶 | 80,000 | 1 | 永久属性+1%(攻/防/血三选一) |

---

## 八、宗门功法（独占）

宗门等级达标后，成员消耗贡献度学习。不占用普通功法槽位，提供**独立第8个被动槽**。

| 功法名称 | 类型 | 宗门等级 | 学习贡献 | Lv1效果 | Lv5效果(每级+10%) |
|---------|------|---------|---------|--------|-----------------|
| 宗门心法·凝神 | 被动 | 2 | 5,000 | 神识+5% | 神识+9% |
| 宗门心法·固体 | 被动 | 4 | 15,000 | 气血上限+8% | 气血上限+14.4% |
| 宗门心法·破军 | 被动 | 6 | 30,000 | 破甲+10% | 破甲+18% |
| 宗门心法·天罡 | 被动 | 8 | 50,000 | 全属性+5% | 全属性+9% |

- 离开宗门后功法**冻结**（不生效），重新加入宗门且贡献度达标后恢复
- 升级消耗：每级 = 学习贡献 × 等级（如固体Lv2→Lv3 = 15,000×3 = 45,000贡献）

---

## 九、宗门排行与宣战（预留，暂不开发）

> 以下为远期规划，首期不实现，但数据库预留字段。

- **宗门战力排行**：按成员战力总和排名
- **宗门宣战**：两个宗门约战，各出10人轮战
- **宗门领地**：占领地图获得全员掉率加成

---

## 十、数据库设计

### 10.1 新增表

```sql
-- ========================================
-- 宗门主表
-- ========================================
CREATE TABLE sects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(24) NOT NULL UNIQUE COMMENT '宗门名称(2-8字)',
  announcement VARCHAR(150) DEFAULT '' COMMENT '宗门宣言(50字)',
  leader_id INT NOT NULL COMMENT '宗主角色ID',
  level INT DEFAULT 1 COMMENT '宗门等级(1-10)',
  fund BIGINT DEFAULT 0 COMMENT '宗门资金(灵石)',
  join_mode ENUM('approval', 'free') DEFAULT 'approval' COMMENT '加入模式',
  member_count INT DEFAULT 1 COMMENT '当前成员数',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (leader_id) REFERENCES characters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宗门';

-- ========================================
-- 宗门成员表
-- ========================================
CREATE TABLE sect_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sect_id INT NOT NULL COMMENT '宗门ID',
  character_id INT NOT NULL UNIQUE COMMENT '角色ID(一人一宗门)',
  role ENUM('leader', 'vice_leader', 'elder', 'inner', 'outer') DEFAULT 'outer' COMMENT '职位',
  contribution BIGINT DEFAULT 0 COMMENT '累计贡献度',
  weekly_contribution BIGINT DEFAULT 0 COMMENT '本周贡献度(周日清零)',
  daily_donated BIGINT DEFAULT 0 COMMENT '今日已捐献灵石',
  last_sign_date DATE DEFAULT NULL COMMENT '上次签到日期',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sect_id) REFERENCES sects(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id),
  INDEX idx_sect (sect_id),
  INDEX idx_contribution (sect_id, contribution DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宗门成员';

-- ========================================
-- 宗门申请表
-- ========================================
CREATE TABLE sect_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sect_id INT NOT NULL,
  character_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_at DATETIME DEFAULT NULL,
  handled_by INT DEFAULT NULL COMMENT '处理人角色ID',
  FOREIGN KEY (sect_id) REFERENCES sects(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id),
  INDEX idx_sect_pending (sect_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宗门申请';

-- ========================================
-- 宗门每日任务表
-- ========================================
CREATE TABLE sect_daily_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  character_id INT NOT NULL,
  sect_id INT NOT NULL,
  task_type VARCHAR(30) NOT NULL COMMENT '任务类型(battle/herb/cultivate/pill/sell/enhance/elite/cave)',
  target_count INT NOT NULL COMMENT '目标数量',
  current_count INT DEFAULT 0 COMMENT '当前进度',
  reward_contribution INT NOT NULL COMMENT '奖励贡献度',
  completed TINYINT(1) DEFAULT 0,
  claimed TINYINT(1) DEFAULT 0 COMMENT '是否已领取奖励',
  task_date DATE NOT NULL COMMENT '任务日期',
  FOREIGN KEY (character_id) REFERENCES characters(id),
  FOREIGN KEY (sect_id) REFERENCES sects(id) ON DELETE CASCADE,
  UNIQUE KEY uk_char_task (character_id, task_type, task_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宗门每日任务';

-- ========================================
-- 宗门周常任务表（全宗门共享进度）
-- ========================================
CREATE TABLE sect_weekly_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sect_id INT NOT NULL,
  task_type VARCHAR(30) NOT NULL COMMENT '任务类型',
  target_count INT NOT NULL,
  current_count INT DEFAULT 0,
  completed TINYINT(1) DEFAULT 0,
  week_start DATE NOT NULL COMMENT '周一日期',
  FOREIGN KEY (sect_id) REFERENCES sects(id) ON DELETE CASCADE,
  UNIQUE KEY uk_sect_week (sect_id, week_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宗门周常任务';

-- ========================================
-- 宗门周常任务领取记录
-- ========================================
CREATE TABLE sect_weekly_claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  weekly_task_id INT NOT NULL,
  character_id INT NOT NULL,
  claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (weekly_task_id) REFERENCES sect_weekly_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id),
  UNIQUE KEY uk_claim (weekly_task_id, character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周常任务领取记录';

-- ========================================
-- 宗门Boss表
-- ========================================
CREATE TABLE sect_bosses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sect_id INT NOT NULL,
  boss_key VARCHAR(30) NOT NULL COMMENT 'boss标识(tiger/blood/dragon/demon/chaos)',
  total_hp BIGINT NOT NULL COMMENT '总血量',
  current_hp BIGINT NOT NULL COMMENT '当前血量',
  status ENUM('active', 'killed', 'expired') DEFAULT 'active',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL COMMENT '24h后过期',
  finished_at DATETIME DEFAULT NULL,
  FOREIGN KEY (sect_id) REFERENCES sects(id) ON DELETE CASCADE,
  INDEX idx_sect_active (sect_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宗门Boss';

-- ========================================
-- 宗门Boss伤害记录
-- ========================================
CREATE TABLE sect_boss_damage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  boss_id INT NOT NULL,
  character_id INT NOT NULL,
  total_damage BIGINT DEFAULT 0 COMMENT '累计伤害',
  lives_used INT DEFAULT 0 COMMENT '已使用命数(上限3)',
  FOREIGN KEY (boss_id) REFERENCES sect_bosses(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id),
  UNIQUE KEY uk_boss_char (boss_id, character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Boss伤害记录';

-- ========================================
-- 宗门商店购买记录（周限购追踪）
-- ========================================
CREATE TABLE sect_shop_purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  character_id INT NOT NULL,
  item_key VARCHAR(50) NOT NULL COMMENT '商品标识',
  quantity INT DEFAULT 1,
  cost_contribution BIGINT NOT NULL COMMENT '消耗贡献度',
  week_start DATE NOT NULL COMMENT '所属周(周一日期)',
  purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id),
  INDEX idx_char_week (character_id, week_start, item_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商店购买记录';

-- ========================================
-- 宗门功法学习记录
-- ========================================
CREATE TABLE sect_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  character_id INT NOT NULL,
  skill_key VARCHAR(30) NOT NULL COMMENT '宗门功法标识',
  level INT DEFAULT 1 COMMENT '等级(1-5)',
  frozen TINYINT(1) DEFAULT 0 COMMENT '是否冻结(离开宗门后)',
  FOREIGN KEY (character_id) REFERENCES characters(id),
  UNIQUE KEY uk_char_skill (character_id, skill_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宗门功法';

-- ========================================
-- characters 表新增字段
-- ========================================
ALTER TABLE characters
  ADD COLUMN sect_id INT DEFAULT NULL COMMENT '所属宗门ID',
  ADD COLUMN sect_quit_time DATETIME DEFAULT NULL COMMENT '上次退出宗门时间(冷却用)';
```

### 10.2 表关系图

```
sects (宗门) 1──N sect_members (成员)
  │                    │
  │                    └── characters (角色)
  │
  ├── 1──N sect_applications (申请)
  ├── 1──N sect_daily_tasks (日常任务)
  ├── 1──N sect_weekly_tasks (周常任务)
  │            └── 1──N sect_weekly_claims (领取记录)
  ├── 1──N sect_bosses (Boss)
  │            └── 1──N sect_boss_damage (伤害记录)
  └── (sect_shop_purchases 按 character_id 关联)
```

---

## 十一、API 接口设计

### 路由前缀: `/api/sect`

#### 11.1 宗门基础

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | /create | 创建宗门 | 是 |
| GET | /info | 当前角色的宗门信息(含成员列表) | 是 |
| GET | /search?name=xxx | 搜索宗门 | 是 |
| GET | /list | 宗门列表(按等级/人数排序) | 是 |
| POST | /update-settings | 修改宗门设置(名称/宣言/加入模式) | 是(宗主) |
| POST | /upgrade | 宗门升级 | 是(宗主) |
| POST | /dissolve | 解散宗门 | 是(宗主) |
| POST | /transfer | 转让宗主 | 是(宗主) |

#### 11.2 成员管理

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | /apply | 申请加入 | 是 |
| POST | /join | 自由加入(仅free模式) | 是 |
| GET | /applications | 待审批列表 | 是(长老+) |
| POST | /approve | 批准申请 | 是(长老+) |
| POST | /reject | 拒绝申请 | 是(长老+) |
| POST | /kick | 踢出成员 | 是(副宗主+) |
| POST | /leave | 退出宗门 | 是 |
| POST | /appoint | 任命职位 | 是(宗主/副宗主) |

#### 11.3 贡献与签到

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | /donate | 捐献灵石 | 是 |
| POST | /sign-in | 每日签到 | 是 |
| GET | /rank | 贡献度排行 | 是 |

#### 11.4 宗门任务

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /tasks/daily | 今日任务(含进度) | 是 |
| POST | /tasks/daily/claim | 领取任务奖励 | 是 |
| GET | /tasks/weekly | 本周任务(含进度) | 是 |
| POST | /tasks/weekly/claim | 领取周常奖励 | 是 |

#### 11.5 宗门Boss

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /boss/list | 当前Boss列表(含状态) | 是 |
| POST | /boss/start | 发起Boss战 | 是(副宗主+) |
| POST | /boss/fight | 挑战Boss(一次战斗) | 是 |
| GET | /boss/rank/:bossId | Boss伤害排名 | 是 |
| POST | /boss/claim/:bossId | 领取Boss奖励 | 是 |

#### 11.6 宗门商店

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /shop/list | 商品列表(含已购数量) | 是 |
| POST | /shop/buy | 购买商品 | 是 |

#### 11.7 宗门功法

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | /skills | 可学习宗门功法列表 | 是 |
| POST | /skills/learn | 学习宗门功法 | 是 |
| POST | /skills/upgrade | 升级宗门功法 | 是 |

---

## 十二、前端设计

### 12.1 入口

在 Game.vue 顶部标签栏新增第 6 个标签页：**宗门**

### 12.2 页面结构

```
宗门标签页
├── [未加入宗门时]
│   ├── 创建宗门按钮(达标才显示)
│   ├── 搜索宗门(输入框+搜索)
│   └── 推荐宗门列表(按等级排序,显示名称/等级/人数/宣言)
│       └── 点击 → 申请加入 / 自由加入
│
├── [已加入宗门时]
│   ├── 宗门信息头部
│   │   ├── 宗门名称 + 等级(Lv.N)
│   │   ├── 宗门宣言
│   │   ├── 宗门资金: xxx 灵石
│   │   ├── 人数: N/M
│   │   └── 全员加成: 攻+N% 防+N% 修为+N%
│   │
│   ├── 功能区(子标签 / 按钮组)
│   │   ├── 📋 成员 — 成员列表(头像/名称/职位/贡献/在线)
│   │   ├── 💰 捐献 — 输入灵石数量,一键捐献,今日已捐/上限
│   │   ├── ✅ 签到 — 每日签到按钮 + 签到奖励预览
│   │   ├── 📜 任务 — 每日任务×3 + 周常任务×1(进度条)
│   │   ├── 👹 Boss — Boss列表,发起/挑战/排名
│   │   ├── 🏪 商店 — 商品列表,贡献度兑换
│   │   ├── 📖 功法 — 宗门独占功法,学习/升级
│   │   └── ⚙️ 管理 — 仅宗主/副宗主可见(审批/踢人/升级/设置)
│   │
│   └── 底部
│       ├── 退出宗门按钮(二次确认)
│       └── 我的贡献: xxx (本周: xxx)
```

### 12.3 弹窗

| 弹窗 | 触发 | 内容 |
|------|------|------|
| 宗门详情 | 搜索结果点击 | 宗门信息+成员数+等级+申请按钮 |
| Boss战斗 | 点击挑战Boss | 复用现有战斗日志UI,显示对Boss伤害 |
| Boss结算 | Boss击杀后 | 伤害排名+奖励领取 |
| 商品详情 | 点击商品 | 效果说明+已购/限购+确认购买 |
| 成员操作 | 点击成员 | 查看信息/任命/踢出(按权限显示) |
| 宗门升级 | 点击升级 | 当前等级→下一级,费用,新增内容预览 |

### 12.4 前端新增文件

```
client/src/
├── api/
│   └── sect.ts              # 宗门API封装(~30个接口)
├── game/
│   └── sectData.ts          # 宗门静态数据(等级/Boss/商品/功法/任务定义)
└── views/
    └── Game.vue             # 新增宗门标签页(或拆分为 SectTab 组件)
```

### 12.5 后端新增文件

```
server/src/
└── routes/
    └── sect.ts              # 宗门路由(~25个接口)
```

---

## 十三、战斗引擎接入点

### 13.1 属性加成接入

在 `server/src/engine/battleEngine.ts` 计算玩家属性时，查询宗门等级并叠加：

```typescript
// 新增：获取宗门加成
async function getSectBonus(characterId: number): Promise<{atk: number, def: number, exp: number}> {
  // 查询 sect_members → sects.level → 返回对应加成比例
  // 无宗门返回 {atk: 0, def: 0, exp: 0}
}

// 在 calculatePlayerStats 中：
const sectBonus = await getSectBonus(characterId);
player.atk = Math.floor(player.atk * (1 + sectBonus.atk));
player.def = Math.floor(player.def * (1 + sectBonus.def));
// expGain 在战斗结算时乘以 (1 + sectBonus.exp)
```

### 13.2 宗门功法接入

宗门功法作为额外被动，在战斗引擎读取被动列表时追加：

```typescript
// 读取已装备被动时，额外查询 sect_skills (frozen=0)
const sectSkills = await getSectSkills(characterId);
passiveList = [...normalPassives, ...sectSkills];
```

### 13.3 日常任务进度接入

在现有接口中埋入任务进度更新逻辑：

| 现有接口 | 触发任务 | 更新方式 |
|---------|---------|---------|
| POST /api/battle/fight | 历练修行 / 击杀精英 | 战斗结束后+1 |
| POST /api/game/cultivate | 闭关修炼 | 闭关成功后+1 |
| POST /api/pill/craft | 炼丹贡献 | 炼丹后+1(无论成败) |
| POST /api/equipment/sell | 装备回收 | 出售后+1 |
| POST /api/equipment/enhance | 强化武装 | 强化后+1 |
| POST /api/cave/collect | 洞府建设 | 领取后+1 |
| POST /api/pill/add-herb (改为提交) | 灵草供奉 | 提交灵草后+1 |

---

## 十四、定时任务

| 任务 | 频率 | 说明 |
|------|------|------|
| 每日任务刷新 | 每日 00:00 | 为每个宗门成员生成3个随机任务 |
| 每日捐献重置 | 每日 00:00 | sect_members.daily_donated = 0 |
| 周常任务刷新 | 每周一 00:00 | 生成新周常任务 |
| 周贡献度清零 | 每周日 00:00 | weekly_contribution = 0 + 发放排名奖励 |
| 商店限购重置 | 每周一 00:00 | 新周开始,购买记录按 week_start 隔离 |
| Boss过期检查 | 每小时 | 超24h未击杀的Boss标记expired,返还50%资金 |

实现方式：使用 `setInterval` 或 `node-cron` 包在后端定时执行。

---

## 十五、开发任务拆分

### 阶段一：基础框架（预计工作量最大）
1. 数据库建表 + migration.sql 更新
2. `server/src/routes/sect.ts` — 创建/加入/退出/成员管理 API
3. `client/src/api/sect.ts` — API 封装
4. `client/src/game/sectData.ts` — 静态数据定义
5. Game.vue 新增宗门标签页 — 基础 UI(创建/搜索/加入/成员列表)
6. 宗门被动加成接入战斗引擎

### 阶段二：经济循环
7. 捐献 + 签到 + 贡献度系统
8. 宗门升级逻辑
9. 宗门商店（商品列表 + 购买 + 限购）
10. 宗门功法（学习 + 升级 + 战斗引擎接入）

### 阶段三：任务系统
11. 每日任务（生成 + 进度追踪 + 领取）
12. 周常任务（协作进度 + 领取）
13. 现有接口埋入任务进度更新
14. 定时任务（每日/每周刷新）

### 阶段四：Boss战
15. Boss 发起 + 状态管理
16. Boss 战斗（复用战斗引擎,调整为Boss模式）
17. 伤害排名 + 奖励结算
18. Boss 过期 / 冷却逻辑

### 阶段五：UI 完善
19. 所有弹窗（Boss战斗/商品详情/成员操作/宗门升级）
20. 宗门排行榜
21. Toast 提示接入
22. 整体 UI 打磨 + 水墨风适配

---

## 十六、衍生玩法（另见独立文档）

宗门基础系统之上，扩展两个独立的进阶玩法，详见各自设计文档：

| 玩法 | 节奏 | 核心价值 | 设计文档 |
|------|------|---------|---------|
| **宗门战 · 问道大比** | 周度集中 PVP | 宗门对抗 + 个人荣誉 + 押注系统 | [`system-sect-war.md`](./system-sect-war.md) |
| **灵脉潮汐** | 实时异步 PVP | 节点争夺 + 持续产出 + 偷袭反击 | [`system-spirit-vein.md`](./system-spirit-vein.md) |

**开发顺序建议：**
1. 基础宗门系统（本文档）
2. 宗门战 · 问道大比（引入 N vs N 多人战斗引擎）
3. 灵脉潮汐（复用多人引擎 + 扩展异步 PVP 能力）
