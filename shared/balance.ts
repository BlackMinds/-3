/**
 * 万界仙途 — v3.0 单一数值源
 *
 * 本文件是项目所有核心数值的**唯一真实源**。
 * 所有战斗、装备、功法、丹药、附灵、怪物等数值必须从这里 import,
 * 严禁在业务代码里散落裸数字。
 *
 * 修改数值请优先修本文件 → 让所有系统同步更新。
 *
 * 设计意图与决策见 design/balance-intent-v3.md
 * 审计基线见 design/balance-audit-v3.md
 */

// =====================================================================
// 一、玩家属性上限 (Caps)
// =====================================================================
// 怪物 cap (battleEngine.ts 内): crit_rate≤50% / crit_dmg≤300% /
// dodge≤30% / lifesteal≤15% / armorPen≤30 / accuracy≤25
// 玩家 cap 设为怪物 cap × 1.5~2.0,保留极限 build 空间
export const PLAYER_CAPS = {
  critRate: 0.75,   // 75%  (怪物 50%, 1.5x)
  critDmg: 3.2,     // 320% (v3.5: 2.8→3.2, 极限 build 留更多空间)
  dodge: 0.45,      // 45%  (怪物 30%, 1.5x) — v3.0 从 40% 上调
  lifesteal: 0.25,  // 25%  (怪物 15%, 1.67x)
  armorPen: 60,     // 60   (怪物 30, 2.0x)
  accuracy: 50,     // 50   (怪物 25, 2.0x)
} as const

// =====================================================================
// 二、装备主属性
// =====================================================================
// 基础值 × mapTier × rarityMul × (1 + enhanceLv × 0.10)
// 注: CRIT_RATE base 1 → 0.8 (v3.0, 缓解 T10 红+10 单件触顶)
export const EQUIP_PRIMARY_BASE: Record<string, number> = {
  ATK: 30,
  DEF: 20,
  HP: 200,
  SPD: 15,
  CRIT_RATE: 0.8,  // v3.0: 从 1 降到 0.8, T10红+10 从 50% → 40%
  CRIT_DMG: 2.0,   // 戒指主属性: T10红+10 = 2.0×10×2.5×2.0 = 100%, 顶配 150%→250% (cap 320%)
  SPIRIT: 8,
}

// 品质对主属性的乘子 (白/绿/蓝/紫/金/红)
export const RARITY_STAT_MUL = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5] as const

// 强化曲线: 每级 +10%, +10 满强化 = +100%
export const ENHANCE_MUL_PER_LEVEL = 0.10

export function getEquipEnhanceMul(level: number): number {
  return 1 + level * ENHANCE_MUL_PER_LEVEL
}

// 升品倍率 (紫→金, 金→红)
export const UPGRADE_RARITY = {
  purple: { oldMul: 1.18, newMul: 1.25 },
  gold:   { oldMul: 1.25, newMul: 1.35 },
} as const

// 品质 → 副属性数量范围
export const RARITY_SUB_COUNT_RANGE: [number, number][] = [
  [0, 0], // white
  [0, 1], // green
  [1, 2], // blue
  [2, 3], // purple
  [3, 4], // gold
  [4, 4], // red
]

// =====================================================================
// 三、武器类型加成
// =====================================================================
// 绑定 weapon 槽装备: 提供额外 buff, 强化武器差异化
export const WEAPON_BONUS: Record<string, {
  ATK_pct?: number
  SPD_pct?: number
  SPIRIT_pct?: number
  CRIT_RATE_flat?: number
  CRIT_DMG_flat?: number
  LIFESTEAL_flat?: number
}> = {
  sword: { ATK_pct: 5,  CRIT_RATE_flat: 3 },
  blade: { ATK_pct: 10, CRIT_DMG_flat: 15 },
  spear: { ATK_pct: 3,  SPD_pct: 12, LIFESTEAL_flat: 3 },
  fan:   { ATK_pct: 3,  SPIRIT_pct: 20 }, // v3.4: 25→20 (-5pp, 匹配其他武器量级)
}

// =====================================================================
// 四、境界加成 (v3.0 crit/dodge/critDmg 压缩)
// =====================================================================
// 原数值 → 新数值: 基于"境界占毕业战力 28%"的预算重算
// T8 最高境界:
//   crit_rate 0.15 → 0.10 (−33%)
//   crit_dmg  0.80 → 0.60 (−25%)
//   dodge     0.06 → 0.04 (−33%)
// 其他 tier 按比例同步下调
export interface RealmBonus {
  hp: number; atk: number; def: number; spd: number
  hp_pct: number; atk_pct: number; def_pct: number
  crit_rate: number; crit_dmg: number; dodge: number
}

// v3.4: T5+ HP flat+pct 梯度放大 (×1.3/1.4/1.5/1.6), 消除 T5+ "互秒"
// 仅放大 HP 维度, ATK/DEF/SPD/CRIT 保持 — 老玩家只会变壮, 不会变弱
export const REALM_BONUSES: Record<number, RealmBonus> = {
  1: { hp: 0,     atk: 0,    def: 0,    spd: 0,   hp_pct: 0,   atk_pct: 0,   def_pct: 0,   crit_rate: 0,    crit_dmg: 0,    dodge: 0    },
  2: { hp: 140,   atk: 5,    def: 3,    spd: 3,   hp_pct: 6,   atk_pct: 3,   def_pct: 3,   crit_rate: 0.007,crit_dmg: 0.04, dodge: 0    },
  3: { hp: 400,   atk: 17,   def: 10,   spd: 8,   hp_pct: 16,  atk_pct: 8,   def_pct: 7,   crit_rate: 0.013,crit_dmg: 0.08, dodge: 0.007},
  4: { hp: 1000,  atk: 50,   def: 27,   spd: 20,  hp_pct: 28,  atk_pct: 14,  def_pct: 13,  crit_rate: 0.027,crit_dmg: 0.15, dodge: 0.013},
  5: { hp: 3400,  atk: 130,  def: 75,   spd: 50,  hp_pct: 54,  atk_pct: 21,  def_pct: 18,  crit_rate: 0.04, crit_dmg: 0.22, dodge: 0.02 },
  6: { hp: 9200,  atk: 330,  def: 180,  spd: 120, hp_pct: 90,  atk_pct: 32,  def_pct: 27,  crit_rate: 0.053,crit_dmg: 0.34, dodge: 0.027},
  7: { hp: 25000, atk: 830,  def: 470,  spd: 270, hp_pct: 138, atk_pct: 46,  def_pct: 39,  crit_rate: 0.067,crit_dmg: 0.45, dodge: 0.033},
  8: { hp: 64000, atk: 2000, def: 1170, spd: 670, hp_pct: 224, atk_pct: 70,  def_pct: 56,  crit_rate: 0.10, crit_dmg: 0.60, dodge: 0.04 },
  // tier 9 混元: 纯荣誉境界, 不给任何属性加成 (突破即境界名变化, 数值不再膨胀)
  9: { hp: 0,     atk: 0,    def: 0,    spd: 0,   hp_pct: 0,   atk_pct: 0,   def_pct: 0,   crit_rate: 0,    crit_dmg: 0,    dodge: 0    },
}

export function getRealmStageMultiplier(stage: number): number {
  return 1 + (stage - 1) * 0.10
}

export function getRealmBonusAtLevel(tier: number, stage: number): RealmBonus {
  const base = REALM_BONUSES[tier] || REALM_BONUSES[1]
  const mul = getRealmStageMultiplier(stage)
  return {
    hp: Math.floor(base.hp * mul),
    atk: Math.floor(base.atk * mul),
    def: Math.floor(base.def * mul),
    spd: Math.floor(base.spd * mul),
    hp_pct: base.hp_pct * mul,
    atk_pct: base.atk_pct * mul,
    def_pct: base.def_pct * mul,
    crit_rate: base.crit_rate * mul,
    crit_dmg: base.crit_dmg * mul,
    dodge: base.dodge * mul,
  }
}

// =====================================================================
// 五、等级加成 (每升 1 级的 flat 加成)
// =====================================================================
export function getLevelStatGain(lv: number): { hp: number; atk: number; def: number; spd: number } {
  if (lv <= 50)  return { hp: 10, atk: 2,  def: 1, spd: 1 }
  if (lv <= 100) return { hp: 20, atk: 4,  def: 2, spd: 2 }
  if (lv <= 150) return { hp: 40, atk: 8,  def: 4, spd: 3 }
  return                 { hp: 80, atk: 15, def: 8, spd: 5 }
}

// =====================================================================
// 六、丹药百分比类上限 (v3.0 保持)
// =====================================================================
export const PILL_PCT_CAP = 0.40

// =====================================================================
// 七、功法被动百分比类上限 (v3.0 保持)
// =====================================================================
export const PASSIVE_PCT_CAP = 40 // atkPercent/defPercent/hpPercent/spdPercent 各独立 cap

// =====================================================================
// 八、战斗公式常量
// =====================================================================
export const BATTLE_FORMULA = {
  atkDefRatioDefWeight: 0.8,   // v3.4: 0.5→0.8, DEF 更值钱, 降伤
  elementCounterMul: 1.15,     // v3.4: 1.3→1.15, 软化克制一刀流
  elementResistedMul: 0.88,    // v3.4: 0.7→0.88, 软化被克
  elementNeutralMul: 1.0,      // 无关: ×1.0
  maxResistRate: 0.7,          // 五行抗性 cap 70%
} as const

// DOT 伤害公式
// v3.6: 整体上调约 30%，配合副属性 DOT_DMG_PCT 让 DOT 流派可玩
export const DOT_FORMULA = {
  poisonPerTurnHpRatio: 0.04,  // 0.03→0.04（+33%）每回合扣 4% maxHp
  burnPerTurnAtkRatio: 0.18,   // 0.15→0.18（+20%）每回合扣 18% atk
  bleedPerTurnAtkRatio: 0.13,  // 0.10→0.13（+30%）每回合扣 13% atk
} as const

// =====================================================================
// 九、境界突破成功率与失败惩罚 (v3.3)
// =====================================================================
// 设计意图:
// - 跨大境界成本高、风险大,玩家需权衡时机或攒够修为多次尝试
// - 金丹起(tier >= 3)小境界也开始有风险,中后期不再"顺畅升级"
// - 练气/筑基全阶段 100% 保留新手爽感

// 跨大境界成功率 (stage 满阶时 tier+1)
export const BREAKTHROUGH_BIG_RATES: Record<number, number> = {
  1: 1.00,  // 练气 → 筑基
  2: 0.85,  // 筑基 → 金丹
  3: 0.75,  // 金丹 → 元婴
  4: 0.65,  // 元婴 → 化神
  5: 0.55,  // 化神 → 渡劫
  6: 0.45,  // 渡劫 → 大乘
  7: 0.35,  // 大乘 → 飞升
  8: 0.20,  // 飞升 → 混元 (跨度极大,曲线显著陡峭)
}

// 跨小境界成功率 (stage++,不改 tier)
// 前两个境界 100%,金丹起有失败概率,混元最难
export const BREAKTHROUGH_STAGE_RATES: Record<number, number> = {
  1: 1.00,  // 练气
  2: 1.00,  // 筑基
  3: 0.95,  // 金丹
  4: 0.90,  // 元婴
  5: 0.85,  // 化神
  6: 0.80,  // 渡劫
  7: 0.75,  // 大乘
  8: 0.70,  // 飞升 (小境界5阶)
  9: 0.60,  // 混元 (小境界5阶, 顶级难度)
}

// 突破失败保底：每连续失败 1 次，下次突破成功率 +N%（成功后清零）
// 上限受 100% 限制，配合突破丹叠加但仍不超过 100%
export const BREAKTHROUGH_FAIL_BOOST_PER_STREAK = 0.05

// 突破失败扣除当前修为比例 (大小境界共用)
export const BREAKTHROUGH_PENALTIES: Record<number, number> = {
  1: 0.10,  // 练气 (100% 不触发)
  2: 0.15,  // 筑基 (小 100%,仅大境界触发)
  3: 0.20,  // 金丹
  4: 0.30,  // 元婴
  5: 0.40,  // 化神
  6: 0.50,  // 渡劫
  7: 0.65,  // 大乘
  8: 0.80,  // 飞升
  9: 0.90,  // 混元 (失败几乎清空修为)
}

/** 给定 tier/stage/maxStage, 返回对应突破成功率 (0~1) */
export function getBreakthroughRateAt(tier: number, stage: number, maxStage: number): number {
  if (tier === 9 && stage >= maxStage) return 0 // 混元末阶不可再突 (游戏顶点)
  if (stage < maxStage) return BREAKTHROUGH_STAGE_RATES[tier] ?? 1.0
  return BREAKTHROUGH_BIG_RATES[tier] ?? 0
}
