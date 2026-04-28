// 秘境组队系统静态数据
// 已实现 SR-1 ~ SR-6，每个 3 档难度（普通/困难/噩梦）

import type { MonsterTemplate } from './battleEngine'

export interface SecretRealmWave {
  /** 波次内的怪物模板（实际数量由 runtime 生成器决定） */
  monsterPool: MonsterTemplate[]
  /** 本波怪物数量 */
  monsterCount: number
  /** 是否 Boss 波 */
  isBoss?: boolean
}

export interface SecretRealmDifficultyConfig {
  /** 难度显示名 */
  name: string
  /** 怪物战力倍率 */
  powerMul: number
  /** 奖励倍率 */
  rewardMul: number
  /** 波次列表 */
  waves: SecretRealmWave[]
  /** 最大回合数 = 每波回合上限 × 波次数 */
  turnsPerWave: number
  /** 基础秘境积分奖励（满贡献值） */
  basePoints: number
}

export interface SecretRealmDef {
  id: string
  name: string
  /** 境界要求 (realm_tier) */
  reqRealmTier: number
  /** 等级要求 */
  reqLevel: number
  /** 元素主题 */
  element: string | null
  /** 简介 */
  description: string
  /** 对应装备/掉落的 tier */
  dropTier: number
  difficulties: Record<1 | 2 | 3, SecretRealmDifficultyConfig>
}

// ==================== 辅助：按 tier 调整战力 ====================
// v3.4.5: 秘境经验密度归一 — 普通怪 ×0.15、BOSS ×0.6（旧 ×0.5/×2.0）
// 配合 team/start.post.ts 的 ×0.84 组队系数,实际密度 0.126/0.504,
// 比主图（0.10/0.40）高 26%,作为组队挑战奖励
function monster(name: string, power: number, element: string | null, role: string, tier: number): MonsterTemplate {
  return {
    name,
    power,
    element,
    role,
    exp: Math.floor(power * 0.15),
    stone_min: Math.floor(power * 0.02),
    stone_max: Math.floor(power * 0.08),
    drop_table: `common_t${tier}`,
  }
}

function boss(name: string, power: number, element: string | null, tier: number): MonsterTemplate {
  return {
    name,
    power,
    element,
    role: 'boss',
    exp: Math.floor(power * 0.6),
    stone_min: Math.floor(power * 0.1),
    stone_max: Math.floor(power * 0.25),
    drop_table: `boss_t${tier}`,
  }
}

// ==================== SR-1 灵草谷（筑基，T2） ====================
// drop_table tier 降一档用 T1 技能池，避免新手被高倍率 T2+ 技能压制
// Boss 也使用 T1，禁用"首领恢复"等让战斗僵持的回血技能
const SR1_MONSTERS = [
  monster('灵草妖', 500, 'wood', 'balanced', 1),
  monster('毒藤', 650, 'wood', 'dps', 1),
  monster('青木傀儡', 800, 'wood', 'tank', 1),
]
const SR1_ELITE = [
  monster('木灵护卫', 1100, 'wood', 'balanced', 1),
  monster('怒藤勇者', 1300, 'wood', 'dps', 1),
]
const SR1_BOSS = boss('千年藤王', 2200, 'wood', 1)

// ==================== SR-2 烈焰窟（金丹，T4） ====================
// v3.1: power × 0.4 (对应主图 T4 × 0.25,秘境稍高作为组队挑战加成)
const SR2_MONSTERS = [
  monster('炎鼠', 2400, 'fire', 'speed', 1),
  monster('熔岩怪', 3200, 'fire', 'balanced', 1),
  monster('赤鳞蜥', 2800, 'fire', 'balanced', 1),
]
const SR2_ELITE = [
  monster('焚烬士', 4800, 'fire', 'dps', 1),
  monster('火灵守卫', 5200, 'fire', 'balanced', 1),
]
const SR2_BOSS = boss('赤焰魔君', 12000, 'fire', 1)

// ==================== SR-3 幽冥渊（元婴，T5） ====================
// v3.1: power × 0.15 (对应主图 T5 × 0.10,秘境稍高)
const SR3_MONSTERS = [
  monster('水鬼', 2700, 'water', 'balanced', 1),
  monster('深海巨蛟', 3300, 'water', 'balanced', 1),
  monster('幽灵鱼', 3000, 'water', 'dps', 1),
]
const SR3_ELITE = [
  monster('冥卫', 5250, 'water', 'dps', 1),
  monster('冰魄师', 5700, 'water', 'balanced', 1),
]
const SR3_BOSS = boss('幽冥水帝', 12750, 'water', 1)

// ==================== SR-4 天雷域（化神，T7） ====================
// 对应 Lv.100 化神阶玩家，战力约 SR-3 × 2x
const SR4_MONSTERS = [
  monster('雷鳞蛇', 5400, 'metal', 'speed', 1),
  monster('金甲傀儡', 6600, 'metal', 'tank', 1),
  monster('雷电巨兽', 6000, 'metal', 'dps', 1),
]
const SR4_ELITE = [
  monster('雷霆使者', 10500, 'metal', 'dps', 1),
  monster('金元帅', 11400, 'metal', 'balanced', 1),
]
const SR4_BOSS = boss('雷霆帝君', 25500, 'metal', 1)

// ==================== SR-5 混沌界（渡劫，T9） ====================
// 对应 Lv.150 渡劫阶玩家，战力约 SR-4 × 2.2x
const SR5_MONSTERS = [
  monster('混沌幼体', 11800, null, 'balanced', 1),
  monster('虚空游魂', 14400, null, 'speed', 1),
  monster('界域碎片', 13200, null, 'dps', 1),
]
const SR5_ELITE = [
  monster('虚空法师', 23100, null, 'dps', 1),
  monster('混沌使徒', 25100, null, 'tank', 1),
]
const SR5_BOSS = boss('混沌魔神', 56000, null, 1)

// ==================== SR-6 太虚秘境（大乘，T10） ====================
// 对应 Lv.185 大乘阶玩家，战力约 SR-5 × 2.2x；元素 = null 表示五行轮转
const SR6_MONSTERS = [
  monster('五行混乱体', 25900, null, 'balanced', 1),
  monster('轮转守卫', 31700, null, 'tank', 1),
  monster('太虚幻影', 29000, null, 'dps', 1),
]
const SR6_ELITE = [
  monster('五行法王', 50800, null, 'dps', 1),
  monster('飞升守卫', 55200, null, 'balanced', 1),
]
const SR6_BOSS = boss('太虚道尊', 123200, null, 1)

// ==================== 秘境定义 ====================
export const SECRET_REALMS: Record<string, SecretRealmDef> = {
  'SR-1': {
    id: 'SR-1',
    name: '灵草谷',
    reqRealmTier: 2, // 筑基
    reqLevel: 15,
    element: 'wood',
    description: '灵草异变，妖兽横行。木灵之力在此汇聚。',
    dropTier: 2,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 100,
        waves: [
          { monsterPool: SR1_MONSTERS, monsterCount: 3 },
          { monsterPool: SR1_ELITE, monsterCount: 2 },
          { monsterPool: [SR1_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 250,
        waves: [
          { monsterPool: SR1_MONSTERS, monsterCount: 4 },
          { monsterPool: SR1_ELITE, monsterCount: 3 },
          { monsterPool: [SR1_BOSS, ...SR1_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR1_ELITE, monsterCount: 3 },
          { monsterPool: [SR1_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 500,
        waves: [
          { monsterPool: SR1_MONSTERS, monsterCount: 5 },
          { monsterPool: SR1_ELITE, monsterCount: 3 },
          { monsterPool: [SR1_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR1_ELITE, monsterCount: 4 },
          { monsterPool: [SR1_BOSS, SR1_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR1_ELITE, monsterCount: 4 },
          { monsterPool: [SR1_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
  'SR-2': {
    id: 'SR-2',
    name: '烈焰窟',
    reqRealmTier: 3, // 金丹
    reqLevel: 40,
    element: 'fire',
    description: '上古炼器遗址，火灵暴走。烈焰肆虐。',
    dropTier: 4,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 200,
        waves: [
          { monsterPool: SR2_MONSTERS, monsterCount: 3 },
          { monsterPool: SR2_ELITE, monsterCount: 2 },
          { monsterPool: [SR2_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 500,
        waves: [
          { monsterPool: SR2_MONSTERS, monsterCount: 4 },
          { monsterPool: SR2_ELITE, monsterCount: 3 },
          { monsterPool: [SR2_BOSS, ...SR2_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR2_ELITE, monsterCount: 3 },
          { monsterPool: [SR2_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 1000,
        waves: [
          { monsterPool: SR2_MONSTERS, monsterCount: 5 },
          { monsterPool: SR2_ELITE, monsterCount: 3 },
          { monsterPool: [SR2_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR2_ELITE, monsterCount: 4 },
          { monsterPool: [SR2_BOSS, SR2_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR2_ELITE, monsterCount: 4 },
          { monsterPool: [SR2_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
  'SR-3': {
    id: 'SR-3',
    name: '幽冥渊',
    reqRealmTier: 4, // 元婴
    reqLevel: 65,
    element: 'water',
    description: '深海秘境，魂魄侵蚀。阴寒彻骨。',
    dropTier: 5,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 350,
        waves: [
          { monsterPool: SR3_MONSTERS, monsterCount: 3 },
          { monsterPool: SR3_ELITE, monsterCount: 2 },
          { monsterPool: [SR3_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 875,
        waves: [
          { monsterPool: SR3_MONSTERS, monsterCount: 4 },
          { monsterPool: SR3_ELITE, monsterCount: 3 },
          { monsterPool: [SR3_BOSS, ...SR3_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR3_ELITE, monsterCount: 3 },
          { monsterPool: [SR3_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 1750,
        waves: [
          { monsterPool: SR3_MONSTERS, monsterCount: 5 },
          { monsterPool: SR3_ELITE, monsterCount: 3 },
          { monsterPool: [SR3_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR3_ELITE, monsterCount: 4 },
          { monsterPool: [SR3_BOSS, SR3_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR3_ELITE, monsterCount: 4 },
          { monsterPool: [SR3_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
  'SR-4': {
    id: 'SR-4',
    name: '天雷域',
    reqRealmTier: 5, // 化神
    reqLevel: 100,
    element: 'metal',
    description: '天雷禁地，劫雷不断。金属性之力在此聚合。',
    dropTier: 7,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 600,
        waves: [
          { monsterPool: SR4_MONSTERS, monsterCount: 3 },
          { monsterPool: SR4_ELITE, monsterCount: 2 },
          { monsterPool: [SR4_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 1500,
        waves: [
          { monsterPool: SR4_MONSTERS, monsterCount: 4 },
          { monsterPool: SR4_ELITE, monsterCount: 3 },
          { monsterPool: [SR4_BOSS, ...SR4_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR4_ELITE, monsterCount: 3 },
          { monsterPool: [SR4_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 3000,
        waves: [
          { monsterPool: SR4_MONSTERS, monsterCount: 5 },
          { monsterPool: SR4_ELITE, monsterCount: 3 },
          { monsterPool: [SR4_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR4_ELITE, monsterCount: 4 },
          { monsterPool: [SR4_BOSS, SR4_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR4_ELITE, monsterCount: 4 },
          { monsterPool: [SR4_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
  'SR-5': {
    id: 'SR-5',
    name: '混沌界',
    reqRealmTier: 6, // 渡劫
    reqLevel: 150,
    element: null,
    description: '混沌之力，万法皆空。虚空裂隙中窥见天道。',
    dropTier: 9,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 1000,
        waves: [
          { monsterPool: SR5_MONSTERS, monsterCount: 3 },
          { monsterPool: SR5_ELITE, monsterCount: 2 },
          { monsterPool: [SR5_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 2500,
        waves: [
          { monsterPool: SR5_MONSTERS, monsterCount: 4 },
          { monsterPool: SR5_ELITE, monsterCount: 3 },
          { monsterPool: [SR5_BOSS, ...SR5_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR5_ELITE, monsterCount: 3 },
          { monsterPool: [SR5_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 5000,
        waves: [
          { monsterPool: SR5_MONSTERS, monsterCount: 5 },
          { monsterPool: SR5_ELITE, monsterCount: 3 },
          { monsterPool: [SR5_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR5_ELITE, monsterCount: 4 },
          { monsterPool: [SR5_BOSS, SR5_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR5_ELITE, monsterCount: 4 },
          { monsterPool: [SR5_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
  'SR-6': {
    id: 'SR-6',
    name: '太虚秘境',
    reqRealmTier: 7, // 大乘
    reqLevel: 185,
    element: null, // 全五行轮转
    description: '飞升试炼，五行轮转。太虚之境，唯道者通。',
    dropTier: 10,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 1800,
        waves: [
          { monsterPool: SR6_MONSTERS, monsterCount: 3 },
          { monsterPool: SR6_ELITE, monsterCount: 2 },
          { monsterPool: [SR6_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 4500,
        waves: [
          { monsterPool: SR6_MONSTERS, monsterCount: 4 },
          { monsterPool: SR6_ELITE, monsterCount: 3 },
          { monsterPool: [SR6_BOSS, ...SR6_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR6_ELITE, monsterCount: 3 },
          { monsterPool: [SR6_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 9000,
        waves: [
          { monsterPool: SR6_MONSTERS, monsterCount: 5 },
          { monsterPool: SR6_ELITE, monsterCount: 3 },
          { monsterPool: [SR6_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR6_ELITE, monsterCount: 4 },
          { monsterPool: [SR6_BOSS, SR6_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR6_ELITE, monsterCount: 4 },
          { monsterPool: [SR6_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
}

// ==================== 工具函数 ====================

export function getSecretRealm(id: string): SecretRealmDef | null {
  return SECRET_REALMS[id] || null
}

/** 每日次数：按境界大阶给 */
export function getDailyCountByRealm(realmTier: number): number {
  if (realmTier <= 3) return 2  // 筑基~金丹
  if (realmTier <= 5) return 3  // 元婴~化神
  if (realmTier <= 7) return 4  // 渡劫~大乘
  return 5                       // 飞升
}

/** 放大怪物 template 的战力（用于难度倍率） */
export function scaleMonsterTemplate(m: MonsterTemplate, mul: number): MonsterTemplate {
  return {
    ...m,
    power: Math.floor(m.power * mul),
    exp: Math.floor(m.exp * mul),
    stone_min: Math.floor(m.stone_min * mul),
    stone_max: Math.floor(m.stone_max * mul),
  }
}
