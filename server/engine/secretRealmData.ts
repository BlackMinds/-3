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

// ==================== SR-7 鸿蒙之海（飞升·合道，T11） ====================
// 对应单人主图 T11，组队战力略高（×1.1-1.2）
const SR7_MONSTERS = [
  monster('鸿蒙水妖', 1500000, 'water', 'balanced', 1),
  monster('本源蛟龙', 1900000, 'water', 'dps', 1),
  monster('虚空圣使', 2200000, 'metal', 'tank', 1),
]
const SR7_ELITE = [
  monster('鸿蒙战将', 3200000, 'water', 'dps', 1),
  monster('本源护法', 3600000, 'water', 'balanced', 1),
]
const SR7_BOSS = boss('鸿蒙水帝', 6500000, 'water', 1)

// ==================== SR-8 永恒虚空（飞升·证道，T12） ====================
const SR8_MONSTERS = [
  monster('虚空泰坦', 6000000, null, 'tank', 1),
  monster('永恒刺客', 7500000, null, 'speed', 1),
  monster('本源毁灭者', 8800000, 'fire', 'dps', 1),
]
const SR8_ELITE = [
  monster('终焉法师', 13000000, null, 'dps', 1),
  monster('永恒守卫', 14000000, null, 'balanced', 1),
]
const SR8_BOSS = boss('虚空之主', 28000000, null, 1)

// ==================== SR-9 万源虚境（飞升·太极，T13） ====================
const SR9_MONSTERS = [
  monster('万源守阙', 17000000, 'earth', 'balanced', 1),
  monster('本源剑灵', 21000000, 'metal', 'speed', 1),
  monster('虚境游魂', 25000000, null, 'dps', 1),
]
const SR9_ELITE = [
  monster('万源裁定', 36000000, null, 'dps', 1),
  monster('虚境守阙', 40000000, null, 'tank', 1),
]
const SR9_BOSS = boss('万源道祖', 80000000, null, 1)

// ==================== SR-10 时空裂界（飞升·无极，T14） ====================
const SR10_MONSTERS = [
  monster('时序哨卫', 55000000, 'metal', 'balanced', 1),
  monster('空裂幽影', 65000000, null, 'dps', 1),
  monster('裂界吞噬者', 75000000, 'fire', 'dps', 1),
]
const SR10_ELITE = [
  monster('时空裁定', 110000000, null, 'dps', 1),
  monster('裂界君主', 120000000, null, 'balanced', 1),
]
const SR10_BOSS = boss('时空之主', 250000000, null, 1)

// ==================== SR-11 万道终焉（飞升·大圆满，T15） ====================
const SR11_MONSTERS = [
  monster('终焉守阙', 170000000, 'earth', 'tank', 1),
  monster('终焉剑魄', 200000000, 'metal', 'speed', 1),
  monster('末劫呼唤者', 230000000, 'fire', 'dps', 1),
]
const SR11_ELITE = [
  monster('万道执剑', 340000000, 'metal', 'dps', 1),
  monster('终焉裁定者', 380000000, null, 'balanced', 1),
]
const SR11_BOSS = boss('终焉道祖', 800000000, null, 1)

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
        basePoints: 300,
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
        basePoints: 540,
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
        basePoints: 900,
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
        basePoints: 400,
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
        basePoints: 720,
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
        basePoints: 1200,
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
        basePoints: 600,
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
        basePoints: 1080,
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
        basePoints: 1800,
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
        basePoints: 900,
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
        basePoints: 1620,
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
        basePoints: 2700,
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
        basePoints: 1200,
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
        basePoints: 2160,
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
        basePoints: 3600,
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
        basePoints: 3240,
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
        basePoints: 5400,
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
  'SR-7': {
    id: 'SR-7',
    name: '鸿蒙之海',
    reqRealmTier: 8, // 飞升
    reqLevel: 215,
    element: 'water',
    description: '鸿蒙未分之海，孕育万道之始。水域深处藏着远古道则。',
    dropTier: 11,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 2200,
        waves: [
          { monsterPool: SR7_MONSTERS, monsterCount: 3 },
          { monsterPool: SR7_ELITE, monsterCount: 2 },
          { monsterPool: [SR7_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 3960,
        waves: [
          { monsterPool: SR7_MONSTERS, monsterCount: 4 },
          { monsterPool: SR7_ELITE, monsterCount: 3 },
          { monsterPool: [SR7_BOSS, ...SR7_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR7_ELITE, monsterCount: 3 },
          { monsterPool: [SR7_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 6600,
        waves: [
          { monsterPool: SR7_MONSTERS, monsterCount: 5 },
          { monsterPool: SR7_ELITE, monsterCount: 3 },
          { monsterPool: [SR7_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR7_ELITE, monsterCount: 4 },
          { monsterPool: [SR7_BOSS, SR7_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR7_ELITE, monsterCount: 4 },
          { monsterPool: [SR7_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
  'SR-8': {
    id: 'SR-8',
    name: '永恒虚空',
    reqRealmTier: 9, // 混元
    reqLevel: 240,
    element: null,
    description: '诸界之外的永恒虚空，立足者必为踏破极限之人。',
    dropTier: 12,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 2600,
        waves: [
          { monsterPool: SR8_MONSTERS, monsterCount: 3 },
          { monsterPool: SR8_ELITE, monsterCount: 2 },
          { monsterPool: [SR8_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 4680,
        waves: [
          { monsterPool: SR8_MONSTERS, monsterCount: 4 },
          { monsterPool: SR8_ELITE, monsterCount: 3 },
          { monsterPool: [SR8_BOSS, ...SR8_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR8_ELITE, monsterCount: 3 },
          { monsterPool: [SR8_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 7800,
        waves: [
          { monsterPool: SR8_MONSTERS, monsterCount: 5 },
          { monsterPool: SR8_ELITE, monsterCount: 3 },
          { monsterPool: [SR8_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR8_ELITE, monsterCount: 4 },
          { monsterPool: [SR8_BOSS, SR8_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR8_ELITE, monsterCount: 4 },
          { monsterPool: [SR8_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
  'SR-9': {
    id: 'SR-9',
    name: '万源虚境',
    reqRealmTier: 9, // 混元
    reqLevel: 260,
    element: null,
    description: '万道之源凝于此境，虚实相融，法则在此处皆为残卷。',
    dropTier: 13,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 3000,
        waves: [
          { monsterPool: SR9_MONSTERS, monsterCount: 3 },
          { monsterPool: SR9_ELITE, monsterCount: 2 },
          { monsterPool: [SR9_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 5400,
        waves: [
          { monsterPool: SR9_MONSTERS, monsterCount: 4 },
          { monsterPool: SR9_ELITE, monsterCount: 3 },
          { monsterPool: [SR9_BOSS, ...SR9_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR9_ELITE, monsterCount: 3 },
          { monsterPool: [SR9_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 9000,
        waves: [
          { monsterPool: SR9_MONSTERS, monsterCount: 5 },
          { monsterPool: SR9_ELITE, monsterCount: 3 },
          { monsterPool: [SR9_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR9_ELITE, monsterCount: 4 },
          { monsterPool: [SR9_BOSS, SR9_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR9_ELITE, monsterCount: 4 },
          { monsterPool: [SR9_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
  'SR-10': {
    id: 'SR-10',
    name: '时空裂界',
    reqRealmTier: 9, // 混元
    reqLevel: 285,
    element: null,
    description: '时之河断，空之裂裸，唯执一念可定乾坤。',
    dropTier: 14,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 3400,
        waves: [
          { monsterPool: SR10_MONSTERS, monsterCount: 3 },
          { monsterPool: SR10_ELITE, monsterCount: 2 },
          { monsterPool: [SR10_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 6120,
        waves: [
          { monsterPool: SR10_MONSTERS, monsterCount: 4 },
          { monsterPool: SR10_ELITE, monsterCount: 3 },
          { monsterPool: [SR10_BOSS, ...SR10_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR10_ELITE, monsterCount: 3 },
          { monsterPool: [SR10_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 10200,
        waves: [
          { monsterPool: SR10_MONSTERS, monsterCount: 5 },
          { monsterPool: SR10_ELITE, monsterCount: 3 },
          { monsterPool: [SR10_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR10_ELITE, monsterCount: 4 },
          { monsterPool: [SR10_BOSS, SR10_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR10_ELITE, monsterCount: 4 },
          { monsterPool: [SR10_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
    },
  },
  'SR-11': {
    id: 'SR-11',
    name: '万道终焉',
    reqRealmTier: 9, // 混元
    reqLevel: 310,
    element: null,
    description: '诸道尽头，纵证圣亦止于此，唯越终焉者得见无极。',
    dropTier: 15,
    difficulties: {
      1: {
        name: '普通',
        powerMul: 1.0,
        rewardMul: 1.0,
        turnsPerWave: 15,
        basePoints: 4000,
        waves: [
          { monsterPool: SR11_MONSTERS, monsterCount: 3 },
          { monsterPool: SR11_ELITE, monsterCount: 2 },
          { monsterPool: [SR11_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      2: {
        name: '困难',
        powerMul: 1.8,
        rewardMul: 2.0,
        turnsPerWave: 15,
        basePoints: 7200,
        waves: [
          { monsterPool: SR11_MONSTERS, monsterCount: 4 },
          { monsterPool: SR11_ELITE, monsterCount: 3 },
          { monsterPool: [SR11_BOSS, ...SR11_ELITE], monsterCount: 3, isBoss: true },
          { monsterPool: SR11_ELITE, monsterCount: 3 },
          { monsterPool: [SR11_BOSS], monsterCount: 1, isBoss: true },
        ],
      },
      3: {
        name: '噩梦',
        powerMul: 3.0,
        rewardMul: 3.5,
        turnsPerWave: 18,
        basePoints: 12000,
        waves: [
          { monsterPool: SR11_MONSTERS, monsterCount: 5 },
          { monsterPool: SR11_ELITE, monsterCount: 3 },
          { monsterPool: [SR11_BOSS], monsterCount: 1, isBoss: true },
          { monsterPool: SR11_ELITE, monsterCount: 4 },
          { monsterPool: [SR11_BOSS, SR11_BOSS], monsterCount: 2, isBoss: true },
          { monsterPool: SR11_ELITE, monsterCount: 4 },
          { monsterPool: [SR11_BOSS], monsterCount: 1, isBoss: true },
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
