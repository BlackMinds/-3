# 灵脉潮汐 · 节点争夺玩法设计

> 版本: v1.1
> 日期: 2026-04-18
> 状态: 待开发
> 父文档: [`system-sect.md`](./system-sect.md)

---

## 零、前置基础设施依赖

本系统依赖以下**共用基础设施**（完整定义见 [`system-sect-war.md`](./system-sect-war.md)，此处仅标注使用场景）：

| 基础设施 | 来源 | 本系统使用场景 |
|---------|------|-------------|
| 站内邮件系统 (`mails`) | `system-sect-war.md §零` | **所有个人奖励与离线通知统一走邮件下发**：涌灵分成、稀有掉落、被偷袭失败通知、奖池结算 |
| 限时 Buff 表 (`timed_buffs`) | `system-sect-war.md §6.1.1` | v1 暂不写入；v2 若加"节点光环"需对齐合并语义（同 `source_type` UPSERT、不同 `source_type` 累加） |
| N vs N 多人战斗引擎 | `system-sect-war.md §3.3` | 偷袭战直接复用，不另立引擎 |

> ⚠️ **开工前置：** 上述三项须由宗门战开发阶段一先行完成。本系统的战报/奖励发放逻辑建立在 `sendMail` / `sendMailBatch` API 可用的基础上。

---

## 一、设计概述

### 1.1 定位

灵脉潮汐是宗门系统的**持续性异步 PVP 玩法**，不依赖固定开赛时间，24 小时运转。与"宗门战"（周度集中 PVP）形成互补：

| 维度 | 宗门战 | 灵脉潮汐 |
|------|--------|--------|
| 节奏 | 周度集中 | 实时异步 |
| 参与形式 | 报名后 9 人集中对决 | 任意成员随时出战 |
| 产出 | 荣誉 + 一次性资金/Buff | 持续性灵气收益 |
| 核心乐趣 | "大战役" | "占山为王 + 偷家快感" |

### 1.2 核心循环

```
地图上 6 个灵脉节点 → 宗门派成员驻守
    ↓
每 2 小时涌灵 → 占领宗门自动获得灵气 (灵石/修为)
    ↓
其他宗门派人偷袭 → 与守卫战斗 → 胜者占领
    ↓
败方守卫进入"闭关疗伤"CD (2 小时不可再守)
    ↓
循环: 守卫 / 偷袭 / 反击 持续进行
```

### 1.3 设计目标

1. **不卡在线时间** — 异步对战，战斗走战报，不需要双方同时在线
2. **持续收益 + 持续冲突** — 占住节点有稳定收益，但不占住也不会"被锁死"
3. **"偷家"的爽感** — 小宗门也能靠精准偷袭从大宗门手里抢节点
4. **反滚雪球** — 占领节点越多，被偷袭优先级越高，防止一家独大

---

## 二、地图与节点

### 2.1 节点布局

全服共 **6 个灵脉节点**，固定配置，不随机：

| 节点 | 名称 | 品级 | 涌灵产出基数（每 2h） | 守卫上限 |
|------|------|------|-------------------|---------|
| 1 | 青木灵脉 | 下品 | 灵石 +2,000 / 修为 +500 | 2 |
| 2 | 赤焰灵脉 | 下品 | 灵石 +2,000 / 修为 +500 | 2 |
| 3 | 玄水灵脉 | 中品 | 灵石 +5,000 / 修为 +1,200 | 3 |
| 4 | 黄土灵脉 | 中品 | 灵石 +5,000 / 修为 +1,200 | 3 |
| 5 | 白金灵脉 | 上品 | 灵石 +12,000 / 修为 +3,000 + **3% 概率解锁高级丹方** | 4 |
| 6 | 九天灵脉 | 极品 | 灵石 +25,000 / 修为 +6,000 + **5% 概率掉落觉醒石/附灵石** | 5 |

> 📌 **奖励落地说明（全部通过邮件 `category=spirit_vein_surge` 下发附件，不直接写库）：**
> - "解锁高级丹方"：命中时为每个守卫随机选一个其**未解锁**的高级丹方，通过附件 `{type:'recipe', recipeId}` 下发；若已全部解锁则改发 **50,000 灵石** 等价替代（附件 `{type:'spirit_stone', amount:50000}`）
> - "觉醒石/附灵石"：命中时按 60/40 概率选一个，通过附件 `{type:'material', itemId:'awaken_stone'|'spirit_inscription', qty:1}` 下发
> - 玩家在邮件系统中一键领取后，才真正写入 `character_unlocked_recipes` / `character_materials`

> 设计意图：品级越高收益越大，但守卫上限也越高（抢下来需要组织更多人），拉出风险/收益曲线。

### 2.2 节点可见性 & 访问权

- **地图全公开** — 所有宗门可见 6 个节点当前占领方 / 守卫列表 / 下次涌灵时间
- **进入资格：**
  - 下品节点：宗门等级 ≥ 1
  - 中品节点：宗门等级 ≥ 3
  - 上品节点：宗门等级 ≥ 5
  - 极品节点：宗门等级 ≥ 7
- **境界门槛：** 挑战/驻守者 ≥ 筑基(T2)

### 2.3 初始状态

- 每周一 00:00 **全图清空** 所有节点 → 进入"无主"状态 (NPC 守卫占领，称"**守脉鬼差**"，强度中档)
- 无主节点第一周先由 NPC 占领，降低"冷启动期垄断"风险

---

## 三、占领与驻守

### 3.1 占领流程

```
节点状态 A: 无主（NPC 守卫） → 击败 NPC → 宗门派人驻守 → 状态 B: 占领中
节点状态 B: 占领中（玩家守卫） → 其他宗门偷袭并击败全部守卫 → 短暂真空 (10 分钟) → 偷袭方可安排驻守 → 状态 B'
```

### 3.2 驻守规则

| 项目 | 规则 |
|------|------|
| 驻守资格 | 宗门内门弟子 ≥，境界 ≥ 筑基(T2) |
| 驻守时长 | 默认 24 小时，时长结束后自动离岗（可续守） |
| 同时驻守 | 一个玩家同一时间只能守**一个**节点 |
| 离线可守 | 可，驻守者离线仍按战力参与防守 |
| 替换 | 宗主/副宗主可将己方节点的守卫替换（不消耗战斗） |

### 3.3 驻守收益

**涌灵发放：** 每 2 小时结算一次（自然时间整点：00:00/02:00/04:00...）

| 收益方 | 分配规则 | 落地方式 |
|-------|---------|---------|
| 宗门整体 | 节点产出基数 × 60% → 宗门资金 | 直接 UPDATE `sects.fund`（公共资源，无需邮件） |
| 守卫个人 | 节点产出基数 × 30% → 参与分成的在守玩家平分（灵石 + 修为） | **走邮件** `category=spirit_vein_surge` 附件 |
| 贡献度 | 每次涌灵给参与分成的守卫 +100 贡献度 | **走邮件**附件 `{type:'contribution'}` |
| 奖池留存 | 10% → 全服灵脉大奖池（见 §5.3） | 累加 `spirit_vein_jackpot.pool_amount` |

**"参与分成"的判定（防挂机守）：**

| 最近登录时间 | 分成比例 | 未分得部分去向 |
|-----------|---------|-------------|
| ≤ 24 小时 | 100% | — |
| 24 ~ 72 小时 | 50% | 剩余回流宗门 60% 部分 |
| > 72 小时 | 0%（仍计入防守战力） | 全部回流宗门 60% 部分 |

> 设计意图：驻守离线也能防守（维持"离线战力有用"的设计），但长期不登录的号拿不到个人实利，避免工作室批量刷号挂机。

**极品 / 上品节点额外稀有掉落：** 按 §2.1 概率，**仅对当次参与分成比例 > 0 的守卫** 发放；附件随同涌灵邮件一起下发，不单独建邮件。

---

## 四、偷袭与战斗

### 4.1 偷袭发起

| 条件 | 说明 |
|------|------|
| 发起权 | 任意外宗内门弟子及以上，境界 ≥ 筑基(T2) |
| CD | 同一人对同一节点偷袭 CD：30 分钟 |
| 每日上限 | 单人每日最多发起 10 次偷袭（含各节点） |
| 进攻方人数 | **`min(守卫上限, 实际在守人数 + 1)`**；例：中品节点守卫上限 3、实际仅 1 人在守 → 进攻方最多 2 人。避免"守卫不满员导致碾压式偷袭" |
| 最小进攻人数 | 1 人（可单挑空节点的 NPC 守脉鬼差） |
| 组队限制 | 必须全部来自**同一宗门** |

### 4.2 战斗流程

**单场偷袭 = 一场 N vs N 战报战斗**（复用宗门战 3v3 多人引擎）

```
发起偷袭 → 支付 500 灵石 (进场费) → 系统拉取当前节点所有守卫的角色快照 (离线也能战) →
战斗引擎执行 → 返回战报 →
胜方: 进攻胜 → 原守卫全部被击退 → 10 分钟真空期后可驻守
胜方: 防守胜 → 进攻方进入 "伤势未愈" CD (2 小时) → 守卫不变
```

### 4.3 战败惩罚

| 身份 | 惩罚 |
|------|------|
| 守卫败方 | 进入"**闭关疗伤**" CD — 2 小时内不可再驻守任何节点 |
| 进攻败方 | "伤势未愈" CD — 2 小时内不可再偷袭任何节点 |
| 双方 | 无血量/经验损失（纯 CD 软惩罚） |

### 4.4 真空期

击败全部守卫后，节点进入 **10 分钟真空期**：
- 真空期内原宗门 **不可** 立刻再次驻守
- 真空期内其他宗门 **可以** 驻守（抢占机会）
- 真空期结束后，若无人驻守，则恢复为 NPC 守卫

> 设计意图：避免"打下就反手让原宗副守上"的无意义拉扯；给偷袭方实际占领窗口。

---

## 五、反骚扰与平衡

### 5.1 新宗门保护期

| 规则 | 说明 |
|------|------|
| 保护期 | 新创建宗门 / 宗门等级 ≤ 2 的宗门，**享受 7 天保护期** |
| 保护内容 | 保护期宗门**自己占领的节点**不可被偷袭 |
| 防钻空子 | 保护期宗门成员**若作为守卫被其他宗门节点驻守**（理论上不允许跨宗驻守，此处是未来扩展防御），该节点**不享受保护**，避免"壳宗门"租借保护 |
| 占领上限 | 保护期宗门**最多占领 2 个节点**（防止滥用保护圈地极品资源） |
| 放弃保护 | 宗主可主动放弃保护期（通常为了占极品节点 / 解除占领上限） |

> 设计意图：给新宗门安全窗口积累发展，不被老宗门 Day 1 压制。

### 5.2 反滚雪球机制

**占领数惩罚：** 同一宗门同时占领节点数越多，守卫 buff 越低：

| 占领节点数 | 守卫战力修正 |
|----------|-----------|
| 1 个 | ×1.0 |
| 2 个 | ×0.95 |
| 3 个 | ×0.90 |
| 4+ 个 | ×0.80 |

**仇视机制：** 宗门一旦占领 ≥ 4 个节点，**2 小时后**自动成为"**众矢之敌**"（触发窗口从 24h 缩短到 2h，避免"周一冲量 → 拿奖池 → 周二才被标记"的刷榜策略）：
- 对其偷袭的进场费 × 0.5
- 偷袭胜方额外获得 +500 贡献度
- 期间其自身节点涌灵的 60% 宗门分成**减半**（另一半回流全服奖池）
- 占领数回落至 ≤ 3 后，仇视状态保留 30 分钟才解除（防止"打下即抛"规避惩罚）

> 设计意图：让小宗门有"围殴大宗门"的动力，避免单一强宗门垄断。

### 5.3 全服灵脉大奖池

每次涌灵的 10% 汇入全服大奖池。每周日 23:55 结算：

| 排名 | 奖励来源 | 分配 |
|------|---------|------|
| 本周"综合贡献"排行 TOP1 宗门 | 奖池 40% | 直接入宗门资金 |
| TOP2-3 宗门 | 奖池 20% (各 10%) | 直接入宗门资金 |
| 全服参与偷袭 ≥ 20 次玩家 | 奖池 30% | 平分，**通过邮件** `category=spirit_vein_jackpot` 下发 |
| 奖池留存 | 10% | 滚入下周奖池 |

**"综合贡献"排行公式（反垄断激励，替代纯涌灵次数排行）：**

```
score = 总涌灵次数 × (1 - 同时占领节点数 / 6)
```

> **举例：**
> - A 宗门同时占 5 个节点、涌灵 60 次 → `60 × (1 - 5/6) = 10`
> - B 宗门同时占 2 个节点、涌灵 40 次 → `40 × (1 - 2/6) ≈ 26.7` → **B 宗门排名更高**
>
> 设计意图：让只占 1~2 个节点但高频防守的小宗门有机会登顶，彻底破除"满图垄断宗门自动 TOP1 → 奖池给强者 → 强者更强"的死循环。结合仇视机制与占领数惩罚，形成三层反滚雪球压力。

---

## 六、数据结构

> 📌 **全部 PostgreSQL 语法**，与现有 `migration.sql` 对齐。`user_id` 全部改为 `character_id`（与项目统一身份标识）。
> 📌 **限时 Buff**（例如占领方守卫个人 +X% 战力等未来扩展）复用宗门战定义的 `timed_buffs` 通用表（见 `system-sect-war.md` §6.1.1），本系统不单独建表。

### 6.1 数据表

```sql
-- ========================================
-- 灵脉节点静态配置（6 条，初始化时 INSERT）
-- ========================================
CREATE TABLE IF NOT EXISTS spirit_vein_node (
  id SMALLINT PRIMARY KEY,                                    -- 1~6
  name VARCHAR(20) NOT NULL,
  tier VARCHAR(10) NOT NULL CHECK (tier IN ('low','mid','high','supreme')),
  stone_reward INT NOT NULL,
  exp_reward INT NOT NULL,
  guard_limit SMALLINT NOT NULL,
  min_sect_level SMALLINT NOT NULL
);

-- ========================================
-- 节点占领状态（一行对应一个节点）
-- ========================================
CREATE TABLE IF NOT EXISTS spirit_vein_occupation (
  node_id SMALLINT PRIMARY KEY REFERENCES spirit_vein_node(id),
  sect_id INT DEFAULT NULL REFERENCES sects(id) ON DELETE SET NULL,  -- null = 无主/NPC
  current_guard_count SMALLINT DEFAULT 0,                     -- 冗余：当前在守人数（由 guard 表增删触发维护）
  occupied_at TIMESTAMP DEFAULT NULL,
  next_surge_at TIMESTAMP NOT NULL,                           -- 下次涌灵时间
  vacuum_until TIMESTAMP DEFAULT NULL,                        -- 真空期结束时间
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- current_guard_count 冗余字段维护：在 spirit_vein_guard INSERT/DELETE 时同步 ±1
-- 避免每次地图查询都 JOIN COUNT(*)，6 节点 × 高频刷新场景下显著省开销

CREATE TRIGGER set_sv_occupation_updated_at
  BEFORE UPDATE ON spirit_vein_occupation
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ========================================
-- 当前驻守者
-- ========================================
CREATE TABLE IF NOT EXISTS spirit_vein_guard (
  id SERIAL PRIMARY KEY,
  node_id SMALLINT NOT NULL REFERENCES spirit_vein_node(id),
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  sect_id INT NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,                              -- 驻守到期时间
  UNIQUE (node_id, character_id)
);

-- ========================================
-- 玩家 CD 状态（闭关疗伤 / 伤势未愈 / 对单节点偷袭 CD）
-- ========================================
CREATE TABLE IF NOT EXISTS spirit_vein_cooldown (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  cd_type VARCHAR(20) NOT NULL
    CHECK (cd_type IN ('defend_injured','attack_injured','attack_node')),
  target_node_id SMALLINT DEFAULT NULL REFERENCES spirit_vein_node(id),   -- 仅 attack_node 时填
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 涌灵结算日志
-- ========================================
CREATE TABLE IF NOT EXISTS spirit_vein_surge_log (
  id SERIAL PRIMARY KEY,
  node_id SMALLINT NOT NULL REFERENCES spirit_vein_node(id),
  sect_id INT DEFAULT NULL REFERENCES sects(id) ON DELETE SET NULL,  -- null = NPC 守时不算
  surge_at TIMESTAMP NOT NULL,
  sect_stone_granted INT DEFAULT 0,
  rare_drops JSONB DEFAULT '[]'::jsonb,                       -- 稀有掉落明细
  guards_snapshot JSONB NOT NULL,                             -- 当次分配的守卫 character_id 列表
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 偷袭战斗记录
-- ========================================
CREATE TABLE IF NOT EXISTS spirit_vein_raid (
  id SERIAL PRIMARY KEY,
  node_id SMALLINT NOT NULL REFERENCES spirit_vein_node(id),
  attacker_sect_id INT NOT NULL REFERENCES sects(id),
  defender_sect_id INT DEFAULT NULL REFERENCES sects(id),     -- null = NPC 守
  attackers JSONB NOT NULL,                                   -- [character_id, ...]
  defenders JSONB NOT NULL,
  winner_side VARCHAR(10) NOT NULL CHECK (winner_side IN ('attacker','defender')),
  battle_log JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 每日偷袭计数
-- ========================================
CREATE TABLE IF NOT EXISTS spirit_vein_daily_raid_count (
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  raid_date DATE NOT NULL,
  count SMALLINT DEFAULT 0,
  PRIMARY KEY (character_id, raid_date)
);

-- ========================================
-- 全服奖池（每周一行）
-- ========================================
CREATE TABLE IF NOT EXISTS spirit_vein_jackpot (
  week_start DATE PRIMARY KEY,                                -- 本周一日期
  pool_amount BIGINT DEFAULT 0,
  raid_count_total INT DEFAULT 0,
  settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMP DEFAULT NULL
);
```

### 6.2 关键索引

```sql
CREATE INDEX IF NOT EXISTS idx_sv_guard_node ON spirit_vein_guard (node_id);
CREATE INDEX IF NOT EXISTS idx_sv_guard_char ON spirit_vein_guard (character_id);
CREATE INDEX IF NOT EXISTS idx_sv_guard_expires ON spirit_vein_guard (expires_at);
CREATE INDEX IF NOT EXISTS idx_sv_cd_char_type ON spirit_vein_cooldown (character_id, cd_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_sv_surge_node_time ON spirit_vein_surge_log (node_id, surge_at DESC);
CREATE INDEX IF NOT EXISTS idx_sv_raid_node ON spirit_vein_raid (node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sv_occ_sect ON spirit_vein_occupation (sect_id);
```

### 6.3 战报归档策略

`spirit_vein_raid.battle_log` (JSONB) 单条可能 50KB+，全服每日可能产生上千条。保留策略：

- **热数据：** `spirit_vein_raid` 表仅保留 **最近 30 天** 完整记录
- **归档：** 每日凌晨 04:00 定时任务将 30 天前记录**移动**到 `spirit_vein_raid_archive`（同结构，可选按月分区）
- **前端查询：** 节点详情页默认只读最近 30 天；"历史战报"需用户主动点击二级入口才走归档表

同策略适用于 `spirit_vein_surge_log`（涌灵日志）和宗门战文档的 `sect_war_battle` 表。

---

## 七、API 设计

| 路由 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/spirit-vein/map` | GET | 获取 6 节点总览（占领方/守卫/下次涌灵） | 所有玩家 |
| `/api/spirit-vein/node/:id` | GET | 节点详情 + 最近 20 条战报 + 涌灵日志 | 所有玩家 |
| `/api/spirit-vein/guard` | POST | 申请驻守（需宗门为占领方） | 宗门成员 |
| `/api/spirit-vein/guard/leave` | POST | 主动离岗 | 守卫本人 |
| `/api/spirit-vein/raid` | POST | 发起偷袭（携带队员列表） | 宗门成员 |
| `/api/spirit-vein/cd` | GET | 查询自己当前所有 CD | 本人 |
| `/api/spirit-vein/jackpot` | GET | 查看本周奖池 + 上周结算排行 | 所有玩家 |

**接口细节示例：**

```typescript
// POST /api/spirit-vein/raid
body: {
  nodeId: number,
  attackerCharacterIds: number[]  // 含发起人，人数 ≤ 守卫上限，全部来自同一宗门
}
response: {
  code: 200 | 400 | 500,
  message: string,
  data?: {
    battleLog: BattleLog,
    result: 'attacker' | 'defender',
    vacuumUntil?: string         // ISO timestamp, 若进攻胜
  }
}
```

---

## 八、定时任务

| 频率 | 任务 | 说明 |
|------|------|------|
| 每 2 小时 (偶数整点) | 涌灵结算 | 遍历 6 节点，计算宗门 60% 直接入账；**守卫个人 30% + 贡献 + 稀有掉落全部通过 `sendMailBatch` 下发**（category=`spirit_vein_surge`） |
| 每 5 分钟 | 真空期扫描 | 真空期结束且无人驻守的节点 → NPC 接管 |
| 每 10 分钟 | 驻守过期扫描 | `guard.expires_at` 到期 → 自动离岗 + 触发"驻守结束"邮件（无附件） |
| 偷袭结算实时 | 偷袭战斗结束时 | 胜方进攻方 → 无邮件（直接跳转战报）；**败方原守卫（尤其离线）→ `sendMail` "节点被偷袭"通知**（category=`spirit_vein_raid`，无附件） |
| 每日 00:00 | 每日偷袭计数重置 | 按日期分区存储，到期清空 |
| 每日 04:00 | 战报归档 + 邮件清理 | 超过 30 天的 `spirit_vein_raid` / `spirit_vein_surge_log` 移入 archive；`mails.expires_at < NOW()` 的邮件，**未领取的先自动发放再删除** |
| 每周日 23:55 | 奖池结算 | 根据"综合贡献"公式（§5.3）分发；个人部分通过 `sendMailBatch` 下发 |
| 每周一 00:00 | 全图重置 | 清空占领，所有节点变 NPC 守；新一周保护期刷新 |

---

## 九、UI 设计要点

### 9.1 灵脉全景页 `/spirit-vein`

- 顶部 tab: "灵脉总览 / 我的驻守 / 最近战报 / 奖池排行"
- 主体：6 个节点 card 横排/网格
  - 节点名 + 品级色（下品绿/中品蓝/上品紫/极品金）
  - 当前占领宗门 logo + 名称
  - 守卫头像列（最多 N 个位置，空位灰）
  - 下次涌灵倒计时
  - 按钮：[驻守] / [偷袭] / [查看详情]
- 小地图式视觉（参考现有"秘境地图"组件）

### 9.2 偷袭发起弹窗

- 左：当前守卫列表（角色卡 + 战力）
- 右：我方出征选择（从宗门成员中勾选，人数 ≤ 守卫上限）
- 底部：战力对比条 + 预估胜率
- 按钮：[确认偷袭 -500 灵石]
- 战后：直接进入战报回放页

### 9.3 涌灵通知

- **在线玩家：** 涌灵结算后 Toast："灵脉涌动 — 已发送至邮箱（点击查看）" → 直接跳转邮件抽屉
- **离线玩家：** 上线后邮件红点提示 + 点开即可一键领取 7 天内所有涌灵附件
- **被偷袭失败：** 前守卫玩家收到邮件（category=`spirit_vein_raid`，无附件）："你驻守的 {节点名} 被 {宗门名} 偷袭得手，战斗详情见链接" → 点击跳转战报回放
- **设计原则：** **所有个人奖励零直写背包**，全部走邮件 → 解决"异步玩法 Toast 丢失导致奖励/通知不可追溯"的老问题

---

## 十、数值平衡注意点

1. **涌灵基数分级** — 下品、中品、上品、极品节点收益差距约 **2x → 2.5x → 2x**，让低品节点也不至于"没人抢"
2. **守卫上限阶梯** — 2/3/4/5，保证越高品节点越需要"集体组织"
3. **偷袭 CD 30 分钟** — 防止单人刷屏，同时让"组织多人轮班偷袭"成为策略
4. **每日偷袭 10 次** — 限制肝度，避免工作室机制破坏体验
5. **周度全图重置** — 防止老宗门长期垄断，每周一是"黄金起跑时刻"
6. **新宗门 7 天保护** — 初期存活率保护
7. **反滚雪球 ×0.8 战力修正 + 仇视机制** — 大宗门"守不住 4 个节点"的数学暗示

---

## 十一、开发任务拆分

### 前置依赖
> ⚠️ 本系统**依赖宗门战**已先行完成以下三项基础设施，开工前请确认：
> 1. **`mails` 邮件表 + `sendMail` 工具 + `/api/mail/*` 接口套件**（本系统所有异步奖励/通知的落地通道）
> 2. `timed_buffs` 通用表已建立（v1 不写入，v2 节点光环扩展用）
> 3. N vs N 多人战斗引擎已可用（复用于偷袭战）

### 阶段一：数据 + 基础 API
1. migration.sql 新增 7 张表 + 初始化 6 个节点静态数据（INSERT 固定 6 行）
2. `server/api/spirit-vein/` 目录 — map / node / guard / raid / cd / jackpot
3. CD 工具函数 `server/utils/spiritVeinCd.ts`（查询/写入 `spirit_vein_cooldown`）

### 阶段二：战斗与奖励接入
4. 偷袭战斗复用宗门战多人引擎
5. 离线战力快照工具 `server/utils/battleSnapshot.ts`（按 character_id 拉取完整战力）
6. 登录时间工具 `server/utils/lastLoginAt.ts`（驱动涌灵 30% 分成的三档判定）
7. 涌灵奖励发放器 — 宗门 60% 直接 UPDATE `sects.fund`；**个人 30% + 贡献 + 稀有掉落全部走 `sendMailBatch`**（附件类型见 §零 0.6）
8. 偷袭结算器 — 胜方无邮件；**败方守卫走 `sendMail` 通知**；invalidate `current_guard_count` 冗余维护
9. 战报持久化到 `spirit_vein_raid.battle_log` (JSONB)

### 阶段三：定时任务
8. 涌灵结算器 — 每 2 小时整点触发（node-cron：`0 */2 * * *`）
9. 真空期 / 驻守过期扫描（每 5~10 分钟）
10. 每周一 00:00 全图重置 + 每周日 23:55 奖池结算

### 阶段四：前端
11. `pages/spirit-vein.vue` 主页 + 节点网格组件
12. 偷袭弹窗 + 战报回放（复用宗门战战报组件）
13. 驻守管理页（我的驻守 + 一键离岗）
14. 奖池排行榜页
15. 宗门内集成入口 (从 `pages/sect.vue` 跳转)

### 阶段五：细节 + 平衡
16. 消息中心：偷袭成功/失败、节点被偷袭的离线通知
17. 保护期视觉标识（新宗门 banner）
18. 众矢之敌标识（占领 ≥ 4 节点的醒目红色 banner）
19. 数值微调（上线后根据数据反馈）

---

## 十二、与宗门战的交互

| 维度 | 规则 |
|------|------|
| 驻守不影响宗门战报名 | 灵脉守卫仍可被提名为宗门战阵容 |
| 宗门战期间暂停偷袭 | 周五 20:00 ~ 20:30 冻结偷袭（避免战报冲突） |
| 灵脉 v1 不写 timed_buffs | 仅发放即时资源（灵石/修为/贡献/材料），不下发长期属性 Buff；v2 若加"节点光环"需对齐 sect-war §6.1.1 合并语义（同 source_type UPSERT、不同累加） |
| 共用邮件系统 | 所有异步通知/奖励统一经 `sendMail`，与宗门战共用 `mails` 表与前端邮件抽屉 |
| 共用战斗引擎 | N vs N 多人战斗引擎复用（先做宗门战再做灵脉） |

---

## 十三、待定事项

| 事项 | 当前默认 | 备选 |
|------|---------|------|
| 6 个节点命名 / 品级分布 | 2/2/1/1 | 可改 3/2/1 或加第 7 节点 |
| 涌灵间隔 (2h) | 固定 | 可做品级差异 (极品节点 4h) |
| 反滚雪球触发阈值 (4 节点) | 固定 | 可按服务器宗门总数动态调整 |
| NPC 守脉鬼差强度 | 中档 | 需策划定档（建议 = 当服 T3 中位数战力） |
| 是否做"节点被动光环"给周边玩家 | 否 | v2 可加"极品节点附近玩家 +5% 修为"（需写 `timed_buffs`） |
| 驻守奖励是否含境界经验 | 否，只有修为 | 可加但数值要小心 |
| T1 弟子参与度 | 仅可旁观战报 / 查看地图 | v2 可开放"押注灵脉偷袭结果"轻量玩法，保留新手憧憬感 |
| 保护期宗门占领节点上限（2 个） | 固定 | 可按宗门等级浮动（Lv1 = 1, Lv2 = 2） |

> 待与策划确认后补全。
