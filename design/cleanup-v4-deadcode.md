# V4 装备死代码清除手册（公测前最小风险版）

> 生成日期: 2026-05-15
> 适用版本: 公测前 commit `4356ab6` 之后
> 执行环境: Windows + PowerShell（项目根目录 `C:\Users\developer\Desktop\ecms\game`）
> 风险等级: **极低** —— 仅删本地校准脚本，不动任何生产代码路径

---

## 一、背景：为什么 V4 主体不能删

V4 是公测当下的**装备主干 + 数值地基**，不是"旧版本残留"。V5 当前只是 V4 之上叠加的「special drop + 元始天尊套 + boss 秘宝」扩展层。

| V4 在管什么 | 删了的后果 |
|---|---|
| `EQUIP_PRIMARY_V4` / `EQUIP_SUB_POOL_V4` / `RARITY_SUB_COUNT_V4` | 战斗/挂机/秘境/成就掉落全部崩溃 |
| `decideEquipPrimariesV4` / `rollSubStatsV4` | 主掉落入口失效 |
| `SUB_STAT_RANGE_V4` / `RARITY_IDX_MAP` | V5 自己也在 import，连带 V5 崩溃 |
| `reroll-sub-stats` API 用 V4 池 | 洗练接口失效 |
| 9 套套装系统（`rollEquipSet`） | 套装、套装重铸全部失效 |
| `pages/index.vue` 的 `V5_STAT_TO_V4_KEY` | 前端属性显示全错 |
| `equipment.ts` 中的 `getCharId` / `ensureLoadouts` / `syncLoadoutSlot` 等通用工具 | 几乎所有装备 API 失效 |

**结论：公测前只清死代码，不动骨架。V5 全面替换 V4 留到公测稳定后单独立项。**

---

## 二、本次清除清单

### 2.1 真正要删的文件（2 个）

| 路径 | 类型 | 删除理由 |
|---|---|---|
| `test/sim-equip-v4.ts` | V4 装备数值校准模拟脚本 | 仅本地一次性校准用，公测不依赖，无外部引用 |
| `test/sim-reroll-v4.ts` | V4 洗练接口验证脚本 | 同上，仅本地验证用 |

### 2.2 已落地的 UI 入口清理（2026-05-15 实施，公测删库前提下的死菜单清扫）

前提：公测会清空数据库，且 V5 灰度默认开启（蓝+全走 V5，白/绿走 V4 但不出套装）→ 公测后**不会再产出任何带 `set_id` 的 V4 套装装备**，V4 套装相关 UI 入口全部变成永远不可达的死菜单。本次只清「玩家可见但永远不可达」的 UI 入口，**代码骨架（EQUIP_SETS / rollEquipSet / battleEngine 套装 hooks / reforge-set API）全部保留**，防级联崩溃。

| 文件:行 | 改动 | 原因 |
|---|---|---|
| `components/MarketDrawer.vue:32-36` | 删除坊市「按套装筛选」下拉 select 块 | 公测后筛选结果永远 0 件 |
| `components/MarketDrawer.vue` (script) | 删 `EQUIP_SETS` import + `filter.set_id` 字段 + `reload()` 里 `q.set_id` 传参 | 配合上一项 |
| `pages/index.vue:2965` | 删帮助文档「套装碎片 / 合成 6 套套装(烈阳/渊海/万木/雷罚/磐岩/虚空)」行 | 2026-05-07 已下线（`migration.sql:1489`），帮助文档未同步 |
| `pages/index.vue:7771-7775` | 删 `set_reforge_voucher` 道具使用 toast | 重铸入口按钮已永远不显示，提示误导玩家 |
| `design/sql.md:196-202` | 删「重置套装」给老账号发 7 个 `set_reforge_voucher` 的 SQL | 公测删库无意义 |

### 2.3 保留不动但实际死掉的部分（防御性，避免引用链断）

| 路径 | 状态 |
|---|---|
| `game/items.ts:35` 道具 `set_reforge_voucher` 条目 | 保留 — 该字符串被 5 处代码引用（含后端 `reforge-set.post.ts` 直接消耗），删风险高于收益 |
| `pages/index.vue:1894-1901` 装备点击面板「重铸套装 ❖」按钮 | 保留 — `v-if="clickedEquip.set_id && ..."` 公测后永远 false，UI 自动隐藏 |
| `pages/index.vue:845-870` 套装重铸 dialog | 保留 — 入口已隐藏，dialog 不可达 |
| `pages/index.vue:488-525` 套装激活面板 | 保留 — `v-if="activeSetSummaries.length > 0"` 永远 false |
| `components/EquipDetail.vue` 套装信息显示 | 保留 — `v-if` 依赖 `set_id`，永远不触发 |

**验证依据**：
- 全仓库 grep `sim-equip-v4` / `sim-reroll-v4` 仅命中文件自身注释（`npx tsx test/sim-equip-v4.ts` 用法行），**无任何 import / 引用 / CI / package.json scripts 调用**
- `tsconfig.json` 继承 `.nuxt/tsconfig.json`，`test/` 目录不参与 Nuxt 生产构建
- 两文件均已 `git ls-files` 跟踪，需要用 `git rm` 删除并 commit

### 2.2 看着像 V4 死代码但**不能删**的（防误伤）

| 路径 | 看着像但实际是 | 不删原因 |
|---|---|---|
| `design/balance-intent-v3.md` | "v3" 听起来像旧版本 | 是当前 V4 数值的**设计意图源**，`balance.ts` 反推自这里 |
| `design/balance-audit-v3.md` | "v3" 听起来像旧版本 | V3 数值重构前的盘点，是 `shared/balance.ts` 单一数值源的依据 |
| `design/sim-report-v3.md` | "v3" 听起来像旧版本 | V3 模拟器基线报告，仍是数值参照 |
| `design/numerical-balance.md` | 含大量 V4 数值表 | 引用了 V3 文档，是数值文档主入口 |
| `shared/balance.ts` 的 `EQUIP_PRIMARY_V4` / `EQUIP_SUB_POOL_V4` / `RARITY_SUB_COUNT_V4` | 名字带 V4 | 公测主掉落数值表，删 = 装备无法生成 |
| `server/utils/equipment.ts` 中 `decideEquipPrimariesV4` / `rollSubStatsV4` / `SUB_STAT_RANGE_V4` / `FLAT_V4` / `GOOD_V4` / `RARITY_IDX_MAP` | 名字带 V4 | 公测主掉落主流程；V5 也在 import |
| `server/api/equipment/reroll-sub-stats.post.ts` 中 `EQUIP_SUB_POOL_V4` 引用 | 用了 V4 池 | 唯一的洗练实现，V5 没有洗练系统 |
| `pages/index.vue` 中 `V5_STAT_TO_V4_KEY` | 名字含 V4 | 前端把 V5 字段映射回 V4 SCREAMING_CASE 显示用，删 = UI 显示错乱 |
| `server/utils/equipment-v5.ts:44` 的 `import { SUB_STAT_RANGE_V4, RARITY_IDX_MAP }` | 名字带 V4 | V5 强化词条数值范围复用 V4 |

---

## 三、执行步骤

> 在项目根目录 `C:\Users\developer\Desktop\ecms\game` 下执行。每一步执行完再进下一步。

### Step 1：确认工作区干净 / 当前分支

```powershell
git status
git branch --show-current
```

**期望**：当前在 `main` 或预定清理分支；如果有未提交的脏改动，先 commit 或 stash 隔离。

### Step 2：再次确认 2 个 sim 脚本无外部引用

```powershell
git grep -n "sim-equip-v4|sim-reroll-v4"
```

**期望产出**：只命中 2 个文件自身的注释行（`用法：npx tsx test/sim-equip-v4.ts` 之类），没有别的命中。
若命中了 `package.json` / `.github/` / `nuxt.config.ts` / 任何 `.ts/.vue` 文件 → **停止删除**，先排查引用。

### Step 3：删除文件

```powershell
git rm test/sim-equip-v4.ts test/sim-reroll-v4.ts
```

### Step 4：验证 TypeScript 无新增报错

```powershell
npx nuxi typecheck
```

**期望**：报错数量与删除前一致（项目可能本就有历史报错，关注的是「没新增因为删除导致的找不到模块/找不到符号」类报错）。
若出现 `Cannot find module '../shared/balance'` 或 `Cannot find name 'rollSubStatsV4'` 之类 → **回退**（见第五节）。

### Step 5：验证关键测试仍跑通

```powershell
npx tsx test/balance-v5.test.ts
```

**期望**：和删除前一致跑通（V5 测试不依赖 V4 sim 脚本，应当无影响）。

### Step 6：手测一遍核心装备路径（公测前必跑）

启动 dev：

```powershell
npm run dev
```

在浏览器手测：
1. 打一场战斗 → 确认有装备掉落、副词条数量正确（红 6 / 金 5 / 紫 4 / 蓝 3 / 绿 2 / 白 1）
2. 离线挂机领取 → 确认有装备掉落
3. 洗练一件装备 → 确认副词条按部位池正确刷新
4. 强化一件装备 → 确认数值按 +10%/级递增
5. 重铸套装 → 确认套装能切换
6. 装备/卸下/出售/锁定 → 全部正常

任何一项异常 → 停止并回退。

### Step 7：提交（**等手测全过再 commit**）

```powershell
git commit -m @'
chore(equipment): 清除 V4 死代码 — 移除未引用的本地校准脚本

- 删除 test/sim-equip-v4.ts（V4 装备数值一次性校准模拟）
- 删除 test/sim-reroll-v4.ts（V4 洗练接口本地验证）
- V4 主体（EQUIP_PRIMARY_V4 / rollSubStatsV4 / SUB_STAT_RANGE_V4 等）
  保持原样 —— 公测主掉落仍走 V4，V5 仅 special drop 扩展层

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## 四、为什么不需要做的事

- ❌ **不需要**改 `shared/balance.ts`
- ❌ **不需要**改 `server/utils/equipment.ts`
- ❌ **不需要**改 `server/utils/equipment-v5.ts`
- ❌ **不需要**改任何 `server/api/equipment/*.post.ts`
- ❌ **不需要**改 `pages/index.vue`
- ❌ **不需要**删 `design/balance-intent-v3.md` 等 v3 命名文档
- ❌ **不需要**重命名 `_V4` 后缀的任何变量

---

## 五、回退方案

若 Step 4-6 任一步出现异常：

```powershell
git restore --staged test/sim-equip-v4.ts test/sim-reroll-v4.ts
git checkout HEAD -- test/sim-equip-v4.ts test/sim-reroll-v4.ts
```

若已经 commit 但发现问题：

```powershell
git revert HEAD
```

（不要用 `git reset --hard`；revert 创建新 commit 更安全。）

---

## 六、公测后再做的事（不在本手册范围）

公测稳定（建议 2 周后）再考虑：

1. **V5 全面替代 V4 普通装备**：需新写 V5 普通装备生成器、迁移现有 V4 装备数据、改前端去 `V5_STAT_TO_V4_KEY` 兼容层、改洗练走 V5 池
2. **V4 数值表收编**：把 `EQUIP_PRIMARY_V4` 等编入 V5 体系或重命名为 legacy
3. **设计文档归档**：v3 文档移入 `design/legacy/`

这些都是**至少 3-5 天的工作**，公测前 3 天严禁碰。
