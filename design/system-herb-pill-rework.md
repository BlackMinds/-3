# 灵草分级系统重构设计文档

> 创建时间: 2026-04-08
> 状态: 设计中(待实施)
> 优先级: P1
> 工程量: 大型(预计涉及前后端 8-10 个文件、3 张数据表)

---

## 一、设计目标

### 1.1 当前问题

目前的灵草系统过于简单:
- 只有一种"灵草"(spirit_herb),没有种类区分
- 灵田升级只增加产量,种植内容不变
- 丹方消耗灵草数量,但灵草本身没有属性
- 丹药属性是固定的,缺少深度

### 1.2 改造目标

让"采药 → 炼丹"形成有深度的策略链:

1. **灵田可以选择种植不同的灵草** — 玩家有种植决策
2. **灵草有种类和品质** — 不同灵草用于不同丹方
3. **灵草品质影响丹药属性** — 高品质灵草炼出更强的丹药
4. **灵田升级解锁更高品质** — 长线养成目标
5. **野外采集** — 打怪也能掉落特殊灵草,丰富资源来源

---

## 二、核心设计

### 2.1 灵草种类(7 种)

按五行 + 通用 + 特殊 分类:

| 灵草ID | 名称 | 五行 | 用途 | 来源 |
|--------|------|------|------|------|
| `metal_herb` | 锐金草 | 金 | 攻击系丹药 | 灵田/金系怪物 |
| `wood_herb` | 青木叶 | 木 | 气血系丹药 | 灵田/木系怪物 |
| `water_herb` | 玄水苔 | 水 | 防御系丹药 | 灵田/水系怪物 |
| `fire_herb` | 赤焰花 | 火 | 暴击系丹药 | 灵田/火系怪物 |
| `earth_herb` | 厚土参 | 土 | 综合系丹药 | 灵田/土系怪物 |
| `common_herb` | 灵草 | 无 | 通用辅料 | 所有灵田/普通怪物 |
| `spirit_grass` | 仙灵草 | 无 | 突破丹药关键 | 高级灵田/Boss |

### 2.2 灵草品质(6 级)

| 品质 | 颜色 | 属性倍率 | 说明 |
|------|------|----------|------|
| 凡品 (white) | #CCCCCC | 1.00 | 最低等级 |
| 灵品 (green) | #00CC00 | 1.20 | 普通灵田主要产出 |
| 玄品 (blue) | #0066FF | 1.50 | 升级灵田后产出 |
| 地品 (purple) | #9933FF | 2.00 | 高级灵田/Boss掉落 |
| 天品 (gold) | #FFAA00 | 3.00 | 仅Boss/精英怪掉落 |
| 仙品 (red) | #FF3333 | 5.00 | 后期内容 |

### 2.3 灵田改造

#### 灵田地块系统

灵田升级不再只增加每小时产量,而是开放更多 **种植地块**:

| 灵田等级 | 地块数 | 最高品质 | 解锁种植 |
|----------|--------|----------|----------|
| Lv.1-3 | 2 | 凡品~灵品 | 灵草、锐金草、青木叶 |
| Lv.4-6 | 3 | 凡品~玄品 | + 玄水苔、赤焰花 |
| Lv.7-9 | 4 | 凡品~地品 | + 厚土参 |
| Lv.10-12 | 5 | 凡品~天品 | + 仙灵草 |
| Lv.13-15 | 6 | 凡品~仙品 | 全部 |

#### 种植机制

每个地块可以独立种植一种灵草:
- 选择种子(灵草类型) + 选择品质(只能种当前灵田支持的最高品质或更低)
- 种植后开始计时,种子消耗按品质收取灵石(或免费)
- **成熟时间**: 凡品 30分钟,灵品 1小时,玄品 2小时,地品 4小时,天品 8小时,仙品 16小时
- 成熟后可随时收获,也可累积(超过24h不再增长)

#### 灵田显示示例

```
灵田 Lv.5 (3地块/3地块)
┌─────────────────┐
│ 地块1: 锐金草·灵品 │
│  ✓ 已成熟 (3株)   │
│  [收获] [清理]    │
├─────────────────┤
│ 地块2: 青木叶·灵品 │
│  生长中 (45分钟)  │
├─────────────────┤
│ 地块3: 空        │
│  [种植]          │
└─────────────────┘
```

### 2.4 丹方系统改造

每种丹药需要消耗 **特定种类** 的灵草,而不是通用灵草:

#### 战斗丹药示例

**聚灵丹(攻击+15%, 10场)**
- 锐金草 × 3
- 灵草 × 2
- 灵石 × 500

**铁皮丹(防御+15%, 10场)**
- 玄水苔 × 3
- 灵草 × 2
- 灵石 × 500

**培元丹(气血+20%, 10场)**
- 青木叶 × 3
- 灵草 × 2
- 灵石 × 500

**破妄丹(会心率+8%, 10场)**
- 赤焰花 × 5
- 锐金草 × 3
- 灵草 × 5
- 灵石 × 1500

**天元丹(攻防血+10%, 15场)**
- 厚土参 × 5
- 锐金草 × 3
- 玄水苔 × 3
- 青木叶 × 3
- 灵草 × 10
- 灵石 × 5000

#### 突破丹药示例

**筑基丹** = 仙灵草×1 + 灵草×5 + 1000灵石
**凝元丹** = 仙灵草×3 + 玄水苔×5 + 灵草×10 + 5000灵石
**化神丹** = 仙灵草×10 + 厚土参×10 + 灵草×30 + 20000灵石
**渡劫丹** = 仙灵草×50 + 五行各15 + 100000灵石

### 2.5 灵草品质 → 丹药属性

**核心机制**: 灵草的平均品质决定丹药的属性倍率

#### 计算公式

```
丹药品质系数 = SUM(每种灵草的品质倍率 × 数量) / 总灵草数量
最终丹药效果 = 基础效果 × 丹药品质系数
```

#### 举例: 聚灵丹(基础效果 = 攻击+15%)

**用 3 株凡品锐金草 + 2 株凡品灵草炼制:**
- 品质系数 = (1.0×3 + 1.0×2) / 5 = 1.0
- 实际效果: **攻击 +15%**

**用 3 株玄品锐金草 + 2 株凡品灵草炼制:**
- 品质系数 = (1.5×3 + 1.0×2) / 5 = 1.30
- 实际效果: **攻击 +19.5%**

**用 3 株天品锐金草 + 2 株玄品灵草炼制:**
- 品质系数 = (3.0×3 + 1.5×2) / 5 = 2.40
- 实际效果: **攻击 +36%**

#### 持续场次也会变化

战斗丹药持续场次也按品质系数加成:
- 系数 1.0 → 10场(基础)
- 系数 1.5 → 15场
- 系数 2.0 → 20场

#### 突破丹药修为加成

突破丹的 expGain 也按品质系数计算:
- 凡品筑基丹: 500 修为
- 玄品筑基丹: 750 修为
- 天品筑基丹: 1500 修为

### 2.6 炼丹界面改造

炼丹时玩家需要选择具体使用哪些品质的灵草:

```
炼制 [聚灵丹]

需要:
- 锐金草 × 3 [选择品质 ▼]
   ✓ 凡品 锐金草 (拥有8株)
   ✓ 灵品 锐金草 (拥有2株)
   ✗ 玄品 锐金草 (拥有0株)
- 灵草 × 2 [选择品质 ▼]
   ✓ 凡品 灵草 (拥有20株)

预览效果:
攻击 +18% (基础15% × 1.20)
持续 12场 (基础10场 × 1.20)
品质系数: 1.20

[确认炼制] [取消]
```

### 2.7 野外掉落

打怪时按地图属性掉落对应灵草:
- 火属性地图掉落赤焰花
- 水属性地图掉落玄水苔
- 普通地图掉落灵草

掉落品质按地图 tier 浮动:
- T1-T2: 凡品(80%)、灵品(20%)
- T3-T4: 灵品(60%)、玄品(40%)
- T5-T6: 玄品(50%)、地品(50%)
- T7+: 地品(60%)、天品(40%)

Boss 必掉一份对应属性的高品质灵草。

---

## 三、数据库改造

### 3.1 改造现有表

#### `character_materials` 表(扩展)

当前结构: `id, character_id, material_id, count`

改造为: 用 `material_id` 区分种类和品质,例如 `metal_herb_green`, `wood_herb_blue`

或者新增字段:
```sql
ALTER TABLE character_materials ADD COLUMN quality VARCHAR(10) DEFAULT 'white';
ALTER TABLE character_materials DROP INDEX unique_material;
ALTER TABLE character_materials ADD UNIQUE KEY unique_material_quality (character_id, material_id, quality);
```

### 3.2 新增表

#### `character_cave_plots` 表(灵田地块)

```sql
CREATE TABLE character_cave_plots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  character_id INT NOT NULL,
  plot_index INT NOT NULL COMMENT '地块编号 0~5',
  herb_id VARCHAR(30) DEFAULT NULL COMMENT '种植的灵草ID',
  herb_quality VARCHAR(10) DEFAULT NULL COMMENT '种植的灵草品质',
  plant_time DATETIME DEFAULT NULL COMMENT '种植时间',
  mature_time DATETIME DEFAULT NULL COMMENT '成熟时间',
  yield_count INT DEFAULT 0 COMMENT '产量',
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE KEY unique_plot (character_id, plot_index)
);
```

### 3.3 移除/重构

灵田原来的 `character_cave` 中的 `herb_field` 不再产出统一灵草,而是作为 **地块容器**。
- 当 `building_id = 'herb_field'` 时,level 决定地块数和最高品质
- 收获从 `character_cave_plots` 表读取

---

## 四、后端 API 改造

### 4.1 新增接口

#### `GET /api/cave/plots`
获取所有灵田地块状态

返回:
```json
{
  "code": 200,
  "data": [
    {
      "plot_index": 0,
      "herb_id": "metal_herb",
      "herb_quality": "green",
      "plant_time": "2026-04-08 10:00:00",
      "mature_time": "2026-04-08 11:00:00",
      "yield_count": 3,
      "is_mature": true
    },
    { "plot_index": 1, "herb_id": null, ... },
    ...
  ]
}
```

#### `POST /api/cave/plant`
在地块上种植

参数: `{ plot_index, herb_id, herb_quality }`

校验:
- 灵田等级是否解锁该地块
- 灵田等级是否支持该品质
- 地块是否为空
- 是否有种子(种子可以是免费的,直接从灵田等级生成)

#### `POST /api/cave/harvest`
收获地块

参数: `{ plot_index }`

校验: 灵草是否成熟

效果: 把灵草加到 `character_materials`,清空地块

#### `POST /api/cave/clear-plot`
清理地块(放弃当前种植)

参数: `{ plot_index }`

### 4.2 改造现有接口

#### `GET /api/pill/herb` → `GET /api/pill/herbs`
返回所有灵草种类和品质的库存:

```json
{
  "code": 200,
  "data": [
    { "herb_id": "metal_herb", "quality": "white", "count": 8 },
    { "herb_id": "metal_herb", "quality": "green", "count": 2 },
    { "herb_id": "common_herb", "quality": "white", "count": 20 },
    ...
  ]
}
```

#### `POST /api/pill/craft` 改造

参数:
```json
{
  "pill_id": "atk_pill_1",
  "herbs_used": [
    { "herb_id": "metal_herb", "quality": "white", "count": 3 },
    { "herb_id": "common_herb", "quality": "white", "count": 2 }
  ]
}
```

后端:
1. 校验玩家是否拥有这些灵草
2. 校验种类和数量是否匹配丹方需求
3. 扣减灵草和灵石
4. 计算品质系数,生成对应效果的丹药
5. 把品质系数也存到丹药记录里(`character_pills.quality_factor`)

#### `character_pills` 表加字段

```sql
ALTER TABLE character_pills ADD COLUMN quality_factor DECIMAL(4,2) DEFAULT 1.00;
```

不同品质系数的同名丹药要分开存储:
```sql
ALTER TABLE character_pills DROP INDEX unique_pill;
ALTER TABLE character_pills ADD UNIQUE KEY unique_pill_quality (character_id, pill_id, quality_factor);
```

---

## 五、前端改造

### 5.1 灵田页面改造(洞府标签下)

灵田从单个建筑卡变为独立的子页面或弹窗,显示所有地块:

```
┌────────────────────────────────────────────────────┐
│ 灵田 Lv.5  [3地块开放, 最高品质: 玄品]             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ 锐金草   │  │ 灵草     │  │   空    │            │
│  │ 灵品     │  │ 凡品     │  │         │            │
│  │ ✓成熟    │  │ 38分钟   │  │ [种植]  │            │
│  │ 3株      │  │          │  │         │            │
│  │ [收获]   │  │ [清理]   │  │         │            │
│  └─────────┘  └─────────┘  └─────────┘            │
│                                                    │
│  [一键收获]   [一键清理]                           │
└────────────────────────────────────────────────────┘
```

### 5.2 种植弹窗

```
┌──────────────────────┐
│ 选择种植              │
│ ━━━━━━━━━━━━━━━━━━━━ │
│ 灵草种类:             │
│  ○ 锐金草(金)         │
│  ○ 青木叶(木)         │
│  ○ 玄水苔(水)         │
│  ○ 赤焰花(火)         │
│  ○ 厚土参(土) 🔒(Lv7) │
│  ○ 灵草(无)           │
│                      │
│ 品质:                │
│  ○ 凡品 (30分钟)      │
│  ○ 灵品 (1小时)       │
│  ○ 玄品 (2小时) 🔒    │
│                      │
│  [开始种植] [取消]    │
└──────────────────────┘
```

### 5.3 灵草背包(炼丹页面顶部)

```
灵草库存:
[凡品 锐金草 ×8] [灵品 锐金草 ×2]
[凡品 青木叶 ×5] [玄品 青木叶 ×1]
[凡品 灵草 ×20]
[凡品 仙灵草 ×0]
```

### 5.4 炼丹页面改造

每个丹方变成可展开的卡片,展开后选择具体灵草:

```
┌─────────────────────────────────┐
│ 聚灵丹 [拥有: 3]                │
│ 攻击+15% 持续10场                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 锐金草 × 3                       │
│  [凡品×8] [灵品×2 ✓]            │
│ 灵草 × 2                         │
│  [凡品×20 ✓]                    │
│                                 │
│ 预览效果:                        │
│  攻击 +18% (1.20倍)             │
│  持续 12场                       │
│                                 │
│ 消耗: 500灵石                    │
│ [炼制]                           │
└─────────────────────────────────┘
```

### 5.5 丹药背包

同名丹药按品质分组显示:
```
聚灵丹
  ├─ ×3 (1.00倍 - 攻击+15% 10场)
  ├─ ×1 (1.20倍 - 攻击+18% 12场)
  └─ ×1 (2.40倍 - 攻击+36% 24场)
```

### 5.6 静态数据改造

#### 新建 `client/src/game/herbData.ts`

```typescript
export interface HerbDef {
  id: string;
  name: string;
  element: 'metal' | 'wood' | 'water' | 'fire' | 'earth' | null;
  description: string;
  unlockPlotMaxLevel: number; // 解锁该灵草需要的灵田等级
}

export interface HerbQualityDef {
  id: string;
  name: string;
  color: string;
  multiplier: number;     // 品质倍率
  growMinutes: number;    // 成熟时间(分钟)
  baseYield: number;      // 基础产量(株)
  unlockPlotLevel: number; // 解锁该品质需要的灵田等级
}

export const HERBS: HerbDef[] = [
  { id: 'common_herb', name: '灵草', element: null, description: '通用灵草', unlockPlotMaxLevel: 1 },
  { id: 'metal_herb', name: '锐金草', element: 'metal', description: '金系灵草', unlockPlotMaxLevel: 1 },
  { id: 'wood_herb', name: '青木叶', element: 'wood', description: '木系灵草', unlockPlotMaxLevel: 1 },
  { id: 'water_herb', name: '玄水苔', element: 'water', description: '水系灵草', unlockPlotMaxLevel: 4 },
  { id: 'fire_herb', name: '赤焰花', element: 'fire', description: '火系灵草', unlockPlotMaxLevel: 4 },
  { id: 'earth_herb', name: '厚土参', element: 'earth', description: '土系灵草', unlockPlotMaxLevel: 7 },
  { id: 'spirit_grass', name: '仙灵草', element: null, description: '突破必备', unlockPlotMaxLevel: 10 },
];

export const HERB_QUALITIES: HerbQualityDef[] = [
  { id: 'white',  name: '凡品', color: '#CCCCCC', multiplier: 1.00, growMinutes: 30,  baseYield: 3, unlockPlotLevel: 1  },
  { id: 'green',  name: '灵品', color: '#00CC00', multiplier: 1.20, growMinutes: 60,  baseYield: 3, unlockPlotLevel: 1  },
  { id: 'blue',   name: '玄品', color: '#0066FF', multiplier: 1.50, growMinutes: 120, baseYield: 4, unlockPlotLevel: 4  },
  { id: 'purple', name: '地品', color: '#9933FF', multiplier: 2.00, growMinutes: 240, baseYield: 4, unlockPlotLevel: 7  },
  { id: 'gold',   name: '天品', color: '#FFAA00', multiplier: 3.00, growMinutes: 480, baseYield: 5, unlockPlotLevel: 10 },
  { id: 'red',    name: '仙品', color: '#FF3333', multiplier: 5.00, growMinutes: 960, baseYield: 5, unlockPlotLevel: 13 },
];
```

#### 改造 `pillData.ts`

每个丹方的 `herbCost` 改成数组:

```typescript
export interface PillRecipe {
  ...
  herbCost: { herb_id: string; count: number }[];  // 改成数组
  baseEffect: { ... };  // 基础效果(品质系数 1.0 时)
}

export const PILL_RECIPES: PillRecipe[] = [
  {
    id: 'atk_pill_1',
    name: '聚灵丹',
    ...
    herbCost: [
      { herb_id: 'metal_herb', count: 3 },
      { herb_id: 'common_herb', count: 2 },
    ],
    baseEffect: { atkPercent: 15, duration: 10 },
  },
  ...
];
```

---

## 六、实施步骤

### 阶段 1: 基础数据(后端 + 数据)
1. 创建 `herbData.ts`(灵草和品质定义)
2. 改造 `pillData.ts`(丹方使用灵草数组)
3. 数据库迁移:
   - 添加 `character_cave_plots` 表
   - `character_materials` 加 `quality` 字段
   - `character_pills` 加 `quality_factor` 字段
4. 数据迁移:把现有的 `spirit_herb` 转为 `common_herb` 凡品

### 阶段 2: 灵田地块系统(后端)
5. 后端新增 `/api/cave/plots`、`/api/cave/plant`、`/api/cave/harvest`、`/api/cave/clear-plot`
6. 修改聚灵阵的产出逻辑(灵田改成不再自动产出)
7. 灵田升级解锁地块和品质的逻辑

### 阶段 3: 炼丹改造(后端)
8. 改造 `/api/pill/craft` 接收灵草数组
9. 新增 `/api/pill/herbs` 返回灵草分品质库存
10. 计算品质系数,丹药存品质系数

### 阶段 4: 前端灵田 UI
11. 灵田页面改造(地块网格)
12. 种植弹窗
13. 收获/清理逻辑

### 阶段 5: 前端炼丹 UI
14. 炼丹卡片改造(展开选灵草)
15. 灵草背包显示
16. 品质系数预览

### 阶段 6: 战斗丹药生效
17. 改造 `/api/pill/use` 应用品质系数
18. 战斗中读取品质系数生效 buff
19. 突破丹药使用按品质系数加修为

### 阶段 7: 野外掉落
20. 战斗引擎掉落特定灵草
21. 根据地图属性和 tier 决定灵草种类和品质

### 阶段 8: 测试和平衡
22. 验证所有数值
23. 调整品质系数和成熟时间

---

## 七、影响范围

### 7.1 涉及的文件

**后端 (4 个新增 / 修改):**
- `server/src/routes/cave.ts` (改造,新增 plot 相关接口)
- `server/src/routes/pill.ts` (改造 craft、herbs)
- `server/src/database/migration.sql` (新增表和字段)

**前端 (5 个新增 / 修改):**
- `client/src/game/herbData.ts` (新建)
- `client/src/game/pillData.ts` (改造 herbCost)
- `client/src/views/Game.vue` (灵田 UI、炼丹 UI 改造)
- `client/src/api/request.ts` (无需改)
- `client/src/stores/game.ts` (可能需要新加灵草缓存)

### 7.2 数据迁移

老用户已有的 `spirit_herb` 需要无损迁移:
```sql
-- 将所有 spirit_herb 转为 common_herb 凡品
UPDATE character_materials
SET material_id = 'common_herb', quality = 'white'
WHERE material_id = 'spirit_herb';
```

### 7.3 已发布丹药的兼容

老的 `character_pills` 记录默认 `quality_factor = 1.00`,效果保持不变。

---

## 八、设计权衡和注意事项

### 8.1 复杂度 vs 可玩性

⚠️ **风险**: 系统复杂度大幅提升,新手可能感到困难

**缓解方案**:
- 灵田 Lv.1-3 只解锁 3 种灵草,降低初期决策成本
- 炼丹界面默认勾选最低品质,玩家点确认就能炼
- 提供"自动选灵草"按钮(优先用低品质)

### 8.2 灵草种类太多?

7 种灵草 + 6 种品质 = 42 种状态,背包可能溢出。

**缓解方案**:
- 灵草背包按种类分组,品质用标签区分
- 不需要的低品质灵草可以"提纯"消耗 N 株凡品换 1 株灵品

### 8.3 丹方数量

7 个丹方 × 多种灵草组合 = 比较丰富的搭配,够用了。

**未来扩展**: 可以加"复合丹"概念,需要 5+ 种灵草炼制,效果叠加。

### 8.4 经济平衡

新系统让灵石需求降低(种植免费),需要重新平衡:
- 种植可以收取灵石(每次种植 100~10000)
- 高品质灵田升级灵石消耗大幅提高
- 提纯灵草也可以消耗灵石

---

## 九、决策点(开发前需确认)

请小夏确认以下设计决策:

### Q1: 灵草种植是否消耗种子?
- **方案 A**: 免费种植(灵田直接生成)
- **方案 B**: 消耗种子(每次种植扣灵石)
- **方案 C**: 灵草本身也是种子(种 1 株成熟后变 N 株)
使用方案a
### Q2: 同品质的同名丹药是否合并存储?
- **方案 A**: 同品质合并(背包简洁,但难以区分批次)
- **方案 B**: 每次炼制一条记录(精确,但背包可能很多条)
方案b
### Q3: 野外掉落的灵草和灵田产出是否相同?
- **方案 A**: 相同(野外掉落作为补充来源)
- **方案 B**: 不同(野外只掉特殊品种,灵田产基础品种)
方案a
### Q4: 是否保留"通用灵草"(`common_herb`)?
- **方案 A**: 保留作为辅料(每个丹方都需要)
- **方案 B**: 取消,所有丹方只用五行/特殊灵草
方案a
### Q5: 灵田升级和聚灵阵/聚宝盆的升级是否独立?
- **方案 A**: 独立(灵田升级不影响其他建筑)
- **方案 B**: 灵田升级解锁的品质需要其他建筑前置
方案b
### Q6: 炼丹失败是否消耗灵草?
- **方案 A**: 失败也消耗(玩家承担风险)
- **方案 B**: 失败返还灵草(只损失灵石)
方案a
---

## 十、参考时间估算

| 阶段 | 工作量 |
|------|--------|
| 阶段 1: 基础数据 | 2 小时 |
| 阶段 2: 灵田地块系统(后端) | 3 小时 |
| 阶段 3: 炼丹改造(后端) | 2 小时 |
| 阶段 4: 前端灵田 UI | 4 小时 |
| 阶段 5: 前端炼丹 UI | 3 小时 |
| 阶段 6: 战斗丹药生效 | 2 小时 |
| 阶段 7: 野外掉落 | 1 小时 |
| 阶段 8: 测试和平衡 | 2 小时 |
| **合计** | **约 19 小时** |

---

## 十一、后续可扩展方向

实现这个系统后,还可以扩展:

1. **灵草加工系统** — 凡品提纯为灵品(需要消耗多份)
2. **灵草交易** — 玩家间交易稀有灵草(需要先做社交系统)
3. **采药技能** — 角色等级提升采药成功率和数量
4. **特殊地块** — 灵田中可能出现"灵脉地块"(产出+50%)
5. **传说灵草** — 限时活动产出,炼制传说丹药
6. **丹炉系统** — 不同丹炉炼制不同丹药,提供额外加成

---

## 十二、文档版本

| 版本 | 日期 | 修改 |
|------|------|------|
| v0.1 | 2026-04-08 | 初始草案 |
