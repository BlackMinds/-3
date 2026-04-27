---
状态: 已实施 (v1.3)
最后更新: 2026-04-26
关联: design/system-equipment-awaken.md (v1.2 base)
实施改动:
  - server/engine/battleEngine.ts (PlayerAwakenState + calculateDamage isMainSkill + tryApplyDebuff 元素匹配 + 攻击循环钩子)
  - server/engine/multiBattleEngine.ts (PvP 引擎同步)
  - server/api/battle/fight.post.ts (awaken 字段聚合)
  - server/api/equipment/awaken.post.ts (slot 白名单放宽)
  - game/awakenData.ts (AwakenDef.slot + ring 池 12 条 + meta 注入)
  - pages/index.vue (canEquipAwaken 自动启用 + tooltip 条件提示 + 主修切换 toast)
道具方案: A 复用 awaken_stone/awaken_reroll
怪物联动: T6+ HP +5% (server/engine/battleEngine.ts:391)
---

# 灵戒附灵 · 主修功法增幅系统（v1.3 已实施）

> 本文档是对现有 **附灵系统 v1.2** 的扩展，将"附灵"槽位从 3 槽（兵器/法袍/灵佩）扩展到 **4 槽**，新增灵戒 `ring` 槽位，效果方向锚定到**主修功法增幅**。
>
> ### v1.3 实施记录（2026-04-26）
> - 已选定 **道具方案 A**：复用现有 `awaken_stone` / `awaken_reroll`，仅放宽 slot 白名单
> - **木灵戒** 设计调整：原"中毒可叠层"实施为"中毒每跳伤害 +X%"（避免改 ActiveDebuff 结构）
> - 已联动调整怪物：T6+ 高境界 Boss 血量 +5%（含秘境）
> - PvE/PvP 引擎运行时钩子均已实现（共 12 处插桩，单元素匹配带 ✦ 元素 tag 战斗日志）

---

## 一、设计目标与差异化

### 1.1 痛点
当前主修功法**固定 6 个**（`server/engine/skillData.ts:70-78`，1 白 + 5 绿，按五行各一），玩家选定灵根后主修基本"一眼到顶"，没有成长曲线，也没有 build 多样性。

### 1.2 提案核心
让**灵戒附灵**作为"主修功法的隐性升阶维度"：
- 同样的"烈焰剑诀"，灵戒附灵不同 → 偏暴击爆发 / 偏灼烧持续 / 偏五行强化 → 玩出不同流派
- 主修功法本体不再扩充（数据简洁），通过附灵层产生组合空间

### 1.3 与既有 v1.2 的差异化
| 槽位 | 效果池方向 | 触发心智 |
|------|----------|---------|
| `weapon` 兵器 | 通用输出（吸血/持续伤害/暴击/斩杀） | 普攻每次都吃到 |
| `armor` 法袍 | 通用生存（反伤/减伤/回血/抗性） | 受击/回合开始 |
| `pendant` 灵佩 | 通用辅助（身法/暴伤/掉率/经验） | 全战斗常驻 |
| **`ring` 灵戒（新）** | **主修功法专属增幅** | 仅主修攻击触发 |

**心智差异**：兵器/法袍/灵佩附灵是"装上就生效"，灵戒附灵是"看你主修是什么 → 决定能吃到多少"，给玩家 build 决策权重。

---

## 二、效果池草案（12 条 / 主修向）

> 灵戒槽位主属性已是 `CRIT_DMG`（`game/equipData.ts:76`），效果池避开 `critDmg` 直接堆叠，转向**主修触发钩子**。

### 2.1 通用向（4 条）— 任意主修都生效

| ID | 名称 | 效果 | 实现 stat | 蓝 | 紫 | 金 | 红 |
|----|------|------|-----------|----|----|----|----|
| `aw_main_amp` | 心法贯通 | **主修**伤害倍率 +X% | 新增 `mainSkillMultBonus` | 8 | 13 | 20 | 28 |
| `aw_main_crit` | 主修锋锐 | **主修**攻击额外暴击率 +X% | 新增 `mainSkillCritRate` | 4 | 7 | 10 | 14 |
| `aw_main_pierce` | 主修破玄 | **主修**攻击无视目标 X% 防御 | 新增 `mainSkillArmorPen` | 6 | 10 | 15 | 22 |
| `aw_main_lifesteal` | 主修噬灵 | **主修**命中回复 X% 最大气血 | 新增 `mainSkillLifesteal` | 1.5 | 2.5 | 4 | 6 |

### 2.2 属性匹配向（6 条，v3.6 +1）— 主修属性匹配才触发

| ID | 名称 | 触发条件 | 效果 | 实现 stat | 蓝 | 紫 | 金 | 红 |
|----|------|---------|------|-----------|----|----|----|----|
| `aw_metal_resonance` | 金鸣戒 | 主修属性=金 | 主修流血伤害 +X% / 跳 | 新增 `mainSkillBleedAmp` | 20 | 35 | 50 | 75 |
| `aw_wood_resonance` | 木灵戒 | 主修属性=木 | 主修中毒可额外叠 1 层 (上限 3 层) | 新增 `mainSkillPoisonStack` | 1层 | 1层 | 2层 | 2层 |
| `aw_water_resonance` | 水蕴戒 | 主修属性=水 | 主修冻结概率 +X% | 新增 `mainSkillFreezeChance` | 8 | 13 | 20 | 28 |
| `aw_fire_resonance` | 焚天戒 | 主修属性=火 | 主修灼烧持续 +X 回合 | 新增 `mainSkillBurnDuration` | +1 | +1 | +2 | +2 |
| `aw_fire_burn_amp` **v3.6** | 焚天烬戒 | 主修属性=火 | 主修灼烧每跳伤害 +X% | 新增 `mainSkillBurnAmp` | 20 | 35 | 50 | 75 |
| `aw_earth_resonance` | 厚土戒 | 主修属性=土 | 主修脆弱效果减防加深 +X% | 新增 `mainSkillBrittleAmp` | 10 | 15 | 22 | 30 |

> **v3.6 注**: 焚天戒 (持续) 与焚天烬戒 (伤害放大) 互为 2 选 1，火主修玩家可选"持续 vs 伤害"两条 DOT 路线，配合金鸣戒/木灵戒补全火/金/木三元素的主修 DOT amp 灵戒。

> **关键设计点**：白品主修 `basic_sword` 没有元素属性 (`element: null`)，**不吃任何"属性匹配向"附灵**——这是给"换主修"创造内在驱动力（拿到一个绿品主修才能解锁灵戒附灵的属性维度）。

### 2.3 机制向（3 条）— 高阶 Build 解锁

| ID | 名称 | 效果 | 实现 stat | 蓝 | 紫 | 金 | 红 |
|----|------|------|-----------|----|----|----|----|
| `aw_main_chain` | 紫电连华 | **主修**攻击 X% 概率追击一次（60% 倍率，不递归触发附灵） | 新增 `mainSkillChainChance` | 8 | 13 | 20 | 28 |
| `aw_main_cdcut` | 心剑回响 | **主修**暴击时，所有神通 CD -1 (每回合至多 1 次) | 新增 `mainSkillCritCdCut` | bool | bool | bool | bool |
| `aw_main_execute` | 灵戒裂魂 | **主修**对气血<X% 目标伤害 +30% / +45% / +60% / +85% | 新增 `mainSkillExecuteHpThr` + Bonus | 20%阈值/30% | 25%阈值/45% | 30%阈值/60% | 35%阈值/85% |

> 机制向只 3 条，避免与兵器附灵 (`aw_chain`/`aw_execute`) 完全同质化——区别在于**仅主修触发**且效果更强。

---

## 三、数值上限自检

按 v1.2 第 1.3 节硬上限框架追加灵戒条目：

| 维度 | 灵戒附灵贡献 | 与既有上限关系 |
|------|------------|--------------|
| 主修倍率提升 | 心法贯通 +28%（红品最高） | 单一加法不影响其他暴击/暴伤 cap |
| 主修暴击率 | 主修锋锐 +14% | 与兵器锋锐 +12% 叠加 → 主修攻击单点暴击率上限提升 ~26%，仍未破 50% 引擎 cap |
| 主修吸血 | 主修噬灵 +6% | 独立通道，不与 `lifesteal` 叠加，上限 6% < 怪物 cap 15% |
| 灼烧持续 | 焚天戒 +2 回合 | 仅主修触发，与神通灼烧不叠加 |
| 主修追击 | 紫电连华 28% × 60%倍率 | 追击不递归触发附灵（防循环），单回合期望伤害 +16.8% |

**关键 clamp**：
- 单角色仅 1 件灵戒，所有"mainSkill\*"效果**不跨件叠加**（结构天然保护）
- 主修追击与兵器 `aw_chain` 连击**互斥**（防双倍连击爆发）→ 实现层在 chainCheck 时取 `Math.max`，不累加
- 心剑回响 CD-1 每回合至多 1 次（避免主修连续暴击导致神通秒转）

---

## 四、道具方案 — 三选一（待小夏决策）

### A. 复用现有道具（最省事）⭐ 推荐 MVP
- `awaken_stone` / `awaken_reroll` 同时支持 4 个槽位（仅放宽校验白名单）
- 灵戒掉落本身已经在秘境/斗法台等渠道存在，玩家不需要新刷新道具
- **风险**：灵戒池 + 兵器/法袍/灵佩池 共用一颗附灵石 → 玩家可能囤石优先开高价值槽
- **成本**：~5 行校验改动

### B. 新开"附灵符"系列（差异化驱动）
- 新增 `awaken_talisman` / `awaken_talisman_reroll` 两个道具，**仅用于灵戒**
- 掉落渠道：**斗法台高段位奖励 / 宗门战 / 噩梦秘境 Boss 30%**（PvP/团本侧倾斜，与现有附灵石的副本侧形成区分）
- **风险**：道具种类增加（拥有数 +2），背包稍乱
- **成本**：~150 行（道具定义 + API 分支 + 掉落表 + UI 分类）

### C. 混合方案（既有道具能用，新道具更香）
- 复用 `awaken_stone` 可附 1-3 档（蓝~金）灵戒附灵
- 新增 **"灵戒附灵·真品"** `awaken_stone_ring_premium`，仅在金/红品灵戒上生效，**保证出 2.3 节机制向**3 条之一
- 形成 "通用入门 + 高阶专精" 双轨
- **成本**：~80 行

> 我倾向 **A（MVP 上线）→ 内测后视玩家反馈再加 B 或 C**。

---

## 五、数据结构改动（仅必要项）

### 5.1 数据库
**无需新增字段**。`character_equipment.awaken_effect` JSON 字段已通用，只是把灵戒槽位也写进去。

### 5.2 类型扩展
```ts
// game/equipData.ts —— AwakenEffect 接口已存在，仅扩展 slot 字面量
export interface AwakenDef {
  id: string;
  name: string;
  slot: 'weapon' | 'armor' | 'pendant' | 'ring';   // 新增 'ring'
  // ... 其余字段不变
  conditionalElement?: 'metal' | 'wood' | 'water' | 'fire' | 'earth';  // 新增：仅当主修属性匹配时生效
}
```

### 5.3 效果池
```ts
// game/awakenData.ts —— 在 AWAKEN_POOLS 追加
export const AWAKEN_POOLS: Record<string, AwakenDef[]> = {
  weapon:  [ /* 13 条 (既有) */ ],
  armor:   [ /* 13 条 (既有) */ ],
  pendant: [ /* 12 条 (既有) */ ],
  ring:    [ /* 12 条 (本提案 §2) */ ],   // ← 新增
};
```

### 5.4 API
若选方案 A：`server/api/equipment/awaken.post.ts` 仅放宽 slot 校验（`['weapon','armor','pendant']` → `['weapon','armor','pendant','ring']`）。

---

## 六、战斗引擎改动

### 6.1 玩家属性聚合（追加 switch 分支）
在 `applyAwakenToPlayer` switch 内追加：
```ts
case 'mainSkillMultBonus':    p.mainSkillMultBonus = (p.mainSkillMultBonus||0) + v; break;
case 'mainSkillCritRate':     p.mainSkillCritRate = (p.mainSkillCritRate||0) + v; break;
case 'mainSkillArmorPen':     p.mainSkillArmorPen = (p.mainSkillArmorPen||0) + v; break;
case 'mainSkillLifesteal':    p.mainSkillLifesteal = (p.mainSkillLifesteal||0) + v; break;
case 'mainSkillBleedAmp':     conditionalAttach(p, 'metal', 'mainSkillBleedAmp', v); break;
case 'mainSkillPoisonStack':  conditionalAttach(p, 'wood',  'mainSkillPoisonStack', v); break;
case 'mainSkillFreezeChance': conditionalAttach(p, 'water', 'mainSkillFreezeChance', v); break;
case 'mainSkillBurnDuration': conditionalAttach(p, 'fire',  'mainSkillBurnDuration', v); break;
case 'mainSkillBrittleAmp':   conditionalAttach(p, 'earth', 'mainSkillBrittleAmp', v); break;
case 'mainSkillChainChance':  p.mainSkillChainChance = (p.mainSkillChainChance||0) + v; break;
case 'mainSkillCritCdCut':    p.mainSkillCritCdCut = true; break;
case 'mainSkillExecuteHpThr': p.mainSkillExecuteHpThr = v.threshold; p.mainSkillExecuteBonus = v.bonus; break;

// 辅助函数：仅当玩家主修属性匹配时挂上 (在 ACTIVE_SKILLS 里查 element)
function conditionalAttach(p, requireElem, key, value) {
  const mainSkill = ACTIVE_SKILLS.find(s => s.id === p.activeSkillId);
  if (mainSkill?.element === requireElem) p[key] = (p[key]||0) + value;
}
```

### 6.2 触发钩子插桩位置

| 字段 | 插入位置 | 逻辑 |
|------|---------|-----|
| `mainSkillMultBonus` | 主动技能伤害公式 `multiplier` 取用前 | `mult = skill.multiplier * (1 + p.mainSkillMultBonus)` 仅 `type==='active'` |
| `mainSkillCritRate` | 暴击 roll 前 | `if (skill.type==='active') critRate += p.mainSkillCritRate` |
| `mainSkillArmorPen` | 主修攻击伤害公式 def 取用前 | `if (skill.type==='active') effectiveDef *= 1 - p.mainSkillArmorPen` |
| `mainSkillLifesteal` | 主修攻击命中后 | `p.hp += p.maxHp * p.mainSkillLifesteal` (仅命中即触发，与暴击无关) |
| `mainSkillBleedAmp` | 主修施加流血时 | 流血伤害字段 × (1 + bonus) — 在 debuff tickDamage 阶段乘 |
| `mainSkillPoisonStack` | 主修施加中毒时 | 允许同目标叠 1-2 层，每层独立 tick |
| `mainSkillFreezeChance` | 主修施加冻结的 roll 前 | `freezeChance += bonus` |
| `mainSkillBurnDuration` | 主修施加灼烧的 applyDebuff 调用 | `duration += bonus` |
| `mainSkillBrittleAmp` | 主修施加脆弱时 | 脆弱减防 value × (1 + bonus) |
| `mainSkillChainChance` | 主修攻击结算后 | `if (Math.random() < chance) doExtraMainAttack(0.6)`，不递归触发附灵 |
| `mainSkillCritCdCut` | 主修暴击命中后 | `for (skill of divineSkills) skill.cdRemaining = max(0, cdRemaining-1)`，每回合至多 1 次 |
| `mainSkillExecuteHpThr` | 主修伤害结算乘法链 | `if (target.hp/target.maxHp < threshold) damage *= 1 + bonus` |

**关键约束**：所有 `mainSkill*` 钩子都需要先判断"当前是否在执行主修攻击"——建议在 `executeActiveAttack(player, skill)` 入口设置 `p._isMainSkillAttack = true`，结算后清掉，避免神通误触发。

---

## 七、UI 改动（最小化）

### 7.1 装备操作区
- 灵戒解禁附灵按钮（移除 `slot !== ring` 的禁用判断）
- 按钮文案保持 `[附灵 ✦]` / `[洗练 ✦]`，与既有一致

### 7.2 装备详情 tooltip
属性匹配向附灵的描述需要**条件化**：
```
✦ 附灵·焚天戒    主修属性=火 时，主修灼烧持续 +2 回合
                 (当前主修：烈焰剑诀 ✓ 已生效)
                 (当前主修：基础剑法 ✗ 未生效)
```

### 7.3 主修选择面板（新提示）
切换主修功法时，若灵戒附灵是"属性匹配向"，给予 toast 提示：
```
切换至 寒冰掌 (水)
✦ 灵戒附灵·水蕴戒 已生效
```

---

## 八、工作量估算

| 模块 | 工作 | 代码量 |
|------|-----|-------|
| 1. 类型扩展 | `AwakenDef` 加 ring + conditionalElement | ~10 行 |
| 2. 效果池定义 | `awakenData.ts` 加 ring 池 12 条 + 描述函数 | ~120 行 |
| 3. API 校验放宽 | `awaken.post.ts` slot 白名单 | ~5 行 |
| 4. 战斗引擎聚合 | switch 追加 12 个 case + conditionalAttach | ~60 行 |
| 5. 触发钩子插桩 | 12 处主修攻击位置（表 6.2） | ~150 行 |
| 6. `_isMainSkillAttack` 标记 | `executeActiveAttack` 入口/出口 | ~10 行 |
| 7. 装备 UI 解禁 | 操作区按钮判断 | ~5 行 |
| 8. tooltip 条件化描述 | 属性匹配向显示当前是否生效 | ~30 行 |
| 9. 主修切换 toast | 新增提示 | ~25 行 |
| 10. 仿真自测 | sim-build-player 加灵戒附灵参数维度 | ~80 行 |
| **合计** | | **~495 行** |

**预计工期**：1.5 天写代码 + 0.5 天自测（含仿真核对 §3 数值上限）。

---

## 九、验收清单（草案）

### 基础
- [ ] 灵戒槽位附灵按钮启用，白/绿品仍禁用
- [ ] 附灵石可附到灵戒，洗练规则与其他槽位一致
- [ ] tooltip 正确展示"主修属性匹配生效/未生效"

### 通用向（4 条）
- [ ] 心法贯通：主修攻击伤害比无附灵高 X%
- [ ] 主修锋锐：仅主修攻击额外暴击概率，神通不受影响
- [ ] 主修破玄：主修对高防御目标伤害提升明显
- [ ] 主修噬灵：主修命中后角色气血回复

### 属性匹配向（5 条）
- [ ] 切换主修后效果实时启停（log 中带 ✓/✗ 提示）
- [ ] 5 系附灵分别在对应主修下生效
- [ ] 白品 `basic_sword` 主修下 5 系附灵全部不生效

### 机制向（3 条）
- [ ] 紫电连华追击不递归触发其他附灵
- [ ] 心剑回响 CD-1 每回合最多 1 次
- [ ] 灵戒裂魂阈值正确（蓝20%/紫25%/金30%/红35%）

### 数值安全
- [ ] 仿真满配灵戒附灵不破 §3 上限
- [ ] 紫电连华 + 兵器 aw_chain 同存时，连击不双发（取 max）

---

## 十、决策记录（v1.3 已落地）

1. ✅ **道具方案 A** — 复用 `awaken_stone` / `awaken_reroll`，仅放宽 slot 白名单（`game/awakenData.ts: AWAKEN_SLOTS`）
2. ⏸️ **属性匹配向条数** — 保持五行各 1 条共 5 条，后续按数据反馈再扩展
3. ✅ **主修选择是手动** — `pages/index.vue: equipSkill` 玩家点击切换；属性匹配向 build 决策权不会被吞
4. ✅ **PvP 钩子同步** — `multiBattleEngine.ts` 已镜像 PvE 引擎的所有 mainSkill* 触发逻辑；T6+ Boss 血量 +5% 同时压缩 PvE 强度峰值

---

**v1.3 已实施完毕。后续观察 1-2 周，关注 T5+ Boss 通关时长 / 斗法台胜率分布 / 高品质灵戒附灵持有率。**
