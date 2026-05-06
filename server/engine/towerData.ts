// 通天塔静态数据 — 100 层配置 + Trait 定义
// MVP 阶段实现 1-25 层（大乘 T7 段 + 飞升初 T8 段前半）。
// 设计文档：design/system-tower.md
//
// 数值生成完全复用现有 battleEngine.generateMonsterStats()，
// 我们只配置 power / element / role / drop_table（决定 tier 缩放）+ traits。
// trait 的运行时效果由 towerTraits.ts 负责注入到 BattlerStats 或 monster 技能池上。

import type { MonsterTemplate } from './battleEngine'

export const TOTAL_FLOORS = 100
export const TURN_LIMIT_PER_FLOOR = 100
export const DAILY_FAIL_LIMIT = 3
export const ENTRY_REALM_TIER = 7   // 大乘
export const ENTRY_LEVEL = 140

// ========== Trait 定义 ==========
// 每个 trait 的实际效果在 towerTraits.ts 里实现；这里只是元数据用于前端展示。
export type TraitId =
  | 'T01' | 'T03' | 'T05' | 'T07' | 'T08'
  | 'T09' | 'T11' | 'T13' | 'T15' | 'T16'
  | 'T17' | 'T18' | 'T19' | 'T20' | 'T21' | 'T22'
  | 'B01' | 'B02' | 'B05'

export interface TraitDef {
  id: TraitId
  name: string
  desc: string
  category: 'rage' | 'sustain' | 'defense' | 'element' | 'reflect' | 'control' | 'dot' | 'special'
}

export const TRAITS: Record<TraitId, TraitDef> = {
  T01: { id: 'T01', name: '狂暴',       desc: '攻击 +30%、速度 +15%（开战即激活）',                   category: 'rage' },
  T03: { id: 'T03', name: '爆发',       desc: '暴击率 +50%、暴击伤害 +50%',                            category: 'rage' },
  T05: { id: 'T05', name: '再生',       desc: '每回合恢复最大血量 5%',                                 category: 'sustain' },
  T07: { id: 'T07', name: '减伤',       desc: '受到伤害减少 30%（实际由防御 ×1.5 体现）',              category: 'defense' },
  T08: { id: 'T08', name: '护盾叠加',   desc: '基础最大血量 +30%（相当于初始护盾）',                   category: 'defense' },
  T09: { id: 'T09', name: '圣盾期',     desc: '战斗前 3 回合免疫一切伤害（仍可被控制）',               category: 'defense' },
  T11: { id: 'T11', name: '元素吸收·水', desc: '对水属性伤害免疫',                                      category: 'element' },
  T13: { id: 'T13', name: '反伤',       desc: '受到伤害的 25% 反弹给攻击者',                           category: 'reflect' },
  T15: { id: 'T15', name: '反击',       desc: '被普攻命中时立即反击（基础攻击的 80%）',                category: 'reflect' },
  T16: { id: 'T16', name: '群冻附带',   desc: '攻击命中时 30% 概率冻结 1 回合',                        category: 'control' },
  T17: { id: 'T17', name: '群眩附带',   desc: '攻击命中时 25% 概率眩晕 1 回合',                        category: 'control' },
  T18: { id: 'T18', name: '沉默',       desc: '攻击命中时 30% 概率沉默 2 回合',                        category: 'control' },
  T19: { id: 'T19', name: '束缚',       desc: '攻击命中时 30% 概率束缚 2 回合',                        category: 'control' },
  T20: { id: 'T20', name: '命中附毒',   desc: '攻击命中时 50% 概率叠 1 层中毒',                        category: 'dot' },
  T21: { id: 'T21', name: '命中附烧',   desc: '攻击命中时 50% 概率叠 1 层灼烧',                        category: 'dot' },
  T22: { id: 'T22', name: '命中附流血', desc: '攻击命中时 40% 概率叠 1 层流血',                        category: 'dot' },
  B01: { id: 'B01', name: '三阶段',     desc: 'MVP 简化：基础属性 +30%（满血起即激活）',               category: 'special' },
  B02: { id: 'B02', name: '召唤',       desc: 'MVP 简化：最大血量 +30%（暂未实现召唤小怪）',           category: 'special' },
  B05: { id: 'B05', name: '五行轮转',   desc: 'MVP 简化：五行抗性全部 30%（每元素受伤都减少）',        category: 'special' },
}

// ========== 怪物配置类型 ==========
export interface FloorMonster {
  template: MonsterTemplate
  /** 该怪物专属 traits */
  traits: TraitId[]
}

export interface FloorDef {
  /** 层数 1-100 */
  floor: number
  /** 层名 */
  name: string
  /** 1-2 个怪物 */
  monsters: FloorMonster[]
  /** 是否层主（每 5 层尾） */
  isLayerLord?: boolean
  /** 是否中 Boss（25/50/75 层） */
  isMidBoss?: boolean
  /** 是否塔主（100 层） */
  isFinalBoss?: boolean
  /** MVP 即发的称号（首通触发） */
  rewardTitle?: string
  /** MVP 即发的永久全属性 +X%（首通触发，整数百分比） */
  permanentStatPct?: number
  /** 设计意图（前端可选展示） */
  designNote?: string
}

// ========== 通天塔称号 ==========
// 这些称号会通过 ACHIEVEMENTS 系统挂上去（详见 server/engine/achievementData.ts 的 tower_clear_floor 事件）
export const TOWER_TITLES = {
  FLOOR_15: '塔下行者',
  FLOOR_25: '塔中过客',
  FLOOR_50: '半塔之主',
  FLOOR_75: '塔顶遥望',
  FLOOR_100: '通天塔主',
} as const

// ========== 怪物模板生成辅助 ==========
function mkMonster(name: string, power: number, element: string | null, role: string, tier: number): MonsterTemplate {
  return {
    name,
    power,
    element,
    role,
    exp: 0,           // 通天塔不发战斗经验（奖励统一在首通触发）
    stone_min: 0,
    stone_max: 0,
    drop_table: `tower_t${tier}`,  // tier 缩放识别用，'tower_' 前缀避免被现有掉落表 hit
  }
}

// ========== 1-15 层 (大乘 T7) ==========
// power 区间：80k ~ 312k，对位主图 T7 ×2.0-3.0
const FLOORS_1_15: FloorDef[] = [
  {
    floor: 1, name: '道殿入口',
    monsters: [{ template: mkMonster('焚渊魔将', 80000, 'fire', 'dps', 7), traits: ['T01', 'T21'] }],
    designNote: '进塔即考验，5 回合内压制',
  },
  {
    floor: 2, name: '寒月初照',
    monsters: [{ template: mkMonster('寒月使者', 90000, 'water', 'dps', 7), traits: ['T16', 'T11'] }],
    designNote: '第一次"换元素"考验',
  },
  {
    floor: 3, name: '雷崖断',
    monsters: [{ template: mkMonster('雷豹王', 100000, 'metal', 'dps', 7), traits: ['T03', 'T13'] }],
    designNote: '防御 + 反伤双考验',
  },
  {
    floor: 4, name: '古木阴',
    monsters: [{ template: mkMonster('古木哨灵', 115000, 'wood', 'tank', 7), traits: ['T05', 'T07', 'T22'] }],
    designNote: '长战 BD 检验',
  },
  {
    floor: 5, name: '★星陨之灵',
    monsters: [{ template: mkMonster('星陨之灵', 175000, null, 'boss', 7), traits: ['T07', 'T08', 'T03'] }],
    isLayerLord: true,
    designNote: '第一个层主，护盾叠加压迫',
  },
  {
    floor: 6, name: '黑雾刺谷',
    monsters: [{ template: mkMonster('黑雾刺客', 125000, null, 'speed', 7), traits: ['T15', 'T19'] }],
    designNote: '反击+控，禁普攻流',
  },
  {
    floor: 7, name: '焰心圣域',
    monsters: [{ template: mkMonster('焰心圣女', 140000, 'fire', 'balanced', 7), traits: ['T21', 'T01', 'T22'] }],
    designNote: 'DOT 三件 + 狂暴',
  },
  {
    floor: 8, name: '玄铁堡',
    monsters: [{ template: mkMonster('玄铁守卫', 155000, 'metal', 'tank', 7), traits: ['T07', 'T13', 'T08'] }],
    designNote: '三段防御，破甲检验',
  },
  {
    floor: 9, name: '蛇雷岭',
    monsters: [
      { template: mkMonster('青冥蛇王', 170000, 'wood', 'dps', 7), traits: ['T20', 'T18'] },
      { template: mkMonster('紫电蝎',   102000, 'metal', 'dps', 7), traits: ['T03'] },
    ],
    designNote: '大乘段第一次双怪',
  },
  {
    floor: 10, name: '★阎魔尸卫',
    monsters: [{ template: mkMonster('阎魔尸卫', 247000, 'water', 'boss', 7), traits: ['T13', 'T18', 'T19', 'T05'] }],
    isLayerLord: true,
    designNote: '反伤池 + 双控 + 续航',
  },
  {
    floor: 11, name: '业火门',
    monsters: [
      { template: mkMonster('业火护卫', 180000, 'fire', 'tank', 7), traits: ['T21', 'T07'] },
      { template: mkMonster('火甲蝙蝠', 108000, 'fire', 'speed', 7), traits: ['T01', 'T03'] },
    ],
    designNote: '灼烧+减伤+狂暴+爆发',
  },
  {
    floor: 12, name: '寒星阵',
    monsters: [
      { template: mkMonster('寒星天使', 195000, 'water', 'dps', 7), traits: ['T16', 'T03', 'T11'] },
      { template: mkMonster('凝霜兵',   117000, 'water', 'tank', 7), traits: ['T07', 'T16'] },
    ],
    designNote: '三机制压制',
  },
  {
    floor: 13, name: '八歧穴',
    monsters: [
      { template: mkMonster('八歧蛇尾', 210000, 'wood', 'dps', 7), traits: ['T20', 'T15', 'T19'] },
      { template: mkMonster('蛇姬使',   126000, 'wood', 'speed', 7), traits: ['T19', 'T05'] },
    ],
    designNote: '中毒+反击+三控+续航',
  },
  {
    floor: 14, name: '地狱火门',
    monsters: [
      { template: mkMonster('地狱火将', 225000, 'fire', 'dps', 7), traits: ['T01', 'T21', 'T22'] },
      { template: mkMonster('地狱火兵', 135000, 'fire', 'balanced', 7), traits: ['T22', 'T03'] },
    ],
    designNote: '三 DOT 叠层+爆发',
  },
  {
    floor: 15, name: '★烈焰天王',
    monsters: [{ template: mkMonster('烈焰天王', 312000, 'fire', 'boss', 7), traits: ['T21', 'T01', 'T08', 'T07', 'T22'] }],
    isLayerLord: true,
    rewardTitle: TOWER_TITLES.FLOOR_15,
    designNote: '5 trait 复合层主，大乘段终点；首通授予「塔下行者」',
  },
]

// ========== 16-25 层 (飞升初 T8 前半) ==========
// power 区间：300k ~ 900k，对位主图 T8 ×2.0-3.0
const FLOORS_16_25: FloorDef[] = [
  {
    floor: 16, name: '哀嚎窟',
    monsters: [
      { template: mkMonster('噬魂尸卒', 300000, 'water', 'balanced', 8), traits: ['T05', 'T18', 'T11'] },
      { template: mkMonster('哀嚎尸卒', 180000, 'water', 'dps', 8), traits: ['T19'] },
    ],
    designNote: '续航 + 沉默 + 元素吸收',
  },
  {
    floor: 17, name: '金甲门',
    monsters: [
      { template: mkMonster('金甲圣戒卫', 320000, 'metal', 'tank', 8), traits: ['T07', 'T13', 'T08'] },
      { template: mkMonster('银甲卫',     192000, 'metal', 'balanced', 8), traits: ['T22'] },
    ],
    designNote: '4 段防御层',
  },
  {
    floor: 18, name: '业火天阵',
    monsters: [
      { template: mkMonster('业火天将', 340000, 'fire', 'dps', 8), traits: ['T21', 'T01', 'T08'] },
      { template: mkMonster('焰心使',   204000, 'fire', 'speed', 8), traits: ['T03', 'T22'] },
    ],
    designNote: '灼烧叠层 + 护盾',
  },
  {
    floor: 19, name: '寒月将台',
    monsters: [
      { template: mkMonster('寒月将军', 360000, 'water', 'dps', 8), traits: ['T16', 'T11', 'T03'] },
      { template: mkMonster('凝霜士',   216000, 'water', 'tank', 8), traits: ['T07', 'T13'] },
    ],
    designNote: '控+吸收+爆发+防御',
  },
  {
    floor: 20, name: '★渡劫雷王',
    monsters: [{ template: mkMonster('渡劫雷王', 520000, 'metal', 'boss', 8), traits: ['T03', 'T13', 'T18', 'T01', 'T08'] }],
    isLayerLord: true,
    designNote: '5 trait 层主，反伤池压制',
  },
  {
    floor: 21, name: '钢虫巢',
    monsters: [
      { template: mkMonster('百足傀儡', 420000, 'earth', 'tank', 8), traits: ['T08', 'T13', 'T07'] },
      { template: mkMonster('钢甲蝎',   252000, 'metal', 'dps', 8), traits: ['T22', 'T03'] },
    ],
    designNote: '终极防御组合',
  },
  {
    floor: 22, name: '阴煞营',
    monsters: [
      { template: mkMonster('阴煞将', 440000, 'water', 'dps', 8), traits: ['T18', 'T19', 'T05'] },
      { template: mkMonster('怨灵',   264000, 'water', 'balanced', 8), traits: ['T19', 'T11'] },
    ],
    designNote: '双控连锁',
  },
  {
    floor: 23, name: '玄龟潭',
    monsters: [
      { template: mkMonster('玄龟',     460000, 'water', 'tank', 8), traits: ['T07', 'T13', 'T08'] },
      { template: mkMonster('龟甲蜘蛛', 276000, 'water', 'balanced', 8), traits: ['T22', 'T05'] },
    ],
    designNote: '防御+反伤+续航',
  },
  {
    floor: 24, name: '蛇雷高崖',
    monsters: [
      { template: mkMonster('青冥蛇王', 480000, 'wood', 'dps', 8), traits: ['T20', 'T15', 'T19'] },
      { template: mkMonster('紫电蝎',   288000, 'metal', 'dps', 8), traits: ['T03', 'T01'] },
    ],
    designNote: '中毒+反击+双控+爆狂',
  },
  {
    floor: 25, name: '◆阎罗冥王',
    monsters: [{ template: mkMonster('阎罗冥王', 900000, null, 'boss', 8), traits: ['B01', 'T18', 'T15', 'T07', 'T08'] }],
    isMidBoss: true,
    rewardTitle: TOWER_TITLES.FLOOR_25,
    permanentStatPct: 1,  // +1% 全属性
    designNote: '第一个中 Boss；首通授予「塔中过客」+ 永久全属性 +1%',
  },
]

// ========== 全塔配置（按 floor 索引） ==========
export const TOWER_FLOORS: Record<number, FloorDef> = {}
for (const def of [...FLOORS_1_15, ...FLOORS_16_25]) {
  TOWER_FLOORS[def.floor] = def
}

/** 已实现的最高层（MVP 阶段 = 25；后续 Phase 扩展时改这个常量） */
export const IMPLEMENTED_FLOORS = 25

export function getFloorDef(floor: number): FloorDef | null {
  return TOWER_FLOORS[floor] || null
}
