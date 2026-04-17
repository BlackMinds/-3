# 宗门战 · 问道大比 融合玩法设计

> 版本: v1.0
> 日期: 2026-04-18
> 状态: 待开发
> 父文档: [`system-sect.md`](./system-sect.md)

---

## 一、设计概述

### 1.1 定位

宗门战是宗门系统的**周度核心 PVP 玩法**，把"宗门对抗 (团战)"和"个人荣誉 (问道大比)"融合成一场完整赛事。

- **宗门战** → 两个宗门整体对抗，决出胜负，产出宗门贡献、资金、灵脉 buff
- **问道大比** → 赛事前半段的 3 场个人单挑，决出本届"论道之星"，授予个人称号
- **押注系统** → 所有玩家（含不参战者 / 非参赛宗门）可在赛前押注**宗门胜方**，赢家按赔率分奖

### 1.2 核心循环

```
周一 00:00 开启报名 → 宗主选择参战阵容 (9 人)
    ↓
周三 00:00 赛程对阵表公布 → 开启押注（持续 48h）
    ↓
周五 20:00 正式开打 (单挑 3 场 → 团战 2 场，BO5)
    ↓
决出胜方 → 发放宗门奖励 / 论道之星称号 / 押注返利
    ↓
周日 24:00 本周结算完成 → 下周重新报名
```

### 1.3 设计目标

1. **让宗门贡献度有真实的"战力变现"出口** — 不只是日常捐献/任务
2. **把非战斗玩家也拉进来** — 押注系统让"看客"也能参与
3. **个人荣誉 + 集体胜负并行** — 既有单挑秀操作，也有团战要配合

---

## 二、赛事结构

### 2.1 参战阵容 (9 人)

每个报名宗门由宗主/副宗主从成员中挑选 **9 名弟子** 出战：

| 分组 | 人数 | 用途 | 备注 |
|------|------|------|------|
| **问道组** (个人单挑) | 3 人 | 参加 3 场 1v1 单挑 | 每场 1 人，不重复上阵 |
| **团战组** (3v3) | 6 人 | 分两队各 3 人，参加 2 场 3v3 | 每人固定 1 场 |
| **合计** | **9 人** | — | 同一人不可跨组 |

**报名条件：**
- 该弟子必须为宗门内门弟子及以上职位
- 该弟子**境界 ≥ 筑基(T2)**
- 同一弟子一周只能参加一次宗门战（即使被换到其他队伍）

**阵容提交截止：** 周三 00:00（即对阵表公布前）
- 截止后阵容锁定，赛中不可换人（弟子掉线/下线仍按当前战力结算）

### 2.2 赛制 (BO5 · 3 胜制)

| 场次 | 类型 | 积分 | 计分规则 |
|------|------|------|---------|
| 第 1 场 | 个人单挑 · 先锋战 | 1 分 | 胜方宗门 +1 |
| 第 2 场 | 个人单挑 · 中军战 | 1 分 | 胜方宗门 +1 |
| 第 3 场 | 个人单挑 · 主将战 | 1 分 | 胜方宗门 +1 |
| 第 4 场 | 3v3 团战 · 上阵 | 1 分 | 胜方宗门 +1 |
| 第 5 场 | 3v3 团战 · 终局 | 2 分 | 胜方宗门 +2（翻盘机会） |

**胜负判定：** 总积分高者胜。最高可达 6 分，先达 **4 分** 可提前锁定胜利（不再播后续场次，但参战数据保留）。

> 设计意图：单挑 3 场 + 团战 1 场 = 4 场可决出胜负；若单挑 3 场平 + 团战 1 胜 1 负，则终局场 2 分一锤定音。避免平局。

### 2.3 对阵匹配

**匹配池：** 周三 00:00 自动从所有已提交阵容的宗门中匹配。

| 匹配条件 | 说明 |
|---------|------|
| 宗门战力 ±20% | 计算参战 9 人战力总和，按战力分档匹配 |
| 避免重复对阵 | 近 3 周交战过的宗门降权 |
| 单数处理 | 若报名宗门为奇数，战力最低的一个宗门本周**轮空**，获得基础奖励 |

**对阵表公布后：** 押注窗口开启，持续 48h。

---

## 三、战斗规则

### 3.1 战斗引擎复用

所有场次复用现有 `server/engine/battleEngine.ts`：
- **单挑** = 1v1 模式 (已有)
- **3v3** = 新增多人战斗模式（详见 §3.3）

### 3.2 加成与规则

| 项目 | 说明 |
|------|------|
| 宗门等级被动 | 全员享受己方宗门等级加成（攻/防/修为） |
| 宗门技能 | 可使用，CD 按战斗内结算，**跨场次重置** |
| 丹药 | **禁用** 战斗中丹药（避免氪金不平衡） |
| 装备 / 附灵 | 全部生效 |
| 境界压制 | 禁用（保留压制会让高境界碾压，宗门战重策略） |
| 战败惩罚 | 无（不掉血不扣经验，纯荣誉赛制） |

### 3.3 3v3 团战规则

- 双方各 3 人依次出场，类似"车轮战"但**可救援**
- 每人拥有独立血量 / 灵力 / CD
- **集火机制：** 每回合己方可指定集火目标（AI 辅助选择）
- **援护机制：** 队友血量 <30% 时，可消耗一回合行动力施加"护盾"
- **胜负判定：** 一方 3 人全部倒下则败
- **实现方式：** 战报式（类单人战斗），非实时

> 详细战斗字段与协议在开发阶段细化，本文档不展开。

---

## 四、押注系统

### 4.1 参与资格

| 规则 | 说明 |
|------|------|
| 开放对象 | 所有玩家（不限是否参战宗门） |
| 参战宗门弟子 | 可押注**自己宗门**（赔率降低，详见 4.3） |
| 押注上限 | 每场比赛（=每个对阵）每人最多押注 **50,000 灵石** |
| 押注窗口 | 周三 00:00 ~ 周五 20:00（开赛前） |

### 4.2 押注对象

**押注"宗门整体胜方"** — 即本场 5 局赛事的最终赢家，非单场比赛。

> 设计意图：保持简单，避免"盘口过细"导致用户迷惑。若后期热度够，可扩展"首胜方 / MVP 押注"等玩法。

### 4.3 赔率与返利

**基础赔率：** 根据两宗门参战阵容总战力差距动态计算。

| 战力差 | 强势宗门赔率 | 弱势宗门赔率 |
|-------|-----------|-----------|
| ±5%   | 1.9x      | 1.9x      |
| 5%-15% | 1.5x     | 2.5x      |
| 15%-20% | 1.3x    | 3.5x      |

- **押注自家宗门：** 赔率 × 0.8（避免"必赢套利"）
- **手续费：** 奖池抽成 5%，返还宗门资金池（给对阵两方平分）

### 4.4 结算

- 赛事结束后 10 分钟内自动结算
- 押中者：原注 + 原注 × 赔率（自动返还到灵石背包）
- 押错者：原注清零
- **逃赛 / 阵容不足宗门：** 视为弃权败，押注其一方全部退还（不扣手续费）

---

## 五、奖励体系

> ⚠️ **与现有项目兼容性说明**
> - 项目 `sects` 表**没有声望字段**，本设计**不新增**，改为统一提升 fund 数额
> - 限时属性加成通过**新增 `timed_buffs` 通用表**驱动（见 §6.1），战斗引擎合并 `character_buffs` (丹药) + `timed_buffs` (玩法 buff)
> - 称号通过扩展 `server/engine/achievementData.ts` 的 `ACHIEVEMENTS` / `TITLES`，复用 `characters.title` 字段 + `/api/achievement/title` 接口

### 5.1 宗门奖励

| 名次 | 宗门资金 (fund) | 成员全员限时 Buff | 备注 |
|------|--------------|--------------|------|
| 胜方 | +250,000 | atk_pct +5%, def_pct +5% (持续 7 天) | Buff 可续期叠加（取较长 expires_at） |
| 败方 | +80,000 | — | 保底避免垫底宗门摆烂 |
| 轮空 | +100,000 | — | 未参与对阵的宗门 |

**全员 Buff 发放：** 赛事结算时遍历胜方宗门当前 `sect_members`，为每个 `character_id` 写入 2 条 `timed_buffs` 记录（atk_pct / def_pct）。

### 5.2 个人奖励 (参战 9 人)

| 身份 | 贡献度 | 灵石 | 备注 |
|------|-------|------|------|
| 胜方参战 | +2,000 | +50,000 | 含团战组也拿 |
| 败方参战 | +500 | +10,000 | — |
| 胜方单挑 3 战全胜 | 额外 +3,000 贡献 | — | 个人成就加成 |

### 5.3 论道之星 (单挑 MVP)

**产生方式：** 每届赛事，所有参赛宗门的**单挑组（问道组）** 中，按"胜场数 → 总伤害 → 总承伤"三级排序，取第 1 名授予"**论道之星**"称号。

| 奖励 | 说明 | 实现方式 |
|------|------|---------|
| 称号（限时） | "论道之星"（持续 7 天） | 写入 `timed_buffs` + 临时设置 `characters.title`（到期由定时任务清除） |
| 属性加成 | atk_pct +3%, def_pct +3%, hp_pct +3%（持续 7 天） | 写入 3 条 `timed_buffs` 记录 |
| 永久称号 | 累计获得 3 次 → "问道魁首" | 新增成就 `sect_war_mvp_3`，达成后走 `/api/achievement/title` 挂载 |

**对 `achievementData.ts` 的扩展：** 新增两条 `AchievementDef`：

```typescript
{ id: 'sect_war_mvp_1', name: '论道之星', desc: '宗门战单挑 MVP', category: 'sect',
  type: 'counter', target: 1, event: 'sect_war_mvp', reward: { spirit_stone: 20000 },
  title: '论道之星' },
{ id: 'sect_war_mvp_3', name: '问道魁首', desc: '累计 3 次宗门战单挑 MVP', category: 'sect',
  type: 'counter', target: 3, event: 'sect_war_mvp', reward: { spirit_stone: 100000 },
  title: '问道魁首' },
```

并在 `TITLES` 字典中补充 `'论道之星'` / `'问道魁首'` 两项定义。

### 5.4 押注奖励

详见 §4.4 结算部分。

---

## 六、数据结构

> 📌 **全部使用 PostgreSQL 语法**，与现有 `server/database/migration.sql` 一致（`SERIAL` / `TIMESTAMP` / `VARCHAR` / `DECIMAL`）。外键统一 `REFERENCES` + 级联策略。

### 6.1 数据表

#### 6.1.1 通用限时 Buff 表（本期新增，灵脉潮汐也会复用）

```sql
-- ========================================
-- 限时 Buff（来自玩法奖励，非丹药）
-- ========================================
CREATE TABLE IF NOT EXISTS timed_buffs (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  source_type VARCHAR(30) NOT NULL,         -- 'sect_war_win' / 'sect_war_mvp' / 'vein_node' ...
  source_id VARCHAR(50),                    -- 来源引用ID（match_id / node_id 等，字符串化）
  stat_key VARCHAR(20) NOT NULL,            -- 'atk_pct' / 'def_pct' / 'hp_pct' / 'spd_pct' / 'crit_rate' ...
  stat_value DECIMAL(6,2) NOT NULL,         -- 加成数值（百分比按整数存，如 5 = 5%）
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timed_buff_char ON timed_buffs (character_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_timed_buff_source ON timed_buffs (source_type, source_id);
```

**战斗引擎对接方式：** `battleEngine.ts` 的角色构建阶段，除读取 `character_buffs`（丹药 buff）外，新增一段读取 `SELECT stat_key, stat_value FROM timed_buffs WHERE character_id = $1 AND expires_at > NOW()`，按 `stat_key` 归类合并到最终属性上。同 key 的多条记录**累加**（符合"Buff 续期叠加取较长 expires_at"的设计 — 实际上续期时应 UPDATE 现有行，不是 INSERT 新行）。

**定时清理：** `cron/daily-reset` 追加一条 `DELETE FROM timed_buffs WHERE expires_at < NOW()`。

#### 6.1.2 宗门战专用表

```sql
-- 宗门战赛季
CREATE TABLE IF NOT EXISTS sect_war_season (
  id SERIAL PRIMARY KEY,
  season_no INT NOT NULL UNIQUE,                             -- 第 N 届
  start_date TIMESTAMP NOT NULL,                             -- 周一 00:00
  end_date TIMESTAMP NOT NULL,                               -- 周日 24:00
  status VARCHAR(15) NOT NULL
    CHECK (status IN ('registering','betting','fighting','settled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 宗门报名
CREATE TABLE IF NOT EXISTS sect_war_registration (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES sect_war_season(id) ON DELETE CASCADE,
  sect_id INT NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
  roster_duel JSONB NOT NULL,                                -- [characterId, characterId, characterId]
  roster_team_a JSONB NOT NULL,                              -- [characterId, ...]
  roster_team_b JSONB NOT NULL,                              -- [characterId, ...]
  total_power BIGINT NOT NULL,                               -- 9 人战力总和（锁定后不变）
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (season_id, sect_id)
);

-- 对阵
CREATE TABLE IF NOT EXISTS sect_war_match (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES sect_war_season(id) ON DELETE CASCADE,
  sect_a_id INT NOT NULL REFERENCES sects(id),
  sect_b_id INT NOT NULL REFERENCES sects(id),
  odds_a DECIMAL(5,2) NOT NULL,                              -- 押注 A 方赔率
  odds_b DECIMAL(5,2) NOT NULL,
  winner_sect_id INT DEFAULT NULL,                           -- null 未结算
  score_a INT DEFAULT 0,
  score_b INT DEFAULT 0,
  mvp_character_id INT DEFAULT NULL,                         -- 论道之星 character.id
  fought_at TIMESTAMP DEFAULT NULL,
  settled_at TIMESTAMP DEFAULT NULL
);

-- 单场战报 (5 场)
CREATE TABLE IF NOT EXISTS sect_war_battle (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL REFERENCES sect_war_match(id) ON DELETE CASCADE,
  round_no SMALLINT NOT NULL,                                -- 1~5
  battle_type VARCHAR(10) NOT NULL CHECK (battle_type IN ('duel','team')),
  side_a_chars JSONB NOT NULL,                               -- [characterId, ...]
  side_b_chars JSONB NOT NULL,
  winner_side VARCHAR(1) NOT NULL CHECK (winner_side IN ('a','b')),
  battle_log JSONB NOT NULL,                                 -- 战报完整 JSON（复用现有格式）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 押注记录
CREATE TABLE IF NOT EXISTS sect_war_bet (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL REFERENCES sect_war_match(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  bet_side VARCHAR(1) NOT NULL CHECK (bet_side IN ('a','b')),
  bet_amount BIGINT NOT NULL,                                -- 押注灵石数
  odds_at_bet DECIMAL(5,2) NOT NULL,                         -- 下注时赔率（锁定）
  payout BIGINT DEFAULT 0,                                   -- 实际返还（含本金）
  status VARCHAR(12) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','won','lost','refunded')),
  placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP DEFAULT NULL
);
```

> 📌 **论道之星累计次数不新建表** — 直接复用 `character_achievements` 记录 `sect_war_mvp_1` / `sect_war_mvp_3` 成就 progress 字段。查询个人 MVP 次数 = 对应成就的 progress。

### 6.2 关键索引

```sql
CREATE INDEX IF NOT EXISTS idx_bet_match_char ON sect_war_bet (match_id, character_id);
CREATE INDEX IF NOT EXISTS idx_match_season ON sect_war_match (season_id, winner_sect_id);
CREATE INDEX IF NOT EXISTS idx_registration_season ON sect_war_registration (season_id);
CREATE INDEX IF NOT EXISTS idx_battle_match_round ON sect_war_battle (match_id, round_no);
```

---

## 七、API 设计

| 路由 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/sect/war/season` | GET | 获取当前赛季状态 | 所有玩家 |
| `/api/sect/war/register` | POST | 提交宗门参战阵容 | 宗主/副宗主 |
| `/api/sect/war/roster` | GET | 查看己方报名阵容 | 宗门成员 |
| `/api/sect/war/match` | GET | 获取本届所有对阵表 | 所有玩家 |
| `/api/sect/war/match/:id` | GET | 查看单场对阵详情（含战报） | 所有玩家 |
| `/api/sect/war/bet` | POST | 押注 | 所有玩家 |
| `/api/sect/war/bet/my` | GET | 我的押注记录 | 所有玩家 |
| `/api/sect/war/mvp/rank` | GET | 历届论道之星排行 | 所有玩家 |

---

## 八、定时任务

| 时间 | 任务 | 说明 |
|------|------|------|
| 周一 00:00 | 开启赛季 | 创建 season 记录，进入 registering 状态 |
| 周三 00:00 | 阵容锁定 + 匹配 | 扫描 registration，生成 match；进入 betting 状态 |
| 周五 20:00 | 开赛 | 调用战斗引擎批量执行 5 场战斗；进入 fighting → 秒级完成 |
| 周五 20:10 | 押注结算 | 根据 winner_sect_id 结算 bet |
| 周五 20:15 | 奖励发放 | 宗门资金 / 贡献 / 灵石 / 称号 / Buff |
| 周日 24:00 | 赛季关闭 | status = settled，历史归档 |

---

## 九、UI 设计要点

### 9.1 宗门战主页

- 顶部状态条：当前阶段（报名中 / 押注中 / 激战中 / 已结束）+ 倒计时
- 中部：我的宗门对阵信息（对手宗门 / 赔率 / 己方阵容）
- 下部：本届所有对阵表 + 押注入口

### 9.2 阵容编辑页 (宗主/副宗主)

- 9 个空位：3 问道组 + 3 团战 A 队 + 3 团战 B 队
- 从宗门成员列表拖拽 / 点击选择
- 实时显示总战力 + 预估赔率

### 9.3 战报播放页

- 5 场分 Tab 切换
- 每场用现有战斗回放组件
- 顶部显示总积分 (如 3:2)
- 论道之星 / MVP 高亮金框动画

### 9.4 押注弹窗

- 左右两宗门 card + 实时赔率
- 灵石输入框 + 快捷按钮 (1k / 5k / 10k / 50k)
- 二次确认："押注后不可撤销"
- 我的押注历史入口

---

## 十、数值平衡注意点

1. **押注抽成 5%** → 回流宗门资金池，形成"宗门战养宗门"的闭环
2. **单挑禁丹药** → 避免富有玩家碾压，保持技术含量
3. **Buff 7 天叠加** → 连胜宗门强者愈强，但败方保底资金防止断档
4. **参战资格 ≥ 筑基** → 避免小号凑数，维护参与门槛
5. **轮空保底 80k** → 避免宗门数量为奇数时被排除者心理落差

---

## 十一、开发任务拆分

### 阶段一：基础设施（先做）
1. migration.sql 新增 **`timed_buffs` 通用表** + 索引
2. `battleEngine.ts` 修改角色构建阶段：合并 `character_buffs` + `timed_buffs` 到最终属性
3. `cron/daily-reset` 加入 `timed_buffs` 过期清理
4. 扩展 `achievementData.ts`：新增 `sect_war_mvp_1` / `sect_war_mvp_3` 成就 + `TITLES` 补充论道之星/问道魁首

### 阶段二：数据 + 后端核心
5. migration.sql 新增 5 张宗门战专用表 + 索引
6. `server/api/sect/war/` 目录 — season / register / match / bet / roster / mvp API
7. 周度定时任务（node-cron / setInterval）
8. 赔率计算工具 `server/utils/sectWarOdds.ts`

### 阶段三：战斗引擎扩展
9. `battleEngine.ts` 新增 3v3 多人战斗模式（teamBattleEngine 基础上适配）
10. 单挑模式禁丹药的 flag 接入（`consume-buff` 调用增加 ctx 校验）
11. 宗门战专用战报格式（复用 battle_log JSON）

### 阶段四：前端页面
12. `pages/sect-war.vue` 主页
13. 阵容编辑弹窗
14. 押注弹窗
15. 战报播放页复用
16. 宗门战入口集成到 `pages/sect.vue`

### 阶段五：奖励发放 + 细节打磨
17. 赛事结算器 — 胜方 fund 入账 + 全员 `timed_buffs` 写入 + 论道之星成就 progress +1
18. 押注结算器 — 读取 match.winner_sect_id，遍历 bet 表结算灵石返还
19. 历届 MVP / 战绩排行榜页
20. 消息中心 / Toast 提示（阵容提交 / 押注结算 / 称号获得 / Buff 生效）

---

## 十二、待定事项

| 事项 | 当前默认 | 备选 |
|------|---------|------|
| 赛事时段 (周五 20:00) | 固定 | 改为玩家投票 / 季度调整 |
| 3v3 是否支持"替补" | 否 | 每队最多 1 名替补 |
| 押注上限 50,000 灵石 | 固定 | 按玩家等级浮动 |
| 是否做"跨服宗门战" | 否 (纯本服) | v2 版本引入 |
| 论道之星是否发丹药实物 | 否 (仅 buff) | 加赠 3 颗筑基丹类奖励 |

> 待与策划确认后补全。
