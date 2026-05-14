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
  critRate: 1.0,    // 100% (不设封顶)
  critDmg: 3.5,     // 350% (2026-05-14: 3.2→3.5, 极限 build 留更多空间)
  dodge: 0.45,      // 45%  (怪物 30%, 1.5x) — v3.0 从 40% 上调
  lifesteal: 0.25,  // 25%  (怪物 15%, 1.67x)
  armorPen: 70,     // 70   (怪物 30, 2.33x) — 2026-05-14: 60→70
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
  HP: 600,         // 2026-05-04: 200→600 (×3) 配合境界右移、削弱境界血量占比，让装备血量主属性更值钱
  SPD: 15,
  CRIT_RATE: 0.8,  // v3.0: 从 1 降到 0.8, T10红+10 从 50% → 40%
  CRIT_DMG: 2.0,   // 戒指主属性: T10红+10 = 2.0×10×2.5×2.0 = 100%, 顶配 150%→250% (cap 350%)
  SPIRIT: 8,
}

// 品质对主属性的乘子 (白/绿/蓝/紫/金/红)
export const RARITY_STAT_MUL = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5] as const

// v3.8.3 (2026-05-06): 装备主属性 tier 权重（仅 T11+ 加陡，T1-T10 保持原线性）
// 背景：T11-T15 怪物属性跨幅被 MUL 压扁后（每 tier ~×1.5），装备主属性
// 仍是 base × tier 线性，T10→T14 仅 ×1.4，导致 T10 装备能蹭到 T14 地图。
// 改成 T11+ 段每 tier 权重 +2，T10→T14 装备主属性提升到 ×1.8。
// 配合 battleEngine.ts T11-T15 MUL 上调（每 tier 跨幅 ~×1.85）。
export function getEquipTierWeight(tier: number): number {
  return tier <= 10 ? tier : 10 + (tier - 10) * 2
}

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

// 2026-05-04: 境界整体右移一档 — 混元·无极成为新顶点（= 旧飞升·大罗金仙数值）
// 思路：让混元 5 阶有真正的属性成长（合道→无极每阶 +10%），同时削弱前面境界 flat 占总血量的比例，
// 让装备/等级在养成里更有存在感。配套改动：装备主属性 HP base ×3、副属性 HP/HP_PCT ×2、等级 hp ×3。
// 筑基保留旧筑基 50% 的微小过渡值，让突破到筑基仍有"入门反馈"。
export const REALM_BONUSES: Record<number, RealmBonus> = {
  1: { hp: 0,     atk: 0,    def: 0,    spd: 0,   hp_pct: 0,   atk_pct: 0,   def_pct: 0,   crit_rate: 0,    crit_dmg: 0,    dodge: 0    },
  2: { hp: 70,    atk: 3,    def: 2,    spd: 2,   hp_pct: 3,   atk_pct: 1.5, def_pct: 1.5, crit_rate: 0.004,crit_dmg: 0.02, dodge: 0    }, // 筑基（微小过渡）
  3: { hp: 140,   atk: 5,    def: 3,    spd: 3,   hp_pct: 6,   atk_pct: 3,   def_pct: 3,   crit_rate: 0.007,crit_dmg: 0.04, dodge: 0    }, // 金丹（旧筑基）
  4: { hp: 400,   atk: 17,   def: 10,   spd: 8,   hp_pct: 16,  atk_pct: 8,   def_pct: 7,   crit_rate: 0.013,crit_dmg: 0.08, dodge: 0.007}, // 元婴（旧金丹）
  5: { hp: 1000,  atk: 50,   def: 27,   spd: 20,  hp_pct: 28,  atk_pct: 14,  def_pct: 13,  crit_rate: 0.027,crit_dmg: 0.15, dodge: 0.013}, // 化神（旧元婴）
  6: { hp: 3400,  atk: 130,  def: 75,   spd: 50,  hp_pct: 54,  atk_pct: 21,  def_pct: 18,  crit_rate: 0.04, crit_dmg: 0.22, dodge: 0.02 }, // 渡劫（旧化神）
  7: { hp: 9200,  atk: 330,  def: 180,  spd: 120, hp_pct: 90,  atk_pct: 32,  def_pct: 27,  crit_rate: 0.053,crit_dmg: 0.34, dodge: 0.027}, // 大乘（旧渡劫）
  8: { hp: 25000, atk: 830,  def: 470,  spd: 270, hp_pct: 138, atk_pct: 46,  def_pct: 39,  crit_rate: 0.067,crit_dmg: 0.45, dodge: 0.033}, // 飞升（旧大乘）
  9: { hp: 64000, atk: 2000, def: 1170, spd: 670, hp_pct: 224, atk_pct: 70,  def_pct: 56,  crit_rate: 0.10, crit_dmg: 0.60, dodge: 0.04 }, // 混元（旧飞升）— stage 5 无极 = 旧大罗金仙
}

export function getRealmStageMultiplier(stage: number): number {
  return 1 + (stage - 1) * 0.10
}

export function getRealmBonusAtLevel(tier: number, stage: number): RealmBonus {
  // 2026-05-04: 混元 (tier 9) 走自己的属性表，5 阶 stage 倍率 1.0/1.1/1.2/1.3/1.4 自然分档
  // 合道 = 旧飞升·散仙数值；无极 (stage 5) = 旧飞升·大罗金仙数值（游戏顶点）
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
  // 2026-05-04: 各档 hp ×3 (10/20/40/80 → 30/60/120/240) 配合境界右移，让等级在血量上有存在感
  if (lv <= 50)  return { hp: 30,  atk: 2,  def: 1, spd: 1 }
  if (lv <= 100) return { hp: 60,  atk: 4,  def: 2, spd: 2 }
  if (lv <= 150) return { hp: 120, atk: 8,  def: 4, spd: 3 }
  return                 { hp: 240, atk: 15, def: 8, spd: 5 }
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
// 八、道侣仙缘印记 — LV0~LV5 全属性加成（小数, 0.12 = 12%）
// 战斗 (fight.post.ts) 与角色面板 (index.vue mainStats) 共用此表
// =====================================================================
export const COMPANION_SEAL_PCT = [0, 0.02, 0.04, 0.06, 0.09, 0.12] as const

// =====================================================================
// 装备 v4.0（2026-05-07）— 神兵锻造总纲 PDF 落地
// =====================================================================
// 主属性双轨：属性1（受强化，每级 +10%）+ 属性2（不受强化，固定值）
// 副词条按"部位 × 词条位"分桶，稀有度决定开放到第几位
// 词条权重双轴乘积：%类:固定值 = 4:6，伤害:生存功能 = 4:6
//
// 老装备：primary_stat_2 = NULL，行为不变；只对新生成装备生效

// 五行强化 — 饰品/护符主属性 base
// base 0.4 → T10 红+10 = 0.4 × 10 × 2.5 × 2.0 = 20%（PDF 上沿）
//          T14 红+10 = 0.4 × 18 × 2.5 × 2.0 = 36%（PDF 30~50% 中段）
// 加进 EQUIP_PRIMARY_BASE 同一张表，复用现有公式
;(EQUIP_PRIMARY_BASE as any).METAL_DMG = 0.4
;(EQUIP_PRIMARY_BASE as any).WOOD_DMG  = 0.4
;(EQUIP_PRIMARY_BASE as any).WATER_DMG = 0.4
;(EQUIP_PRIMARY_BASE as any).FIRE_DMG  = 0.4
;(EQUIP_PRIMARY_BASE as any).EARTH_DMG = 0.4

// 属性2 base 表（不参与 enhanceMul，只受 tier × rarity 影响）
// 校准目标：T14 红 ≈ 30 数值/百分比（剑/枪破甲、刀斧 ATK% 等量级一致）
//          base 0.667 → T14 红 = 0.667 × 18 × 2.5 = 30
// SPIRIT 是 flat 类，base 略高补偿（扇乐器属性2 神识 T14 红 ≈ 100）
export const EQUIP_PRIMARY_BASE_2: Record<string, number> = {
  ATK_PCT:    0.667,  // 兵器·刀斧 / 法宝·法术向
  ARMOR_PEN:  0.667,  // 兵器·剑枪
  SPIRIT:     2.22,   // 兵器·扇乐器（flat）
  SPIRIT_PCT: 0.667,  // 法宝·物理向
}

// 计算属性2 数值（不受强化影响）
export function getEquipPrimaryValue2(stat: string, tier: number, rarityIdx: number): number {
  const base = EQUIP_PRIMARY_BASE_2[stat] ?? 0
  return Math.max(1, Math.floor(base * getEquipTierWeight(tier) * RARITY_STAT_MUL[rarityIdx]))
}

// 部位 × 子类 → 双主属性配置
// 槽位维度（用 DB base_slot）: weapon / armor / helmet / boots / treasure / ring / pendant
//   - ring 槽 = PDF 的"饰品"，5 个子类（metal/wood/water/fire/earth）决定五行强化主属性 + 装备名词缀
//   - pendant 槽 = PDF 的"护符"，2 个子类（crit_rate/crit_dmg）决定主属性
// 子类维度: 兵器按 weaponType / 法宝按 treasureType（phys/magic）/ ring 按五行 / pendant 按 crit / 其他 '_'
export interface EquipPrimaryConfig {
  primary1: string
  primary2: string | null
}

export const EQUIP_PRIMARY_V4: Record<string, Record<string, EquipPrimaryConfig>> = {
  weapon: {
    blade: { primary1: 'ATK', primary2: 'ATK_PCT'   },  // 刀（含斧）
    sword: { primary1: 'ATK', primary2: 'ARMOR_PEN' },  // 剑
    spear: { primary1: 'ATK', primary2: 'ARMOR_PEN' },  // 枪
    fan:   { primary1: 'ATK', primary2: 'SPIRIT'    },  // 扇（含乐器）
  },
  armor:  { _: { primary1: 'DEF', primary2: null } },
  helmet: { _: { primary1: 'HP',  primary2: null } },
  boots:  { _: { primary1: 'SPD', primary2: null } },
  treasure: {
    phys:  { primary1: 'SPIRIT', primary2: 'SPIRIT_PCT' }, // 物理向（紫金葫/乾坤袋/聚灵珠/河图洛书）
    magic: { primary1: 'ATK',    primary2: 'ATK_PCT'    }, // 法术向（太极印/镇魂铃/浑天仪/九幽鼎）
  },
  // 饰品（DB ring 槽）：按五行子类决定主属性 + 装备名词缀
  ring: {
    metal: { primary1: 'METAL_DMG', primary2: null }, // 金项链
    wood:  { primary1: 'WOOD_DMG',  primary2: null }, // 玉佩
    water: { primary1: 'WATER_DMG', primary2: null }, // 蓝宝石戒指
    fire:  { primary1: 'FIRE_DMG',  primary2: null }, // 红宝石戒指
    earth: { primary1: 'EARTH_DMG', primary2: null }, // 琥珀手镯
  },
  // 护符（DB pendant 槽）：随机会心率/会心伤害二选一作为主属性，名字仍用现有"灵佩"系
  pendant: {
    crit_rate: { primary1: 'CRIT_RATE', primary2: null },
    crit_dmg:  { primary1: 'CRIT_DMG',  primary2: null },
  },
}

// 副词条池（部位 → 词条1/2/3/4，每个词条位是候选 stat 数组）
// 稀有度截断：白0/绿1/蓝2/紫2/金3/红4 — 即决定"开放到第几个词条位"
// 五行强化/抗性已展开为 5 种独立条目（金木水火土），抽中时不会全 5 种叠出
const FIVE_DMG  = ['METAL_DMG','WOOD_DMG','WATER_DMG','FIRE_DMG','EARTH_DMG']
const FIVE_RES  = ['METAL_RES','WOOD_RES','WATER_RES','FIRE_RES','EARTH_RES']

export const EQUIP_SUB_POOL_V4: Record<string, [string[], string[], string[], string[]]> = {
  // 兵器
  weapon: [
    ['ATK','ATK_PCT'],
    ['CRIT_RATE','CRIT_DMG'],
    ['ARMOR_PEN','SPIRIT_PCT','ATK_PCT'],
    [...FIVE_DMG],
  ],
  // 法袍
  armor: [
    ['HP','HP_PCT','DEF','DEF_PCT'],
    ['DEF','DEF_PCT'],
    ['CTRL_RES','DEF','HP','HP_PCT'],
    [...FIVE_RES],
  ],
  // 法冠
  helmet: [
    ['HP','HP_PCT','DEF','DEF_PCT'],
    ['DEF_PCT','SPD_PCT'],
    ['SPIRIT','CRIT_RATE','CRIT_DMG'],
    [...FIVE_DMG, ...FIVE_RES],
  ],
  // 云履
  boots: [
    ['ATK','SPD','CRIT_RATE','CRIT_DMG'],
    ['ACCURACY','DODGE','CTRL_RES','CTRL_CHANCE'],
    ['SPIRIT','SPIRIT_PCT','CRIT_RATE','CRIT_DMG'],
    ['SPD','SPD_PCT', ...FIVE_DMG, ...FIVE_RES],
  ],
  // 法宝
  treasure: [
    ['SPIRIT','ATK','SPIRIT_PCT','ATK_PCT'],
    ['DODGE','ACCURACY','SPD','SPIRIT'],
    ['SPD_PCT','LUCK','SPIRIT_DENSITY','LIFESTEAL'],
    ['CRIT_RATE','CRIT_DMG','ARMOR_PEN', ...FIVE_DMG],
  ],
  // 饰品（DB ring 槽，5 子类共享词条池）
  ring: [
    [...FIVE_DMG, ...FIVE_RES],
    ['CRIT_RATE','CRIT_DMG','CTRL_CHANCE','CTRL_RES'],
    ['LIFESTEAL','ARMOR_PEN','LUCK','SPIRIT_DENSITY'],
    ['ATK_PCT','SPIRIT_PCT'],
  ],
  // 护符（DB pendant 槽）
  pendant: [
    ['ATK_PCT','SPIRIT_PCT','HP_PCT','DEF_PCT'],
    ['SPIRIT','ATK','LIFESTEAL','ARMOR_PEN'],
    ['DODGE','ACCURACY','LUCK','SPIRIT_DENSITY'],
    [...FIVE_DMG, ...FIVE_RES],
  ],
}

// 稀有度 → 副词条数（v4.0 修订版，对齐 PDF 表头"金/红装备具有词条3/4"）
export const RARITY_SUB_COUNT_V4: Record<string, number> = {
  white: 0, green: 1, blue: 2, purple: 2, gold: 3, red: 4,
}

// 双轴权重分类
// 轴 A：百分比类(P) vs 固定值类(F) = 40:60
// 轴 B：伤害类(D) vs 生存功能类(S) = 40:60
// 单条权重 = A × B：PD=0.16  PS=0.24  FD=0.24  FS=0.36
// 桶内按权重抽取后归一化
const AXIS_PCT = new Set([
  'ATK_PCT','DEF_PCT','HP_PCT','SPD_PCT','SPIRIT_PCT',
  'CRIT_RATE','CRIT_DMG','DODGE','LIFESTEAL',
  'CTRL_CHANCE','CTRL_RES',
  'LUCK','SPIRIT_DENSITY',
  ...FIVE_DMG, ...FIVE_RES,
])
const AXIS_DMG = new Set([
  'ATK','ATK_PCT','SPIRIT','SPIRIT_PCT',
  'CRIT_RATE','CRIT_DMG','ARMOR_PEN','ACCURACY',
  ...FIVE_DMG,
])

export function getSubStatAxisWeight(stat: string): number {
  const isPct = AXIS_PCT.has(stat)
  const isDmg = AXIS_DMG.has(stat)
  const a = isPct ? 0.4 : 0.6  // %类:固定 = 4:6
  const b = isDmg ? 0.4 : 0.6  // 伤害:生存功能 = 4:6
  return a * b
}

// 装备背包上限（仅统计 slot IS NULL 的"背包内"装备，已穿戴 7 件不计入）
// 满后新装备直接按基础售价转灵石返还，套装件也不例外
export const EQUIP_BAG_LIMIT = 400

// 灵石持有上限：700 亿（70_000_000_000）
// 所有 spirit_stone += 入口在 SQL 层用 LEAST(SPIRIT_STONE_CAP, spirit_stone + X) 强制封顶
// 同时战斗/秘境/挂机的怪物掉落灵石已置 0，仅保留出售/邮件/宗门/活动等非掉落产出
export const SPIRIT_STONE_CAP = 70_000_000_000

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
// v3.7: 基础 DOT 再上调约 35%，让裸值 DOT 至少与 1 次普攻持平（3 回合总伤），不再依赖养成栈才"能用"
// v3.9.1: 整体下调 — 灼烧/中毒 0.25→0.20, 流血 0.18→0.15（DOT 套+万毒归一+元素戒已经把上限堆得过高，裸值削回更接近其他流派）
export const DOT_FORMULA = {
  poisonPerTurnAtkRatio: 0.20, // v3.9: 改为攻击系 DOT，公式与灼烧一致；v3.9.1: 0.25→0.20
  burnPerTurnAtkRatio: 0.20,   // v3.9.1: 0.25→0.20
  bleedPerTurnAtkRatio: 0.15,  // v3.9.1: 0.18→0.15
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
  8: 0.15,  // 飞升 → 混元 (跨度极大,曲线显著陡峭)
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
  9: 0.50,  // 混元 fallback — 实际走 BREAKTHROUGH_STAGE_RATES_PER_STAGE 的逐阶覆盖
}

// 部分境界的小境界概率会逐阶递减 (顶级境界专属)
// key = 当前 stage (从 1 开始), 表示从 stage N → stage N+1 的成功率
// 命中此表的 tier 优先用此处的值, 未命中时回落到 BREAKTHROUGH_STAGE_RATES[tier]
export const BREAKTHROUGH_STAGE_RATES_PER_STAGE: Record<number, Record<number, number>> = {
  9: {
    1: 0.50, // 合道 → 证道
    2: 0.40, // 证道 → 太上
    3: 0.30, // 太上 → 太极
    4: 0.20, // 太极 → 无极
  },
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
  if (stage < maxStage) {
    const perStage = BREAKTHROUGH_STAGE_RATES_PER_STAGE[tier]
    if (perStage && perStage[stage] !== undefined) return perStage[stage]
    return BREAKTHROUGH_STAGE_RATES[tier] ?? 1.0
  }
  return BREAKTHROUGH_BIG_RATES[tier] ?? 0
}

// =====================================================================
// 装备 V5.0.2 常量与函数（design_only，与 V4 并存，未接入装备生成器）
// 详细见 shared/balance-v5.ts 与 design/system-equipment-v5-0-2.json
// =====================================================================
export * from './balance-v5'
