# 坊市系统设计文档

> 版本: v1.0
> 日期: 2026-04-23
> 状态: 待开发
> 方案基调: **寄售挂单制 + 价格区间护栏 + 交易税**（混合方案 C）

---

## 零、前置基础设施依赖

| 基础设施 | 来源 | 本系统使用场景 |
|---------|------|-------------|
| 站内邮件系统 (`mails`) | `system-sect-war.md §零` | 成交到账、挂单过期退回、被购买通知、封禁/违规公告 **统一走邮件下发**（不直接写背包，保证异步安全） |
| 背包系列表 | `character_equipment` | 上架时扣减、取消/过期时通过邮件退回 |
| `characters.spirit_stone` | 现有 | 交易媒介（唯一货币） |
| 全服广播 (`world_broadcast`) | 现有 | 高价值商品成交 / 史诗级拍卖打广播 |

> ⚠️ **开工前置：** 邮件系统必须先能承载"装备实例附件"和"灵石附件"。若现有 `mails.attachments` 尚未支持装备实例的整包重建（强化等级 / 副词条 / 觉醒效果），需先补齐 claim 分发器。

---

## 一、系统概述

### 1.1 设计目标

坊市是万界仙途的**全服 C2C 交易系统**，解决三个问题：

1. **玩家间资源错配** — A 满仓的装备是 B 的稀缺品，没有渠道流通就是浪费
2. **中后期灵石消耗深度** — T5+ 玩家灵石过剩，坊市提供一个"凭眼光套利"的灵石去处
3. **非氪金的稀有获取路径** — 欧皇出货、非酋收货，让运气差的玩家也能靠肝度兑换稀有品

### 1.2 设计禁区（反向目标）

坊市**不是**、也绝不能变成下列东西：

- ❌ 工作室提款机：必须让外挂/脚本/小号刷金的收益 < 封禁成本
- ❌ 通胀加速器：灵石回收率必须 ≥ 坊市产出的灵石流速
- ❌ RMT（真钱交易）温床：单账号日成交额设上限，阻断外部挂钩
- ❌ 数值跳级器：低境界不能用坊市买到远超自己阶段的神器
- ❌ PVP 代替品：坊市是经济系统，不是强弱宣告栏

### 1.3 核心循环

```
玩家 A 刷图/秘境 → 获得暂不需要的装备
    ↓
在坊市挂单（选装备 → 设价 → 系统校验价格区间）→ 装备从背包移至托管
    ↓
玩家 B 搜索需要的品类 → 看到 A 的挂单 + 系统参考价对比 → 购买
    ↓
系统扣 B 灵石 → 扣 10% 税进黑洞 → 剩余 90% 通过邮件打给 A → 物品通过邮件打给 B
    ↓
交易流水写入 market_transactions → 参考价更新任务把新成交并入统计
    ↓
下次再有同类商品挂单时，新的参考价生效 → 市场自我调节
```

### 1.4 与其他系统的关系

| 系统 | 关系 |
|------|------|
| 宗门商店 | **互补**：宗门商店卖系统定价的独占品（解锁型），坊市卖玩家互通的实例品 |
| 邮件系统 | **强依赖**：所有物品交付都走邮件，保证异步+原子性 |
| 宗门战 / 灵脉潮汐 | **无耦合**：坊市独立运转，不参与 PVP 荣誉/贡献度体系 |
| 全服广播 | **轻度使用**：仅史诗级成交（如 +10 仙品装备）触发 |
| 装备 | **可流通**（除绑定标记的）；功法残页 / 丹药 / 灵草 / 洗髓丹一期均不可交易 |

---

## 二、名字与 UI 入口

### 2.1 名字：**坊市**

- 修仙题材中流通性最高的词（凡人/遮天/雪中悍刀行都用）
- 2 字，短；前端图标位置不紧张
- 一期仅开放**宝阁**（装备）一个分区，未来按需扩展

### 2.2 UI 主入口

地图 / 城镇界面新增按钮：**「坊市」**，解锁门槛见 §4.3。

### 2.3 主界面分区

```
┌──────────────────────────────────────────────────┐
│  坊市                                    [我的挂单] [成交记录] │
├──────────────────────────────────────────────────┤
│  分区: 宝阁·装备（一期仅此一项）                          │
├──────────────────────────────────────────────────┤
│  筛选: [品质▼] [境界▼] [槽位▼] [排序:时间/价格/性价比]       │
│  搜索: [_______________]                                  │
├──────────────────────────────────────────────────┤
│  [图标] 太虚剑 (地品·+7)      参考价 12,000      │
│         副词条: 攻击+120, 破甲+5%             9,500  [购买] │
│         🟢 低于参考价 21%    卖家: 青莲道君           │
├──────────────────────────────────────────────────┤
│  ...                                                      │
└──────────────────────────────────────────────────┘
```

---

## 三、核心模式详解

### 3.1 寄售挂单（Consignment）

- 玩家上架后，物品**立刻从背包托管至坊市**（物理移除，防一物二卖）
- 挂单期间物品无法装备、无法使用、无法强化
- 买家下单瞬间完成所有权转移，无"双方同时在线"要求

### 3.2 价格区间护栏（Price Guardrail）

- 每个可交易品类都有**系统参考价 `ref_price`**
- 上架价必须落在 **[ref_price × 0.3, ref_price × 3.0]** 区间内
  - 下限防"1 灵石刷小号"的 RMT
  - 上限防"刷参考价"的骗局（虚高挂单 → 诱导高报价 → 再低价自收）
- 参考价计算见 §5

**特殊情况**：
- 参考价数据不足（成交样本 < 5）的物品，使用策划配置的**基础参考价 `base_ref_price`**（按品质 × tier 分档）
- 全服首次出现的物品（新版本装备），用 `base_ref_price` 撑 30 天后切换到真实参考价

### 3.3 交易税（灵石回收器）

- 买家支付 `price`，系统扣 **10%** 税
- 卖家到账 `price × 90%`
- 税率参数化（`config.market_tax_rate`），运营可临时调到 15%（压通胀）或 5%（促消费节）

**为什么不是固定手续费？**
按比例收能自动对低价垃圾少收、对高价珍品多收，同时避免小额交易被手续费直接劝退。

### 3.4 挂单有效期

- 默认 **48 小时**自动过期
- 过期后物品 **通过邮件退回卖家**（不是直接进背包，保证一致性）
- 卖家手动下架：**扣 5% 灵石下架费**（按挂单价计算），防止用挂单-下架操作刷参考价

### 3.5 绑定机制

- 新增 `is_bound` 字段（或在 `character_equipment` / `pills` / `materials` 上扩展）
- 以下物品**强制绑定、不可上架**：
  - 宗门商店购买的道具
  - 任务/成就奖励
  - 新手引导物品
  - 洗髓丹（避免灵根刷子）
- 掉落品、合成品、闭关产物默认**不绑定**（可流通）

---

## 四、可交易品类与防滥用

### 4.1 可上架品类

| 品类 | 实例粒度 | 上架单位 | 门槛 | 备注 |
|------|---------|---------|------|------|
| 装备 (`character_equipment`) | 单件实例 | 1 件/单 | **品质 ≥ 紫色** 且 **tier ≥ 3** | 带强化等级、副词条、觉醒效果整体打包 |

**一期仅开放装备**。具体准入：
- 品质 `rarity ∈ {purple, gold, red}`（白/绿/蓝品质装备一律不可挂单）
- 地图 `tier ≥ 3`（早期阶段装备不进入坊市，避免低境界跳级、降低工作室低价倾销空间）
- **V5 传奇装备一律不可挂单**（`legendary_set_id` 非空）：极稀有产出，禁止流通以防 RMT 与跳级

功法残页 / 丹药 / 灵草等堆叠类资源同样暂不进入坊市，原因见 §4.2。

### 4.2 不可上架品类（硬规则）

- 灵石（货币本身，防刷金）
- 装备强化石/残片（只能宗门商店流通）
- 绑定物品（`is_bound = TRUE`）
- 宗门专属奖励（贡献兑换品）
- 洗髓丹 / 改名券 / 转职类道具
- **白 / 绿 / 蓝品质装备**（低于紫色一律不可挂单，避免新手装垃圾流通污染参考价、压缩工作室低价倾销空间）
- **tier < 3 的装备**（早期阶段装备只走自产自销，防低境界用坊市跳级）
- **V5 传奇装备**（`legendary_set_id` 非空，如元始天尊套等）：极稀有产出，禁止流通以防 RMT 与跳级；命中时错误码 `ITEM_LEGENDARY_NOT_TRADABLE`
- **功法残页 / 丹药 / 灵草等堆叠类资源**（一期不开放，原因：堆叠品流动性强、易被工作室批量化套现，留待后续单开"散件市集"或在反 RMT 体系成熟后再开放）

### 4.3 账号准入门槛

坊市对新号开放有**阶梯限制**：

| 条件 | 效果 |
|------|------|
| 账号注册 < 1 天 | 完全禁用坊市（看都看不到） |
| 角色境界 < 筑基（tier < 2） | 仅可浏览，不可交易 |
| 角色等级 < 30 | 仅可浏览 |
| 上述都满足 | 可买、可卖 |

**理由**：1 天冷却挡掉"注册即交易"的脚本号，配合筑基门槛进一步抬高工作室成本；更严格的对敲检测交给 §4.5 风控规则。

### 4.4 挂单数与交易量限制

| 限制项 | 数值 | 目的 |
|-------|------|------|
| 单角色同时挂单数 | 30 单 | 与每日成交上限对齐，防刷参考价 |
| 单角色每日上架次数 | 30 次 | 给取消重挂留余量，仍限制刷参考价 |
| 单角色**每日成交件数**（买 + 卖合计） | **30 件** | 主限额：阻断工作室批量化、限制 RMT 转账规模 |
| 单角色每日成交额（买 + 卖） | 10,000,000 灵石 | 附加护栏：单件超大额下单的兜底约束 |
| 单件商品成交后冷却 | 无 | 不限制频次，只限制件数与金额 |

超限的操作直接拒绝，前端按命中的具体规则提示：
- 件数超限 → "您今日交易件数（买+卖）已达 30 件上限，请明日再来"
- 金额超限 → "您今日交易额已达上限，请明日再来"
- 挂单数超限 → "您当前进行中的挂单已达上限，请下架部分商品后再上架"

### 4.5 反工作室 / 反 RMT 双向判定

同一交易触发下列任一条件 → **直接阻断交易并记入风控日志**：

1. 买卖双方同一 `register_ip`（或 `last_login_ip` 近 7 天重合）
2. 买卖双方同一设备指纹（前端上报 `device_hash`）
3. 买卖双方在 60 秒内有过私聊/组队（高度嫌疑对敲）
4. 买家 24h 内注册
5. 卖家单日已触发过 1 次以上风控，再交易直接拒绝

风控触发时：**物品退回卖家、灵石退回买家**，双方邮件收到"交易异常已取消"通知，但**不主动告知具体哪条规则**（防工作室反向测试）。

### 4.6 下架费与挂单费

| 操作 | 费用 |
|------|------|
| 上架 | 免费（但占挂单名额） |
| 手动下架 | 挂单价的 5% 灵石（防刷参考价） |
| 到期过期 | 免费（正常商业行为） |
| 修改挂单价 | 不支持（必须下架重上） |

---

## 五、参考价计算

### 5.1 参考价的归一化单位

参考价按"物品品类的归一化键"聚合，不是按具体实例：

| 品类 | 归一化键 `category_key` |
|------|------------------------|
| 装备 | `eq:{slot}:{rarity}:{tier}:{enhance_level}` |

**注意装备的简化**：副词条、觉醒效果、具体 `primary_value` **不进入键**。这意味着坊市会把"同品质同强化等级的同槽位装备"归为一类，参考价一致。玩家可以通过副词条差异定价超出/低于参考价（但仍受 ±3x 护栏约束）。

> 这是经过权衡的简化：如果按完整词条算，样本会极度稀疏，绝大多数物品永远没有参考价。

### 5.2 计算公式

每小时跑一次定时任务 `market:update-ref-price`：

```
对每个 category_key:
  取最近 7 天的成交记录
  过滤: 样本数 >= 5
  去极值: 丢掉最高 10% 和最低 10%
  ref_price = AVG(剩余样本的 price)
  写入 market_reference_price 表
```

样本数 < 5 时**保留上一次计算结果**，连续 30 天无成交则回退到 `base_ref_price`。

### 5.3 基础参考价表（策划配置）

策划维护一张 `market_base_price.json`（或直接入库 `market_base_price` 表），按归一化键给兜底价：

```json
{
  "eq:weapon:purple:3:0": 25000,
  "eq:weapon:purple:5:0": 60000,
  "eq:weapon:gold:5:0": 150000,
  "eq:weapon:red:7:0": 800000,
  "eq:armor:purple:4:0": 30000,
  "eq:accessory:gold:5:0": 120000
}
```

> 仅紫色及以上 + tier ≥ 3 的归一化键会被写入 base_price 表；低于该门槛的装备压根进不了坊市，自然不需要参考价。

### 5.4 前端提示

```
当前挂单价: 9,500
系统参考价: 12,000
[🟢 低于参考价 21%]   ← 性价比排序用这个
```

---

## 六、数据库设计

### 6.1 挂单表 `market_listings`

```sql
CREATE TABLE IF NOT EXISTS market_listings (
  id BIGSERIAL PRIMARY KEY,
  seller_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

  -- 分类（一期仅 'equipment'，保留 column 以备未来扩展堆叠品）
  category VARCHAR(16) NOT NULL DEFAULT 'equipment' CHECK (category IN ('equipment')),
  category_key VARCHAR(80) NOT NULL,  -- 归一化键（见 §5.1）

  -- 物品快照（托管期间原始背包行已删除，这里保留全量重建所需）
  item_snapshot JSONB NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity = 1),  -- 装备恒为 1

  -- 价格
  unit_price BIGINT NOT NULL CHECK (unit_price > 0),     -- 单价
  total_price BIGINT GENERATED ALWAYS AS (unit_price * quantity) STORED,

  -- 状态
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','sold','cancelled','expired','risk_blocked')),

  -- 生命周期
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP DEFAULT NULL,  -- 成交/下架/过期时间

  -- 成交信息（仅 sold 时填充）
  buyer_id INT DEFAULT NULL REFERENCES characters(id),
  tax_amount BIGINT DEFAULT 0,
  seller_received BIGINT DEFAULT 0
);

CREATE INDEX idx_market_active_category ON market_listings (category, category_key, unit_price)
  WHERE status = 'active';
CREATE INDEX idx_market_active_expires ON market_listings (expires_at) WHERE status = 'active';
CREATE INDEX idx_market_seller ON market_listings (seller_id, status, created_at DESC);
CREATE INDEX idx_market_buyer ON market_listings (buyer_id, closed_at DESC) WHERE buyer_id IS NOT NULL;
```

**`item_snapshot` 结构示例**（装备）：
```json
{
  "name": "太虚剑",
  "slot": "weapon",
  "weapon_type": "sword",
  "rarity": "purple",
  "primary_stat": "atk",
  "primary_value": 380,
  "sub_stats": [{"key":"atk_pct","value":0.12}, {"key":"crit_rate","value":0.05}],
  "awaken_effect": null,
  "set_id": null,
  "enhance_level": 7,
  "req_level": 80,
  "tier": 5
}
```

### 6.2 成交流水表 `market_transactions`

```sql
CREATE TABLE IF NOT EXISTS market_transactions (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES market_listings(id),

  seller_id INT NOT NULL REFERENCES characters(id),
  buyer_id INT NOT NULL REFERENCES characters(id),

  category VARCHAR(16) NOT NULL DEFAULT 'equipment',
  category_key VARCHAR(80) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price BIGINT NOT NULL,
  total_price BIGINT NOT NULL,
  tax_amount BIGINT NOT NULL,
  seller_received BIGINT NOT NULL,

  -- 风控快照（事后追查用）
  seller_ip VARCHAR(45) DEFAULT NULL,
  buyer_ip VARCHAR(45) DEFAULT NULL,
  seller_device VARCHAR(64) DEFAULT NULL,
  buyer_device VARCHAR(64) DEFAULT NULL,
  risk_score SMALLINT DEFAULT 0,  -- 0~100，用于事后复盘

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tx_category_time ON market_transactions (category_key, created_at DESC);
CREATE INDEX idx_tx_seller_day ON market_transactions (seller_id, created_at DESC);
CREATE INDEX idx_tx_buyer_day ON market_transactions (buyer_id, created_at DESC);
```

### 6.3 参考价表 `market_reference_price`

```sql
CREATE TABLE IF NOT EXISTS market_reference_price (
  category_key VARCHAR(80) PRIMARY KEY,
  ref_price BIGINT NOT NULL,
  sample_count INT NOT NULL,
  calc_method VARCHAR(16) NOT NULL CHECK (calc_method IN ('base','historical')),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.4 基础参考价表 `market_base_price`

```sql
CREATE TABLE IF NOT EXISTS market_base_price (
  category_key VARCHAR(80) PRIMARY KEY,
  base_price BIGINT NOT NULL,
  notes VARCHAR(200) DEFAULT ''
);
-- 由策划批量 upsert，不走游戏逻辑
```

### 6.5 每日限额缓存表 `market_daily_quota`

```sql
CREATE TABLE IF NOT EXISTS market_daily_quota (
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quota_date DATE NOT NULL,
  listing_count INT DEFAULT 0,       -- 当日上架次数
  buy_count INT DEFAULT 0,           -- 当日买入件数（成交计）
  sell_count INT DEFAULT 0,          -- 当日卖出件数（成交计）
  buy_amount BIGINT DEFAULT 0,       -- 当日买入金额
  sell_amount BIGINT DEFAULT 0,      -- 当日卖出金额
  PRIMARY KEY (character_id, quota_date)
);

-- 校验时使用 (buy_count + sell_count) <= market_max_daily_trade_count
-- 同时校验 (buy_amount + sell_amount) <= market_max_daily_trade_amount

-- 日切后自然失效，定期清理 7 天前数据
```

### 6.6 风控黑名单表 `market_risk_log`

```sql
CREATE TABLE IF NOT EXISTS market_risk_log (
  id BIGSERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id),
  listing_id BIGINT REFERENCES market_listings(id),
  rule_hit VARCHAR(30) NOT NULL,  -- 'same_ip' / 'same_device' / 'register_too_new' / ...
  extra_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_char ON market_risk_log (character_id, created_at DESC);
```

---

## 七、接口设计（Nuxt 3 server routes）

### 7.1 浏览侧

#### `GET /api/market/listings`
**请求参数**
```
category: 'equipment'   (一期固定值，预留参数以兼容后续扩展)
filters: { rarity?, tier?, slot?, weapon_type?, set_id?, enhance_level_min?, enhance_level_max? }
sort: 'time_desc' | 'price_asc' | 'price_desc' | 'cost_performance'
page: number (默认 1)
page_size: number (默认 20, 最大 50)
```

**返回**
```json
{
  "items": [
    {
      "id": 12345,
      "seller_name": "青莲道君",
      "item_snapshot": { ... },
      "quantity": 1,
      "unit_price": 9500,
      "total_price": 9500,
      "ref_price": 12000,
      "price_diff_pct": -0.208,     // 相对参考价偏差
      "expires_at": "2026-04-25T10:00:00Z"
    }
  ],
  "total": 412,
  "page": 1
}
```

#### `GET /api/market/reference-price?category_key=...`
返回单个品类的参考价，前端上架时调用以画区间。

#### `GET /api/market/my-listings`
返回当前角色的全部进行中 / 最近 30 天历史挂单。

#### `GET /api/market/my-transactions`
返回当前角色最近 30 天的买入/卖出流水。

### 7.2 上架

#### `POST /api/market/list`
**请求体**
```json
{
  "source": {
    "category": "equipment",
    "inventory_id": 98765   // character_equipment.id
  },
  "unit_price": 9500
}
```

**服务端流程**（事务内执行）：
1. 鉴权 + 校验账号准入（§4.3）
2. 校验当日挂单次数 < 30、进行中挂单 < 30
3. 校验装备存在、归属、未绑定、未穿戴中
4. **校验装备 `rarity ∈ {purple, gold, red}` 且 `tier ≥ 3`**（不满足直接拒，错误码 `ITEM_BELOW_MARKET_THRESHOLD`）
5. 计算 `category_key`，拉取 `ref_price`
6. 校验 `unit_price ∈ [ref * 0.3, ref * 3.0]`
7. 从背包扣除装备（`character_equipment` 行 `DELETE`）
8. 构造 `item_snapshot` 写入 `market_listings`（quantity 恒为 1）
9. `market_daily_quota.listing_count += 1`
10. 返回新挂单信息

### 7.3 购买

#### `POST /api/market/buy`
**请求体**
```json
{ "listing_id": 12345, "expected_unit_price": 9500 }
```
（`expected_unit_price` 做乐观校验，防"点击时已被改价"——虽然我们本就不允许改价，但留一道前后端对齐的校验）

**服务端流程**（事务 + 行锁）：
1. `SELECT ... FOR UPDATE` 锁住挂单行
2. 校验 `status = 'active'` 且未过期
3. 校验买家 ≠ 卖家
4. 风控检查（§4.5）——命中任一硬规则直接 ROLLBACK + 写 `market_risk_log`
5. 校验买家 `spirit_stone >= total_price`
6. **校验买家当日 (buy_count + sell_count) < 10、卖家当日 (buy_count + sell_count) < 10**
7. 校验买家当日买入额度、卖家当日卖出额度（金额护栏，§4.4）
8. 扣买家灵石：`characters.spirit_stone -= total_price`
9. 写交易流水 `market_transactions`
10. 更新 `market_listings`: status='sold', buyer_id, tax_amount, seller_received, closed_at
11. 更新双方 `market_daily_quota`：买家 `buy_count += 1, buy_amount += total_price`，卖家 `sell_count += 1, sell_amount += total_price`
12. 发邮件：
    - 给卖家：灵石 `seller_received` + 成交通知
    - 给买家：物品附件（按 item_snapshot 重建）
13. 高价值成交（total_price > 100万）触发 `world_broadcast`
14. 提交事务

### 7.4 取消 / 过期

#### `POST /api/market/cancel`
```json
{ "listing_id": 12345 }
```
**流程**：
1. 锁行、校验 `status = 'active'` 且属于当前角色
2. 扣下架费 = `unit_price * quantity * 0.05`，买不起直接拒
3. `status = 'cancelled'`, `closed_at = now()`
4. 发邮件：附件为原物品，标题"坊市下架"

#### 定时任务 `market:expire`
每 5 分钟跑一次：
```sql
UPDATE market_listings
SET status = 'expired', closed_at = CURRENT_TIMESTAMP
WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP
RETURNING id, seller_id, item_snapshot, quantity;
```
对返回的每一行发邮件退回物品。

### 7.5 参考价更新

#### 定时任务 `market:update-ref-price`
每小时 0 分跑一次：
```
WITH recent AS (
  SELECT category_key, unit_price,
         ROW_NUMBER() OVER (PARTITION BY category_key ORDER BY unit_price) AS rn_asc,
         ROW_NUMBER() OVER (PARTITION BY category_key ORDER BY unit_price DESC) AS rn_desc,
         COUNT(*) OVER (PARTITION BY category_key) AS total
  FROM market_transactions
  WHERE created_at > NOW() - INTERVAL '7 days'
),
filtered AS (
  SELECT category_key, unit_price
  FROM recent
  WHERE total >= 5
    AND rn_asc > total * 0.1
    AND rn_desc > total * 0.1
)
INSERT INTO market_reference_price (category_key, ref_price, sample_count, calc_method)
SELECT category_key, AVG(unit_price)::BIGINT, COUNT(*), 'historical'
FROM filtered
GROUP BY category_key
ON CONFLICT (category_key) DO UPDATE SET
  ref_price = EXCLUDED.ref_price,
  sample_count = EXCLUDED.sample_count,
  calc_method = 'historical',
  last_updated = CURRENT_TIMESTAMP;
```

对数据库没记录的 `category_key`，读取时回退到 `market_base_price`。

---

## 八、数值参数（运营可调）

| 参数 | 初始值 | 调整方向 |
|-----|-------|---------|
| `market_tax_rate` | 0.10 | 通胀压力大时 ↑ 到 0.15；节日促销 ↓ 到 0.05 |
| `market_price_floor_ratio` | 0.30 | 参考价偏离容忍下限 |
| `market_price_ceiling_ratio` | 3.0 | 参考价偏离容忍上限 |
| `market_listing_duration_hours` | 48 | 节日活动可延长到 72 |
| `market_cancel_fee_ratio` | 0.05 | 下架费率 |
| `market_max_active_listings` | 30 | 单角色同时进行中挂单 |
| `market_max_daily_listings` | 30 | 单角色每日上架次数 |
| `market_max_daily_trade_count` | 10 | 单角色每日成交件数（买 + 卖合计） |
| `market_max_daily_trade_amount` | 10,000,000 | 单角色每日成交额（金额护栏） |
| `market_broadcast_threshold` | 1,000,000 | 触发全服广播的成交额 |
| `market_entry_realm_tier` | 2 | 准入境界 |
| `market_entry_level` | 30 | 准入等级 |
| `market_entry_register_days` | 1 | 账号最低注册天数 |
| `market_item_min_rarity` | `purple` | 装备上架最低品质（白/绿/蓝禁止） |
| `market_item_min_tier` | 3 | 装备上架最低 tier |
| `market_block_legendary` | true | V5 传奇装备（`legendary_set_id` 非空）禁挂总开关 |
| `market_ref_sample_min` | 5 | 参考价最小样本 |
| `market_ref_window_days` | 7 | 参考价滑动窗口 |

全部写入 `game_config` 或 env，热更新无需重启。

---

## 九、UI 交互细节

### 9.1 上架引导

```
右键背包中的装备 → [放入坊市]
  ↓
弹窗:
  ┌─────────────────────────────────────┐
  │ 挂售 · 太虚剑 (地品·+7)               │
  │                                      │
  │ 系统参考价: 12,000 灵石               │
  │ 允许区间: [3,600 ~ 36,000]            │
  │                                      │
  │ 单价: [___9500___] 灵石               │
  │       🟢 低于参考价 21%               │
  │                                      │
  │ 挂单有效期: 48 小时                   │
  │ 成交税率: 10%                         │
  │ 预计到账: 8,550 灵石                  │
  │                                      │
  │          [取消]    [确认上架]         │
  └─────────────────────────────────────┘
```

### 9.2 价格偏离配色

- `< ref * 0.7` → 🟢 性价比
- `ref * 0.7 ~ ref * 1.3` → ⚪ 合理
- `> ref * 1.3` → 🟡 偏贵
- `> ref * 2.0` → 🔴 高溢价（仍允许成交，但 UI 警示）

### 9.3 高价成交广播

```
【天机】青莲道君 于坊市以 1,200,000 灵石 购入【太虚剑·+9】，一时风头无两。
```
写入 `world_broadcast` 表，前端气泡推送。

### 9.4 我的挂单页

- Tab: 进行中 / 已成交 / 已过期 / 已下架
- 进行中 Tab 支持批量"下架"操作（仍按件扣下架费）
- 已成交 Tab 展示买家昵称、成交价、到账额、成交时间

---

## 十、开发阶段拆分

### 阶段一：最小可玩（MVP，预计 4-5 天）

- [ ] 表结构迁移（§6 全部表）
- [ ] 装备的挂单 / 购买 / 下架 / 过期闭环
- [ ] 参考价的基础价兜底（§5.3 基础价表手填）
- [ ] 邮件附件分发装备实例
- [ ] 基础 UI：坊市主页 + 我的挂单
- [ ] 账号准入（§4.3）+ 价格区间护栏（§3.2）+ 交易税（§3.3）
- [ ] 不做：广播 / 风控 / 参考价历史计算

### 阶段二：参考价 + 限额（预计 2 天）

- [ ] 历史参考价计算定时任务（§5.2）
- [ ] 下架费、挂单限额、每日成交额限制
- [ ] 我的挂单 / 成交记录页完整版

### 阶段三：安全与风控（预计 2-3 天）

- [ ] 设备指纹上报
- [ ] 风控规则（§4.5）
- [ ] `market_risk_log` + 事后复盘查询接口
- [ ] 高价成交广播

### 阶段四：体验打磨（预计 2 天）

- [ ] 性价比排序、价格偏离配色
- [ ] 搜索 / 筛选 / 收藏夹
- [ ] 策划后台：基础参考价热更新、税率热更新

### 远期扩展（不在本次排期）

- [ ] 功法残页 / 丹药 / 灵草等堆叠品的"散件市集"分区（需要先完善反工作室体系）
- [ ] 拍卖房（高价值装备走单独竞拍入口）

---

## 十一、风险与未决事项

### 11.1 已知风险

| 风险 | 缓解措施 |
|------|---------|
| **冷启动无参考价**：开服前期所有品类走 base_price，玩家感知不到区间 | 基础参考价表必须在开服前评审，避免 10 倍数量级偏差 |
| **装备归一化键粒度粗**：同品质同等级同槽位装备词条差异巨大，参考价失真 | 允许 3 倍上限 ceiling 让好词条装备溢价；门槛限定紫色+起步进一步缩小样本方差；后续可引入副词条加成分档 |
| **工作室多账号换设备换 IP 规避风控** | 阶段三接入行为指纹（挂单频次、价格分布异常） |
| **通缩**：税率过高玩家不愿交易 | 参数化税率，上线后 2 周看交易密度动态调 |
| **首日爆仓**：开服即有人挂高价骗参考价** | 开服前 7 天全部走 base_price，第 8 天起才启用历史均价 |

### 11.2 未决事项（等小夏拍）

1. **是否支持一口价+议价**？目前方案只支持一口价，拍卖/砍价需额外设计
2. **绑定逻辑落在哪**？建议在每张背包表加 `is_bound BOOLEAN DEFAULT FALSE`，掉落/合成时置 FALSE，宗门/任务奖励时置 TRUE
3. **高价值装备是否走拍卖房**？目前全走一口价，后期可考虑 > 参考价 10 倍的商品走单独竞拍入口

---

## 十二、测试清单

- [ ] 上架装备后背包消失，挂单列表出现
- [ ] 上架价低于下限 / 高于上限 被拒
- [ ] 买方扣灵石 = 挂单价，卖方邮件到账 = 挂单价 × 90%，差额进灵石黑洞
- [ ] 挂单 48 小时不动自动过期，邮件退回卖家
- [ ] 下架扣 5% 灵石，物品邮件退回
- [ ] 同 IP 双号购买被阻断
- [ ] 新号（< 1 天）访问坊市入口被拒
- [ ] 试图上架功法残页 / 丹药 / 灵草被前后端双重拒绝
- [ ] 试图上架蓝品（玄品）及以下品质装备被拒，错误码 `ITEM_BELOW_MARKET_THRESHOLD`
- [ ] 试图上架 tier < 3 的紫色装备被拒
- [ ] 试图上架 V5 传奇装备（`legendary_set_id` 非空）被拒，错误码 `ITEM_LEGENDARY_NOT_TRADABLE`
- [ ] 紫色 tier 3 装备可正常挂单成交
- [ ] 已穿戴中的装备无法上架
- [ ] 单角色当日买入 5 件 + 卖出 5 件后，第 11 件买卖均被拒（前端提示"今日交易件数已达上限"）
- [ ] 单角色同时挂单达到 30 件后，第 31 次上架被拒
- [ ] 高价成交触发广播
- [ ] 交易税率配置改为 0.15，新交易按新税率结算
- [ ] 参考价定时任务跑一次后，有足够样本的品类 `calc_method` 切为 `historical`
- [ ] 并发购买同一挂单只能成交一次（行锁生效）

---

> **最后一句**：坊市是经济系统，一旦上线就很难回滚（玩家资产已经通过它流转）。阶段一 MVP 上线前必须在测试服灌 500+ 挂单跑至少 3 天，观察灵石回收/产出比，再决定是否放开生产环境。
