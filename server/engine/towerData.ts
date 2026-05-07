// 通天塔静态数据 — 100 层配置 + Trait 定义
// v3：1-100 层全部实装，按段位映射主图 T7-T15。
// 设计文档：design/system-tower.md
//
// 数值生成完全复用现有 battleEngine.generateMonsterStats()，
// 我们只配置 power / element / role / drop_table（决定 tier 缩放）+ traits。
// trait 的运行时效果由 towerTraits.ts 负责注入到 BattlerStats 或 monster 技能池上。

import type { MonsterTemplate } from './battleEngine'

export const TOTAL_FLOORS = 100
export const TURN_LIMIT_PER_FLOOR = 150
export const DAILY_FAIL_LIMIT = 3
export const ENTRY_REALM_TIER = 7   // 大乘
export const ENTRY_LEVEL = 140

// ========== Trait 定义 ==========
// 每个 trait 的实际效果在 towerTraits.ts 里实现；这里只是元数据用于前端展示。
export type TraitId =
  | 'T01' | 'T03' | 'T05' | 'T07' | 'T08'
  | 'T09' | 'T11' | 'T13' | 'T15' | 'T16'
  | 'T17' | 'T18' | 'T19' | 'T20' | 'T21' | 'T22'
  | 'B01' | 'B02' | 'B03' | 'B04' | 'B05'

export interface TraitDef {
  id: TraitId
  name: string
  desc: string
  category: 'rage' | 'sustain' | 'defense' | 'element' | 'reflect' | 'control' | 'dot' | 'special'
}

export const TRAITS: Record<TraitId, TraitDef> = {
  T01: { id: 'T01', name: '狂暴',       desc: '攻击 +30%、速度 +15%（开战即激活）',                   category: 'rage' },
  T03: { id: 'T03', name: '爆发',       desc: '会心率 +50%、会心伤害 +50%',                            category: 'rage' },
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
  B03: { id: 'B03', name: '分身',       desc: 'MVP 简化：攻击 +40%、速度 +20%（双形态高频压制）',      category: 'special' },
  B04: { id: 'B04', name: '狂暴计时',   desc: 'MVP 简化：开战即狂暴，攻击 +50%（30 回合机制简化）',    category: 'special' },
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
// power 区间：60k ~ 235k，对位主图 T7 ×1.5-2.4（v2 削弱：原 80k~312k 偏难）
const FLOORS_1_15: FloorDef[] = [
  {
    floor: 1, name: '道殿入口',
    monsters: [{ template: mkMonster('焚渊魔将', 60000, 'fire', 'dps', 7), traits: ['T21'] }],
    designNote: '进塔教学层，单 trait 入门',
  },
  {
    floor: 2, name: '寒月初照',
    monsters: [{ template: mkMonster('寒月使者', 70000, 'water', 'dps', 7), traits: ['T16', 'T11'] }],
    designNote: '第一次"换元素"考验',
  },
  {
    floor: 3, name: '雷崖断',
    monsters: [{ template: mkMonster('雷豹王', 80000, 'metal', 'dps', 7), traits: ['T03'] }],
    designNote: '爆发型 dps，闪避检验',
  },
  {
    floor: 4, name: '古木阴',
    monsters: [{ template: mkMonster('古木哨灵', 92000, 'wood', 'tank', 7), traits: ['T05', 'T22'] }],
    designNote: '续航 + 流血',
  },
  {
    floor: 5, name: '★星陨之灵',
    monsters: [{ template: mkMonster('星陨之灵', 135000, null, 'boss', 7), traits: ['T08', 'T03'] }],
    isLayerLord: true,
    designNote: '第一个层主，厚血爆发',
  },
  {
    floor: 6, name: '黑雾刺谷',
    monsters: [{ template: mkMonster('黑雾刺客', 100000, null, 'speed', 7), traits: ['T15'] }],
    designNote: '反击，禁普攻流',
  },
  {
    floor: 7, name: '焰心圣域',
    monsters: [{ template: mkMonster('焰心圣女', 110000, 'fire', 'balanced', 7), traits: ['T21', 'T01'] }],
    designNote: '灼烧 + 狂暴',
  },
  {
    floor: 8, name: '玄铁堡',
    monsters: [{ template: mkMonster('玄铁守卫', 125000, 'metal', 'tank', 7), traits: ['T07', 'T08'] }],
    designNote: '双段防御，破甲检验',
  },
  {
    floor: 9, name: '蛇雷岭',
    monsters: [
      { template: mkMonster('青冥蛇王', 135000, 'wood', 'dps', 7), traits: ['T20'] },
      { template: mkMonster('紫电蝎',   80000, 'metal', 'dps', 7), traits: ['T03'] },
    ],
    designNote: '大乘段第一次双怪，毒+爆',
  },
  {
    floor: 10, name: '★阎魔尸卫',
    monsters: [{ template: mkMonster('阎魔尸卫', 190000, 'water', 'boss', 7), traits: ['T18', 'T05', 'T11'] }],
    isLayerLord: true,
    designNote: '沉默 + 续航 + 水吸收',
  },
  {
    floor: 11, name: '业火门',
    monsters: [
      { template: mkMonster('业火护卫', 145000, 'fire', 'tank', 7), traits: ['T21'] },
      { template: mkMonster('火甲蝙蝠', 85000, 'fire', 'speed', 7), traits: ['T01'] },
    ],
    designNote: '灼烧 + 狂暴',
  },
  {
    floor: 12, name: '寒星阵',
    monsters: [
      { template: mkMonster('寒星天使', 155000, 'water', 'dps', 7), traits: ['T16', 'T11'] },
      { template: mkMonster('凝霜兵',   95000, 'water', 'tank', 7), traits: ['T07'] },
    ],
    designNote: '冻结 + 元素吸收',
  },
  {
    floor: 13, name: '八歧穴',
    monsters: [
      { template: mkMonster('八歧蛇尾', 165000, 'wood', 'dps', 7), traits: ['T20', 'T15'] },
      { template: mkMonster('蛇姬使',   100000, 'wood', 'speed', 7), traits: ['T05'] },
    ],
    designNote: '中毒 + 反击 + 续航',
  },
  {
    floor: 14, name: '地狱火门',
    monsters: [
      { template: mkMonster('地狱火将', 180000, 'fire', 'dps', 7), traits: ['T21', 'T01'] },
      { template: mkMonster('地狱火兵', 110000, 'fire', 'balanced', 7), traits: ['T22'] },
    ],
    designNote: '灼烧叠层 + 狂暴',
  },
  {
    floor: 15, name: '★烈焰天王',
    monsters: [{ template: mkMonster('烈焰天王', 235000, 'fire', 'boss', 7), traits: ['T21', 'T01', 'T08', 'T22'] }],
    isLayerLord: true,
    rewardTitle: TOWER_TITLES.FLOOR_15,
    designNote: '4 trait 层主，大乘段终点；首通授予「塔下行者」',
  },
]

// ========== 16-25 层 (飞升初 T8 前半) ==========
// power 区间：225k ~ 600k，对位主图 T8 ×1.5-2.0（v2 削弱：原 300k~900k 偏难）
const FLOORS_16_25: FloorDef[] = [
  {
    floor: 16, name: '哀嚎窟',
    monsters: [
      { template: mkMonster('噬魂尸卒', 225000, 'water', 'balanced', 8), traits: ['T05', 'T11'] },
      { template: mkMonster('哀嚎尸卒', 135000, 'water', 'dps', 8), traits: ['T19'] },
    ],
    designNote: '续航 + 元素吸收',
  },
  {
    floor: 17, name: '金甲门',
    monsters: [
      { template: mkMonster('金甲圣戒卫', 240000, 'metal', 'tank', 8), traits: ['T07', 'T08'] },
      { template: mkMonster('银甲卫',     145000, 'metal', 'balanced', 8), traits: ['T22'] },
    ],
    designNote: '双段防御层',
  },
  {
    floor: 18, name: '业火天阵',
    monsters: [
      { template: mkMonster('业火天将', 255000, 'fire', 'dps', 8), traits: ['T21', 'T01'] },
      { template: mkMonster('焰心使',   155000, 'fire', 'speed', 8), traits: ['T22'] },
    ],
    designNote: '灼烧叠层 + 狂暴',
  },
  {
    floor: 19, name: '寒月将台',
    monsters: [
      { template: mkMonster('寒月将军', 270000, 'water', 'dps', 8), traits: ['T16', 'T11'] },
      { template: mkMonster('凝霜士',   165000, 'water', 'tank', 8), traits: ['T07'] },
    ],
    designNote: '冻结 + 吸收 + 防御',
  },
  {
    floor: 20, name: '★渡劫雷王',
    monsters: [{ template: mkMonster('渡劫雷王', 390000, 'metal', 'boss', 8), traits: ['T03', 'T18', 'T01', 'T08'] }],
    isLayerLord: true,
    designNote: '4 trait 层主，控制 + 爆发 + 厚血',
  },
  {
    floor: 21, name: '钢虫巢',
    monsters: [
      { template: mkMonster('百足傀儡', 315000, 'earth', 'tank', 8), traits: ['T08', 'T07'] },
      { template: mkMonster('钢甲蝎',   190000, 'metal', 'dps', 8), traits: ['T03'] },
    ],
    designNote: '坦+爆，破甲检验',
  },
  {
    floor: 22, name: '阴煞营',
    monsters: [
      { template: mkMonster('阴煞将', 330000, 'water', 'dps', 8), traits: ['T18', 'T05'] },
      { template: mkMonster('怨灵',   200000, 'water', 'balanced', 8), traits: ['T11'] },
    ],
    designNote: '沉默 + 续航 + 水吸收',
  },
  {
    floor: 23, name: '玄龟潭',
    monsters: [
      { template: mkMonster('玄龟',     345000, 'water', 'tank', 8), traits: ['T07', 'T08'] },
      { template: mkMonster('龟甲蜘蛛', 210000, 'water', 'balanced', 8), traits: ['T22'] },
    ],
    designNote: '防御 + 流血',
  },
  {
    floor: 24, name: '蛇雷高崖',
    monsters: [
      { template: mkMonster('青冥蛇王', 360000, 'wood', 'dps', 8), traits: ['T20', 'T15'] },
      { template: mkMonster('紫电蝎',   215000, 'metal', 'dps', 8), traits: ['T03'] },
    ],
    designNote: '中毒 + 反击 + 爆发',
  },
  {
    floor: 25, name: '◆阎罗冥王',
    monsters: [{ template: mkMonster('阎罗冥王', 600000, null, 'boss', 8), traits: ['B01', 'T18', 'T08'] }],
    isMidBoss: true,
    rewardTitle: TOWER_TITLES.FLOOR_25,
    permanentStatPct: 1,  // +1% 全属性
    designNote: '第一个中 Boss（三阶段+沉默+护盾）；首通授予「塔中过客」+ 永久全属性 +1%',
  },
]

// ========== 26-35 层 (飞升中 T9) ==========
// power 区间：250k ~ 870k，对位主图 T9 boss 700-800k ×1.0-1.3
const FLOORS_26_35: FloorDef[] = [
  { floor: 26, name: '寒月使谷',
    monsters: [
      { template: mkMonster('寒月使者', 250000, 'water', 'dps', 9), traits: ['T16', 'T11'] },
      { template: mkMonster('冷血卫',   150000, 'water', 'tank', 9), traits: ['T07'] },
    ], designNote: '冻结 + 元素吸收',
  },
  { floor: 27, name: '焚天双蛟',
    monsters: [
      { template: mkMonster('焚天蛟',   290000, 'fire', 'dps', 9), traits: ['T21', 'T01'] },
      { template: mkMonster('火焰魔将', 175000, 'fire', 'balanced', 9), traits: ['T08'] },
    ], designNote: '灼烧 + 狂暴 + 护盾',
  },
  { floor: 28, name: '影刺再现',
    monsters: [
      { template: mkMonster('黯影刺客', 335000, null, 'speed', 9), traits: ['T15', 'T19'] },
      { template: mkMonster('影分身',   200000, null, 'dps', 9), traits: ['T18'] },
    ], designNote: '反击 + 双控',
  },
  { floor: 29, name: '火甲连营',
    monsters: [
      { template: mkMonster('业火护卫', 385000, 'fire', 'tank', 9), traits: ['T21', 'T07'] },
      { template: mkMonster('火甲蝙蝠', 230000, 'fire', 'speed', 9), traits: ['T01', 'T22'] },
    ], designNote: '灼烧 + 减伤 + 流血',
  },
  { floor: 30, name: '★阴影统领',
    monsters: [{ template: mkMonster('阴影统领', 580000, null, 'boss', 9), traits: ['T15', 'T19', 'T05', 'T08'] }],
    isLayerLord: true, designNote: '4 trait 层主：反击+控+续航+护盾',
  },
  { floor: 31, name: '太虚卫所',
    monsters: [
      { template: mkMonster('虚空剑侍', 415000, 'metal', 'balanced', 9), traits: ['T07', 'T08'] },
      { template: mkMonster('圣境守护', 250000, 'earth', 'tank', 9), traits: ['T22', 'T05'] },
    ], designNote: '双段防御层',
  },
  { floor: 32, name: '圣境再阵',
    monsters: [
      { template: mkMonster('寒星天使', 470000, 'water', 'dps', 9), traits: ['T16', 'T11'] },
      { template: mkMonster('凝霜兵',   280000, 'water', 'tank', 9), traits: ['T07'] },
    ], designNote: '控 + 吸收',
  },
  { floor: 33, name: '业火殿',
    monsters: [
      { template: mkMonster('业火天将', 530000, 'fire', 'dps', 9), traits: ['T21', 'T01', 'T08'] },
      { template: mkMonster('焰心使',   320000, 'fire', 'speed', 9), traits: ['T22'] },
    ], designNote: '灼烧叠层 + 护盾',
  },
  { floor: 34, name: '寒月再起',
    monsters: [
      { template: mkMonster('寒月将军', 600000, 'water', 'dps', 9), traits: ['T16', 'T11'] },
      { template: mkMonster('凝霜士',   360000, 'water', 'tank', 9), traits: ['T07', 'T13'] },
    ], designNote: '控 + 吸收 + 反伤',
  },
  { floor: 35, name: '★太虚帝君',
    monsters: [{ template: mkMonster('太虚帝君', 870000, 'metal', 'boss', 9), traits: ['B05', 'T08', 'T03'] }],
    isLayerLord: true, designNote: '3 trait 层主：五行轮转教学',
  },
]

// ========== 36-50 层 (飞升后 T10) ==========
// power 区间：800k ~ 2.95M，对位主图 T10 boss 750k-1.2M ×1.5-2.5
const FLOORS_36_50: FloorDef[] = [
  { floor: 36, name: '钢虫终阵',
    monsters: [
      { template: mkMonster('百足傀儡', 800000, 'earth', 'tank', 10), traits: ['T08', 'T07'] },
      { template: mkMonster('钢甲蝎',   480000, 'metal', 'dps', 10), traits: ['T03'] },
    ], designNote: '终极防御组合',
  },
  { floor: 37, name: '阴煞终营',
    monsters: [
      { template: mkMonster('阴煞将', 880000, 'water', 'dps', 10), traits: ['T18', 'T05'] },
      { template: mkMonster('怨灵',   530000, 'water', 'balanced', 10), traits: ['T11'] },
    ], designNote: '沉默+续航+吸收',
  },
  { floor: 38, name: '玄龟终潭',
    monsters: [
      { template: mkMonster('玄龟',     980000, 'water', 'tank', 10), traits: ['T07', 'T08'] },
      { template: mkMonster('龟甲蜘蛛', 590000, 'water', 'balanced', 10), traits: ['T22', 'T05'] },
    ], designNote: '防御+续航',
  },
  { floor: 39, name: '终极蛇雷',
    monsters: [
      { template: mkMonster('青冥蛇王', 1080000, 'wood', 'dps', 10), traits: ['T20', 'T15'] },
      { template: mkMonster('紫电蝎',   650000,  'metal', 'dps', 10), traits: ['T03'] },
    ], designNote: '中毒+反击+爆',
  },
  { floor: 40, name: '★始祖龙',
    monsters: [{ template: mkMonster('始祖龙', 1450000, null, 'boss', 10), traits: ['B02', 'T18', 'T07', 'T05'] }],
    isLayerLord: true, designNote: '4 trait 层主：召唤+沉默+续航',
  },
  { floor: 41, name: '鸿蒙异兽',
    monsters: [
      { template: mkMonster('鸿蒙异兽', 1180000, 'wood', 'dps', 10), traits: ['T20', 'T15'] },
      { template: mkMonster('本源精灵', 710000,  'water', 'balanced', 10), traits: ['T11', 'T05'] },
    ], designNote: '中毒+反击+续航+吸收',
  },
  { floor: 42, name: '玄龟仙潭',
    monsters: [
      { template: mkMonster('玄龟',     1300000, 'water', 'tank', 10), traits: ['T07', 'T13', 'T08'] },
      { template: mkMonster('龟甲蜘蛛', 780000,  'water', 'balanced', 10), traits: ['T22'] },
    ], designNote: '防御+反伤+护盾',
  },
  { floor: 43, name: '终极蛇阵',
    monsters: [
      { template: mkMonster('青冥蛇王', 1430000, 'wood', 'dps', 10), traits: ['T20', 'T15', 'T03'] },
      { template: mkMonster('紫电蝎',   860000,  'metal', 'dps', 10), traits: ['T01'] },
    ], designNote: '中毒+反击+爆',
  },
  { floor: 44, name: '寒月终曲',
    monsters: [
      { template: mkMonster('寒月使者', 1580000, 'water', 'dps', 10), traits: ['T16', 'T11'] },
      { template: mkMonster('冷血卫',   950000,  'water', 'tank', 10), traits: ['T07', 'T13'] },
    ], designNote: '控+吸收+反伤',
  },
  { floor: 45, name: '★道劫之灵',
    monsters: [{ template: mkMonster('道劫之灵', 2050000, null, 'boss', 10), traits: ['T09', 'T03', 'T08', 'T05'] }],
    isLayerLord: true, designNote: '4 trait 层主：圣盾期前置',
  },
  { floor: 46, name: '焚天再焚',
    monsters: [
      { template: mkMonster('焚天蛟',   1750000, 'fire', 'dps', 10), traits: ['T21', 'T01', 'T07'] },
      { template: mkMonster('火焰魔将', 1050000, 'fire', 'balanced', 10), traits: ['T08'] },
    ], designNote: '灼烧+狂暴+护盾',
  },
  { floor: 47, name: '暗影殿',
    monsters: [
      { template: mkMonster('黯影刺客', 1920000, null, 'speed', 10), traits: ['T15', 'T19', 'T03'] },
      { template: mkMonster('影分身',   1150000, null, 'dps', 10), traits: ['T18'] },
    ], designNote: '反击+双控+爆发',
  },
  { floor: 48, name: '业火极殿',
    monsters: [
      { template: mkMonster('业火护卫', 2100000, 'fire', 'tank', 10), traits: ['T21', 'T07', 'T22'] },
      { template: mkMonster('火甲蝙蝠', 1260000, 'fire', 'speed', 10), traits: ['T01', 'T08'] },
    ], designNote: '灼烧+减伤+护盾',
  },
  { floor: 49, name: '金甲终殿',
    monsters: [
      { template: mkMonster('金甲圣戒卫', 2350000, 'metal', 'tank', 10), traits: ['T07', 'T08', 'T19'] },
      { template: mkMonster('银甲卫',     1410000, 'metal', 'balanced', 10), traits: ['T22', 'T18'] },
    ], designNote: '5 trait 终极防御',
  },
  { floor: 50, name: '◆诸天魔王',
    monsters: [{ template: mkMonster('诸天魔王', 2950000, null, 'boss', 10), traits: ['B01', 'T18', 'T07', 'T08'] }],
    isMidBoss: true,
    rewardTitle: TOWER_TITLES.FLOOR_50,
    permanentStatPct: 2,
    designNote: '第二个中 Boss（4 trait）；首通授予「半塔之主」+ 永久全属性 +2%',
  },
]

// ========== 51-65 层 (混元初 T11) ==========
// power 区间：3.0M ~ 8.5M，对位主图 T11 boss 4.5-5.5M ×1.3-1.6
const FLOORS_51_65: FloorDef[] = [
  { floor: 51, name: '鸿蒙浪谷',
    monsters: [
      { template: mkMonster('鸿蒙巨鲲', 3000000, 'water', 'balanced', 11), traits: ['T11', 'T16'] },
      { template: mkMonster('本源水妖', 1800000, 'water', 'dps', 11), traits: ['T07'] },
    ], designNote: '混元水阵',
  },
  { floor: 52, name: '本源龙窟',
    monsters: [
      { template: mkMonster('本源龙神', 3300000, null, 'dps', 11), traits: ['T01', 'T03'] },
      { template: mkMonster('幼龙',     2000000, null, 'speed', 11), traits: ['T15'] },
    ], designNote: '狂爆+反击',
  },
  { floor: 53, name: '虚空圣堂',
    monsters: [
      { template: mkMonster('虚空圣使', 3600000, 'metal', 'dps', 11), traits: ['T07', 'T08'] },
      { template: mkMonster('圣使从者', 2150000, 'metal', 'tank', 11), traits: ['T22'] },
    ], designNote: '防御+流血',
  },
  { floor: 54, name: '九天将台',
    monsters: [
      { template: mkMonster('天庭元帅', 3950000, 'metal', 'tank', 11), traits: ['T07', 'T13'] },
      { template: mkMonster('天兵',     2350000, 'metal', 'balanced', 11), traits: ['T08'] },
    ], designNote: '反伤+护盾',
  },
  { floor: 55, name: '★星辰大将',
    monsters: [{ template: mkMonster('星辰大将', 5000000, 'fire', 'boss', 11), traits: ['T01', 'T03', 'T21', 'T08'] }],
    isLayerLord: true, designNote: '4 trait 层主：狂爆+灼烧+护盾',
  },
  { floor: 56, name: '雷霆君营',
    monsters: [
      { template: mkMonster('雷霆君主', 4300000, 'metal', 'dps', 11), traits: ['T03', 'T22'] },
      { template: mkMonster('雷使',     2600000, 'metal', 'speed', 11), traits: ['T18'] },
    ], designNote: '爆发+流血+沉默',
  },
  { floor: 57, name: '玉宇仙宫',
    monsters: [
      { template: mkMonster('玉宇神将', 4700000, 'metal', 'tank', 11), traits: ['T07', 'T08', 'T13'] },
      { template: mkMonster('玉卫',     2800000, 'metal', 'balanced', 11), traits: ['T05'] },
    ], designNote: '三段防御+续航',
  },
  { floor: 58, name: '混沌烈狱',
    monsters: [
      { template: mkMonster('混沌火魔', 5100000, 'fire', 'dps', 11), traits: ['T21', 'T01', 'T08'] },
      { template: mkMonster('烈焰使',   3050000, 'fire', 'balanced', 11), traits: ['T22'] },
    ], designNote: '灼烧叠层+狂暴',
  },
  { floor: 59, name: '木灵仙境',
    monsters: [
      { template: mkMonster('木灵帝君', 5550000, 'wood', 'dps', 11), traits: ['T20', 'T15', 'T05'] },
      { template: mkMonster('木灵使',   3300000, 'wood', 'speed', 11), traits: ['T19'] },
    ], designNote: '中毒+反击+续航',
  },
  { floor: 60, name: '★鸿蒙帝君',
    monsters: [{ template: mkMonster('鸿蒙帝君', 7000000, null, 'boss', 11), traits: ['B03', 'T03', 'T07', 'T08'] }],
    isLayerLord: true, designNote: '4 trait 层主：B03 分身首次登场',
  },
  { floor: 61, name: '永夜之渊',
    monsters: [
      { template: mkMonster('永夜之灵', 6000000, null, 'dps', 11), traits: ['T18', 'T19', 'T03'] },
      { template: mkMonster('夜灵',     3600000, null, 'speed', 11), traits: ['T15'] },
    ], designNote: '双控+爆+反击',
  },
  { floor: 62, name: '寒霜帝座',
    monsters: [
      { template: mkMonster('寒霜帝君', 6500000, 'water', 'dps', 11), traits: ['T16', 'T11', 'T03'] },
      { template: mkMonster('霜凝兵',   3900000, 'water', 'tank', 11), traits: ['T07'] },
    ], designNote: '冻结+吸收+爆发',
  },
  { floor: 63, name: '炎魔大殿',
    monsters: [
      { template: mkMonster('炎魔之主', 7000000, 'fire', 'tank', 11), traits: ['T21', 'T07', 'T08'] },
      { template: mkMonster('焰仆',     4200000, 'fire', 'speed', 11), traits: ['T01', 'T22'] },
    ], designNote: '灼烧+减伤+护盾',
  },
  { floor: 64, name: '玄黄圣岭',
    monsters: [
      { template: mkMonster('玄黄道君', 7500000, 'earth', 'tank', 11), traits: ['T07', 'T13', 'T08'] },
      { template: mkMonster('土甲卫',   4500000, 'earth', 'balanced', 11), traits: ['T22'] },
    ], designNote: '终极防御+反伤',
  },
  { floor: 65, name: '★九霄玉帝',
    monsters: [{ template: mkMonster('九霄玉帝', 8500000, 'metal', 'boss', 11), traits: ['B05', 'T07', 'T08', 'T03'] }],
    isLayerLord: true, designNote: '4 trait 层主：五行轮转再现',
  },
]

// ========== 66-80 层 (混元中 T12) ==========
// power 区间：10M ~ 38M，对位主图 T12 boss 16-25M ×1.3-1.6
const FLOORS_66_80: FloorDef[] = [
  { floor: 66, name: '虚空泰坦阵',
    monsters: [
      { template: mkMonster('虚空泰坦', 10000000, null, 'tank', 12), traits: ['T07', 'T08'] },
      { template: mkMonster('泰坦守',   6000000,  null, 'balanced', 12), traits: ['T22'] },
    ], designNote: '坦+流血',
  },
  { floor: 67, name: '永恒刺殿',
    monsters: [
      { template: mkMonster('永恒刺客', 11500000, null, 'speed', 12), traits: ['T15', 'T19', 'T03'] },
      { template: mkMonster('暗影',     6900000,  null, 'dps', 12), traits: ['T18'] },
    ], designNote: '反击+双控+爆',
  },
  { floor: 68, name: '本源毁灭',
    monsters: [
      { template: mkMonster('本源毁灭者', 13000000, 'fire', 'dps', 12), traits: ['T21', 'T01', 'T08'] },
      { template: mkMonster('毁灭使',     7800000,  'fire', 'balanced', 12), traits: ['T22'] },
    ], designNote: '灼烧叠层+狂暴',
  },
  { floor: 69, name: '虚空之渊',
    monsters: [
      { template: mkMonster('深渊之主', 15000000, null, 'tank', 12), traits: ['T07', 'T13', 'T08'] },
      { template: mkMonster('深渊使',   9000000,  null, 'balanced', 12), traits: ['T05'] },
    ], designNote: '防御+反伤+续航',
  },
  { floor: 70, name: '★虚空之主',
    monsters: [{ template: mkMonster('虚空之主', 19000000, null, 'boss', 12), traits: ['B04', 'T07', 'T08', 'T18'] }],
    isLayerLord: true, designNote: '4 trait 层主：B04 狂暴计时首次',
  },
  { floor: 71, name: '创世守阵',
    monsters: [
      { template: mkMonster('创世守卫', 17000000, 'earth', 'tank', 12), traits: ['T07', 'T08', 'T22'] },
      { template: mkMonster('守卫使',   10000000, 'earth', 'balanced', 12), traits: ['T05'] },
    ], designNote: '防御+流血+续航',
  },
  { floor: 72, name: '法则裁定',
    monsters: [
      { template: mkMonster('法则裁定者', 19000000, null, 'dps', 12), traits: ['T03', 'T18', 'T19'] },
      { template: mkMonster('裁定使',     11000000, null, 'speed', 12), traits: ['T15'] },
    ], designNote: '爆+双控+反击',
  },
  { floor: 73, name: '终焉先知',
    monsters: [
      { template: mkMonster('终焉先知', 22000000, null, 'dps', 12), traits: ['T18', 'T03', 'T05'] },
      { template: mkMonster('先知使',   13000000, null, 'balanced', 12), traits: ['T11'] },
    ], designNote: '沉默+爆+续航+吸收',
  },
  { floor: 74, name: '万灭之炼',
    monsters: [
      { template: mkMonster('万灭之灵', 25000000, 'fire', 'dps', 12), traits: ['T21', 'T01', 'T22', 'T07'] },
      { template: mkMonster('灭灵使',   15000000, 'fire', 'speed', 12), traits: ['T22'] },
    ], designNote: '4 trait 灼烧+流血+减伤',
  },
  { floor: 75, name: '◆创世道祖',
    monsters: [{ template: mkMonster('创世道祖', 32000000, null, 'boss', 12), traits: ['B01', 'B05', 'T07', 'T08', 'T03'] }],
    isMidBoss: true,
    rewardTitle: TOWER_TITLES.FLOOR_75,
    permanentStatPct: 3,
    designNote: '第三个中 Boss（5 trait 三阶段+五行轮转）；首通授予「塔顶遥望」+ 永久全属性 +3%',
  },
  { floor: 76, name: '万源剑域',
    monsters: [
      { template: mkMonster('本源剑灵', 22000000, 'metal', 'speed', 13), traits: ['T15', 'T19', 'T03'] },
      { template: mkMonster('剑使',     13000000, 'metal', 'dps', 13), traits: ['T18'] },
    ], designNote: '反击+控+爆',
  },
  { floor: 77, name: '终焉炼狱',
    monsters: [
      { template: mkMonster('本源终焉', 25000000, 'fire', 'dps', 13), traits: ['T21', 'T01', 'T22'] },
      { template: mkMonster('终焉使',   15000000, 'fire', 'balanced', 13), traits: ['T08'] },
    ], designNote: '三 DOT+护盾',
  },
  { floor: 78, name: '万源守阙',
    monsters: [
      { template: mkMonster('万源守阙', 28000000, 'earth', 'balanced', 13), traits: ['T07', 'T13', 'T05'] },
      { template: mkMonster('守阙使',   17000000, 'earth', 'tank', 13), traits: ['T08'] },
    ], designNote: '防御+反伤+续航',
  },
  { floor: 79, name: '混沌神宫',
    monsters: [
      { template: mkMonster('混沌神王', 30000000, null, 'dps', 13), traits: ['T03', 'T18', 'T19', 'T08'] },
      { template: mkMonster('神宫使',   18000000, null, 'speed', 13), traits: ['T15'] },
    ], designNote: '4 trait 爆+双控+护盾+反击',
  },
  { floor: 80, name: '★星辰仲裁',
    monsters: [{ template: mkMonster('星辰仲裁者', 38000000, 'metal', 'boss', 13), traits: ['T07', 'T08', 'T03', 'T13'] }],
    isLayerLord: true, designNote: '4 trait 层主：终极防御+反伤+爆发',
  },
]

// ========== 81-90 层 (道域 T13) ==========
// power 区间：35M ~ 90M，对位主图 T13 boss 60-70M ×1.3-1.5
const FLOORS_81_90: FloorDef[] = [
  { floor: 81, name: '星海掠地',
    monsters: [
      { template: mkMonster('星海掠者', 35000000, 'water', 'dps', 13), traits: ['T16', 'T11', 'T03'] },
      { template: mkMonster('星海使',   21000000, 'water', 'speed', 13), traits: ['T19'] },
    ], designNote: '冻结+吸收+爆+控',
  },
  { floor: 82, name: '宙环道场',
    monsters: [
      { template: mkMonster('宙环先知', 42000000, null, 'dps', 13), traits: ['T18', 'T03', 'T05'] },
      { template: mkMonster('先知卫',   25000000, null, 'balanced', 13), traits: ['T11'] },
    ], designNote: '沉默+爆+续航',
  },
  { floor: 83, name: '万源道场',
    monsters: [
      { template: mkMonster('万源道君', 50000000, null, 'tank', 13), traits: ['T07', 'T08', 'T13', 'T05'] },
      { template: mkMonster('道君使',   30000000, null, 'balanced', 13), traits: ['T22'] },
    ], designNote: '4 trait 终极防御',
  },
  { floor: 84, name: '终焉之域',
    monsters: [
      { template: mkMonster('终焉道魂', 58000000, 'fire', 'dps', 13), traits: ['T21', 'T01', 'T22', 'T08'] },
      { template: mkMonster('道魂使',   35000000, 'fire', 'speed', 13), traits: ['T03'] },
    ], designNote: '4 trait 三 DOT+爆',
  },
  { floor: 85, name: '★天宇道君',
    monsters: [{ template: mkMonster('天宇道君', 70000000, 'metal', 'boss', 13), traits: ['B05', 'T07', 'T08', 'T03', 'T13'] }],
    isLayerLord: true, designNote: '5 trait 层主：五行轮转+终极防御',
  },
  { floor: 86, name: '因果潮汐',
    monsters: [
      { template: mkMonster('因果守律', 60000000, 'water', 'tank', 14), traits: ['T07', 'T08', 'T13'] },
      { template: mkMonster('守律使',   36000000, 'water', 'balanced', 14), traits: ['T11', 'T05'] },
    ], designNote: '防御+反伤+水吸收',
  },
  { floor: 87, name: '命运裂界',
    monsters: [
      { template: mkMonster('命运刺客', 68000000, null, 'speed', 14), traits: ['T15', 'T19', 'T18', 'T03'] },
      { template: mkMonster('刺客随从', 41000000, null, 'dps', 14), traits: ['T22'] },
    ], designNote: '4 trait 反击+三控+爆',
  },
  { floor: 88, name: '裁决厅',
    monsters: [
      { template: mkMonster('因果裁决', 76000000, null, 'dps', 14), traits: ['T03', 'T18', 'T22', 'T08'] },
      { template: mkMonster('裁决使',   46000000, null, 'balanced', 14), traits: ['T05'] },
    ], designNote: '4 trait 爆+沉默+流血+护盾',
  },
  { floor: 89, name: '时空残隙',
    monsters: [
      { template: mkMonster('时序哨卫', 82000000, 'metal', 'balanced', 14), traits: ['T07', 'T13', 'T08', 'T19'] },
      { template: mkMonster('哨卫长',   49000000, 'metal', 'tank', 14), traits: ['T22'] },
    ], designNote: '4 trait 防御+反伤+护盾+控',
  },
  { floor: 90, name: '★裂界吞噬者',
    monsters: [{ template: mkMonster('裂界吞噬者', 90000000, 'fire', 'boss', 14), traits: ['B04', 'T21', 'T07', 'T08', 'T03'] }],
    isLayerLord: true, designNote: '5 trait 层主：狂暴计时+灼烧+终极防御',
  },
]

// ========== 91-100 层 (法则 T14 / 终焉 T15 / 塔主) ==========
// power 区间：120M ~ 1B，对位主图 T14-T15 boss × 1.3-1.5
const FLOORS_91_100: FloorDef[] = [
  { floor: 91, name: '裂界深渊',
    monsters: [
      { template: mkMonster('空裂幽影', 120000000, null, 'dps', 14), traits: ['T18', 'T03', 'T22', 'T08'] },
      { template: mkMonster('幽影使',   72000000,  null, 'speed', 14), traits: ['T15'] },
    ], designNote: '4 trait 沉默+爆+流血+护盾',
  },
  { floor: 92, name: '时空圣域',
    monsters: [
      { template: mkMonster('时空圣女', 150000000, 'water', 'balanced', 14), traits: ['T11', 'T16', 'T03', 'T08'] },
      { template: mkMonster('圣使',     90000000,  'water', 'tank', 14), traits: ['T07'] },
    ], designNote: '4 trait 吸收+控+爆+护盾',
  },
  { floor: 93, name: '★因果天尊',
    monsters: [{ template: mkMonster('因果天尊', 240000000, 'water', 'boss', 14), traits: ['B05', 'T11', 'T07', 'T08', 'T05'] }],
    isLayerLord: true, designNote: '5 trait 层主：五行轮转+水吸收+续航',
  },
  { floor: 94, name: '时空崩坏',
    monsters: [
      { template: mkMonster('时序终焉', 200000000, null, 'dps', 14), traits: ['T03', 'T18', 'T19', 'T08'] },
      { template: mkMonster('终焉使',   120000000, null, 'speed', 14), traits: ['T15', 'T22'] },
    ], designNote: '4+2 trait 爆+三控+反击+护盾',
  },
  { floor: 95, name: '★时空之主',
    monsters: [{ template: mkMonster('时空之主', 330000000, null, 'boss', 14), traits: ['B01', 'T07', 'T08', 'T03', 'T18'] }],
    isLayerLord: true, designNote: '5 trait 层主：三阶段+终极防御+爆+沉默',
  },
  { floor: 96, name: '初辰之眠',
    monsters: [
      { template: mkMonster('初辰守者', 350000000, 'fire', 'tank', 15), traits: ['T21', 'T07', 'T08', 'T13'] },
      { template: mkMonster('守者使',   210000000, 'fire', 'balanced', 15), traits: ['T22', 'T05'] },
    ], designNote: '4+2 trait 灼烧+终极防御+续航',
  },
  { floor: 97, name: '创世圣台',
    monsters: [
      { template: mkMonster('创世圣使', 450000000, 'metal', 'dps', 15), traits: ['T03', 'T22', 'T08', 'T18'] },
      { template: mkMonster('圣使从',   270000000, 'metal', 'speed', 15), traits: ['T15', 'T19'] },
    ], designNote: '4+2 trait 爆+流血+护盾+沉默+反击+控',
  },
  { floor: 98, name: '★初辰道神',
    monsters: [{ template: mkMonster('初辰道神', 600000000, null, 'boss', 15), traits: ['B05', 'T07', 'T08', 'T03', 'T05'] }],
    isLayerLord: true, designNote: '5 trait 层主：五行轮转+终极防御+续航',
  },
  { floor: 99, name: '万道终炼',
    monsters: [
      { template: mkMonster('终焉守阙', 500000000, 'earth', 'tank', 15), traits: ['T07', 'T13', 'T08', 'T22', 'T05'] },
      { template: mkMonster('守阙使',   300000000, 'earth', 'balanced', 15), traits: ['T18'] },
    ], designNote: '5+1 trait 终极防御+反伤+流血+续航+沉默',
  },
  { floor: 100, name: '◆镇塔之灵',
    monsters: [{ template: mkMonster('镇塔之灵', 1000000000, null, 'boss', 15), traits: ['B01', 'B04', 'B05', 'T07', 'T08', 'T03'] }],
    isFinalBoss: true,
    rewardTitle: TOWER_TITLES.FLOOR_100,
    permanentStatPct: 5,
    designNote: '塔主"镇塔之灵"（6 trait 全机制集大成：三阶段+狂暴计时+五行轮转+终极防御+爆发）；首通授予「通天塔主」+ 永久全属性 +5%',
  },
]

// ========== 全塔配置（按 floor 索引） ==========
export const TOWER_FLOORS: Record<number, FloorDef> = {}
for (const def of [
  ...FLOORS_1_15, ...FLOORS_16_25, ...FLOORS_26_35, ...FLOORS_36_50,
  ...FLOORS_51_65, ...FLOORS_66_80, ...FLOORS_81_90, ...FLOORS_91_100,
]) {
  TOWER_FLOORS[def.floor] = def
}

/** 已实现的最高层（v3：1-100 层全部实装） */
export const IMPLEMENTED_FLOORS = 100

export function getFloorDef(floor: number): FloorDef | null {
  return TOWER_FLOORS[floor] || null
}
