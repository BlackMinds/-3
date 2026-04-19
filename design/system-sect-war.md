# 宗门战 · 问道大比 融合玩法设计

> 版本: v1.1
> 日期: 2026-04-18
> 状态: 待开发
> 父文档: [`system-sect.md`](./system-sect.md)

---

## 零、前置基础设施 · 站内邮件系统

> 📌 本章定义一套共用的"站内邮件 + 附件"基础设施，同时服务于宗门战、灵脉潮汐及未来所有**异步结算类玩法**。
> 📌 [`system-spirit-vein.md`](./system-spirit-vein.md) 直接引用本章，不再重复定义。

### 0.1 为什么需要

异步/定时玩法（宗门战结算、灵脉涌灵、偷袭胜负通知、押注返利……）的结果**不保证玩家在线**。仅靠 Toast 推送会丢失：

- 玩家下线期间的结算通知无法重新看到
- 奖励（灵石/丹方/称号）若只靠事务内直接入账，遇到异常难以补偿
- 异步战报需要"可追溯"的归档入口

邮件系统统一解决以上问题：**结果写入 → 邮件归档 → 上线即看 → 附件一键领**。所有异步玩法的个人奖励**必须**通过邮件下发，禁止直接写背包。

### 0.2 数据表

```sql
-- ========================================
-- 站内邮件（含奖励附件）
-- ========================================
CREATE TABLE IF NOT EXISTS mails (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL,    -- 'sect_war' / 'sect_war_bet' /
                                    -- 'spirit_vein_surge' / 'spirit_vein_raid' /
                                    -- 'spirit_vein_jackpot' / 'system'
  title VARCHAR(80) NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  /* attachments 示例:
     [
       { "type": "spirit_stone", "amount": 50000 },
       { "type": "contribution", "amount": 2000 },
       { "type": "exp",          "amount": 1200 },
       { "type": "material",     "itemId": "awaken_stone", "qty": 1 },
       { "type": "recipe",       "recipeId": "pill_advanced_gold_core" },
       { "type": "title",        "titleKey": "论道之星", "duration": 604800 },
       { "type": "timed_buff",   "statKey": "atk_pct", "statValue": 5, "duration": 604800 }
     ]
  */
  ref_type VARCHAR(30),             -- 'match' / 'bet' / 'raid' / 'surge' / ...
  ref_id VARCHAR(50),               -- 业务主键字符串化
  is_read BOOLEAN DEFAULT FALSE,
  is_claimed BOOLEAN DEFAULT FALSE, -- 附件是否已领取；无附件邮件创建时直接 TRUE
  expires_at TIMESTAMP NOT NULL,    -- 默认 30 天后
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP DEFAULT NULL,
  claimed_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_mail_char_unread ON mails (character_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_char_unclaimed ON mails (character_id, is_claimed) WHERE is_claimed = FALSE;
CREATE INDEX IF NOT EXISTS idx_mail_expires ON mails (expires_at);
```

### 0.3 发送工具函数

`server/utils/mail.ts` 对外暴露：

```typescript
type MailAttachment =
  | { type: 'spirit_stone'; amount: number }
  | { type: 'contribution'; amount: number }
  | { type: 'exp';          amount: number }
  | { type: 'material';     itemId: string; qty: number }
  | { type: 'recipe';       recipeId: string }
  | { type: 'title';        titleKey: string; duration: number }  // 秒
  | { type: 'timed_buff';   statKey: string; statValue: number; duration: number };

export async function sendMail(params: {
  characterId: number;
  category: MailCategory;
  title: string;
  content: string;
  attachments?: MailAttachment[];
  refType?: string;
  refId?: string | number;
  ttlDays?: number;  // 默认 30
}): Promise<number>;

// 宗门群发 / 守卫群发时使用事务批写入
export async function sendMailBatch(items: SendMailParams[]): Promise<void>;
```

### 0.4 API

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/mail/list` | GET | 分页列表（`?category=&page=&pageSize=`） |
| `/api/mail/unread-count` | GET | 红点：未读数 + 未领数 |
| `/api/mail/read` | POST | 标记单封/批量已读 |
| `/api/mail/claim` | POST | 领取单封附件（事务内写背包/贡献/修为/timed_buffs） |
| `/api/mail/claim-all` | POST | 一键领取所有未领取邮件 |
| `/api/mail/delete` | POST | 删除已读且已领取邮件（或无附件通知邮件） |

### 0.5 定时清理

| 频率 | 任务 |
|------|------|
| 每日 04:00 | 清理 `expires_at < NOW()` 邮件；**仍有未领附件的过期邮件，自动执行一次发放后再删除**（兜底：玩家错过过期不丢失奖励） |

### 0.6 触发场景一览

| 场景 | category | 附件 |
|------|---------|------|
| 宗门战结算（参战弟子） | `sect_war` | contribution / spirit_stone |
| 宗门战胜方全员 Buff | `sect_war` | timed_buff × 2 |
| 论道之星称号发放 | `sect_war` | title + timed_buff × 3 |
| 押注返利 / 退款 | `sect_war_bet` | spirit_stone |
| 灵脉涌灵分成 | `spirit_vein_surge` | spirit_stone / exp / contribution |
| 灵脉稀有掉落（觉醒石/丹方） | `spirit_vein_surge` | material / recipe |
| 灵脉被偷袭失败通知（离线守卫） | `spirit_vein_raid` | 无附件（纯通知） |
| 灵脉奖池每周结算 | `spirit_vein_jackpot` | spirit_stone |

### 0.7 前端入口

全局右上角通用"邮件"图标（与任务/通知图标并列），红点 = 未读数 + 未领数。点击打开邮件列表抽屉，分类 Tab（宗门战 / 灵脉 / 系统）。

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
- **弟子退宗/转宗：** 其应战场次自动判负（己方 0 分，个人无奖励），其他场次不受影响；若 3 个单挑组全部退宗或宗门解散，整届赛事该宗门直接弃权，押注按 §4.4 全额退还
- **截止前重组：** 宗主/副宗主可通过 `DELETE /api/sect/war/register` 撤回阵容后重新提交（周三 00:00 后不可操作）

### 2.2 赛制 (BO5 · 3 胜制)

| 场次 | 类型 | 积分 | 计分规则 |
|------|------|------|---------|
| 第 1 场 | 个人单挑 · 先锋战 | 1 分 | 胜方宗门 +1 |
| 第 2 场 | 个人单挑 · 中军战 | 1 分 | 胜方宗门 +1 |
| 第 3 场 | 个人单挑 · 主将战 | 1 分 | 胜方宗门 +1 |
| 第 4 场 | 3v3 团战 · 上阵 | 2 分 | 胜方宗门 +2 |
| 第 5 场 | 3v3 团战 · 终局 | 3 分 | 胜方宗门 +3（翻盘机会） |

**胜负判定：** 总积分高者胜。最高可达 8 分，先达 **5 分** 可提前锁定胜利（不再播后续场次，但参战数据保留）。

**提前终止规则：**
- 单挑 3 场结束后，若一方 **0 胜（0:3 落后）**，团战最大 5 分仍无法翻盘（最多追平），直接判已胜方获胜，跳过团战场次
- 单挑 3:0 一方 + 团战第 1 场 2:0 → 总分 5:0 锁定胜利
- 否则必须打完团战至分出胜负（最坏情况单挑 1:2 + 团战 3+2 = 5 分翻盘）

> 设计意图：团战权重提升到 2 分/3 分，让"单挑负、团战胜"的翻盘路径**真正可行**；单挑 0:3 直接判负避免无意义的收尾战报；不设平局。

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
| 丹药 | **禁用** 战斗中丹药（避免氪金不平衡）。实现：战斗 context 传入 `forbidPills: true` flag，`battleEngine.ts` 角色构建阶段跳过 `character_buffs` 读取 |
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
| 参战宗门弟子 | **不可押注自家宗门**（防止宗主/成员利用内部阵容信息套利）；可自由押注其他对阵 |
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

- **手续费：** 奖池抽成 5%，返还宗门资金池（给对阵两方平分）
- **校验：** `POST /api/sect/war/bet` 入参需校验 `bet_side` 对应的宗门 ≠ 玩家所属宗门，否则 400

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
| 胜方 | +250,000 | atk_pct +5%, def_pct +5% (持续 7 天) | 连胜续期仅刷新 `expires_at`，不叠加数值（见 §6.1.1 UPSERT 语义） |
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
  source_id VARCHAR(50) NOT NULL DEFAULT '',-- 来源引用ID（match_id 等）；无则空串，不用 NULL 便于 UNIQUE
  stat_key VARCHAR(20) NOT NULL,            -- 'atk_pct' / 'def_pct' / 'hp_pct' / 'spd_pct' / 'crit_rate' ...
  stat_value DECIMAL(6,2) NOT NULL,         -- 加成数值（百分比按整数存，如 5 = 5%）
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, source_type, source_id, stat_key)
);

CREATE INDEX IF NOT EXISTS idx_timed_buff_char ON timed_buffs (character_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_timed_buff_source ON timed_buffs (source_type, source_id);
```

**战斗引擎对接方式：** `battleEngine.ts` 的角色构建阶段，除读取 `character_buffs`（丹药 buff）外，新增一段读取 `SELECT stat_key, stat_value FROM timed_buffs WHERE character_id = $1 AND expires_at > NOW()`，按 `stat_key` 归类合并到最终属性上。

**合并语义（重要，避免数值飞升）：**

- **不同 `source_type` 之间：** 同 `stat_key` 的记录**属性值累加**。例如：宗门战胜利 Buff +5% atk_pct 与论道之星 +3% atk_pct 叠加为 +8%。
- **同 `source_type + source_id` 之间：** 写入走 **UPSERT**（连胜续期只刷新 `expires_at`，不重复插入），防止连胜宗门越滚越强。
- **唯一约束：** 表级 `UNIQUE (character_id, source_type, source_id, stat_key)` 是 UPSERT 的基础。

```sql
-- 续期/发放 Buff 的标准写法
INSERT INTO timed_buffs (character_id, source_type, source_id, stat_key, stat_value, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (character_id, source_type, source_id, stat_key)
DO UPDATE SET
  stat_value = EXCLUDED.stat_value,             -- 源值变化时以最新为准
  expires_at = GREATEST(timed_buffs.expires_at, EXCLUDED.expires_at);  -- 续期只向后延
```

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
  round_no SMALLINT NOT NULL DEFAULT 1,                      -- 轮次（v1 固定为 1，预留多轮淘汰制扩展）
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
| `/api/sect/war/register` | DELETE | 截止前撤回阵容（用于重组） | 宗主/副宗主 |
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
| 周五 20:10 | 押注结算 | 根据 winner_sect_id 结算 bet；**每笔结算结果通过 `sendMail` 下发**（category=`sect_war_bet`，附件=灵石） |
| 周五 20:15 | 奖励发放 | 宗门资金直接入账；**个人奖励（贡献/灵石/称号/Buff）全部走 `sendMail`**（category=`sect_war`，见 §零 0.6）；胜方全员 Buff 通过 `sendMailBatch` 批量下发 |
| 周日 24:00 | 赛季关闭 | status = settled，历史归档 |

> 📌 **为什么走邮件：** 周五结算时可能有大量玩家在线/离线，Toast 只对在线玩家有效。通过邮件下发后，玩家上线自动看到"宗门战捷报"红点，点击即可一键领取附件，避免奖励丢失。**宗门资金**因为是"公共资源"不涉及个人通知，仍然直接 UPDATE `sects.fund`。

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
1. migration.sql 新增 **`mails` 邮件表** + 索引（见 §零 0.2）
2. `server/utils/mail.ts` — `sendMail` / `sendMailBatch` 工具函数
3. `/api/mail/*` 接口套件（list / unread-count / read / claim / claim-all / delete）
4. 前端全局"邮件"图标 + 邮件抽屉组件（分类 tab + 红点 + 一键领取）
5. migration.sql 新增 **`timed_buffs` 通用表** + 索引 + `UNIQUE (character_id, source_type, source_id, stat_key)` 约束
6. `battleEngine.ts` 修改角色构建阶段：合并 `character_buffs` + `timed_buffs` 到最终属性；新增 `forbidPills` context flag 支持（单挑场次启用）
7. `cron/daily-reset` 加入 `timed_buffs` / `mails` 过期清理（邮件过期前自动发放附件兜底）
8. 扩展 `achievementData.ts`：新增 `sect_war_mvp_1` / `sect_war_mvp_3` 成就 + `TITLES` 补充论道之星/问道魁首

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
