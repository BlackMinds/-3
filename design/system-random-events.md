# 随机事件系统 - 详细设计文档

> 版本：v1.0 | 日期：2026-04-14
> 状态：设计中（未实现）

---

## 一、系统概述

### 1.1 设计目标

放置修仙游戏的核心体验痛点是**长时间单调刷图**。随机事件系统通过在挂机/历练/闭关过程中穿插"小确幸"与"小波折"，让玩家每次上线都充满期待：

- **增强沉浸感**：用修仙世界观的小桥段（奇遇、劫难、顿悟）让战斗之外依然有故事
- **延长留存**：把"刷怪掉装备"的单一反馈拓展为 50+ 种可能性
- **稀释重复感**：相同地图每次历练都能产生不同叙事
- **世界频道烘托**：其他玩家触发的稀有事件可以广播，营造"你不是一个人在修仙"的氛围

### 1.2 事件分类

按影响性质划分为 5 大类，**全部可通过现有数据表字段增减直接实现**，不依赖战斗引擎扩展或新增复杂机制：

| 分类 | 数量 | 属性 | 涉及字段 | 示例 |
|------|------|------|---------|------|
| 奇遇拾获 | 7 | 正面 | stones / cultivation_exp / equipment / materials / skill_inventory | 古洞奇缘、天外陨铁 |
| 修为顿悟 | 5 | 正面 | cultivation_exp / permanent_hp/atk/def/spd / skill exp | 观瀑顿悟、饮灵泉 |
| 邂逅赠予 | 3 | 正面 | stones / pills | 前辈赠丹、同门相助 |
| 宗门专属 | 1 | 正面 | sect_members.contribution | 长老垂青 |
| 劫难损失 | 4 | 负面 | stones / cultivation_exp / materials | 山贼劫道、假丹之骗 |
| **合计** | **20** | — | — | — |

### 1.3 核心机制：天道独眷（全服定时抽奖）

系统采用**全服定时抽奖**机制——**每 30 分钟，服务器从全体玩家中随机抽取 1 位"天道眷顾者"**触发随机事件。这种设计契合修仙"天道无亲，机缘有定数，唯有缘者得之"的世界观：

- 💎 **稀缺感**：一天全服只有 **48 次**机会，被选中即是天大造化
- 🌍 **社交感**：每个玩家都在等待、关注、羡慕别人被选中的瞬间
- 📢 **内容感**：风云阁成为"众仙围观"的中心，每条广播都自带热度
- ⚖️ **服务端友好**：无需每人独立计时，一次 cron 搞定全服

---

## 二、触发机制

### 2.1 基础规则

| 项目 | 设定 |
|------|------|
| **触发周期** | 全服每 **30 分钟** 抽奖一次（08:00、08:30 ... 23:30） |
| **静默时段** | **00:00 - 08:00 不触发**（深夜无人在线，保留次日清晨的风云阁新鲜感） |
| **抽奖范围** | 所有**当前在线**玩家（离线玩家不参与） |
| **每次中奖人数** | **1 人**（天道独眷，每半个小时全服只有一个幸运儿） |
| **中奖后推送** | 弹窗 + 音效 + 顶部金色横幅庆祝 3 秒 |
| **广播范围** | 所有中奖事件均进入风云阁、**实名显示**（包括负面事件，江湖恩怨亦是谈资） |
| **连续保护** | 被选中者进入 **6 小时冷却**，期间不再参与抽奖（避免同一人连中） |

> **静默时段设计动机**：
> - 深夜玩家极少，触发也无人围观，浪费稀缺机会
> - 让风云阁在夜里"沉睡"，玩家清晨上线能看到昨晚最后一条停在那里，早上 8:00 第一条 tick 触发有"新的一天江湖传闻"的仪式感
> - 服务端按 UTC 运行，cron 表达式需做时区偏移（中国 08:00 = UTC 00:00）

### 2.2 抽奖候选池

每次 30 分钟 tick 时，服务端按以下顺序筛选：

```
第 1 步：筛选在线玩家
  条件：最后一次 API 请求在 10 分钟内

第 2 步：剔除冷却中
  条件：上次中奖时间 > 6 小时前

第 3 步：剔除新手保护期
  条件：角色注册满 24 小时（避免刚创建的小号占用奖池）

第 4 步：按福缘权重抽取 1 人
  weight = 100 + 福缘副属性值  // 装备副属性"福缘"提升中奖概率
```

### 2.3 抽到之后：再抽事件

选中玩家后，从满足条件的事件池中按稀有度 + 权重抽取具体事件：

```ts
function rollEventForWinner(character): RandomEvent {
  const pool = events.filter(e =>
    e.min_realm <= character.realm_tier &&
    e.max_realm >= character.realm_tier &&
    !isInCooldown(character.id, e.id) &&
    checkRequires(character, e.requires)
  );

  // 稀有度概率（中奖者已经是"天道眷顾"，稀有度整体上移）
  const rarity = pickRarity(character);
  // common 40% / rare 35% / epic 20% / legendary 5%

  const candidates = pool.filter(e => e.rarity === rarity);
  return weightedPick(candidates);
}
```

> **对比**：原方案（每人自抽）common 占 60%，现方案（全服独抽）common 降至 40%——被选中的都是幸运儿，稀有事件比例更高，戏剧性更强。

### 2.4 数值校准（在线 100 人为例）

> 静默 8 小时（00:00-08:00），每日实际触发时段为 08:00-23:30，共 **32 次 tick**

| 指标 | 数值 |
|------|-----|
| 每日 tick 次数 | **32 次**（原 48，砍掉夜间 16 次） |
| 每次候选池（减冷却） | ~90 人 |
| 单人每日被选中概率 | 32 / 90 ≈ **36%** |
| 单人平均中奖间隔 | ~2.8 天 / 次 |
| 福缘 +200 玩家中奖概率 | 提升约 **2 倍** |

**其他在线人数场景**：

| 在线玩家 | 单人每日中奖概率 | 平均间隔 |
|---------|---------------|---------|
| 20 人 | 100%（每天 1.6 次） | 15 小时 |
| 100 人 | 36% | 2.8 天 |
| 500 人 | 6.4% | 15.6 天 |
| 2000 人 | 1.6% | 62 天 |

> ⚠️ **规模提醒**：玩家破 500 后单人命中率显著下降，需考虑两种扩容方案：
> - **方案 A**：固定每次抽 1 人，接受稀缺感（更稀有但更冷清）
> - **方案 B**：动态抽 `ceil(在线数 / 100)` 人，保持单人命中率不崩盘（推荐）
>
> 暂以方案 A 上线，按玩家反馈切换。

### 2.5 负面事件的广播

所有事件**一律实名广播**，包括负面事件：

| 类型 | 风云阁显示 | 示例 |
|------|----------|------|
| 正面事件 | 实名 | `道友「剑无痕」古洞取宝，修为大进！` |
| 负面事件 | **同样实名** | `道友「寒星子」夜行遇袭，损失灵石若干……天道无常` |

> **设计考量**：修仙江湖本就有"幸灾乐祸"与"惺惺相惜"两种情绪——有人栽了跟头被围观，也是世界鲜活的一部分。广播文案措辞偏叙事感（"天道无常""失足一劫"），避免嘲讽式措辞，既保留戏剧张力又不显刻薄。

### 2.6 中奖玩家的体验流程

```
[玩家正在历练] → 00:30 时钟到 → 服务端抽奖
                                    ↓
        被选中 ←→ 未被选中（什么都不发生，继续游戏）
          ↓
    🎉 顶部金色横幅："天道眷顾！古洞奇缘降临..."
    🔔 中央弹窗（大图 + 奖励明细）
    🎵 悠扬铃声音效
          ↓
     [领取]（抉择类则显示选项）
          ↓
     奖励入库 + 角色数据刷新 + 进入风云阁广播池
```

- 如果玩家此时正在**战斗回合动画**中：事件弹窗延迟到战斗结束再弹，不打断节奏
- 如果玩家此时**正处在弹窗遮挡**（例如炼丹结果）：加入队列，关闭前一个弹窗后自动弹出
- 抉择类事件超时 2 小时未选 → 按默认选项自动结算

### 2.7 保护机制

- **新手保护**：注册 **2h** 内不参与抽奖（避免刚创建的号还没玩就被选中）
- **连中冷却**：中奖者 6h 内不再参与（给其他人机会）
- **长期未中奖加权**：连续 7 天未中奖的玩家，下次抽奖权重 × 2（软保底）
- **资源下限**：
  - 灵石扣除后不低于当前境界进阶所需费用的 50%
  - 修为扣除不会导致境界倒退
  - 装备丢失仅限背包中的凡品/灵品，已装备的受保护

---

## 三、20 种事件完整清单

> 文案格式中 `{player}` 为玩家道号占位符，在广播/弹窗时动态替换
> 效果数值按玩家当前境界 tier 缩放：`base × realmScaling[tier]`
> 所有效果**仅操作现有数据库字段**，无需新增系统或改造战斗引擎

### 3.1 奇遇拾获（E001-E007）

| ID | 名称 | 稀有度 | 文案模板 | 效果 | 落库操作 |
|----|------|--------|---------|------|---------|
| E001 | 灵玉拾遗 | common | {player} 路过山涧瀑布，见一枚晶莹灵玉半埋于泥中，拾起后得灵石 +{n} | 灵石 +[1000 × tier²] | `characters.stones += N` |
| E002 | 灵田意外 | common | {player} 在野外发现一片野生灵田，采得上品灵草 ×{n} | 当前境界对应品质灵草 ×[3~8] | `character_materials.quantity += N`（按 tier 选品质） |
| E003 | 古墓风云 | rare | {player} 误闯古墓秘穴，破阵取宝，获得装备一件与灵石若干 | 装备 ×1 + 灵石 +[3000 × tier²] | `character_equipment` 插入 + `characters.stones += N` |
| E004 | 遗落储物袋 | rare | {player} 于乱葬岗角落拾得一只前辈遗落的储物袋 | 灵石 +[500 × tier²] + 灵草 ×3 + 低阶丹药 ×1 | 多表联合更新 |
| E005 | 魂灯指路 | rare | {player} 得到一盏引魂灯，被其引至一处洞府，获得功法玉简一卷 | 随机已解锁功法 ×1（按 tier 分级） | `character_skill_inventory` 插入 |
| E006 | 灵矿惊现 | epic | {player} 踏入废弃矿洞，竟是一处未被开采的灵石矿脉 | 灵石 +[20000 × tier²] | `characters.stones += N` |
| E007 | 天外陨铁 | legendary | 夜幕深沉，{player} 目睹流星坠落，掘出一块星铁炼成绝世兵器 | 武器装备 ×1（金品 80% / 红品 20%） | `character_equipment` 插入 |

### 3.2 修为顿悟（E008-E012）

| ID | 名称 | 稀有度 | 文案模板 | 效果 | 落库操作 |
|----|------|--------|---------|------|---------|
| E008 | 禅音入耳 | common | 古寺钟声飘来，{player} 心神澄澈，修为小有进益 | 修为 +[境界所需 × 3%] | `characters.cultivation_exp += N` |
| E009 | 观瀑顿悟 | rare | {player} 立于百丈飞瀑前，忽有所悟，修为大进 | 修为 +[境界所需 × 15%] | `characters.cultivation_exp += N` |
| E010 | 梦中授法 | rare | {player} 昏沉入睡，梦中一白发老者为其讲解功法 | 随机已装备功法 +1 级经验 | `character_skills.exp += levelReq` |
| E011 | 心斋入定 | rare | {player} 偶遇禅师传授心斋诀，气血温养，修为精进 | 修为 +[境界所需 × 5%] + 气血永久 +[20 × tier] | `characters.cultivation_exp += N`, `characters.permanent_hp += M` |
| E012 | 饮灵泉 | epic | {player} 饮下山间灵泉，气血脉络大开 | 气血永久 +[30 × tier] | `characters.permanent_hp += N` |

### 3.3 邂逅赠予（E013-E015）

| ID | 名称 | 稀有度 | 文案模板 | 效果 | 落库操作 |
|----|------|--------|---------|------|---------|
| E013 | 同门相助 | common | 偶遇同门师兄弟，对方赠灵石以助 {player} 修行 | 灵石 +[5000 × tier] | `characters.stones += N` |
| E014 | 前辈赠丹 | epic | {player} 搭救迷路前辈，对方赠丹相谢 | 高阶丹药 ×1（按境界选丹方） | `character_pills.quantity += 1` |
| E015 | 古洞奇缘 | epic | {player} 游历时偶遇一座残破古洞，进入后发现前辈遗骸，修为大进并获得储物戒一枚 | 修为 +[境界所需 × 10%] + 装备 ×1（紫+概率 30%） | `characters.cultivation_exp += N` + `character_equipment` 插入 |

### 3.4 宗门专属（E016）

> 仅限已加入宗门（`characters.sect_id IS NOT NULL`）的玩家被抽中

| ID | 名称 | 稀有度 | 文案模板 | 效果 | 落库操作 |
|----|------|--------|---------|------|---------|
| E016 | 长老垂青 | rare | {sect} 长老召见 {player}，赐下贡献度奖励 | 宗门贡献 +[100 × tier] | `sect_members.contribution += N` |

### 3.5 劫难损失（E017-E020）

> **实名广播**，与正面事件一样显示道号；文案措辞偏叙事、不带嘲讽

| ID | 名称 | 稀有度 | 文案模板 | 效果 | 落库操作 |
|----|------|--------|---------|------|---------|
| E017 | 山贼劫道 | common | 道友 {player} 夜行僻径，遭遇散修山贼围攻，损失灵石若干……天道无常 | 灵石 -[8%]（有下限保护） | `characters.stones -= N`（带 MAX(0, floor) 保护） |
| E018 | 幻境惊魂 | common | 道友 {player} 误入幻阵，神魂受创，修为略有倒退 | 修为 -[当前境界 × 2%]（不跌境界） | `characters.cultivation_exp = MAX(0, exp - N)` |
| E019 | 误采毒草 | common | 道友 {player} 辨识失误，采回一批毒草，反噬灵田 | 随机灵草 -[5~15] | `character_materials.quantity -= N` |
| E020 | 假丹之骗 | common | 道友 {player} 从游商处购得假丹，损失灵石颗粒无收 | 灵石 -[3000 × tier²] | `characters.stones -= N` |

### 3.6 稀有度分布总览

| 稀有度 | 数量 | 占比 | 抽奖概率（中奖者稀有度） |
|-------|:----:|:----:|:---------------------:|
| ⚪ common | 8 | 40% | 40% |
| 🔵 rare | 7 | 35% | 35% |
| 🟣 epic | 4 | 20% | 20% |
| 🟠 legendary | 1 | 5% | 5% |
| **合计** | **20** | **100%** | **100%** |

正负面分布：
- ✅ 正面事件：16 个（奇遇 7 + 顿悟 5 + 邂逅 3 + 宗门 1）
- ⚠️ 负面事件：4 个（全部 common 级，实名广播，带资源下限保护）

---

## 四、数值缩放基准

### 4.1 境界 Tier 映射

| 境界 | Tier | 奖励系数 | 负面下限保护 |
|------|------|---------|-------------|
| 练气 | 1 | 1x | 灵石 ≥ 100 |
| 筑基 | 2 | 3x | 灵石 ≥ 1,000 |
| 金丹 | 3 | 8x | 灵石 ≥ 10,000 |
| 元婴 | 4 | 20x | 灵石 ≥ 100,000 |
| 化神 | 5 | 50x | 灵石 ≥ 500,000 |
| 渡劫 | 6 | 120x | 灵石 ≥ 2,000,000 |
| 大乘 | 7 | 300x | 灵石 ≥ 10,000,000 |
| 飞升 | 8 | 800x | 灵石 ≥ 50,000,000 |

### 4.2 奖励对照（灵石类）

| 事件 | 练气 | 金丹 | 化神 | 飞升 |
|------|-----|------|------|------|
| E001 灵玉拾遗 | 1,000 | 9,000 | 25,000 | 64,000 |
| E006 灵矿惊现 | 20,000 | 180,000 | 500,000 | 1,280,000 |
| E013 同门相助 | 5,000 | 15,000 | 25,000 | 40,000 |
| E017 山贼劫道 | -8% | -8% | -8% | -8%（按当前灵石百分比，有下限） |
| E020 假丹之骗 | -3,000 | -27,000 | -75,000 | -192,000 |

---

## 五、UI 展示设计

### 5.1 事件弹窗

```
┌─────────────────────────────────────┐
│  [紫色边框·奇遇]       ×关闭       │
│                                     │
│  ✨ 古洞奇缘                        │
│                                     │
│  [插画：古朴洞府]                   │
│                                     │
│  你于流云山脉游历时偶遇一座残破     │
│  古洞，进入后发现前辈遗骸……         │
│                                     │
│  获得：                             │
│  · 修为 +12,500                     │
│  · 玄品长剑 ×1                      │
│                                     │
│            [领取奖励]               │
└─────────────────────────────────────┘
```

### 5.2 抉择弹窗（E033-E038 专用）

```
┌─────────────────────────────────────┐
│  ⚔️ 邪修挑战                        │
│                                     │
│  一名邪修拦路挑战你，眼中杀机毕露   │
│                                     │
│  [🗡 应战]  50% 胜率，胜得紫装       │
│  [🏃 离去]  损失少量灵石            │
│                                     │
│  剩余时间：58 秒                    │
└─────────────────────────────────────┘
```

### 5.3 风云阁 · 全服事件广播

在游戏**顶部导航栏**新增一个常驻入口「🗺 风云阁」，点击展开悬浮面板，展示**全服所有玩家**近期触发的随机事件。是玩家感知"自己不是独自修仙"的核心窗口。

#### A. 顶部入口设计

```
┌───────────────────────────────────────────────────────────┐
│ 万界仙途  │ 角色  历练  功法  装备  洞府  宗门 │ 🗺 风云阁ⓝ │
└───────────────────────────────────────────────────────────┘
                                              └─ 红点徽标
                                                 显示有新鲜广播
```

- 常驻在所有页面顶部（紧邻用户头像）
- 有**未读红点 badge**，显示最近 5 分钟内传说级事件数量
- 点击展开右侧抽屉式面板（不遮挡主战斗画面）

#### B. 风云阁面板 UI

```
┌──────────────────────────────────────────┐
│  🗺 风云阁 · 万界见闻录        [✕关闭]   │
│  ─────────────────────────────────────── │
│  [全部] [传说] [史诗] [稀有] [宗门]      │  ← 筛选 Tab
│  ─────────────────────────────────────── │
│  🟠 1分钟前                              │
│    ⚡ 道友「剑无痕」夜观流星坠落，        │
│    掘出星铁炼成仙品战戟 ×1               │
│                                          │
│  🟣 3分钟前                              │
│    ✨ 道友「清风月」误闯古洞，寻得        │
│    前辈遗骸，修为大进                    │
│                                          │
│  🟣 5分钟前                              │
│    🏛 「苍穹剑宗」长老召见门人「白衣卿」, │
│    赐下百点贡献                          │
│                                          │
│  🔵 8分钟前                              │
│    📜 道友「醉月楼」观瀑顿悟，修为 +5%   │
│                                          │
│  🔵 12分钟前                             │
│    ⚔️ 道友「寒星子」遭山贼劫道，         │
│    损失灵石 若干                         │
│                                          │
│  ... (最多显示 50 条，下拉加载)          │
└──────────────────────────────────────────┘
```

#### C. 广播规则（按稀有度）

因为全服每 30 分钟只抽 1 人，**每一条中奖都会进入风云阁**——这也正是风云阁的全部内容来源。只是根据稀有度决定**额外呈现形式**：

| 稀有度 | 风云阁 | 顶部滚动横幅 | 宗门频道 | 玩家名显示 |
|-------|:-----:|:-----------:|:------:|----------|
| 🟠 传说 legendary | ✅ | ✅ 全服红色横幅 3 秒 | ✅ | 实名 |
| 🟣 史诗 epic | ✅ | ❌ | ✅ | 实名 |
| 🔵 稀有 rare | ✅ | ❌ | 仅同宗门 | 实名 |
| ⚪ 凡品 common (正面) | ✅ | ❌ | ❌ | 实名 |
| ⚔️ 负面事件（E017-E020） | ✅ | ❌ | ❌ | **实名**（与正面一致） |

#### D. 筛选 Tab 说明

| Tab | 展示内容 |
|-----|---------|
| **全部** | 全服 rare+ 级事件，最多 50 条 |
| **传说** | 仅 legendary 事件（最稀有，通常几小时一条） |
| **史诗** | epic 级事件 |
| **稀有** | rare 级事件 |
| **宗门** | 仅本宗门成员触发的事件（降低稀有度门槛，common 也显示） |

#### E. 数据来源与实时性

- 所有玩家触发的事件记录到 `character_event_log`，其中 `broadcast_level` 标记广播范围
- 前端打开风云阁时拉取最近 50 条，后续通过 **SSE / 轮询**（每 15 秒一次）增量拉新
- 超过 24 小时的记录自动从热榜移除（但数据库保留供成就/统计使用）

#### F. 示例广播文案

```
🟠【风云阁 · 传说】道友「剑无痕」夜观流星坠落，掘出星铁炼成仙品战戟！
🟣【风云阁 · 史诗】道友「清风月」游历古洞，修为大进！
🟣【风云阁 · 史诗】道友「白衣卿」饮下山间灵泉，气血脉络大开！
🔵【风云阁 · 稀有】道友「醉月楼」观瀑顿悟，参透一丝道机。
🔵【风云阁 · 稀有】「苍穹剑宗」长老垂青门人「寒星子」，赐下贡献。
⚪【风云阁 · 凡品】道友「青衫客」山涧拾得一枚灵玉。
⚔️【风云阁 · 劫难】道友「孤山行」夜行僻径，损失灵石若干……天道无常。
```

> **句式统一**：道号 + 动作 + 收获，便于模板化替换。负面事件采用叙事措辞（"天道无常""失足一劫""一时不察"），避免嘲讽感。

---

## 六、数据库设计

### 6.1 新增表

```sql
-- 事件定义（静态，可从代码导入）
CREATE TABLE random_events (
  event_id        VARCHAR(10) PRIMARY KEY,  -- E001
  name            VARCHAR(50) NOT NULL,
  category        VARCHAR(20) NOT NULL,     -- fortune/enlighten/disaster/choice/npc/sect/weather
  rarity          VARCHAR(20) NOT NULL,     -- common/rare/epic/legendary
  template        TEXT NOT NULL,            -- 文案模板
  weight          INT DEFAULT 100,
  min_realm       INT DEFAULT 1,
  max_realm       INT DEFAULT 10,
  cooldown_hours  INT DEFAULT 24,
  requires        JSONB,                    -- ["in_sect", "has_cave"]
  effect          JSONB NOT NULL,           -- 奖励/惩罚配置
  is_choice       BOOLEAN DEFAULT FALSE,    -- 是否需要玩家选择
  broadcast_level VARCHAR(20) DEFAULT 'self' -- self/sect/global
);

-- 玩家事件日志
CREATE TABLE character_event_log (
  id              SERIAL PRIMARY KEY,
  character_id    INT NOT NULL REFERENCES characters(id),
  event_id        VARCHAR(10) NOT NULL,
  triggered_at    TIMESTAMP DEFAULT NOW(),
  result          JSONB,                    -- 实际获得/损失的详情
  choice          VARCHAR(20),              -- 玩家抉择（如有）
  claimed         BOOLEAN DEFAULT FALSE,
  broadcast_scope VARCHAR(20) DEFAULT 'none',-- none/sect/global（风云阁广播范围）
  is_positive     BOOLEAN DEFAULT TRUE,      -- 是否正面事件（前端用于广播条目样式区分：正面金色/负面灰色）
  UNIQUE(character_id, triggered_at)
);

CREATE INDEX idx_event_log_char ON character_event_log(character_id, triggered_at DESC);

-- 风云阁广播热榜（冗余表，加速查询，超过 24h 自动清理）
CREATE TABLE world_broadcast (
  id              SERIAL PRIMARY KEY,
  log_id          INT NOT NULL REFERENCES character_event_log(id) ON DELETE CASCADE,
  character_name  VARCHAR(50) NOT NULL,     -- 冗余存角色名，避免 JOIN
  sect_id         INT,                      -- 冗余存宗门 ID，用于宗门 Tab 筛选
  event_id        VARCHAR(10) NOT NULL,
  rarity          VARCHAR(20) NOT NULL,
  rendered_text   TEXT NOT NULL,            -- 预渲染好的广播文案
  scope           VARCHAR(20) NOT NULL,     -- sect / global
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_broadcast_recent ON world_broadcast(created_at DESC);
CREATE INDEX idx_broadcast_sect ON world_broadcast(sect_id, created_at DESC);
CREATE INDEX idx_broadcast_rarity ON world_broadcast(rarity, created_at DESC);
```

### 6.2 Characters 表扩展字段

```sql
ALTER TABLE characters
  ADD COLUMN last_active_at TIMESTAMP DEFAULT NOW(),           -- 最后活跃时间（判断在线）
  ADD COLUMN event_last_won_at TIMESTAMP,                      -- 上次中奖时间（用于 6h 冷却）
  ADD COLUMN event_pending_id INT,                             -- 指向 character_event_log.id，未领取的中奖事件
  ADD COLUMN event_pending_choice JSONB;                       -- 抉择类事件的选项快照
```

### 6.3 全服抽奖 Cron

新增 `server/api/cron/random-event-tick.post.ts`，由 GitHub Actions 每 30 分钟调用：

```ts
// POST /api/cron/random-event-tick
export default defineEventHandler(async (event) => {
  verifyCronSecret(event);

  // 🌙 静默时段校验（即便 cron 误触发也守一道）
  // 服务端 UTC，换算北京时间小时数
  const now = new Date();
  const cnHour = (now.getUTCHours() + 8) % 24;
  if (cnHour < 8) {
    return { skipped: true, reason: 'silent_hours', cn_hour: cnHour };
  }

  const onlineThreshold = new Date(now.getTime() - 10 * 60 * 1000);    // 10 分钟内活跃
  const cooldownThreshold = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6h 冷却
  const newbieThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);   // 新手 2h

  // 1. 筛选候选池
  const candidates = await db.query(`
    SELECT id, name, realm_tier, sect_id, created_at, event_last_won_at,
           (SELECT sub_stats->>'fortune' FROM character_equipment WHERE character_id = c.id AND equipped = true) AS fortune
    FROM characters c
    WHERE last_active_at >= $1
      AND (event_last_won_at IS NULL OR event_last_won_at < $2)
      AND created_at <= $3
  `, [onlineThreshold, cooldownThreshold, newbieThreshold]);

  if (candidates.length === 0) return { skipped: true, reason: 'no_candidates' };

  // 2. 按福缘加权抽 1 人
  const winner = weightedPick(candidates, c => 100 + (c.fortune ?? 0));

  // 3. 按稀有度抽事件
  const eventDef = rollEventForWinner(winner);

  // 4. 结算奖励、入库、标记为 pending（玩家上线领取）
  const logId = await insertEventLog(winner.id, eventDef, now);
  await updateCharacter(winner.id, {
    event_pending_id: logId,
    event_last_won_at: now,
  });

  // 5. 写入风云阁广播
  await insertBroadcast(logId, eventDef, winner);

  return { winner: winner.id, event: eventDef.id };
});
```

**GitHub Actions 配置**（`.github/workflows/cron.yml` 新增）：

```yaml
# 中国 08:00-23:30 每 30 分钟触发一次，夜间静默
# 服务端按 UTC 运行：中国 08:00 = UTC 00:00，中国 23:30 = UTC 15:30
- cron: "*/30 0-15 * * *"
  call: /api/cron/random-event-tick
```

> **双重防御**：cron 表达式已经限制了时段，接口内部还会再判断一次北京时间小时数。即使将来迁移到其他调度平台或时区配置错乱，也不会在深夜误触发。

### 6.4 "活跃"判定

玩家每次调用受鉴权的 API 时，`server/middleware/auth.ts` 顺手更新 `last_active_at = NOW()`。无需前端主动心跳。

---

## 七、实现计划

### 7.1 代码位置

```
server/
├── engine/
│   └── randomEventData.ts       # 50 个事件静态配置
├── utils/
│   ├── randomEvent.ts           # 事件抽取/结算逻辑
│   └── broadcast.ts             # 风云阁广播写入逻辑
└── api/
    ├── cron/
    │   └── random-event-tick.post.ts  # 【核心】每 30 分钟 GH Actions 调用
    └── event/
        ├── pending.get.ts       # 查询本人是否被抽中（未领取）
        ├── claim.post.ts        # 领取奖励
        ├── choose.post.ts       # 抉择类事件提交选项
        └── broadcast.get.ts     # 【风云阁】拉取全服广播列表

stores/
├── event.ts                     # Pinia：事件队列、弹窗状态
└── broadcast.ts                 # Pinia：风云阁广播数据 + 红点计数

components/
├── EventPopup.vue               # 通用事件弹窗
├── EventChoiceDialog.vue        # 抉择类专用
├── WorldBroadcastTopEntry.vue   # 🗺 顶部风云阁入口按钮（含红点）
├── WorldBroadcastPanel.vue      # 风云阁抽屉面板（含 Tab 筛选）
└── WorldBroadcastBanner.vue     # 顶部传说级滚动横幅
```

### 7.2 接入现有游戏流程

**完全独立于战斗/闭关/挂机流程**，只需挂钩三处：

#### A. 活跃度标记（鉴权中间件）

`server/middleware/auth.ts` 在校验 JWT 后：

```ts
// 顺手更新 last_active_at，用于抽奖候选池筛选
await db.query(
  'UPDATE characters SET last_active_at = NOW() WHERE user_id = $1',
  [userId]
);
```

#### B. 中奖推送（前端轮询）

`stores/game.ts` 每 **60 秒**拉一次：

```ts
// 前端 60 秒轮询，检测本玩家是否被抽中
setInterval(async () => {
  const { pending } = await $fetch('/api/event/pending');
  if (pending) {
    eventStore.showWinnerPopup(pending);  // 弹窗 + 音效 + 横幅
  }
}, 60_000);
```

- 误差 ±60 秒可接受（中奖消息晚 1 分钟弹出不影响体验）
- 也可以用 SSE 长连接做实时推送（可选优化）

#### C. 风云阁面板数据

`server/api/event/broadcast.get.ts` 直接从 `world_broadcast` 表查最近记录：

```ts
// GET /api/event/broadcast?rarity=legendary&limit=50
const rows = await db.query(`
  SELECT * FROM world_broadcast
  WHERE ($1::text IS NULL OR rarity = $1)
  ORDER BY created_at DESC
  LIMIT $2
`, [rarity, limit]);
```

### 7.3 分阶段实现路线图

| 阶段 | 范围 | 工作量估计 |
|------|------|----------|
| Phase 1 | DB 建表 + cron tick + 20 个事件全量 + 中奖弹窗 | 完整可玩 |
| Phase 2 | **风云阁**顶部入口 + 面板 + 红点 + 筛选 Tab | 社交感 |
| Phase 3 | 传说级滚动横幅 + 负面事件灰色样式 + 福缘权重生效 | 打磨 |
| Phase 4 | 后续扩展：新事件、动态扩容、抉择类（可选） | 深度玩法 |

---

## 八、可扩展方向

> 以下功能**均依赖新系统**，不在首期 20 事件范围内，待核心上线后视反馈推进：

- **节日事件**：春节红包、中秋赏月顿悟（需运营配置）
- **抉择类事件**：魔头传功、道果之门等玩家决策桥段（需前端抉择 UI）
- **天象全服事件**：灵潮、血月（需全服 buff 系统）
- **战斗关联事件**：下场战斗 buff/debuff（需战斗引擎接入）
- **图鉴收集**：首次触发解锁图鉴条目，集齐获得称号（需成就系统扩展）
- **玩家投稿**：运营后台快速配置新事件，不需发版

---

## 九、风险与注意

1. **广播节奏**：30 分钟 1 条广播对稀有度分布影响大，上线后需观察实际的传说级触发频率
2. **负面反感**：4 个负面事件实名广播 + 带资源下限保护；文案措辞已偏叙事，测试阶段仍需关注被点名玩家的反馈
3. **候选池耦合**：`last_active_at` 更新频率影响候选池准确性，需在鉴权中间件中稳定写入
4. **中奖推送可靠性**：前端 60 秒轮询可能遗漏（网络抖动等），建议 `/api/game/data` 返回时也携带 `pendingEvent` 字段做兜底
