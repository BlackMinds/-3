# 秘境组队系统 - 详细设计文档

> 版本：v1.0 | 日期：2026-04-14

---

## 一、系统概述

### 1.1 设计目标

万界仙途目前的社交玩法仅限于宗门体系（捐献、签到、Boss 顺序攻击），玩家之间缺乏**实时协作**体验。组队系统通过引入"秘境探索"玩法，让 2-4 名玩家组队挑战高难度副本，获取**独占奖励**，填补"宗门 Boss → 真正的多人协作"之间的体验空白。

### 1.2 核心定位

| 维度 | 定位 |
|------|------|
| 玩法类型 | PvE 协作副本（非 PvP） |
| 队伍规模 | 2-4 人 |
| 内容载体 | 秘境（Secret Realm）—— 限时、多波次、有 Boss 的特殊地图 |
| 与现有系统关系 | 补充宗门 Boss（宗门 Boss = 全服接力，秘境 = 小队协作） |
| 进入条件 | 境界 + 等级门槛，每日次数限制 |
| 核心吸引力 | 高品质装备（紫/金/红）高概率掉落、首通奖励、高倍经验、成就称号 |

---

## 二、队伍机制

### 2.1 队伍规模：2-4 人

**为什么不是更多？**

| 人数 | 优势 | 劣势 |
|------|------|------|
| 2 人 | 最容易匹配，低门槛 | 策略深度有限 |
| 3 人 | 平衡匹配与策略 | 奇数分配不均 |
| 4 人 | 策略丰富，角色分工明确 | 匹配难度高，服务端压力大 |
| 5+ 人 | — | 对放置修仙游戏过于复杂，匹配困难 |

**结论：最少 2 人可开启，满编 4 人。** 理由：
- 放置修仙的核心是轻量化，4 人上限保持轻松感
- 2 人即可开启降低匹配等待时间
- 4 人满编时可实现坦克/输出/辅助/控制的分工
- 与宗门 Boss 的大规模参与形成差异化

### 2.2 组队方式：公开大厅制

采用**公开大厅 + 一键加入**模式，取消房间号和快速匹配，让组队流程极简化。

#### A. 创建房间（队长视角）

```
秘境主页 → 选择秘境 → 选择难度 → 点击【创建房间】
                                ↓
                        房间立即出现在公开列表中
                                ↓
                        等待其他玩家加入（无需分享任何东西）
                                ↓
                        满员或队长手动发起 → 进入秘境
```

- 队长：创建者默认为队长，可踢人、调整设置、发起开始
- 房间自动进入公开列表，所有在线玩家都能看到
- 同一玩家同时只能在 1 个房间中
- 房间空闲超 10 分钟未满员也未开始 → 自动解散

#### B. 加入房间（其他玩家视角）

```
秘境主页 → 查看【组队大厅】列表
                ↓
    列表显示所有等待中的房间：
    ┌────────────────────────────────────────┐
    │ 房主道号 │ 秘境/难度 │ 人数 │ 操作    │
    │─────────────────────────────────────── │
    │ 剑无痕   │ SR-1 困难 │ 2/4  │ [加入]  │
    │ 清风月   │ SR-2 普通 │ 1/4  │ [加入]  │
    │ 白衣卿   │ SR-3 噩梦 │ 3/4  │ [加入]  │
    └────────────────────────────────────────┘
                ↓
    点击【加入】→ 自动进入房间 → 等待队长开始
```

- 列表按**创建时间倒序**排列（最新的在上）
- 支持**筛选**：按秘境类型、难度、只看可加入（未满员）
- 不满足条件的房间（境界 / 等级不够）显示为灰色，不可加入
- 列表自动轮询刷新（每 3 秒），也可手动下拉刷新

#### C. 宗门成员房间高亮

- 同宗门成员创建的房间在列表顶部**高亮显示**（金色描边）
- 加入同宗门成员的房间获得 **+10% 全属性**加成（鼓励宗门协作）

### 2.3 队伍状态机

```
[空闲] → 创建房间 → [等待中]
                        ↓ 全员准备 + 队长发起
                 （服务端一次性跑完战斗，数秒内返回结果）
                        ↓
                    [已结束] → 前端各自播放战斗日志 → [空闲]
```

> **关键理解**：组队战斗不是实时回合制。队长点【开始战斗】后，服务端一次性算完所有回合和波次，直接返回完整战斗日志和奖励（与现有单人 `/api/battle/fight` 一致）。前端只是逐条**播放日志做视觉演出**。

### 2.4 掉线与退出处理

因为战斗本身是一次 HTTP 请求的原子计算，**不存在"战斗中"这个持续状态**，掉线处理大大简化：

| 场景 | 处理方式 |
|------|---------|
| 等待阶段退出 | 正常离队，无惩罚 |
| 等待阶段掉线 | 前端心跳（2 秒轮询房间）连续 3 次失败 → 服务端自动将该玩家移出房间 |
| 队长等待阶段掉线 | 移出队长后，自动提升剩余玩家中等级最高者为新队长 |
| 战斗请求中掉线 | 服务端照常跑完战斗 + 入库；玩家重新登录后进入秘境历史能看到奖励和日志 |
| 播放日志时掉线 | 奖励早已入库，无任何影响；重新登录可正常游戏（可选：允许查看"未读战斗回放"） |

**没有"逃跑"概念**——因为点击开始后战斗就已经完成，无法逃跑。
**没有"AI 托管"**——战斗是服务端计算的，所有玩家都是 AI（用已装备功法自动战斗）。

---

## 三、秘境设计

### 3.1 秘境概览

秘境是组队系统的专属战斗地图，分为 **6 个大秘境**，每个秘境有 **3 个难度**。

| 秘境 | 代号 | 境界要求 | 等级要求 | 元素主题 | 背景设定 |
|------|------|---------|---------|---------|---------|
| 灵草谷 | SR-1 | 筑基 | Lv.15 | 木 | 灵草异变，妖兽横行 |
| 烈焰窟 | SR-2 | 金丹 | Lv.40 | 火 | 上古炼器遗址，火灵暴走 |
| 幽冥渊 | SR-3 | 元婴 | Lv.65 | 水 | 深海秘境，魂魄侵蚀 |
| 天雷域 | SR-4 | 化神 | Lv.100 | 金 | 天雷禁地，劫雷不断 |
| 混沌界 | SR-5 | 渡劫 | Lv.150 | 无 | 混沌之力，万法皆空 |
| 太虚秘境 | SR-6 | 大乘 | Lv.185 | 全 | 飞升试炼，五行轮转 |

### 3.2 难度分级

每个秘境有 3 个难度，影响怪物数值、波次数量和奖励倍率：

| 难度 | 怪物战力倍率 | 波次数 | Boss 数 | 回合上限 | 奖励倍率 | 推荐人数 |
|------|------------|--------|---------|---------|---------|---------|
| 普通 | 1.0x | 3 波 | 1 | 40 | 1.0x | 2 人即可 |
| 困难 | 1.8x | 5 波 | 2 | 50 | 2.0x | 3 人推荐 |
| 噩梦 | 3.0x | 7 波 | 3 | 60 | 3.5x | 4 人满编推荐 |

### 3.3 秘境战斗流程

```
进入秘境
  ↓
[第 1 波] 小怪群（3-6 只）
  ↓ 全灭后自动进入下一波，全队 HP 恢复 20%
[第 2 波] 精英怪（2-3 只，有特殊技能）
  ↓
[第 3 波] Boss（1 只，多阶段机制）   ← 普通难度到此结束
  ↓
[第 4 波] 增援小怪 + 精英
  ↓
[第 5 波] 双 Boss（2 只联合作战）   ← 困难难度到此结束
  ↓
[第 6 波] 精英群（4-5 只精英）
  ↓
[第 7 波] 终极 Boss（1 只，三阶段变身） ← 噩梦难度到此结束
```

### 3.4 秘境怪物特殊机制

普通地图的怪物只有基础 AI，秘境怪物引入 **团队机制**：

| 机制名 | 说明 | 出现难度 |
|--------|------|---------|
| 群体攻击 | Boss 技能同时打全队所有人 | 普通+ |
| 仇恨锁定 | Boss 优先攻击当前伤害最高的玩家 | 普通+ |
| 狂暴计时 | Boss 存活超过一定回合后进入狂暴，全属性 +50% | 困难+ |
| 阶段变身 | Boss 在 HP 降至 60%/30% 时变身，改变元素属性和技能组 | 噩梦 |
| 元素共鸣 | 队伍中 2 人以上同元素灵根，该元素伤害 +15% | 全部（被动奖励） |

### 3.5 秘境 Boss 数值参考

以 SR-1 灵草谷为例（基础战力参考 T3 地图怪物）：

| 属性 | 普通 Boss | 困难 Boss | 噩梦终极 Boss |
|------|----------|----------|-------------|
| HP | 50,000 | 180,000 | 600,000 |
| ATK | 300 | 540 | 900 |
| DEF | 150 | 270 | 450 |
| SPD | 80 | 100 | 130 |
| 特殊技能 | 1 个 | 2 个 | 4 个（含变身后新技能） |

> 后续秘境按境界阶梯式增长，SR-6 噩梦 Boss HP 可达 20 亿级别。

---

## 四、战斗机制

### 4.1 多人战斗引擎扩展

现有战斗引擎是 1v多（单玩家 vs 多怪物），组队需扩展为 **多v多**：

```
现有:  Player(1) ←→ Monsters(1-5)
扩展:  Players(2-4) ←→ Monsters(3-8)
```

**回合顺序：** 所有角色（玩家 + 怪物）按 SPD 排序，依次行动。SPD 相同时玩家优先。

**目标选择（AI 自动）：**
- 主修技能：攻击 HP 百分比最低的怪物（集火策略）
- 神通技能（AOE）：自动对全体敌人释放
- 神通技能（单体）：攻击 Boss 或 HP 最高的怪物
- 治疗技能：治疗 HP 百分比最低的队友
- 怪物攻击：优先打击**当前累计伤害最高的玩家**（吸引仇恨的核心机制）；Boss AOE 技能无差别攻击全体

### 4.2 队伍 Buff

组队阶段的"阵容搭配"激励，鼓励玩家合理组队：

| 效果 | 触发条件 | 说明 |
|------|---------|------|
| 元素共鸣 | 2+ 人同灵根 | 该元素伤害 +15% |
| 全元素阵 | 队伍 2+ 人、且覆盖 3 种以上不同灵根 | 全队全属性 +5% |
| 宗门之力 | 全队同宗门 | 全队全属性 +10%，经验 +15% |

> 这些 Buff 在战斗开始时由服务端根据队伍组成一次性计算，整场战斗生效。玩家在组队阶段就能看到当前激活的队伍 Buff。

### 4.3 死亡与失败

以下规则由**服务端战斗引擎**在一次性计算过程中自动应用：

| 情况 | 结果 |
|------|------|
| 单人被击杀 | 该角色 HP=0，后续回合不行动 |
| 全队被击杀 | 秘境失败，按已通过波次给予部分奖励（30%） |
| 回合耗尽（未击杀所有怪物） | 秘境失败，同上 |
| 通关成功（所有波次清光） | 全额奖励 + 通关评分加成 |

### 4.4 通关评分

**通关成功**时根据表现给出 S/A/B 评分，影响奖励倍率：

| 评分 | 条件 | 奖励加成 |
|------|------|---------|
| S | 全员存活 + 回合数 < 上限的 50% | +50% |
| A | 全员存活 + 回合数 < 上限的 70% | +25% |
| B | 通关成功（允许有人倒地） | +0% |

> 战斗失败按 4.3 规则给 30% 奖励，不参与评分。

---

## 五、奖励系统

### 5.1 奖励设计原则

1. **不能替代日常刷图** —— 秘境有次数限制，是"锦上添花"而非"必须做"
2. **要有独占物品** —— 给玩家组队的动力，而非只是"多人刷一样的图"
3. **按贡献分配** —— 避免挂机蹭车，鼓励积极参与
4. **保底机制** —— 即使运气差也不白跑

### 5.2 奖励总览

| 奖励类型 | 说明 | 分配方式 |
|----------|------|---------|
| 灵石 | 基础灵石奖励 | 均分 + 贡献加成 |
| 经验 | 修炼经验 + 等级经验 | 每人独立获取（不分摊） |
| 秘境积分 | 组队专属货币 | 按贡献比例分配 |
| **高品质装备** | 绿~红装备（品质权重向高阶倾斜） | 按贡献加权分配，每人保底 1 件 |
| **Boss 保底装备** | 难度越高保底品质越高（紫/金/红） | 贡献最高者优先 |
| 秘境灵草 | 稀有灵草（分品质） | 均分 |
| 首通奖励 | 秘境积分/宝箱/称号（详见 5.7） | 全队每人首通获得 |

### 5.3 灵石奖励

```
基础灵石 = 对应 T 级地图单波灵石 × 波次数 × 难度倍率 × 1.5（组队加成）

个人灵石 = 基础灵石 × (0.4 + 0.6 × 个人贡献占比)
```

示例（SR-1 灵草谷，普通难度，4 人队伍）：
- 基础灵石 = T3 级灵石(~500) × 3 波 × 1.0 × 1.5 = 2,250
- 如果你贡献 40%：个人灵石 = 2,250 × (0.4 + 0.6 × 0.4) = 2,250 × 0.64 = 1,440
- 如果你贡献 10%：个人灵石 = 2,250 × (0.4 + 0.6 × 0.1) = 2,250 × 0.46 = 1,035

> 保底 40%：即使贡献最低也能拿到基础的 40%，防止完全白跑。

### 5.4 经验奖励

```
个人经验 = 对应 T 级地图经验 × 波次数 × 难度倍率 × 1.2（组队加成）
```

- 经验**不分摊**，每人独立全额获取（鼓励组队，不让人觉得组队反而亏）
- 1.2x 组队加成使组队经验效率略高于单刷

### 5.5 秘境积分（专属货币）

这是组队系统的核心货币，只能通过秘境获取：

**获取量：**

| 秘境 | 普通 | 困难 | 噩梦 |
|------|------|------|------|
| SR-1 灵草谷 | 100 | 250 | 500 |
| SR-2 烈焰窟 | 200 | 500 | 1,000 |
| SR-3 幽冥渊 | 350 | 875 | 1,750 |
| SR-4 天雷域 | 600 | 1,500 | 3,000 |
| SR-5 混沌界 | 1,000 | 2,500 | 5,000 |
| SR-6 太虚秘境 | 1,800 | 4,500 | 9,000 |

> 以上为满贡献值，实际按 `0.4 + 0.6 × 贡献占比` 计算。
> 评分加成叠加：S 级 = ×1.5，A 级 = ×1.25。

**秘境积分商店（核心兑换）：**

| 物品 | 积分 | 周限购 | 说明 |
|------|------|--------|------|
| 紫色装备宝箱 | 2,000 | 3 | 必出紫色品质随机装备（对应当前境界 T 级） |
| 金色装备宝箱 | 8,000 | 1 | 必出金色品质随机装备（对应当前境界 T 级） |
| 红色装备宝箱 | 25,000 | 1 | 必出红色品质随机装备（需飞升境界解锁） |
| 太古精魂 | 30,000 | 2 | 装备升品材料（现有系统） |
| 鉴定符 | 10,500 | 5 | 装备副属性重随（现有系统） |
| 万能残页 | 12,500 | 2 | 功法升级材料（现有系统） |
| 道果结晶 | 15,000 | 1 | 永久属性加成（现有系统） |
| 灵草种子·仙品 | 8,000 | 1 | 最高品质灵草种子 |
| 秘境入场券 | 1,000 | 2 | 额外 1 次每日秘境次数（每日上限 +2） |

### 5.6 装备掉落（核心奖励）

秘境的核心吸引力：**更高概率、更高品质的装备掉落**。

#### 5.6.1 对比现有普通刷图

现有普通刷图的装备品质权重（以 T3 为例）：

| 白 | 绿 | 蓝 | 紫 | 金 | 红 |
|----|----|----|----|----|----|
| 45% | 35% | 15% | 4% | 1% | 0% |

玩家想要一件紫色装备，平均要刷 ~25 次。金色 ~100 次。红色基本刷不到。

#### 5.6.2 秘境装备掉落规则

秘境的品质权重**整体向高品质上移**，且**数量更多**：

| 难度 | 白 | 绿 | 蓝 | 紫 | 金 | 红 | 每场期望掉落数 |
|------|----|----|----|----|----|----|--------------|
| 普通 | 0% | 40% | 35% | 20% | 5% | 0% | 2-3 件 |
| 困难 | 0% | 10% | 40% | 35% | 13% | 2% | 3-4 件 |
| 噩梦 | 0% | 0% | 20% | 45% | 27% | 8% | 4-6 件 |

**关键特性：**
- **不再掉白装**（基础档就是绿装起步）
- **数量叠加**：普通刷图 1 件/场，秘境 2-6 件/场，效率翻倍
- **品质显著上移**：噩梦难度 80% 概率出紫色+，8% 出红色（普通刷图几乎不可能）

#### 5.6.3 Boss 保底机制

除了波次掉落，**Boss 击杀额外保底掉落**，让玩家不空手：

| 难度 | Boss 保底品质 | Boss 额外掉落数 |
|------|-------------|---------------|
| 普通 | **紫色保底** | +1 件 |
| 困难 | **金色保底** | +1 件 |
| 噩梦 | **金色保底，20% 概率升红** | +2 件 |

> 例：噩梦难度 3 只 Boss，**至少保底获得 6 件金色装备**（未算运气升红）。

#### 5.6.4 装备等级（T 级）匹配

掉落装备的 T 级对应秘境要求境界，而非玩家当前境界：

| 秘境 | 装备 T 级 | 需要等级 |
|------|---------|---------|
| SR-1 灵草谷 | T2 (绿~紫) | Lv.15+ |
| SR-2 烈焰窟 | T4 (蓝~金) | Lv.55+ |
| SR-3 幽冥渊 | T5 (蓝~金) | Lv.80+ |
| SR-4 天雷域 | T7 (紫~红) | Lv.140+ |
| SR-5 混沌界 | T9 (紫~红) | Lv.185+ |
| SR-6 太虚秘境 | T10 (金~红) | Lv.195+ |

> 鼓励玩家挑战更高级别秘境换取更顶级装备。

#### 5.6.5 装备分配规则

掉落的装备按队伍贡献度分配：

```
1. 每件装备按贡献度加权随机分配给某位队员
   - 贡献最高者权重 ×1.5
   - 贡献最低者权重 ×1.0（不惩罚）
   
2. 优先级：品质越高越倾向于分配给贡献最高者
   - 红色装备：100% 给贡献第一
   - 金色装备：贡献第一权重 ×2.0
   - 紫色及以下：加权随机
   
3. 保底机制：每位队员每场至少获得 1 件装备（即便贡献最低）
```

#### 5.6.6 与现有系统的兼容性

- 装备表沿用现有 `character_equipment`，**无需新增字段**
- 副属性、强化、升品、出售等功能**完全复用现有系统**
- 秘境掉落标记在 `source` 字段（可选），用于成就检测

### 5.7 首通奖励

每个玩家**首次通关**某个秘境的某个难度时，获得一次性大额奖励：

| 难度 | 首通奖励 |
|------|---------|
| 普通 | 秘境积分 ×（通关量 × 2）+ 成就进度 +1 |
| 困难 | 秘境积分 ×（通关量 × 2.5）+ 紫色装备宝箱 ×1 |
| 噩梦 | 秘境积分 ×（通关量 × 3）+ 金色装备宝箱 ×1 + 专属称号 |

> 称号例：SR-1 噩梦首通 →「灵草谷之主」；SR-6 噩梦首通 →「太虚征服者」。
> 首通记录存于 `secret_realm_clears` 表，`ON CONFLICT DO NOTHING` 保证只触发一次。

---

## 六、每日限制与进入条件

### 6.1 每日次数

| 境界 | 每日免费次数 | 说明 |
|------|------------|------|
| 筑基~金丹 | 2 次 | 入门阶段 |
| 元婴~化神 | 3 次 | 中期提升 |
| 渡劫~大乘 | 4 次 | 后期玩家 |
| 飞升 | 5 次 | 满级特权 |

- 额外次数可通过**秘境入场券**增加（积分商店购买，每日上限 +2 次）
- 宗门等级 5+ 额外 +1 次/天
- 次数每日 00:00 重置（与现有 cron/daily-reset 同步）

### 6.2 进入条件

```
条件 1: 境界 ≥ 秘境要求境界
条件 2: 等级 ≥ 秘境要求等级
条件 3: 今日剩余次数 > 0
条件 4: 不在离线挂机状态
条件 5: 不在闭关修炼状态
```

---

## 七、贡献度计算

贡献度决定奖励分配，是秘境系统的公平性核心：

### 7.1 贡献度来源

```typescript
interface ContributionSources {
  damage: number;       // 造成的总伤害（权重 60%）—— 输出职责
  healing: number;      // 治疗总量（权重 25%）—— 奶妈职责
  tankDamage: number;   // 承受的总伤害（权重 15%）—— 坦克职责
}
```

三个维度覆盖三种职责（DPS / 治疗 / 坦克），让不同定位的玩家都能凭贡献拿奖励。

### 7.2 计算公式

```
个人贡献分 = 
    damage / totalTeamDamage × 60
  + healing / totalTeamHealing × 25
  + tankDamage / totalTeamTankDamage × 15

个人贡献占比 = 个人贡献分 / 队伍总贡献分
```

> 如果某一维度全队为 0（如无人治疗），则该维度权重均分给其他维度。

### 7.3 "空挂机"防护

战斗本身是服务端 AI 自动跑完，玩家在战斗中无需操作。真正需要防范的是"等待阶段挂机占位"：

- 加入房间后超过 5 分钟未准备 → 队长可直接踢出
- 房间创建超过 10 分钟未开始战斗 → 服务端自动解散
- 单玩家每小时最多创建 5 个房间（防刷）

> 因此**不需要战斗内反挂机机制**——战斗是 AI 全自动的，玩家贡献度由其装备/功法/境界决定，这本身就是公平的竞争。

---

## 八、数据库设计

### 8.1 新增表

```sql
-- ==================== 秘境组队系统 ====================

-- 1. 队伍/房间表
CREATE TABLE IF NOT EXISTS team_rooms (
    id              SERIAL PRIMARY KEY,
    leader_id       INTEGER NOT NULL REFERENCES characters(id),
    secret_realm_id VARCHAR(10) NOT NULL,             -- SR-1 ~ SR-6
    difficulty      SMALLINT NOT NULL DEFAULT 1,      -- 1=普通, 2=困难, 3=噩梦
    status          VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting/ready/fighting/finished
    max_members     SMALLINT NOT NULL DEFAULT 4,
    current_members SMALLINT NOT NULL DEFAULT 1,      -- 冗余字段，加速大厅列表查询
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ
);

CREATE INDEX idx_team_rooms_status ON team_rooms(status);
-- 大厅列表查询：按秘境/难度筛选 + 状态等待 + 创建时间倒序
CREATE INDEX idx_team_rooms_lobby ON team_rooms(status, secret_realm_id, difficulty, created_at DESC)
    WHERE status = 'waiting';

-- 2. 队伍成员表
CREATE TABLE IF NOT EXISTS team_members (
    id              SERIAL PRIMARY KEY,
    room_id         INTEGER NOT NULL REFERENCES team_rooms(id) ON DELETE CASCADE,
    character_id    INTEGER NOT NULL REFERENCES characters(id),
    is_ready        BOOLEAN NOT NULL DEFAULT FALSE,
    is_leader       BOOLEAN NOT NULL DEFAULT FALSE,
    join_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active（预留字段，目前仅 active 状态）
    UNIQUE(room_id, character_id)
);

CREATE INDEX idx_team_members_char ON team_members(character_id);
CREATE INDEX idx_team_members_room ON team_members(room_id);

-- 3. 秘境战斗记录表
CREATE TABLE IF NOT EXISTS secret_realm_battles (
    id              SERIAL PRIMARY KEY,
    room_id         INTEGER NOT NULL REFERENCES team_rooms(id),
    secret_realm_id VARCHAR(10) NOT NULL,
    difficulty      SMALLINT NOT NULL,
    result          VARCHAR(10),                     -- victory/defeat
    waves_cleared   SMALLINT NOT NULL DEFAULT 0,
    total_turns     INTEGER NOT NULL DEFAULT 0,
    rating          CHAR(1),                         -- S/A/B/C
    battle_log      JSONB,                           -- 完整战斗日志
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ
);

CREATE INDEX idx_srb_room ON secret_realm_battles(room_id);

-- 4. 秘境个人贡献表
CREATE TABLE IF NOT EXISTS secret_realm_contributions (
    id              SERIAL PRIMARY KEY,
    battle_id       INTEGER NOT NULL REFERENCES secret_realm_battles(id) ON DELETE CASCADE,
    character_id    INTEGER NOT NULL REFERENCES characters(id),
    damage_dealt    BIGINT NOT NULL DEFAULT 0,
    healing_done    BIGINT NOT NULL DEFAULT 0,
    damage_taken    BIGINT NOT NULL DEFAULT 0,
    contribution    REAL NOT NULL DEFAULT 0,          -- 最终贡献占比 0-1
    UNIQUE(battle_id, character_id)
);

CREATE INDEX idx_src_char ON secret_realm_contributions(character_id);

-- 5. 秘境奖励领取记录
CREATE TABLE IF NOT EXISTS secret_realm_rewards (
    id              SERIAL PRIMARY KEY,
    battle_id       INTEGER NOT NULL REFERENCES secret_realm_battles(id) ON DELETE CASCADE,
    character_id    INTEGER NOT NULL REFERENCES characters(id),
    spirit_stone    BIGINT NOT NULL DEFAULT 0,
    exp_gained      BIGINT NOT NULL DEFAULT 0,
    level_exp       BIGINT NOT NULL DEFAULT 0,
    realm_points    INTEGER NOT NULL DEFAULT 0,       -- 秘境积分
    equipment_ids   JSONB,                            -- 获得的装备 ID 数组（已入 character_equipment 表）
    extra_drops     JSONB,                            -- 其他掉落 [{ type, id, quantity }]
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(battle_id, character_id)
);

-- 6. 秘境积分与每日次数
ALTER TABLE characters ADD COLUMN IF NOT EXISTS realm_points      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sr_daily_count    SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sr_daily_date     DATE;

-- 7. 秘境通关记录（用于首通奖励判断）
CREATE TABLE IF NOT EXISTS secret_realm_clears (
    id              SERIAL PRIMARY KEY,
    character_id    INTEGER NOT NULL REFERENCES characters(id),
    secret_realm_id VARCHAR(10) NOT NULL,
    difficulty      SMALLINT NOT NULL,
    first_clear_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    best_rating     CHAR(1),
    clear_count     INTEGER NOT NULL DEFAULT 1,
    UNIQUE(character_id, secret_realm_id, difficulty)
);

CREATE INDEX idx_src_clear_char ON secret_realm_clears(character_id);

-- 8. 秘境积分商店购买记录
CREATE TABLE IF NOT EXISTS realm_shop_purchases (
    id              SERIAL PRIMARY KEY,
    character_id    INTEGER NOT NULL REFERENCES characters(id),
    item_id         VARCHAR(30) NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1,
    cost            INTEGER NOT NULL,
    purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    week_number     INTEGER NOT NULL                  -- 年内周数，用于周限购
);

CREATE INDEX idx_rsp_char_week ON realm_shop_purchases(character_id, week_number);
```

### 8.2 数据关系图

```
team_rooms (1) ←── (N) team_members
     │
     ↓ (1)
secret_realm_battles (1) ←── (N) secret_realm_contributions
                    (1) ←── (N) secret_realm_rewards

characters (1) ←── (N) secret_realm_clears
           (1) ←── (N) realm_shop_purchases
           (1) ←── (N) character_equipment  ←（秘境装备直接入此表，复用现有系统）
```

---

## 九、API 设计

### 9.1 接口总览

| 方法 | 路径 | 说明 |
|------|------|------|
| **房间管理** | | |
| GET | /api/team/rooms | 获取组队大厅房间列表（支持筛选） |
| POST | /api/team/create | 创建房间 |
| GET | /api/team/room/:id | 查询单个房间详情（含成员列表） |
| POST | /api/team/join | 加入房间（传入 room_id） |
| POST | /api/team/leave | 离开房间 |
| POST | /api/team/kick | 踢出成员（队长） |
| POST | /api/team/ready | 切换准备状态 |
| POST | /api/team/start | 发起战斗（队长） |
| **秘境战斗** | | |
| POST | /api/team/battle/fight | 执行秘境战斗（服务端全量计算） |
| GET | /api/team/battle/result/:id | 查询战斗结果与奖励 |
| **秘境信息** | | |
| GET | /api/team/realms | 秘境列表（含解锁状态） |
| GET | /api/team/history | 个人秘境战斗历史 |
| GET | /api/team/clears | 通关记录 |
| **积分商店** | | |
| GET | /api/team/shop/list | 积分商店物品列表 |
| POST | /api/team/shop/buy | 购买物品（装备宝箱会直接生成装备入背包） |

> 共计 **15 个端点**，新增至现有 93 个端点之上，总计 108 个。

### 9.2 关键接口详细设计

#### GET /api/team/rooms（组队大厅）

```typescript
// Query 参数（全部可选）
{
  secret_realm_id?: string;   // 筛选某个秘境
  difficulty?: 1 | 2 | 3;     // 筛选难度
  only_available?: boolean;   // 只看未满员的
  only_eligible?: boolean;    // 只看自己能加入的（境界/等级满足）
}

// Response
{
  success: true,
  rooms: [
    {
      room_id: 12345,
      secret_realm_id: "SR-1",
      secret_realm_name: "灵草谷",
      difficulty: 2,
      difficulty_name: "困难",
      leader: {
        id: 88,
        name: "剑无痕",
        realm: "金丹中期",
        level: 42,
        sect_id: 5,
        sect_name: "剑心宗"
      },
      current_members: 2,
      max_members: 4,
      is_same_sect: true,       // 当前玩家与队长是否同宗门
      is_eligible: true,        // 当前玩家是否可加入（境界/等级）
      created_at: "2026-04-14T10:23:15Z"
    },
    ...
  ]
}
```

**排序规则：**
1. 同宗门队长的房间置顶
2. 按创建时间倒序（最新创建的在前）
3. 已满员的房间排在后面

**默认过滤：** 已开始战斗（`status=fighting`）和已结束（`status=finished`）的房间不返回。

#### POST /api/team/create

```typescript
// Request
{
  secret_realm_id: string;  // "SR-1" ~ "SR-6"
  difficulty: 1 | 2 | 3;
}

// Response
{
  success: true,
  room: {
    room_id: 12345,
    secret_realm_id: "SR-1",
    difficulty: 1,
    leader: { id, name, realm, level },
    members: [...],
    status: "waiting"
  }
}
```

**服务端校验：**
- 玩家不在其他房间中
- 境界 / 等级满足秘境要求
- 今日剩余次数 > 0
- 不在离线挂机 / 闭关状态

#### POST /api/team/join

```typescript
// Request
{
  room_id: number;  // 从大厅列表点击加入时传入
}

// Response
{
  success: true,
  room: { ... 同 create 的 room 结构 ... }
}
```

**服务端校验：**
- 房间存在且 `status = 'waiting'`
- 房间未满员（`current_members < max_members`）
- 玩家境界 / 等级满足秘境要求
- 玩家不在其他房间中
- 今日剩余次数 > 0

> 使用事务 + 行级锁避免并发加入导致超员：
> `SELECT ... FROM team_rooms WHERE id = $1 FOR UPDATE;`

#### POST /api/team/battle/fight

```typescript
// Request（由队长触发，服务端读取全队数据）
{
  room_id: number;
}

// Response
{
  success: true,
  battle: {
    id: number,
    result: "victory" | "defeat",
    waves_cleared: number,
    total_turns: number,
    rating: "S" | "A" | "B" | "C",
    log: BattleLogEntry[],      // 完整战斗日志
    contributions: [{
      character_id: number,
      name: string,
      damage_dealt: number,
      healing_done: number,
      damage_taken: number,
      contribution: number      // 0-1 百分比
    }],
    rewards: [{
      character_id: number,
      spirit_stone: number,
      exp_gained: number,
      realm_points: number,
      equipment: [{ id, name, slot, rarity, tier, primary_stat, sub_stats }], // 新获得装备列表
      extra_drops: [...]
    }]
  }
}
```

**服务端流程：**
1. 校验房间状态 = ready，全员已准备
2. 扣除全队每日次数
3. 加载全队角色数据（属性 + 装备 + 功法 + Buff + 洞府 + 宗门加成）
4. 应用队伍 Buff（元素共鸣 / 宗门之力等）
5. 生成秘境怪物（按波次）
6. 执行多人战斗引擎（扩展版 battleEngine）
7. 计算贡献度
8. 计算奖励分配
9. 入库（战斗记录 + 贡献 + 奖励 + 更新角色数据）
10. 返回完整结果

---

## 十、前端设计

### 10.1 新增 UI 入口

在现有 6 标签页基础上，**在"历练"标签页内新增"秘境组队"按钮**（而非增加第 7 个标签页），保持界面简洁。

```
历练标签页
├── [普通历练]  ← 现有功能
├── [离线挂机]  ← 现有功能
└── [秘境组队]  ← 新增入口，点击打开秘境弹窗
```

### 10.2 秘境弹窗 UI 流程

```
秘境主页（弹窗）
├── 顶部：今日剩余次数 / 我的积分 / 最高通关记录
├── 中部 Tab 切换：
│   ├── [组队大厅]  ← 默认，显示所有等待中的房间列表
│   │   └── 筛选栏 + 房间卡片列表 + [加入]按钮
│   ├── [秘境介绍] ← 6 个秘境卡片，显示解锁状态与今日通关记录
│   └── [积分商店]
├── 右上角悬浮：[+ 创建房间] 按钮
│   └── 点击 → 弹窗：选择秘境 → 选择难度 → 确认 → 进入房间等待页
│
└── 如果当前已在某个房间 → 顶部横幅提示"你当前在【xxx】房间" [返回房间]

组队大厅（默认显示）
┌──────────────────────────────────────────────────────┐
│ 筛选：[秘境▾] [难度▾] ☑仅显示可加入  [↻刷新]        │
├──────────────────────────────────────────────────────┤
│ ✨ 剑无痕 (同宗门)   SR-1 困难  2/4  金丹中期         │
│                                       [加入]         │
├──────────────────────────────────────────────────────┤
│ 清风月              SR-2 普通  1/4  筑基后期          │
│                                       [加入]         │
├──────────────────────────────────────────────────────┤
│ 🔒 白衣卿  SR-6 噩梦  3/4  (境界不足)                │
│                                       [不可加入]     │
└──────────────────────────────────────────────────────┘

房间等待页
├── 秘境信息横幅（名称/难度/境界要求）
├── 队伍成员列表（4 格，空位显示"等待加入..."）
│   ├── 头像 / 道号 / 境界 / 等级 / 灵根 / 准备状态
│   └── 队长显示👑图标
├── [准备/取消准备] 按钮
├── [开始战斗] 按钮（仅队长可见，全员准备后点亮）
├── [踢出成员] 按钮（仅队长，成员头像长按）
└── [离开房间] 按钮

战斗进行页
├── 顶部：波次进度条（第 X/Y 波）
├── 左侧：队友 HP 条列表（2-4 人）
├── 右侧：怪物 HP 条列表
├── 中央：战斗日志（逐条播放）
└── 底部：当前回合信息

结算页
├── 通关评分（S/A/B 大字显示；失败时显示"秘境失败"）
├── 贡献度排行（每人的伤害/治疗/承伤）
├── 奖励列表（每人获得的物品）
└── [返回组队大厅]
```

### 10.2.1 装备宝箱购买流程

```
秘境主页 → [积分商店]
    ↓
积分商店列表
    └── [紫色装备宝箱] 2,000 积分  [周限购 3/3]
    └── [金色装备宝箱] 8,000 积分  [周限购 1/1]
    └── [红色装备宝箱] 25,000 积分 [周限购 1/1]
            ↓ 点击购买
    购买确认弹窗
    ├── "消耗 2,000 秘境积分，必出紫色品质随机装备？"
    ├── [取消]  [确认]
            ↓ 确认
    开箱动画（1-2 秒闪光特效，品质越高特效越炫酷）
            ↓
    结果弹窗
    ├── "获得【紫色·法袍】"
    ├── 显示主属性、副属性列表
    ├── [继续购买]  [查看装备背包]
            ↓ 自动入库至 character_equipment 表
    装备直接进入角色背包
```

**宝箱规则：**
- **槽位随机**：武器/法袍/法冠/步云靴/法宝/灵戒/灵佩 中随机一个槽位
- **品质保底**：紫色宝箱保底紫色，金色宝箱保底金色，红色宝箱保底红色（不会掉级）
- **T 级匹配玩家境界**：按玩家当前境界自动匹配装备 T 级，避免出到过低或过高
- **副属性数量按品质**：紫 3 条 / 金 4 条 / 红 4 条（复用现有规则）
- **副属性随机**：从 14 种副属性池中随机挑选，具体数值按现有公式

### 10.2.2 战斗后装备展示

秘境战斗结算页直接展示本场掉落的装备：

```
结算页 → 奖励列表
┌─────────────────────────────────────┐
│  【你的奖励】                        │
│  ─────────────────────────          │
│  灵石 ×1,440                         │
│  修为 ×5,000                         │
│  秘境积分 ×180                       │
│                                       │
│  装备掉落（3 件）：                  │
│  ┌─────────────────────────────┐    │
│  │ 🟣 紫色·法袍（T3）           │    │
│  │    DEF 主属性 + 副属性×3     │    │
│  │    [查看详情] [直接穿戴]     │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 🟡 金色·灵戒（T3）（Boss保底）│    │
│  │    ...                       │    │
│  └─────────────────────────────┘    │
│                                       │
│  [返回秘境大厅]  [查看装备背包]      │
└─────────────────────────────────────┘
```

**特点：**
- 装备直接进入现有 `character_equipment` 表
- 结算页可**直接点"穿戴"**，体验流畅
- 不穿戴的装备可在角色标签页 → 装备背包正常管理
- **无需新增装备管理界面**，完全复用现有系统

### 10.3 前端状态管理

在 `stores/` 下新增 `team.ts`：

```typescript
// stores/team.ts - 组队状态管理
interface TeamState {
  // 房间状态
  currentRoom: TeamRoom | null;      // 当前所在房间（未加入则为 null）
  lobbyRooms: TeamRoom[];            // 大厅房间列表
  lobbyFilter: {                     // 大厅筛选条件
    secret_realm_id: string | null;
    difficulty: 1 | 2 | 3 | null;
    only_available: boolean;
  };

  // 战斗状态
  battleResult: SecretRealmBattleResult | null;
  battleLog: BattleLogEntry[];
  currentWave: number;
  totalWaves: number;

  // 个人数据
  realmPoints: number;         // 秘境积分
  dailyCount: number;          // 今日已用次数
  dailyMax: number;            // 今日最大次数
  clears: RealmClearRecord[];  // 通关记录
}
```

---

## 十一、与现有系统的集成

### 11.1 战斗引擎扩展

现有 `server/engine/battleEngine.ts` 需要扩展：

| 现有 | 扩展 |
|------|------|
| `players: [1人]` | `players: [1-4人]` |
| 回合：玩家→怪物 | 回合：按 SPD 排序所有单位 |
| 怪物目标：固定打玩家 | 怪物目标：当前伤害最高的玩家 |
| 无队伍 Buff | 战斗开始前一次性计算队伍 Buff（元素共鸣/全元素阵/宗门之力） |
| 奖励直接入库 | 奖励按贡献分配后入库 |

建议：新建 `server/engine/teamBattleEngine.ts`，继承并扩展现有战斗引擎，而非修改原文件（保持单人战斗稳定性）。

### 11.2 成就系统扩展

新增 **秘境成就分类**（约 12 个）：

| 成就 | 条件 | 奖励 |
|------|------|------|
| 初探秘境 | 首次通关任意秘境 | 秘境积分 ×200 |
| 秘境老手 | 通关 50 次秘境 | 称号"秘境探索者" |
| 秘境大师 | 通关 200 次秘境 | 称号"秘境征服者" |
| 完美配合 | 获得 S 评分 10 次 | 秘境积分 ×1,000 |
| 独当一面 | 单次秘境贡献占比 > 60% | 秘境积分 ×500 |
| 守护之心 | 单次秘境承受伤害 > 50% | 称号"不动如山" |
| 仁心妙手 | 单次秘境治疗量 > 全队伤害 30% | 称号"妙手回春" |
| 全境通关 | 6 个秘境全部普通通关 | 秘境积分 ×3,000 |
| 噩梦征服 | 6 个秘境全部噩梦通关 | 称号"万界无双" + 专属头像框 |
| 红装猎手 | 从秘境掉落获得 1 件红色装备 | 秘境积分 ×2,000 |
| 金装大佬 | 从秘境累计获得 20 件金色+ 装备 | 称号"装备大师" |
| 团队之星 | 累计组队 500 次 | 永久秘境次数 +1/天 |

### 11.3 排行榜扩展

新增排行接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/ranking/realm-clear | 秘境通关数排行 |
| GET | /api/ranking/realm-rating | 秘境 S 评分数排行 |

### 11.4 定时任务扩展

| 路径 | 频率 | 说明 |
|------|------|------|
| POST | /api/cron/team-cleanup | 每 5 分钟 | 清理超时房间（创建 > 10 分钟未开始） |

> 复用现有 daily-reset 来重置 `sr_daily_count`。

### 11.5 宗门系统联动

- 宗门等级 5+ 解锁额外秘境次数
- 宗门任务新增：完成 N 次秘境（日常/周常）
- 组队大厅中同宗门成员创建的房间**置顶 + 金色描边**高亮
- 加入同宗门成员房间获得 +10% 全属性加成

### 11.6 洞府系统联动

- **演武堂**加成同样作用于秘境经验奖励
- **炼器房**加成使秘境装备掉落的品质权重额外向高阶倾斜（每级 +1%）

---

## 十二、技术实现注意事项

### 12.1 并发与锁

```
问题：多人同时操作同一房间（加入/准备/开始）
方案：使用 PostgreSQL 行级锁（SELECT ... FOR UPDATE）

-- 加入房间时
BEGIN;
SELECT * FROM team_rooms WHERE id = $1 AND status = 'waiting' FOR UPDATE;
-- 检查人数、状态
INSERT INTO team_members ...;
UPDATE team_rooms SET current_members = current_members + 1 WHERE id = $1;
COMMIT;
```

### 12.2 战斗原子性

```
-- 整个战斗结算必须在一个事务内完成
BEGIN;
  INSERT INTO secret_realm_battles ...;
  INSERT INTO secret_realm_contributions ... (每个队员);
  INSERT INTO secret_realm_rewards ... (每个队员);
  UPDATE characters SET realm_points = realm_points + $x, 
                        sr_daily_count = sr_daily_count + 1,
                        spirit_stone = spirit_stone + $y,
                        ... WHERE id = $char_id;  -- 对每个队员
  INSERT INTO secret_realm_clears ... ON CONFLICT DO UPDATE;  -- 首通记录
COMMIT;
```

### 12.3 前端轮询策略

由于当前架构是 **HTTP 无状态**（非 WebSocket），采用**轮询**模式同步房间与大厅状态：

```typescript
// 组队大厅页：每 3 秒刷新房间列表
const pollLobby = setInterval(async () => {
  const res = await useApi('/api/team/rooms', {
    query: { secret_realm_id, difficulty, only_available }
  });
  updateLobbyList(res.rooms);
}, 3000);

// 房间等待页：每 2 秒轮询房间状态（检测新成员加入/准备状态变化）
const pollRoom = setInterval(async () => {
  const room = await useApi('/api/team/room/' + roomId);
  if (room.status === 'fighting') {
    // 队长发起了战斗，跳转战斗页
    clearInterval(pollRoom);
    goToBattle(room);
  }
  updateRoomUI(room);
}, 2000);
```

> 离开任何页面时务必 `clearInterval` 以避免内存泄漏和无效请求。
> 未来如需实时体验，可升级为 WebSocket / SSE，但当前 HTTP 轮询足够用且与 Vercel 部署兼容。

### 12.4 并发加入的竞争处理

公开大厅允许所有人可见房间，多人同时点【加入】时可能出现超员：

```sql
-- /api/team/join 服务端事务
BEGIN;
-- 行级锁定房间行，阻止其他并发加入
SELECT * FROM team_rooms WHERE id = $1 AND status = 'waiting' FOR UPDATE;

-- 检查是否已满员
IF current_members >= max_members THEN
    ROLLBACK;
    RETURN { error: 'ROOM_FULL' };
END IF;

-- 插入成员 + 更新计数
INSERT INTO team_members (room_id, character_id, ...) VALUES (...);
UPDATE team_rooms SET current_members = current_members + 1 WHERE id = $1;

COMMIT;
```

前端收到 `ROOM_FULL` 错误时提示"房间已满"，并自动刷新大厅列表。

### 12.5 防作弊

- 所有战斗在**服务端**完成（与现有 /api/battle/fight 一致）
- 客户端只负责展示战斗日志，不参与任何数值计算
- 每日次数在服务端严格校验，前端显示仅供参考
- 贡献度由服务端根据战斗引擎结果计算，无法伪造

---

## 十三、实现优先级与分期

### Phase 1 - MVP（核心可玩）

- [x] 数据库表创建
- [ ] 房间创建 / 加入 / 离开 / 准备 / 开始
- [ ] 秘境战斗引擎（teamBattleEngine.ts）—— 复用现有引擎，扩展为多人
- [ ] SR-1 ~ SR-3 三个秘境（覆盖筑基到元婴）
- [ ] 普通难度
- [ ] 基础奖励（灵石 + 经验 + 秘境积分）
- [ ] 前端秘境弹窗 + 房间页 + 战斗日志 + 结算页
- [ ] 每日次数限制

### Phase 2 - 完善

- [ ] 困难 / 噩梦难度
- [ ] SR-4 ~ SR-6 后续秘境
- [ ] 装备高品质掉落权重 + Boss 保底机制
- [ ] 秘境积分商店（含紫/金/红装备宝箱）
- [ ] 贡献度系统完善
- [ ] 通关评分（S/A/B/C）
- [ ] 大厅筛选功能（按秘境/难度/可加入）
- [ ] 同宗门房间高亮

### Phase 3 - 扩展

- [ ] 秘境成就（12 个）
- [ ] 排行榜扩展
- [ ] 宗门任务联动（日常/周常加入秘境目标）
- [ ] 首通奖励（秘境积分 + 宝箱 + 称号）
- [ ] 等待阶段掉线自动移出（心跳检测）
- [ ] 恶意刷房限制（每小时最多创建 5 个房间）

### Phase 4 - 优化

- [ ] WebSocket / SSE 实时通信（替代轮询，实时大厅刷新）
- [ ] 战斗回放系统
- [ ] 秘境赛季 / 限时秘境活动

---

## 十四、数值平衡参考

### 14.1 时间投入对比

| 活动 | 每次耗时 | 每日次数 | 灵石/小时 | 经验/小时 |
|------|---------|---------|----------|----------|
| 普通刷图 | ~3 秒/场 | 无限 | 基准 100% | 基准 100% |
| 离线挂机 | 被动 | 1 次(12h) | ~70% | ~70% |
| 宗门 Boss | ~2 分钟 | 每周 | 按伤害排名 | 无 |
| **秘境普通** | ~1 分钟 | 2-5 次 | ~150% | ~120% |
| **秘境困难** | ~2 分钟 | 同上 | ~250% | ~200% |
| **秘境噩梦** | ~3 分钟 | 同上 | ~400% | ~300% |

> 秘境时间效率更高，但受每日次数限制，确保不替代日常刷图。

### 14.2 高品质装备获取周期预估

以**金色装备**为目标（玩家最想要的档位），对比两种玩法：

**普通刷图路径：**
```
T5 地图金色掉落率：~1%
每场掉落 1 件装备
平均需要刷 ~100 场才出 1 件金色
即便每件槽位、副属性还随机，真正能用的可能需要 500+ 场
```

**秘境路径（困难难度，每日 3 次）：**
```
单场秘境期望掉落：3-4 件，金色权重 13%
单场期望金色数：~0.45 件
每日 3 次 → 每日期望 1.35 件金色
加上 Boss 金色保底 → 每日稳定至少 3 件金色

一周（21 次）期望金色：~28 件
积分商店金色宝箱：每周必得 1 件
```

> **效率对比：秘境 ≈ 普通刷图的 20-30 倍效率**
> 
> 这就是玩家组队的核心动力，也是设计精髓：不引入新装备系统，只调整**现有装备的获取效率**。

---

## 十五、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 在线玩家少，大厅冷清 | 玩家找不到可加入房间 | 2 人即可开战；鼓励宗门成员互相开房；AI 队友填充（v4 考虑） |
| 大厅房间过多，刷新压力大 | 数据库/前端性能问题 | 索引优化（status+realm+difficulty+created_at）；分页加载；默认只显示前 30 个 |
| 恶意创房不开团 | 大厅被占位 | 10 分钟自动解散；同一玩家每小时最多创建 5 个房间（防刷） |
| 高战力带低战力刷噩梦 | 破坏难度曲线 | 秘境进入时校验境界/等级门槛；大厅中不符合要求的房间显示为不可加入 |
| 蹭车玩家贡献极低 | 其他队员拿到的奖励占比被稀释 | 贡献度保底 40% + 贡献度加权分配（装备按贡献优先分配给高贡献者） |
| 等待阶段长时间不准备 | 队伍卡住 | 10 分钟房间自动解散；队长可踢人 |
| 服务端战斗计算时间长 | 4 人 + 高波次可能超时 | 优化引擎；Vercel 函数 60s 超时内可完成 |
| 装备贬值过快 | 普通刷图玩家积极性下降 | 秘境次数严格限制（每日 2-5 次），装备依然有随机副属性的"洗装备"需求 |
| 高 T 装备泛滥 | 装备系统通胀 | 秘境装备 T 级绑定秘境境界，不会出现越级获取；红色保留为真正稀有 |

---

## 附录 A：与现有系统对比

| 特性 | 宗门 Boss | 秘境组队 |
|------|----------|---------|
| 参与人数 | 全宗门(最多50人) | 2-4 人 |
| 战斗方式 | 各自独立攻击，累计伤害 | 同一战场，协同作战 |
| 实时协作 | 无（异步） | 有（同步战斗） |
| 奖励分配 | 按伤害排名 | 按多维贡献度 |
| 独占内容 | 无（奖励在别处也能获取） | 有（秘境积分、红装宝箱、首通称号） |
| 进入频率 | 每周 | 每天 |
| 社交深度 | 浅（只需点击攻击） | 深（需要阵容搭配） |

## 附录 B：文件清单（预估新增）

```
server/
├── engine/
│   ├── teamBattleEngine.ts        # 多人战斗引擎（~400 行，简化复活/仇恨/buff 机制后）
│   └── secretRealmData.ts         # 秘境静态数据（~300 行）
├── utils/
│   └── team.ts                    # 组队辅助函数（~200 行）
├── api/team/
│   ├── rooms.get.ts               # 大厅房间列表
│   ├── create.post.ts             # 创建房间
│   ├── room/[id].get.ts           # 查询单个房间
│   ├── join.post.ts               # 加入房间
│   ├── leave.post.ts              # 离开房间
│   ├── kick.post.ts               # 踢出成员
│   ├── ready.post.ts              # 准备状态
│   ├── start.post.ts              # 发起战斗
│   ├── battle/
│   │   ├── fight.post.ts          # 秘境战斗
│   │   └── result/[id].get.ts     # 战斗结果
│   ├── realms.get.ts              # 秘境列表（静态数据 + 个人解锁状态）
│   ├── history.get.ts             # 战斗历史
│   ├── clears.get.ts              # 通关记录
│   └── shop/
│       ├── list.get.ts            # 商店列表
│       └── buy.post.ts            # 购买（装备宝箱直接生成装备）

game/
├── secretRealmData.ts             # 前端秘境静态数据
└── teamTypes.ts                   # 组队相关类型定义

stores/
└── team.ts                        # 组队状态管理

# pages/index.vue 内新增秘境弹窗组件（不新增页面）
```

> 预估新增代码量：约 2,000-2,800 行（不含测试，持续简化后比初版减少约 1,000-1,500 行）
