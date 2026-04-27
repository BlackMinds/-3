# 装备附灵系统设计（Equipment Awakening）

> 最后更新: 2026-04-26
> 版本: v1.3 — 灵戒附灵增补（主修功法增幅向）
> 设计目标: **在兵器 / 法袍 / 灵佩三个槽位引入丰富的战斗词缀维度；附灵通过专属道具手动附加与洗练，道具仅从组队副本低概率掉落，给副本玩法创造驱动力**
>
> ### v1.3 增补：灵戒槽位
> - 灵戒（ring）作为第 4 个附灵槽，效果池**专门增幅主修功法**，与三槽通用 buff 互补
> - 12 条效果：通用向 4 / 属性匹配向 5（主修元素=金/木/水/火/土 才触发）/ 机制向 3
> - 道具方案 A：复用现有附灵石/灵枢玉，仅放宽 slot 校验
> - 怪物侧联动：T6+ 高境界 Boss 血量 +5%（含秘境） 对冲玩家主修流派峰值
> - 详细设计稿：[`system-equipment-awaken-ring.md`](system-equipment-awaken-ring.md)

---

## 一、设计哲学

### 1.1 定位
"附灵" = 装备上的**第三维属性**，独立于 primary_stat（主属性）和 sub_stats（副属性池）之外：
- **主属性** → 槽位决定
- **副属性** → 词条池随机 2-4 条数值加成
- **附灵**（新） → 槽位决定效果池，**每件装备至多 1 条**，提供战斗触发 / 独特数值效果

### 1.2 核心原则
1. **只给 3 个槽位**：兵器 weapon、法袍 armor、灵佩 pendant
2. **装备掉落不自带附灵**，需玩家用**附灵石**主动为装备附加；可用**灵枢玉**重新洗练
3. **仅蓝品及以上装备支持附灵**，白/绿装备不允许附灵操作
4. **品质决定数值档位**：蓝=1档，紫=2档，金=3档，红=4档（大致 ×1.5~1.7 递增）
5. **附灵道具 = 组队副本低概率掉落**，给秘境组队创造明确驱动力
6. **效果库高度复用战斗引擎已有钩子**（~70% 直接复用，~30% 新增轻量字段）

### 1.3 🔒 数值上限约束（核心安全护栏）

为避免"装备驱动"变成"装备爆炸"，与 v2.0 方案 A 的数字压缩目标对齐，所有附灵数值严格受以下硬上限约束：

| 属性类别 | 单件红品最高 | 3 件红品叠加最高 | v2.0 相关上限 |
|---------|-----------|--------------|------------|
| 吸血 `lifesteal` | 10% | 10%（clamp） | 怪物最高 15% |
| 暴击率 `critRate` | 12% | 30%（clamp） | 引擎 50% cap |
| 暴伤 `critDmg` | 60% | 不叠加上限（但概率低） | 引擎 300% cap |
| 闪避 `dodge` | 10% | 30%（clamp） | 引擎 30% cap |
| 主属性 % (攻击/气血/防御/身法) | 22% | 22%（每件最多一条） | 境界 70% + 被动 40% cap |
| 五系伤害加强 | 25% | 副属性池已有，不叠加 | — |
| 减伤 `damageReduction` | 10% | 20%（clamp） | 引擎新增 |
| 持续伤害概率（命中触发灼烧/中毒） | 25% | 40%（clamp） | — |
| 反伤 `reflectOnCrit` / 反噬持续伤害 | 50% | 一件生效（Max-Merge） | — |

**设计原则**：装备附灵是**倾向性增益**，不是数值核心。与境界、装备主副属性叠加后，玩家的"换装爽感"来自**新触发效果解锁**（"我居然暴击反伤了！"），而不是"数值翻倍"。

---

## 二、装备槽位定位

| 槽位 | 名称 | 定位 | 效果方向 | 本期条数 |
|------|------|------|---------|--------|
| `weapon` | 兵器 | 输出核心 | 进攻性（吸血 / 持续伤害 / 暴击 / 斩杀 / 元素） | **13** |
| `armor` | 法袍 | 生存核心 | 防御性（反伤 / 减伤 / 回血 / 抗性 / 免控） | **13** |
| `pendant` | 灵佩 | 辅助增益 | 功能性（身法 / 暴伤 / 神识 / 掉落 / 资源） | **12** |

**设计意图**：换兵器想输出，换法袍想扛伤，换灵佩想加料——附灵池与槽位心智模型强绑定。

---

## 三、附灵效果池

> 数值格式：百分比以**整数 %** 表示（如 5 表示 5%），代码中存小数（0.05）。

### 3.1 兵器附灵池（13 条 / 输出向）

| ID | 名称 | 效果 | 实现 | 蓝 | 紫 | 金 | 红 |
|----|------|------|-----|----|----|----|----|
| `aw_bloodlust` | 嗜血 | 攻击吸血 +X% | 复用 `lifesteal` | 3 | 5 | 7 | 10 |
| `aw_soulburn` | 焚魂 | 命中时 X% 概率灼烧 2 回合 | 新增 `burnOnHitChance` | 8 | 12 | 18 | 25 |
| `aw_venomfang` | 淬毒 | 命中时 X% 概率中毒 2 回合 | 新增 `poisonOnHitChance` | 8 | 12 | 18 | 25 |
| `aw_bloodrend` | 裂魂 | 命中时 X% 概率流血 2 回合 | 新增 `bleedOnHitChance` | 8 | 12 | 18 | 25 |
| `aw_keen` | 锋锐 | 暴击率 +X% | 复用 `critRate` | 3 | 5 | 8 | 12 |
| `aw_shatter` | 破军 | 攻击% +X% | 主属性攻击% 加成 | 5 | 8 | 12 | 18 |
| `aw_frenzy` | 狂怒 | 开场 4 回合 攻击 +X% | 新增 `frenzyOpening` 开场增益 | 12 | 20 | 30 | 45 |
| `aw_pierce` | 破甲 | 无视目标 X% 防御 | 新增 `armorPenPct`（或复用 破甲 副属性） | 5 | 8 | 12 | 18 |
| `aw_execute` | 斩杀 | 目标 气血<30% 时伤害 +X% | 新增 `executeBonus` | 15 | 25 | 40 | 60 |
| `aw_wrath` | 逆鳞 | 自己 气血<50% 时 攻击 +X% | 新增 `lowHpAtkBonus` | 10 | 18 | 28 | 40 |
| `aw_five_elements` | 五行·X | 对应五系伤害 +X%（火/金/水/木/土随机 1 系） | 复用 `FIRE_DMG`/`METAL_DMG` 等 | 8 | 13 | 18 | 25 |
| `aw_chain` | 连击 | 普攻 X% 概率再打 1 次（造成 60% 伤害） | 新增 `chainAttackChance` | 5 | 8 | 12 | 18 |
| `aw_crit_bonus` | 噬心 | 暴击伤害 +X% | 复用 `critDmg` | 10 | 18 | 28 | 40 |

### 3.2 法袍附灵池（13 条 / 生存向）

| ID | 名称 | 效果 | 实现 | 蓝 | 紫 | 金 | 红 |
|----|------|------|-----|----|----|----|----|
| `aw_adamant` | 金刚 | 防御% +X% | 主属性防御% 加成 | 6 | 10 | 15 | 22 |
| `aw_bastion` | 磐石 | 气血% +X% | 主属性气血% 加成 | 6 | 10 | 15 | 22 |
| `aw_thorns` | 荆棘 | 受暴击时 X% 反弹伤害 | 复用 `reflectOnCrit` | 15 | 25 | 35 | 50 |
| `aw_venomshell` | 毒刺甲 | 受击时 X% 概率使对方中毒 | 复用 `poisonOnHitTaken` | 10 | 15 | 20 | 30 |
| `aw_flameward` | 烈焰甲 | 受击时 X% 概率使对方灼烧 | 复用 `burnOnHitTaken` | 10 | 15 | 20 | 30 |
| `aw_evasion` | 疾影 | 闪避 +X% | 复用 `dodge` | 3 | 5 | 7 | 10 |
| `aw_regen` | 回春 | 每回合回复最大气血 X% | 新增 `regenPerTurn` | 2 | 3 | 5 | 7 |
| `aw_mitigation` | 护佑 | 受到伤害减免 X% | 新增 `damageReduction` | 3 | 5 | 8 | 10 |
| `aw_unyield` | 不屈 | 自己 气血<30% 时 防御 +X% | 新增 `lowHpDefBonus` | 15 | 25 | 40 | 60 |
| `aw_free` | 脱困 | 控制抗性 +X% | 复用 `ctrlResist` | 8 | 15 | 22 | 30 |
| `aw_cleanse` | 洗髓 | 每 N 回合清除 1 个减益 | 新增 `cleanseInterval` | 6回合 | 5回合 | 4回合 | 3回合 |
| `aw_hexward` | 无相 | 对所有系伤害抗性 +X% | 复用 `resists`（全系） | 3 | 5 | 7 | 10 |
| `aw_crit_shield` | 金钟罩 | 受到暴击时伤害再减 X% | 新增 `critTakenReduction` | 10 | 18 | 25 | 35 |

### 3.3 灵佩附灵池（12 条 / 辅助向）

| ID | 名称 | 效果 | 实现 | 蓝 | 紫 | 金 | 红 |
|----|------|------|-----|----|----|----|----|
| `aw_swift` | 疾风 | 身法% +X% | 主属性身法% 加成 | 6 | 10 | 15 | 22 |
| `aw_doom` | 玄冥 | 暴伤 +X% | 复用 `critDmg` | 15 | 25 | 40 | 60 |
| `aw_insight` | 神识 | 神识 +X 点（每点神识 +0.5% 神通伤害） | 复用 `spirit` flat | 10 | 20 | 35 | 60 |
| `aw_harmony` | 聚元 | 攻击/气血/防御 同时 +X% | 三主属性 % 叠加（一次性 clamp） | 3 | 5 | 7 | 10 |
| `aw_fortune` | 福缘 | 装备/功法/灵草掉率 +X% | 复用 `LUCK` 副属性通道 | 5 | 8 | 12 | 18 |
| `aw_spirit_gather` | 聚灵 | 战斗获得灵石 +X% | 复用 `SPIRIT_DENSITY` 副属性通道 | 5 | 8 | 12 | 18 |
| `aw_exp_gain` | 悟道 | 战斗获得经验 +X% | 新增 `expBonus`（仅影响战利品阶段） | 5 | 8 | 12 | 18 |
| `aw_vs_boss` | 破妄 | 对 首领 伤害 +X% | 新增 `vsBossBonus` | 5 | 8 | 12 | 18 |
| `aw_vs_elite` | 惩戒 | 对精英怪（role: dps/tank）伤害 +X% | 新增 `vsEliteBonus` | 5 | 8 | 12 | 15 |
| `aw_debuff_lord` | 天师 | 施加 减益 的持续回合 +X（不含控制类：冻结/眩晕/束缚/沉默） | 新增 `debuffDurationBonus` | +0 | +1 | +1 | +2 |
| `aw_accuracy` | 洞悉 | 命中 +X（抵消怪物闪避） | 复用 `ACCURACY` 副属性 | 5 | 8 | 12 | 18 |
| `aw_sect_bonus` | 弘愿 | 宗门贡献获得 +X%（签到/任务/首领） | 新增 `sectContribBonus`（战斗外） | 5 | 8 | 12 | 18 |

---

## 四、附灵获取流程（道具驱动）

### 4.1 两种附灵道具

| 道具 ID | 名称 | 用途 | 需目标 | 图标色 |
|---------|------|------|--------|--------|
| `awaken_stone` | 附灵石 | 给一件**无附灵**的装备附加 1 条随机附灵 | 蓝+ 品且无附灵的装备 | 青色 #5ACBFF |
| `awaken_reroll` | 灵枢玉 | 将一件**有附灵**的装备附灵重新随机 | 蓝+ 品且已有附灵的装备 | 金色 #FFAA00 |

**设计意图**：
- 附灵石 = "从无到有"的兴奋感，保证人人可用
- 灵枢玉 = "追求极品词条"的高阶诉求，玩家在满足基础附灵后为更优词条继续刷副本
- 两者形成**入门 → 进阶**双层驱动

### 4.2 附灵石使用流程

```
[选中一件装备] → [点击附灵按钮] → [对话框显示目标装备信息]
 ├─ 校验：装备槽位 ∈ {weapon, armor, pendant}
 ├─ 校验：装备品质 ∈ {blue, purple, gold, red}
 ├─ 校验：awaken_effect 为 NULL
 ├─ 消耗附灵石 ×1
 ├─ 按装备槽位读取对应效果池（weapon=13/armor=13/pendant=12）
 ├─ 池中随机 1 条附灵
 ├─ 数值按装备品质取档（蓝/紫/金/红）
 └─ 写入 character_equipment.awaken_effect 字段
```

### 4.3 灵枢玉使用流程

```
[选中一件有附灵的装备] → [点击洗练按钮] → [显示当前附灵 → 提示"重新随机"]
 ├─ 校验：awaken_effect 不为 NULL
 ├─ 消耗灵枢玉 ×1
 ├─ 在对应槽位效果池内随机 1 条（保证与当前 id 不同）
 ├─ 数值按装备品质取档
 └─ 覆写 awaken_effect 字段
```

**反挫败设计**：
- **新附灵保证与旧附灵 id 不同**（避免"洗到原样"的体感差）
- **确认再消耗**：API 流程是"服务端预生成结果 → 返回给前端对话框 → 玩家确认后消耗 + 落库"，防止玩家"预览后不合意不消耗"的刷保也保住玩家决策权（结果已定，只是等玩家点"确认"）

### 4.4 五行·X 的子词条选择

`aw_five_elements` 随机时再次抽选一个元素：

```ts
const elements = ['fire', 'metal', 'water', 'wood', 'earth'];
const elem = elements[rand(0, 4)];
return {
  id: 'aw_five_elements',
  name: `五行·${ELEM_NAME[elem]}`,    // 五行·炎 / 五行·锐 / 五行·渊 / 五行·荣 / 五行·厚
  stat: `${elem.toUpperCase()}_DMG_PCT`,
  value: tiers[rarity],
  meta: { element: elem },
};
```

### 4.5 组队副本掉率

附灵石与灵枢玉均加入 `server/utils/secretRealmDrops.ts` 的秘境掉落逻辑，按**难度分档**：

| 道具 | 普通 | 困难 | 噩梦 | Boss 波额外保底 |
|------|------|------|------|--------------|
| 附灵石 `awaken_stone` | 25% / 场 | 50% / 场 | 80% / 场 | Boss 波 +1 件（噩梦 +2） |
| 灵枢玉 `awaken_reroll` | 5% / 场 | 15% / 场 | 35% / 场 | 仅噩梦 Boss 30% 追加 1 件 |

**分配规则**：
- 附灵石：按**人头均分**，总数 < 队伍人数时每人至少 1 件；剩余按贡献加权
- 灵枢玉：按**贡献度加权**，贡献第一 ×1.5 权重（对齐金装分配规则）

**设计意图**：
- 附灵石掉率宽松，组一两次普通副本就能试水
- 灵枢玉稀有度 5-7x 差距，呼应"高追求"定位
- Boss 保底让每次副本都有确定回报，降低"空跑"挫败

### 4.6 显示方式

装备详情 tooltip 在副属性之后新增一行（前缀 ✦ + 高亮色 `#FFAA00`）：

```
[金品] 太古·青霜剑  +7
主属性: 攻击 +450
副属性: 暴伤 +12%、破甲 +3、金系强化 +5、暴击率 +4%
✦ 附灵·焚魂    命中时 18% 概率灼烧 2 回合
```

- 无附灵的蓝+ 装备：操作区显示 `[附灵 ✦]` 按钮（未附灵时按钮做**呼吸光效提示**引导）
- 有附灵的装备：操作区显示 `[洗练 ✦]` 按钮

### 4.7 背包图标

背包列表项右上角给带附灵的装备加一个小标记 ✦（金色），方便玩家一眼识别。

---

## 五、数据结构改动

### 5.1 数据库

`character_equipment` 表新增一个字段：

```sql
ALTER TABLE `character_equipment`
  ADD COLUMN `awaken_effect` JSON DEFAULT NULL AFTER `sub_stats`;
```

`awaken_effect` 结构（JSON）：
```json
{
  "id": "aw_soulburn",
  "stat": "burnOnHitChance",
  "value": 0.18,
  "meta": null
}
```

- `id`：对应 `AWAKEN_POOLS` 中的定义 id（名称/描述动态取）
- `stat`：战斗引擎聚合时的 switch 分发 key
- `value`：生效数值
- `meta`：可选扩展字段（如 `aw_five_elements` 存 `{ element: 'fire' }`）

**存档兼容**：`NULL` = 无附灵，不影响已有装备。

### 5.2 前端/引擎类型

```ts
// game/equipData.ts
export interface AwakenEffect {
  id: string;
  stat: string;
  value: number;
  meta?: Record<string, any> | null;
}

export interface Equipment {
  // ... 既有字段
  awaken_effect?: AwakenEffect | null;
}
```

### 5.3 效果池定义（新文件）

```ts
// game/awakenData.ts — 新文件 ~300 行
export interface AwakenDef {
  id: string;
  name: string;
  slot: 'weapon' | 'armor' | 'pendant';
  stat: string;
  tiers: { blue: number; purple: number; gold: number; red: number };
  desc: (value: number, meta?: any) => string;
}

export const AWAKEN_POOLS: Record<string, AwakenDef[]> = {
  weapon: [ /* 13 条 */ ],
  armor:  [ /* 13 条 */ ],
  pendant:[ /* 12 条 */ ],
};

/**
 * 按装备槽位和品质随机生成一条附灵
 * @param slot 装备槽位
 * @param rarity 装备品质（决定数值档位）
 * @param excludeId 排除的附灵 id（灵枢玉洗练时传当前 id，避免洗到原样）
 */
export function rollAwakenEffect(slot: string, rarity: string, excludeId?: string): AwakenEffect | null;
```

### 5.4 道具定义（扩展 `game/sectItems.ts` 改名为 `game/items.ts`）

参见第七节 UI 改动 — 原 `sectItems.ts` 重命名为通用 `items.ts`，新增 `awaken` 分类及两个道具：

```ts
// game/items.ts（由 sectItems.ts 改名）
export const ITEM_INFO: Record<string, ItemInfo> = {
  // ... 既有道具（强化保护符、鉴定符、精魂、碎片、道果、突破丹、洗髓丹、万能残页）
  awaken_stone:  { name: '附灵石',   description: '为一件蓝+品装备附加一条随机附灵', category: 'awaken', needsTarget: 'equip' },
  awaken_reroll: { name: '灵枢玉',   description: '重新随机一件装备的附灵',             category: 'awaken', needsTarget: 'equip' },
};

export const ITEM_CATEGORIES = [
  { id: 'enhance',   name: '强化' },
  { id: 'equip',     name: '装备' },
  { id: 'awaken',    name: '附灵' },   // ← 新增
  { id: 'character', name: '修为' },
  { id: 'skill',     name: '功法' },
  { id: 'craft',     name: '合成' },
];
```

### 5.5 新增 API：`/api/equipment/awaken.post.ts`

```ts
// 输入
{ equipId: number, itemId: 'awaken_stone' | 'awaken_reroll' }

// 校验
- 装备存在且属于当前角色
- 装备槽位 ∈ {weapon, armor, pendant}
- 装备品质 ∈ {blue, purple, gold, red}
- awaken_stone：awaken_effect 必须为 NULL
- awaken_reroll：awaken_effect 必须非 NULL
- 背包中对应道具 count ≥ 1

// 事务
1. 扣道具 -1
2. rollAwakenEffect(slot, rarity, excludeId?)
3. UPDATE character_equipment SET awaken_effect = ? WHERE id = ?

// 返回
{ success: true, equipment: { ...with new awaken_effect } }
```

---

## 六、战斗引擎改动

### 6.1 玩家属性聚合（统一 switch 分发）

在 `battleEngine.ts` 玩家属性聚合阶段追加：

```ts
for (const eq of equippedList) {
  const aw = eq.awaken_effect;
  if (!aw) continue;
  applyAwakenToPlayer(player, aw);
}

function applyAwakenToPlayer(p: any, aw: AwakenEffect) {
  const v = aw.value;
  switch (aw.stat) {
    // —— 已有钩子直接叠加 ——
    case 'lifesteal':          p.lifesteal += v; break;
    case 'critRate':           p.critRate += v; break;
    case 'critDmg':            p.critDmg += v; break;
    case 'dodge':              p.dodge += v; break;
    case 'spirit':             p.spirit += v; break;
    case 'ctrlResist':         p.ctrlResist = Math.min(0.7, p.ctrlResist + v); break;
    case 'poisonOnHitTaken':   p.poisonOnHitTaken = Math.max(p.poisonOnHitTaken, v); break;
    case 'burnOnHitTaken':     p.burnOnHitTaken = Math.max(p.burnOnHitTaken, v); break;
    case 'reflectOnCrit':      p.reflectOnCrit = Math.max(p.reflectOnCrit, v); break;
    // —— 主属性 % 加成 ——
    case 'atkPct':             p.atk = Math.floor(p.atk * (1 + v)); break;
    case 'defPct':             p.def = Math.floor(p.def * (1 + v)); break;
    case 'hpPct':              p.maxHp = Math.floor(p.maxHp * (1 + v)); p.hp = p.maxHp; break;
    case 'spdPct':             p.spd = Math.floor(p.spd * (1 + v)); break;
    case 'harmonyPct':         p.atk = Math.floor(p.atk * (1+v)); p.def = Math.floor(p.def*(1+v)); p.maxHp = Math.floor(p.maxHp*(1+v)); p.hp = p.maxHp; break;
    // —— 元素伤害加成（合并至副属性通道）——
    case 'FIRE_DMG_PCT':       p.elementDmg.fire += v; break;
    case 'METAL_DMG_PCT':      p.elementDmg.metal += v; break;
    case 'WATER_DMG_PCT':      p.elementDmg.water += v; break;
    case 'WOOD_DMG_PCT':       p.elementDmg.wood += v; break;
    case 'EARTH_DMG_PCT':      p.elementDmg.earth += v; break;
    // —— 资源 / 掉率 / 命中 ——
    case 'LUCK':               p.luck = (p.luck||0) + v; break;
    case 'SPIRIT_DENSITY':     p.spiritDensity = (p.spiritDensity||0) + v; break;
    case 'ACCURACY':           p.accuracy = (p.accuracy||0) + v; break;
    case 'expBonus':           p.expBonus = (p.expBonus||0) + v; break;
    case 'sectContribBonus':   p.sectContribBonus = (p.sectContribBonus||0) + v; break;
    // —— 新增条件型 / 触发型 ——
    case 'burnOnHitChance':    p.burnOnHitChance = (p.burnOnHitChance||0) + v; break;
    case 'poisonOnHitChance':  p.poisonOnHitChance = (p.poisonOnHitChance||0) + v; break;
    case 'bleedOnHitChance':   p.bleedOnHitChance = (p.bleedOnHitChance||0) + v; break;
    case 'chainAttackChance':  p.chainAttackChance = (p.chainAttackChance||0) + v; break;
    case 'armorPenPct':        p.armorPenPct = (p.armorPenPct||0) + v; break;
    case 'executeBonus':       p.executeBonus = (p.executeBonus||0) + v; break;
    case 'lowHpAtkBonus':      p.lowHpAtkBonus = (p.lowHpAtkBonus||0) + v; break;
    case 'lowHpDefBonus':      p.lowHpDefBonus = (p.lowHpDefBonus||0) + v; break;
    case 'damageReduction':    p.damageReduction = Math.min(0.20, (p.damageReduction||0) + v); break;
    case 'critTakenReduction': p.critTakenReduction = Math.min(0.50, (p.critTakenReduction||0) + v); break;
    case 'regenPerTurn':       p.regenPerTurn = (p.regenPerTurn||0) + v; break;
    case 'cleanseInterval':    p.cleanseInterval = Math.min(p.cleanseInterval||999, v); break;
    case 'allResistBonus':     ['fire','metal','water','wood','earth'].forEach(e => p.resists[e] = Math.min(0.7, (p.resists[e]||0) + v)); break;
    case 'frenzyOpening':      p.frenzyOpening = (p.frenzyOpening||0) + v; break;
    case 'vsBossBonus':        p.vsBossBonus = (p.vsBossBonus||0) + v; break;
    case 'vsEliteBonus':       p.vsEliteBonus = (p.vsEliteBonus||0) + v; break;
    case 'debuffDurationBonus':p.debuffDurationBonus = (p.debuffDurationBonus||0) + v; break;
  }
}
```

### 6.2 触发时机改动（分散钩子）

| 字段 | 插入位置 | 逻辑 |
|------|---------|-----|
| `frenzyOpening` | `initCombat` 末尾 | 加一条 `atk_up` 增益，value=v，duration=4 |
| `burnOnHitChance` / `poisonOnHitChance` / `bleedOnHitChance` | 玩家命中结算后 | `if (Math.random() < p.xxxChance) applyDebuff(target, 'burn'\|'poison'\|'bleed', 2, p.atk)` |
| `chainAttackChance` | 玩家普攻后 | `if (Math.random() < p.chainAttackChance) doExtraAttack(0.6)` — 基于当前攻击重复一次，倍率 60% |
| `armorPenPct` | 伤害公式 `atkDefRatio` 计算前 | `effectiveDef *= (1 - p.armorPenPct)` |
| `executeBonus` | 伤害结算乘法链 | `if (target.hp / target.maxHp < 0.3) damage *= 1 + p.executeBonus` |
| `lowHpAtkBonus` | 玩家 攻击 动态使用点 | `if (p.hp / p.maxHp < 0.5) effectiveAtk *= 1 + p.lowHpAtkBonus` |
| `lowHpDefBonus` | 玩家 防御 动态使用点 | `if (p.hp / p.maxHp < 0.3) effectiveDef *= 1 + p.lowHpDefBonus` |
| `damageReduction` | 玩家受伤入口 | `incoming *= 1 - p.damageReduction` |
| `critTakenReduction` | 玩家受暴击结算 | `if (isCrit) incoming *= 1 - p.critTakenReduction` |
| `regenPerTurn` | 每回合开始 | `p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * p.regenPerTurn))` |
| `cleanseInterval` | 每回合结束 | 累计回合，每满 N 回合移除一个最老的 减益 |
| `vsBossBonus` / `vsEliteBonus` | 伤害结算乘法链 | 按 `target.role` 判定叠乘 |
| `debuffDurationBonus` | applyDebuff 调用入口 | `duration += p.debuffDurationBonus` |

### 6.3 连击 / 触发减益的防循环

- **连击**：每次攻击只触发 1 次，连击自身不再触发 持续伤害 附灵（避免链式递归）
- **多条同类 持续伤害 附灵**：焚魂 + 五行·炎 同存在时，以独立 roll 判定，但同目标的同类 减益 已有引擎去重逻辑（后到的刷新时长）

---

## 七、UI 改动

### 7.1 装备操作区新增附灵按钮（核心）

装备操作区当前按钮布局：`[装备] [强化] [鉴定] [升品] [出售]`。

在 `[强化]` 与 `[鉴定]` 之间插入附灵按钮，状态分三档：

| 装备状态 | 按钮文案 | 按钮色 | 点击行为 |
|---------|---------|-------|---------|
| 非 weapon/armor/pendant 槽位 | `附灵 ✦` | 灰（禁用） | 提示"该槽位不支持附灵" |
| 蓝+ 且无附灵 | `附灵 ✦` | 青色 + 呼吸光 | 打开附灵石消耗对话框 |
| 蓝+ 且已有附灵 | `洗练 ✦` | 金色 | 打开灵枢玉洗练对话框 |
| 白/绿 品 | `附灵 ✦` | 灰（禁用） | 提示"白/绿品装备无法附灵" |

**附灵对话框**（`AwakenDialog.vue`，新组件）：
```
┌─────────────────────────────────┐
│  装备附灵 · 太古·青霜剑 (金品)    │
│                                │
│  当前附灵：无                  │
│                                │
│  [消耗] 附灵石 ×1 (拥有 3)      │
│  [可能获得] 兵器池 13 条附灵之一 │
│                                │
│         [ 附灵 ]  [ 取消 ]      │
└─────────────────────────────────┘
```

洗练对话框类似，但显示"当前附灵 → 新附灵"对比（新附灵由服务端预生成返回）。

### 7.2 装备详情 tooltip

```vue
<div v-if="equip.awaken_effect" class="awaken-row">
  <span class="awaken-prefix">✦</span>
  <span class="awaken-name">附灵·{{ awakenName }}</span>
  <span class="awaken-desc">{{ awakenDesc }}</span>
</div>
```

CSS：
```css
.awaken-row { color: #FFAA00; font-weight: 600; margin-top: 6px; border-top: 1px dashed #FFAA0055; padding-top: 4px; }
.awaken-prefix { margin-right: 4px; }
```

### 7.3 背包列表
带附灵的装备右上角 `✦` 小标记，`title` 鼠标悬停显示附灵名。

### 7.4 "宗门道具" → "道具"（全局改名 + 通用化）

**背景**：原有物品系统依附于"宗门"Tab（宗门商店 / 宗门道具），本质上是玩家的**通用消耗品仓库**，只是初期所有道具都通过宗门商店购买。随着副本掉落（附灵石 / 灵枢玉）、后续扩展（神魂石、炼体丹、灵兽蛋等）加入，"宗门"标签已无法覆盖。

**改名方案**：
- 原入口 `宗门 > 道具` → 独立 Tab `道具` (`pages/items.vue` 或集成到背包 Tab)
- 原文件 `game/sectItems.ts` → `game/items.ts`，导出改名为 `ITEM_INFO`（保持向后兼容可先加 `export const SECT_ITEM_INFO = ITEM_INFO`）
- 原 DB 字段 `character_materials` 表无需动（字段已经是通用的 `item_id / count`）
- 道具列表按 `category` 分 Tab：`强化 / 装备 / 附灵(新) / 修为 / 功法 / 合成`
- 宗门商店保持不变（仍然出售**部分**道具），但道具**展示**与**使用**入口从宗门独立出来

**UI 布局示意**：
```
[道具]                          (拥有 12 类)
├─ 强化  [保护符 ×3] [大师符 ×1]
├─ 装备  [鉴定符 ×5] [精魂 ×2]
├─ 附灵  [附灵石 ×8] [灵枢玉 ×1]    ← 新分类
├─ 修为  [道果 ×1] [突破丹 ×2] [洗髓丹 ×1]
├─ 功法  [万能残页 ×3]
└─ 合成  [套装碎片 ×4]
```

**扩展位预留**：后续新增的 `战魂石`（宗门 Boss 掉落）、`灵兽蛋`（秘境特殊产出）等都可直接落进这个 Tab 下对应分类，不再受"宗门"语义限制。

### 7.5 战斗日志
附灵触发时输出特殊日志行（前缀 ✦ + 金色）：
```
✦ 【焚魂】炼狱魔君 陷入灼烧
✦ 【连击】再次出手，造成 3,450 伤害
✦ 【斩杀】目标濒死，伤害爆发 +40%
```

---

## 八、实施工作量估算

| 模块 | 工作内容 | 代码量 |
|------|---------|-------|
| 1. 数据库迁移 | `ALTER TABLE character_equipment ADD awaken_effect JSON` | ~3 行 SQL |
| 2. 效果池定义 | 新建 `game/awakenData.ts`（38 条 + rollAwakenEffect + 五行·X 扩展） | ~320 行 |
| 3. 类型扩展 | `Equipment` / `AwakenEffect` 接口 | ~15 行 |
| 4. **新增道具定义** | `game/sectItems.ts` → `game/items.ts` 改名 + 新增 `awaken` 分类 + 2 个道具 | ~30 行 |
| 5. **新增附灵 API** | `server/api/equipment/awaken.post.ts`（校验 + 道具扣除 + 洗练 exclude） | ~90 行 |
| 6. **秘境掉落扩展** | `server/utils/secretRealmDrops.ts` 加附灵石/灵枢玉生成 + 分配 | ~60 行 |
| 7. 战斗引擎聚合 | `applyAwakenToPlayer` switch 分发 | ~80 行 |
| 8. 分散钩子插桩 | 13 处触发位置（表 6.2） | ~120 行 |
| 9. 资源/掉率通道 | LUCK/SPIRIT_DENSITY 整合到战后结算 | ~25 行 |
| 10. **装备 UI 按钮** | 操作区新增附灵/洗练按钮 + `AwakenDialog.vue` 新组件 | ~180 行 |
| 11. 装备详情 tooltip | 附灵行 + 呼吸光效 CSS | ~40 行 |
| 12. 背包标记 | 装备列表右上角 ✦ 图标 | ~20 行 |
| 13. **道具 UI 改名** | 宗门 Tab 拆分 + `ITEM_CATEGORIES` Tab 组件 | ~150 行 |
| 14. 战斗日志 | 附灵触发日志行 | ~40 行 |
| **合计** | | **~1170 行 + 1 ALTER** |

**预计工期**：2 天写代码 + 1 天自测（含"附灵/洗练"端到端 + 每条附灵触发 + 秘境掉落概率仿真）。

---

## 九、验收清单

### 基础
- [ ] 装备掉落时**不**自带附灵（所有新装备 `awaken_effect = NULL`）
- [ ] 蓝+ 无附灵装备操作区显示 `[附灵]` 按钮并呼吸光效
- [ ] 蓝+ 已附灵装备操作区显示 `[洗练]` 按钮
- [ ] 白/绿 品装备附灵按钮禁用
- [ ] 非 weapon/armor/pendant 槽位装备附灵按钮禁用
- [ ] 附灵石消耗后装备成功获得随机附灵；无附灵石时按钮提示"缺少附灵石"
- [ ] 灵枢玉洗练后附灵 id 与旧值不同（至少一次验证）
- [ ] 灵枢玉消耗前玩家可取消（未点确认不扣道具）
- [ ] `aw_five_elements` 生成时随机选中 1 系，名称正确显示为"五行·X"
- [ ] 装备详情 tooltip / 背包标记 / 战斗日志均正常
- [ ] 老存档装备 `awaken_effect = NULL` 不报错

### 道具与副本
- [ ] 附灵石 / 灵枢玉按表 4.5 的概率从组队副本掉落（通过 100 次仿真验证）
- [ ] 附灵石按人头均分分配；灵枢玉按贡献度加权分配
- [ ] "道具"Tab 改名生效，`awaken` 分类下能看到附灵石 / 灵枢玉
- [ ] 既有道具（保护符、精魂、道果等）在新"道具"Tab 下分类正确
- [ ] 宗门商店仍能购买原有道具（不受改名影响）

### 兵器（13 条）
- [ ] 嗜血：战斗日志出现吸血回复行
- [ ] 焚魂 / 淬毒 / 裂魂：命中后目标对应 减益 上身
- [ ] 锋锐 / 噬心：面板暴击率、暴伤正确 +数值
- [ ] 破军：总面板 攻击 按 (1 + v) 增长
- [ ] 狂怒：开场第 1-4 回合 攻击 高于基础，第 5 回合恢复
- [ ] 破甲：对 首领 伤害比不带时显著增加（首领 防御 权重 0.5 受影响）
- [ ] 斩杀：首领 气血<30% 时伤害日志出现 +X% 提示
- [ ] 逆鳞：玩家残血时 攻击 提升，满血时无效
- [ ] 五行·X：对应系伤害在伤害日志中出现"元素强化"增幅
- [ ] 连击：战斗日志出现"✦【连击】再次出手"

### 法袍（13 条）
- [ ] 金刚 / 磐石：面板 防御 / 气血 按 (1 + v) 增长
- [ ] 荆棘：受暴击时对方掉血
- [ ] 毒刺甲 / 烈焰甲：受击时触发反噬 持续伤害
- [ ] 疾影：面板闪避 +数值
- [ ] 回春：每回合日志出现"回春 回复 X 点"
- [ ] 护佑：受伤数值 < 不带时（差 ~10%）
- [ ] 不屈：残血时 防御 提升
- [ ] 脱困：面板控制抗性 +数值
- [ ] 洗髓：每 N 回合清除一个 减益
- [ ] 无相：5 系抗性同时 +数值
- [ ] 金钟罩：受暴击时伤害减少 > 受普攻时

### 灵佩（12 条）
- [ ] 疾风：身法 按 % 增长
- [ ] 玄冥 / 神识：面板暴伤 / 神识正确 +
- [ ] 聚元：攻击/气血/防御 三维同时 +X%
- [ ] 福缘：连续战斗掉落率肉眼可感上升（可通过 1000 次战斗仿真验证）
- [ ] 聚灵：战斗灵石结算时 +X%
- [ ] 悟道：战斗经验结算时 +X%
- [ ] 破妄：对 首领 伤害 > 对普通怪
- [ ] 惩戒：对 dps/tank 精英怪伤害 +X%
- [ ] 天师：施加的 减益 持续回合 +X（不含控制类：冻结/眩晕/束缚/沉默）
- [ ] 洞悉：面板命中 +数值
- [ ] 弘愿：宗门签到/任务/首领 结算贡献 +X%

---

## 十、未来扩展（不在本期内）

### v1.3 — 附灵升级 / 合成
同名附灵 3 件合成进阶版（如 3 件蓝·嗜血 → 1 件紫·嗜血数值附灵石，可指定附到新装备）。

### v1.4 — 套装附灵
同套装 ≥ 2 件时解锁一条额外"套装附灵"（如金刚门套装 2 件 → 受击 10% 触发护盾）。

### v1.5 — 负面附灵 / 诅咒附灵
高品质附灵石有小概率附加时带负面词条（如 -5% 身法 换 +25% 攻击），给玩家取舍空间。配套"净化石"道具可去除负面。

### v1.6 — 附灵协同效果
特定 3 条附灵同时装备时解锁隐藏效果（如 焚魂+淬毒+裂魂 → 三系持续伤害叠加时额外真实伤害）。

### v1.7 — 高阶附灵石（宗门商店）
宗门商店推出**高阶附灵石** `awaken_stone_premium`（仅能在金/红装备使用，保证出高档附灵池），消耗贡献度购买，形成"副本通用 / 宗门高端"双轨。

### v1.8 — "道具"Tab 扩展位
随着内容增加，新分类可直接接入：
- `pet`（灵兽蛋 / 灵兽丹）
- `formation`（阵法卷轴 / 阵法灵石）
- `mount`（坐骑蛋 / 坐骑精华）
- `soul`（战魂石 / 魂核 — 宗门 Boss 掉落）

这些都只需在 `ITEM_CATEGORIES` 加一项 + `ITEM_INFO` 加条目，**UI 自动适配**。

---

## 附录 A：钩子复用一览

| 字段 | 引擎既有位置 | 本期复用条数 |
|------|-----------|------------|
| `lifesteal` | `battleEngine.ts:16,538,929` | 1（嗜血） |
| `critRate` | `battleEngine.ts:67` | 1（锋锐） |
| `critDmg` | `battleEngine.ts:67` | 2（玄冥、噬心） |
| `dodge` | `battleEngine.ts:67` | 1（疾影） |
| `spirit` | `battleEngine.ts:23` | 1（神识） |
| `ctrlResist` | `battleEngine.ts:351` | 1（脱困） |
| `poisonOnHitTaken` | `battleEngine.ts:71,719` | 1（毒刺甲） |
| `burnOnHitTaken` | `battleEngine.ts:72,722` | 1（烈焰甲） |
| `reflectOnCrit` | `battleEngine.ts:473,725` | 1（荆棘） |
| `resists` 五系 | `battleEngine.ts:378` | 1（无相） |
| `FIRE/METAL/WATER/WOOD/EARTH_DMG` 副属性通道 | 既有 | 1（五行·X） |
| `LUCK` / `SPIRIT_DENSITY` / `ACCURACY` 副属性通道 | 既有 | 3（福缘 / 聚灵 / 洞悉） |
| 主属性 % 加成 | 既有聚合逻辑 | 5（破军/金刚/磐石/疾风/聚元） |
| **复用合计** | | **~20 条** |

新增钩子 18 个：
- **新增玩家主动触发**：`burnOnHitChance`, `poisonOnHitChance`, `bleedOnHitChance`, `chainAttackChance`
- **新增条件加成**：`executeBonus`, `lowHpAtkBonus`, `lowHpDefBonus`, `vsBossBonus`, `vsEliteBonus`, `armorPenPct`
- **新增受伤减免**：`damageReduction`, `critTakenReduction`
- **新增每回合逻辑**：`regenPerTurn`, `cleanseInterval`
- **新增开场增益**：`frenzyOpening`
- **新增减益持续**：`debuffDurationBonus`
- **新增战利品通道**：`expBonus`, `sectContribBonus`

**所有新增钩子都是"单点插桩"**，不改变既有战斗回合主流程。

---

## 附录 B：数值安全自检

以"满配玩家 T5 化神（3 件红品附灵全部最高档）"仿真：

| 维度 | 附灵贡献 | 其他来源 | 总计 | 是否超限 |
|------|---------|---------|------|---------|
| 攻击% | 破军 18% + 狂怒 45% + 逆鳞 40%（条件） | 境界 +21%，被动 +40% | 非条件时 79%，条件叠加 119% | 境界 +21% 后，原本面板 +103%，加附灵 119% → 共 222%（不破坏数量级） |
| 气血% | 磐石 22% + 聚元 10% | 境界 21% + 被动 40% | 93% | ✅ 未破 T5 仿真气血 预期 |
| 暴击率 | 锋锐 12% + 境界 6% + 副属性最多 ~15% | — | ~33% | ✅ 未破 60% 玩家 cap |
| 暴伤 | 噬心 40% + 玄冥 60% | 境界 30% + 副属性 ~36% | 166% | ✅ 未破 300% 引擎 cap |
| 吸血 | 嗜血 10% | — | 10% | ✅ 未破 15% 怪物 cap |
| 闪避 | 疾影 10% | 境界 3% | 13% | ✅ 未破 30% 引擎 cap |
| 减伤 | 护佑 10% + 金钟罩 35%（条件） | — | 非条件 10%，条件 40%（clamp 到 20%） | ✅ 触发受限 |

**结论**：满配 3 件红品附灵的总增益受既有 v2.0 上限（被动 40%、境界 70%、引擎 cap）与附灵自身的 clamp 共同约束，**不会破坏"T5 玩家需 combo 才能击杀 首领"的设计意图**，符合 v2.0 的数字压缩哲学。

---

**文档结束。**
