# 万界仙途 — 数值体系审计报告（v3.0 基线）

> 生成日期: 2026-04-22
> 目的: 在 v3.0 数值重构前,盘点所有数值散落点,作为建立 `shared/balance.ts` 单一数值源的依据
> 状态: 仅盘点,不做改动

---

## 📌 Executive Summary

全项目数值散落在 **13 大类、约 150+ 个常量点、30+ 个文件**。主要问题:

1. **同一数值多地定义**: `primaryBases` 在 8 处、`WEAPON_BONUS` 在 3 处、副属性池本已分散在 4 处（v2.9 已统一）
2. **属性来源 8+ 组**,各自独立累加,无统一预算: 基础 / 等级 / 境界 / 装备主 / 装备副 / 功法 / 丹药 / 附灵 / 宗门 / 道果 / 洞府
3. **没有"目标函数"**: 玩家在 Lv X / 境界 Y / 装备 Z 时应有多少 ATK/HP/DPS 未定义,数值靠拍脑袋
4. **cap 早期就触达**: 中档 build (T7 紫装 + 境界6-5 + 功法 Lv3) CRIT_RATE/DODGE/LIFESTEAL 全部触顶, 后续装备提升无感

---

## A. 角色基础属性

| 位置 | 内容 |
|---|---|
| `server/api/character/create.post.ts:3-13` | **ROOT_BONUS** 灵根加成表:金(hp=500/atk=58) / 木(hp=575/atk=50) / 水 / 火 / 土,各灵根 hp/atk/def/spd/crit_rate/crit_dmg 分化 |
| `server/api/character/create.post.ts:57` | 初始 resist_metal/wood/water/fire/earth 默认值 |

## B. 等级加成

| 位置 | 内容 |
|---|---|
| `server/utils/realm.ts:25-30` | `getLevelExpRequired(lv)`: 分 4 段指数曲线(Lv≤30 用 60×lv^1.25, 以此类推),上限 Lv 200 |
| `server/api/battle/fight.post.ts:322-327` | **等级固定加成**: Lv≤50 每级 +5hp/+2atk/+1def/+1spd; Lv≤100 +10/+4/+2/+2; Lv≤150 +20/+8/+4/+3; Lv>150 +40/+15/+8/+5 |
| `server/utils/battleSnapshot.ts` 同上 | 重复定义一份,需同步 |

## C. 境界加成

| 位置 | 内容 |
|---|---|
| `server/engine/realmData.ts:17-26` | **REALM_BONUSES** (Tier 1-8): 固定 hp/atk/def/spd + 百分比 hp_pct/atk_pct/def_pct + crit_rate/crit_dmg/dodge |
| `server/engine/realmData.ts:28-29` | stageMultiplier = 1 + (stage-1) × 0.10 (每 stage +10%) |

## D. 装备

### D.1 主属性

| 位置 | 内容 |
|---|---|
| `server/api/battle/fight.post.ts:207` | `primaryBases = {ATK:30, DEF:20, HP:200, SPD:15, CRIT_RATE:1, SPIRIT:8}` |
| **同样的表** 在 7 个其他文件重复 | `offline-claim` / `achievementData` / `sect/boss/claim` / `sect/shop/buy` / `sect/tasks/weekly/claim` / `secretRealmDrops` / `craft-set-fragment` / `game/equipData.ts PRIMARY_BASE` |
| `server/api/battle/fight.post.ts:208` | `statMuls = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5]` (白/绿/蓝/紫/金/红) |
| `server/utils/equipment.ts:21-46` (rollSubStatValue) | enhanceCurve: 每级 +10%,满 +10 = +100% |

### D.2 副属性

| 位置 | 内容 |
|---|---|
| `server/utils/equipment.ts:25-51` | **SUB_STAT_POOL** 23 条,weight 三档(20/10/5),flat vs percent 分类 |
| `server/api/battle/fight.post.ts:180` | `SUB_COUNT_RANGE = [[0,0],[0,1],[1,2],[2,3],[3,4],[4,4]]` |
| `server/utils/equipment.ts:60-68` | `rollSubStatValue`: qualityMul=1+rarityIdx×0.15, tierMul=1+(tier-1)×0.1,flat 乘 tierMul,percent 不乘 |

### D.3 武器类型加成

| 位置 | 内容 |
|---|---|
| `server/api/battle/fight.post.ts:319-324` `server/api/team/start.post.ts:58-63` `server/utils/battleSnapshot.ts:33-38` `game/equipData.ts:40-61` | **WEAPON_BONUS** 4 种:sword(ATK% +5, CRIT_RATE +3) / blade(ATK% +10, CRIT_DMG +15) / spear(ATK% +3, SPD% +12, LIFESTEAL +3) / fan(ATK% +3, SPIRIT% +25) — **4 处重复** |

### D.4 升品

| 位置 | 内容 |
|---|---|
| `server/api/equipment/upgrade-rarity.post.ts:30-31` | 紫→金: oldMul=1.18 → newMul=1.25; 金→红: 1.25 → 1.35 |

### D.5 掉落权重

| 位置 | 内容 |
|---|---|
| `server/api/battle/fight.post.ts:218-222` | 品质权重表 T1-T10(每 tier 独立数组,共 6 档) |
| `server/api/battle/fight.post.ts:213` | 装备掉率 = (Boss 1.0 ÷ 普通 0.20) × luckMul |
| `server/utils/secretRealmDrops.ts:54-58` | 秘境权重独立(普通/困难/噩梦 3 档) |
| `server/api/battle/fight.post.ts:182-185` | Boss 掉落权重向上偏移系数 0.3 |

## E. 功法

| 位置 | 内容 |
|---|---|
| `server/engine/skillData.ts:68-74` | 6 个主修功法, multiplier 1.0-1.5 |
| `server/engine/skillData.ts:77-99` | 21 个神通技能, multiplier 1.2-7.5, cdTurns 5-12 |
| `server/engine/skillData.ts:102-122` | 19 个被动功法,effect 包含 ATK_percent/DODGE_flat/LIFESTEAL_flat/CRIT_RATE_flat 等 |
| `server/engine/battleEngine.ts:477` | lvMul = 1 + (lvl-1) × 0.15 (每级 +15%) |
| `server/engine/battleEngine.ts:538-542` | **PASSIVE_PCT_CAP = 40** (atkPercent / defPercent / hpPercent / spdPercent 各独立 40% 上限) |
| `game/data.ts getSkillSlotLimits` | 功法槽位按境界解锁(练气1/1/1, 筑基1/2/2, 金丹1/2/3, 元婴+1/3/3) |

## F. 丹药

| 位置 | 内容 |
|---|---|
| `server/api/battle/fight.post.ts:468-507` | **PILL_PCT_CAP = 0.40**,各丹药 flat+pct 系数(basic_atk_pill +20, elite_atk_pill +10%, full_pill_1 全属性 +6% 等) |
| `server/api/pill/craft.post.ts:6-8` | QUALITY_MUL = {white:1.00, green:1.10, blue:1.25, purple:1.50, gold:2.00, red:3.00} |
| `server/api/pill/craft.post.ts:18-22` | FIRE_MULTIPLIER = {explode:1.0, gentle:1.10, strong:1.20, true:1.35} |

## G. 附灵

| 位置 | 内容 |
|---|---|
| `game/awakenData.ts:32-72` | **13 条武器附灵** 红品上限:lifesteal 0.10 / critRate 0.12 / critDmg 0.40 / atkPct 0.18 / armorPenPct 0.18 等 |
| `game/awakenData.ts:75-115` | **13 条法袍附灵** 红品:defPct 0.22 / hpPct 0.22 / dodge 0.10 / regenPerTurn 0.07 等 |
| `game/awakenData.ts:118-155` | **12 条灵佩附灵** 红品:spdPct 0.22 / critDmg 0.60 / spirit 60 / accuracyBonus 18 等 |
| `game/awakenData.ts:177` | 槽位限制:仅 weapon/armor/pendant 三槽 |

## H. 宗门加成

| 位置 | 内容 |
|---|---|
| `server/engine/sectData.ts:14-25` | **SECT_LEVELS** 10 级:atkBonus/defBonus 0.02 → 0.30, expBonus 0.05 → 0.50 |
| `server/engine/sectData.ts:137-142` | SECT_SKILLS:spirit_percent=5, hp_percent=8, armor_pen_percent=10, all_percent=5(每级 +10%) |
| `server/engine/sectData.ts:229-234` | 贡献来源:签到 100 + sectLevel×20 + realmTier×30 |

## I. 道果永久属性

| 位置 | 内容 |
|---|---|
| `server/api/battle/fight.post.ts:520-526` | `char.permanent_atk_pct / permanent_def_pct / permanent_hp_pct` 字段独立叠加 |
| `server/engine/sectData.ts:119` | 宗门店 permanent_stat 每购买 +1% |

## J. 洞府

| 位置 | 内容 |
|---|---|
| `game/caveData.ts:36-75` | 7 个建筑(spirit_array 聚灵阵 / martial_hall 武堂 / treasure_pot 聚宝盆 / herb_field 灵田 / sutra_pavilion 藏经阁 / pill_room 丹房 / awaken_hall 炼器房),各 baseCost/costMul/maxLevel/output |
| `fight.post.ts:501` | martial_hall 每级经验加成 5 + (level-1) × 2 |

## K. 怪物

| 位置 | 内容 |
|---|---|
| `server/api/battle/fight.post.ts:30-176` | **ALL_MAPS** 16 个地图 × 3-4 个怪 = ~60 个怪物 stat 定义(power/exp/stone/role) |
| `server/engine/battleEngine.ts:341-347` | **role 系数**:balanced / tank(def×1.5) / dps(atk×1.3) / speed(spd×1.4) / boss(全 ×1.5-2) |
| `server/engine/battleEngine.ts:358-392` | **怪物属性上限**:crit_rate ≤ 0.50 / crit_dmg ≤ 3.0 / dodge ≤ 0.30 / lifesteal ≤ 0.15 / armorPen ≤ 30 / accuracy ≤ 25 |
| `server/engine/battleEngine.ts:373-383` | role 附带 flat:dps 有吸血 0.02 / armorPen tier×1.5; boss 吸血 0.03+tier×0.005 / armorPen tier×2 |

## L. 战斗公式

| 位置 | 内容 |
|---|---|
| `server/engine/battleEngine.ts:416` | **atkDefRatio = atk / (atk + effectiveDef × 0.5)** ← DEF 权重 0.5 |
| `server/engine/battleEngine.ts:405-408` | 五行 resistFactor = 1 - min(0.7, r) (最大抗性 70%) |
| `server/engine/battleEngine.ts:140-145` | elementMulti = 1.3(克) / 0.7(被克) / 1.0(无关) |
| `server/engine/battleEngine.ts:414` | effectiveDef = def × max(0, 1 - totalArmorPen) |
| `server/engine/battleEngine.ts:447-448` | 暴击:random < crit_rate 则 damage ×= crit_dmg |
| `server/engine/battleEngine.ts:1094-1101` | 吸血:heal = floor(damage × lifesteal),clamp 到 maxHp |
| `server/engine/battleEngine.ts:127-131` | DOT 数值:poison = 3% maxHp / 回合; burn = 15% atk; bleed = 10% atk |
| `server/api/battle/fight.post.ts:558-566` | **玩家属性上限**:crit_rate ≤ 0.80 / crit_dmg ≤ 4.0 / dodge ≤ 0.40 / lifesteal ≤ 0.30 / armorPen ≤ 80 / accuracy ≤ 60 |

## M. 秘境 / 组队 / PvP

| 位置 | 内容 |
|---|---|
| `server/utils/secretRealmDrops.ts` | 秘境装备/灵草/功法/附灵石/灵枢玉的掉落率(3 档难度,Boss 保底品质 idx) |
| `server/engine/teamBattleEngine.ts` | 团队战独立公式 |
| `server/api/spirit-vein/*` | 灵脉 PvP,无独立数值定义(复用战斗引擎) |

---

## 🎯 v3.0 重构范围总结

| 大类 | 常量点数量 | 重复度 | 优先级 |
|---|---:|---:|---|
| A 角色基础 | ~30 (5 灵根 × 6 属性) | 1 处 | 中 |
| B 等级 | ~20 (4 段 × 4 属性 + 曲线) | 2 处 | 高(公式重要) |
| C 境界 | ~80 (8 tier × 10 属性) | 1 处 | 高 |
| D 装备 | ~50+ | **4-8 处重复** | **最高** |
| E 功法 | ~60 (46 功法 × 数值) | 1 处 | 中 |
| F 丹药 | ~30 | 1 处 | 中 |
| G 附灵 | ~150 (38 条 × 4 品) | 1 处 | 低(已集中) |
| H 宗门 | ~40 | 1 处 | 中 |
| I 道果 | ~10 | 1 处 | 低 |
| J 洞府 | ~50 | 1 处 | 低 |
| K 怪物 | ~200 (60 怪 + 公式) | 2 处 | 高 |
| L 战斗公式 | ~20 | 1 处 | 高 |
| M 秘境 | ~30 | 1 处 | 中 |

**高优先级 4 项**:等级曲线 / 境界加成 / 装备数值 / 怪物+战斗公式

**装备类重复度最高**(primaryBases 8 处, WEAPON_BONUS 4 处, statMuls 2 处),是本次重构最大收益点。

---

## 📋 阶段②需要你拍板的 4 个决策

建立了这份清单后,阶段②(设计意图)需要你定 4 件事。我会在 `design/balance-intent-v3.md` 给建议,但你先想想这些问题:

1. **挑战曲线**:你希望 T3/T5/T7/T10 地图 Boss 分别打多少回合击杀?(建议 15/20/25/30-40) 按你的建议来
2. **属性预算占比**:装备应占毕业战力百分之多少?(建议 50-60%,剩余 20% 境界 / 15% 功法 / 15% 其他) 按你的建议来
3. **cap 策略**:是降 cap(让触顶门槛更高)还是把来源数值整体压缩(让 cap 更难摸到)? 让 cap 更难摸到
4. **神器稀有度**:红装 4 条全好词条目标概率?(当前 0.002%,建议 0.2-0.5%,配合洗练保底) 改成0.2-0.5% 洗练保底不需要

---

## 📋 v3.5 调整记录（2026-04-26）

### 背景
**问题**：副属性百分比类不随 tier 缩放（仅 FLAT 类按 +10%/tier），导致玩家拿到高 tier 装备的副属性数值池与低 tier 完全相同，**主属性提升 + 副属性持平 = 换装无感**，新捡到的 t10 装备如果副属性洗得差反而不如旧 t5 装备。

### 改动点

#### 1. 副属性 tier 浮动分档（`server/utils/equipment.ts:54-83`）

引入新的 `getTierMul()` 分三档：

| 类别 | 词条 | 系数 | t1 | t10 |
|---|---|---|---|---|
| FLAT | ATK / DEF / HP / SPD / SPIRIT | +10%/tier | 1.0× | 1.9× （已有，不变） |
| GOOD | CRIT_RATE / CRIT_DMG / LIFESTEAL / DODGE / ARMOR_PEN | **+4%/tier** | 1.0× | 1.36× |
| 中档 PCT | ATK_PCT / HP_PCT / DEF_PCT / SPD_PCT / 五行 / ACCURACY / SPIRIT_DENSITY / LUCK | **+6%/tier** | 1.0× | 1.54× |

**好词条系数最低**：避开引擎 cap（暴击 50% / 暴伤 320% / 吸血 15% / 闪避 30%）。

#### 2. CRIT_DMG 削弱（`server/utils/equipment.ts`）

`min: 2 → 1, max: 8 → 6`（v3.4 已经从 10→8，本次再 -25%，min 再 -50%）

理由：暴伤是引擎中唯一无 cap 软压制的好词条（cap 320% 极难撞到），随 tier 浮动后单条期望太高，需要把 base 范围下调以保持稀缺性。

### 战力影响分析

| tier 段 | 净变化 | 说明 |
|---|---|---|
| t1-t3 | **略弱** | CRIT_DMG min/max 同时下调，tierMul 加成接近 0 |
| t4-t6 | 持平~略强 | 中档 PCT 开始浮动 |
| t7-t10 | **明显强** | FLAT +60%~90% / 中档 +36%~54% / 好词条 +24%~36% |

**核心目的**：让玩家的"换装爽感"从"主属性涨"扩展到"副属性也涨"，换装动机回归。

### 怪物配套（待观察）

**当前不动怪物**。理由：
1. 早期玩家其实变弱（CRIT_DMG 砍刀），加强 T1-T5 怪物会让前期卡死
2. v3.4 刚加强过 T5+ 怪物（血量+5%、补回复/buff 技能），还没观察够
3. 引擎 cap 是真护栏，副属性叠满也撞不到 cap

**如果实战发现 T7-T10 玩家碾压**，备选方案：
- T8-T10 boss `永恒之心 / 天道庇佑` 回复百分比 +1~2%
- T9-T10 boss 血量 +5%（对齐 v3.4 T5+ 思路）

---

## 📋 v3.6 调整记录（2026-04-27）

### 背景
**问题**：v3.5 引入 `getTierMul` 三档浮动后，**实测 tier 分档体感仍然不明显**。根因是 `rollSubStatValue` 终值用 `Math.floor` 截断，而好词条（GOOD 类）池子的 base 范围太小：

- `LIFESTEAL` / `DODGE` `min=1, max=1` — t10 倍率 1.36×，`floor(1 × 1.36) = 1`，**完全无差**
- `CRIT_RATE` `min=1 max=3` — 高品下限被 floor 砍到 1，仍像 t1
- `CRIT_DMG` / `ARMOR_PEN` / 五行 — 同样问题，下限被 floor 吃掉

GOOD 类系数本来就低（+4%/tier），`floor` 让 tier 倍率几乎全失效。

### 改动点

#### 1. `Math.floor` → `Math.ceil`（`server/utils/equipment.ts:rollSubStatValue`）

终值改为向上取整。LIFESTEAL/DODGE 的 t10 自然分档为 2（`ceil(1 × 1.36) = 2`），无需提高 max 撞 cap。

#### 2. `SUB_STAT_POOL` 下限上调（`server/utils/equipment.ts`）

| 词条 | min 调整 | max | 备注 |
|---|---|---|---|
| 五行 (METAL/WOOD/WATER/FIRE/EARTH_DMG) | 1 → **2** | 4 | 五条同步 |
| CRIT_RATE | 1 → **2** | 3 | |
| CRIT_DMG | 1 → **2** | 6 | v3.5 max 已砍到 6 |
| ARMOR_PEN | 1 → **2** | 5 | |
| LIFESTEAL | 1 (不动) | 1 | max=1 顶死，靠 ceil 分档 |
| DODGE | 1 (不动) | 1 | 同上 |
| 中档 PCT (ATK_PCT/DEF_PCT/HP_PCT/SPD_PCT/ACCURACY) | 不动 | — | base 范围本身已能配合 ceil 分档 |
| 资源类 (SPIRIT_DENSITY/LUCK) | 不动 | — | 凑数词条不调 |

### 战力影响（取 max 看 t1 vs t10，rarity=red 即 idx=4）

`qualityMul = 1.6`（red），`tierMul`：FLAT 1.9 / GOOD 1.36 / PCT 1.54

| 词条 | t1 ceil | t10 ceil | 提升 |
|---|---|---|---|
| LIFESTEAL (1) | `ceil(1 × 1.6 × 1.0) = 2` | `ceil(1 × 1.6 × 1.36) = 3` | +50% |
| DODGE (1) | 2 | 3 | +50% |
| CRIT_RATE (2~3) | 4~5 | `ceil(2~3 × 1.6 × 1.36)` = 5~7 | ✅ |
| CRIT_DMG (2~6) | 4~10 | 5~14 | ✅ |
| ARMOR_PEN (2~5) | 4~8 | 5~11 | ✅ |
| 五行 (2~4) | 4~7 | `ceil(2~4 × 1.6 × 1.54)` = 5~10 | ✅ |
| ATK_PCT (1~3) | 2~5 | `ceil(1~3 × 1.6 × 1.54)` = 3~8 | ✅ |

### 副作用与备注

1. **t1 装备数值小幅整体上调**（min=1→2 + ceil），但 t1 装备会被 t2~t3 快速替换，影响有限。
2. **`upgrade-rarity.post.ts` 升品自动跟随**（调用 `rollSubStatValue` 时传装备自身的 tier），无需额外改。
3. **怪物配套不动**：玩家小幅上升的副属性数值不会撞引擎 cap（暴击 80% / 暴伤 320% / 吸血 30% / 闪避 40%）。
