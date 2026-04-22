import { getPool } from '~/server/database/db'
import { generateMonsterStats, buildEquippedSkillInfo, runWaveBattle, buildMonsterSkillDescriptions, type BattlerStats, type MonsterTemplate } from '~/server/engine/battleEngine'
import { getSectLevelConfig, getSectSkill, calcSectSkillEffect } from '~/server/engine/sectData'
import { getRealmBonusAtLevel } from '~/server/engine/realmData'
import { generateEquipName } from '~/server/engine/equipNameData'
import { updateSectDailyTask, updateSectWeeklyTaskByCharId } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'
import { applyCultivationExp, applyLevelExp } from '~/server/utils/realm'
import { SKILL_MAP } from '~/server/engine/skillData'
import { rollSubStats } from '~/server/utils/equipment'
import { EQUIP_PRIMARY_BASE, WEAPON_BONUS, PLAYER_CAPS } from '~/shared/balance'

// 战斗锁: 防止同一角色并发刷战斗
// - inProgressSince: 战斗进行中的开始时间戳，用于拦截"上场未结束又发起"的并发请求
// - cooldownUntil: 战斗结束后的冷却截止时间戳，用于频率限制
// 正常战斗应在 MAX_BATTLE_DURATION_MS 内返回；超过则视为僵尸锁，被新请求覆盖
const battleLock = new Map<number, { inProgressSince?: number; cooldownUntil?: number }>()
const BATTLE_COOLDOWN_MS = 1500
const MAX_BATTLE_DURATION_MS = 10000

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

// ===== 地图数据 =====
interface MapMonster {
  name: string; power: number; element: string | null;
  exp: number; stone_min: number; stone_max: number;
  role: string; drop_table: string;
}

const ALL_MAPS: Record<string, { tier: number; monsters: MapMonster[]; boss: MapMonster | null }> = {
  qingfeng_valley: {
    tier: 1,
    monsters: [
      { name: '野猪妖', power: 50, element: null, exp: 10, stone_min: 5, stone_max: 15, role: 'balanced', drop_table: 'common_t1' },
      { name: '灰狼', power: 80, element: null, exp: 15, stone_min: 5, stone_max: 15, role: 'balanced', drop_table: 'common_t1' },
      { name: '蛇妖', power: 120, element: 'wood', exp: 25, stone_min: 5, stone_max: 15, role: 'balanced', drop_table: 'common_t1' },
    ],
    boss: { name: '狼王', power: 300, element: null, exp: 200, stone_min: 100, stone_max: 200, role: 'boss', drop_table: 'boss_t1' },
  },
  misty_swamp: {
    tier: 1,
    monsters: [
      { name: '蟾蜍精', power: 200, element: 'water', exp: 20, stone_min: 5, stone_max: 15, role: 'balanced', drop_table: 'common_t1' },
      { name: '沼蛇', power: 280, element: 'water', exp: 30, stone_min: 5, stone_max: 15, role: 'balanced', drop_table: 'common_t1' },
      { name: '泥傀儡', power: 350, element: 'earth', exp: 40, stone_min: 10, stone_max: 30, role: 'tank', drop_table: 'uncommon_t1' },
    ],
    boss: { name: '沼泽蛟', power: 600, element: 'water', exp: 400, stone_min: 100, stone_max: 200, role: 'boss', drop_table: 'boss_t1' },
  },
  sunset_mountain: {
    tier: 2,
    monsters: [
      { name: '火狐妖', power: 640, element: 'fire', exp: 80, stone_min: 20, stone_max: 60, role: 'balanced', drop_table: 'common_t2' },
      { name: '熔岩蜥', power: 800, element: 'fire', exp: 100, stone_min: 20, stone_max: 60, role: 'balanced', drop_table: 'common_t2' },
      { name: '火鸦', power: 1200, element: 'fire', exp: 150, stone_min: 40, stone_max: 100, role: 'dps', drop_table: 'uncommon_t2' },
    ],
    boss: { name: '赤炎蟒', power: 2400, element: 'fire', exp: 1500, stone_min: 500, stone_max: 1000, role: 'boss', drop_table: 'boss_t2' },
  },
  jade_bamboo_forest: {
    tier: 2,
    monsters: [
      { name: '竹灵', power: 720, element: 'wood', exp: 90, stone_min: 20, stone_max: 60, role: 'balanced', drop_table: 'common_t2' },
      { name: '藤妖', power: 960, element: 'wood', exp: 120, stone_min: 20, stone_max: 60, role: 'balanced', drop_table: 'common_t2' },
      { name: '玉面猴', power: 1280, element: 'wood', exp: 160, stone_min: 40, stone_max: 100, role: 'dps', drop_table: 'uncommon_t2' },
    ],
    boss: { name: '千年竹妖', power: 2800, element: 'wood', exp: 1800, stone_min: 500, stone_max: 1000, role: 'boss', drop_table: 'boss_t2' },
  },
  iron_ore_cave: {
    tier: 2,
    monsters: [
      { name: '铁傀儡', power: 960, element: 'metal', exp: 110, stone_min: 20, stone_max: 60, role: 'balanced', drop_table: 'common_t2' },
      { name: '矿蝠', power: 1120, element: 'metal', exp: 130, stone_min: 20, stone_max: 60, role: 'balanced', drop_table: 'common_t2' },
      { name: '晶蚕', power: 1600, element: 'earth', exp: 180, stone_min: 40, stone_max: 100, role: 'dps', drop_table: 'uncommon_t2' },
    ],
    boss: { name: '矿灵王', power: 3200, element: 'metal', exp: 2000, stone_min: 500, stone_max: 1000, role: 'boss', drop_table: 'boss_t2' },
  },
  myriad_demon_mountain: { tier: 3, monsters: [
    { name: '树妖', power: 1200, element: 'wood', exp: 400, stone_min: 80, stone_max: 200, role: 'balanced', drop_table: 'common_t3' },
    { name: '熊妖', power: 1650, element: 'earth', exp: 550, stone_min: 80, stone_max: 200, role: 'balanced', drop_table: 'common_t3' },
    { name: '花妖', power: 2100, element: 'wood', exp: 700, stone_min: 150, stone_max: 400, role: 'dps', drop_table: 'uncommon_t3' },
  ], boss: { name: '妖猿王', power: 4500, element: 'earth', exp: 8000, stone_min: 2000, stone_max: 5000, role: 'boss', drop_table: 'boss_t3' } },
  thunderpeak: { tier: 3, monsters: [
    { name: '雷鹰', power: 1500, element: 'metal', exp: 500, stone_min: 80, stone_max: 200, role: 'balanced', drop_table: 'common_t3' },
    { name: '风暴狼', power: 1950, element: 'metal', exp: 650, stone_min: 80, stone_max: 200, role: 'balanced', drop_table: 'common_t3' },
    { name: '雷蛇', power: 2400, element: 'metal', exp: 800, stone_min: 150, stone_max: 400, role: 'dps', drop_table: 'uncommon_t3' },
  ], boss: { name: '雷鹏', power: 5400, element: 'metal', exp: 9000, stone_min: 2000, stone_max: 5000, role: 'boss', drop_table: 'boss_t3' } },
  ancient_ruins: { tier: 3, monsters: [
    { name: '石卫士', power: 1800, element: 'earth', exp: 600, stone_min: 80, stone_max: 200, role: 'balanced', drop_table: 'common_t3' },
    { name: '符傀儡', power: 2400, element: 'earth', exp: 800, stone_min: 150, stone_max: 400, role: 'dps', drop_table: 'uncommon_t3' },
    { name: '远古怨灵', power: 3000, element: null, exp: 1000, stone_min: 150, stone_max: 400, role: 'dps', drop_table: 'uncommon_t3' },
  ], boss: { name: '遗迹守护者', power: 6600, element: 'earth', exp: 12000, stone_min: 2000, stone_max: 5000, role: 'boss', drop_table: 'boss_t3' } },
  dark_sea: { tier: 4, monsters: [
    { name: '海蛟', power: 4500, element: 'water', exp: 2000, stone_min: 300, stone_max: 800, role: 'balanced', drop_table: 'common_t4' },
    { name: '幽灵鱼', power: 5500, element: 'water', exp: 2500, stone_min: 300, stone_max: 800, role: 'balanced', drop_table: 'common_t4' },
    { name: '墨海兽', power: 7500, element: 'water', exp: 3500, stone_min: 600, stone_max: 1500, role: 'dps', drop_table: 'uncommon_t4' },
  ], boss: { name: '龙龟', power: 15000, element: 'water', exp: 30000, stone_min: 8000, stone_max: 20000, role: 'boss', drop_table: 'boss_t4' } },
  soul_forest: { tier: 4, monsters: [
    { name: '噬魂树', power: 5000, element: 'wood', exp: 2200, stone_min: 300, stone_max: 800, role: 'balanced', drop_table: 'common_t4' },
    { name: '幽影猫', power: 6250, element: null, exp: 2800, stone_min: 300, stone_max: 800, role: 'balanced', drop_table: 'common_t4' },
    { name: '尸花', power: 8000, element: 'wood', exp: 3800, stone_min: 600, stone_max: 1500, role: 'dps', drop_table: 'uncommon_t4' },
  ], boss: { name: '噬魂古树', power: 16250, element: 'wood', exp: 35000, stone_min: 8000, stone_max: 20000, role: 'boss', drop_table: 'boss_t4' } },
  desert_of_sands: { tier: 4, monsters: [
    { name: '沙蝎王', power: 6000, element: 'earth', exp: 2600, stone_min: 300, stone_max: 800, role: 'balanced', drop_table: 'common_t4' },
    { name: '沙虫', power: 7500, element: 'earth', exp: 3200, stone_min: 300, stone_max: 800, role: 'balanced', drop_table: 'common_t4' },
    { name: '蜃狐', power: 9500, element: 'fire', exp: 4200, stone_min: 600, stone_max: 1500, role: 'dps', drop_table: 'uncommon_t4' },
  ], boss: { name: '流沙帝蝎', power: 20000, element: 'earth', exp: 40000, stone_min: 8000, stone_max: 20000, role: 'boss', drop_table: 'boss_t4' } },
  purgatory: { tier: 5, monsters: [
    { name: '狱卒', power: 9000, element: 'fire', exp: 10000, stone_min: 1000, stone_max: 3000, role: 'balanced', drop_table: 'common_t5' },
    { name: '魔兵', power: 11000, element: 'metal', exp: 12000, stone_min: 2000, stone_max: 6000, role: 'dps', drop_table: 'uncommon_t5' },
    { name: '骨龙', power: 15000, element: 'fire', exp: 18000, stone_min: 5000, stone_max: 12000, role: 'dps', drop_table: 'rare_t5' },
  ], boss: { name: '炼狱魔君', power: 35000, element: 'fire', exp: 100000, stone_min: 30000, stone_max: 80000, role: 'boss', drop_table: 'boss_t5' } },
  frozen_abyss: { tier: 5, monsters: [
    { name: '霜巨人', power: 9500, element: 'water', exp: 11000, stone_min: 1000, stone_max: 3000, role: 'balanced', drop_table: 'common_t5' },
    { name: '冰魄', power: 12000, element: 'water', exp: 14000, stone_min: 2000, stone_max: 6000, role: 'dps', drop_table: 'uncommon_t5' },
    { name: '冰蛟龙', power: 16000, element: 'water', exp: 19000, stone_min: 5000, stone_max: 12000, role: 'dps', drop_table: 'rare_t5' },
  ], boss: { name: '寒渊冰帝', power: 38000, element: 'water', exp: 110000, stone_min: 30000, stone_max: 80000, role: 'boss', drop_table: 'boss_t5' } },
  demon_battlefield: { tier: 5, monsters: [
    { name: '魔将', power: 13000, element: 'fire', exp: 15000, stone_min: 2000, stone_max: 6000, role: 'dps', drop_table: 'uncommon_t5' },
    { name: '暗骑士', power: 16000, element: 'metal', exp: 18000, stone_min: 2000, stone_max: 6000, role: 'dps', drop_table: 'uncommon_t5' },
    { name: '战魔', power: 20000, element: null, exp: 22000, stone_min: 5000, stone_max: 12000, role: 'dps', drop_table: 'rare_t5' },
  ], boss: { name: '魔帅', power: 45000, element: null, exp: 150000, stone_min: 30000, stone_max: 80000, role: 'boss', drop_table: 'boss_t5' } },
  tribulation_wasteland: { tier: 6, monsters: [
    { name: '雷兽', power: 27000, element: 'metal', exp: 50000, stone_min: 5000, stone_max: 15000, role: 'balanced', drop_table: 'common_t6' },
    { name: '虚空生物', power: 33000, element: null, exp: 65000, stone_min: 8000, stone_max: 25000, role: 'speed', drop_table: 'uncommon_t6' },
    { name: '堕仙', power: 42000, element: 'metal', exp: 85000, stone_min: 15000, stone_max: 40000, role: 'dps', drop_table: 'rare_t6' },
  ], boss: { name: '雷帝', power: 90000, element: 'metal', exp: 500000, stone_min: 100000, stone_max: 300000, role: 'boss', drop_table: 'boss_t6' } },
  void_rift: { tier: 6, monsters: [
    { name: '虚空猎手', power: 28800, element: null, exp: 55000, stone_min: 5000, stone_max: 15000, role: 'balanced', drop_table: 'common_t6' },
    { name: '时光幻影', power: 34800, element: null, exp: 70000, stone_min: 8000, stone_max: 25000, role: 'speed', drop_table: 'uncommon_t6' },
    { name: '混沌元素', power: 45000, element: null, exp: 90000, stone_min: 15000, stone_max: 40000, role: 'dps', drop_table: 'rare_t6' },
  ], boss: { name: '虚空之主', power: 96000, element: null, exp: 550000, stone_min: 100000, stone_max: 300000, role: 'boss', drop_table: 'boss_t6' } },
  celestial_mountain: { tier: 7, monsters: [
    { name: '仙鹤', power: 36000, element: 'metal', exp: 200000, stone_min: 30000, stone_max: 80000, role: 'balanced', drop_table: 'common_t7' },
    { name: '玉麒麟', power: 44000, element: 'earth', exp: 250000, stone_min: 50000, stone_max: 150000, role: 'dps', drop_table: 'uncommon_t7' },
    { name: '金龙', power: 56000, element: 'metal', exp: 320000, stone_min: 80000, stone_max: 250000, role: 'dps', drop_table: 'rare_t7' },
  ], boss: { name: '昆仑仙尊', power: 120000, element: 'metal', exp: 2000000, stone_min: 500000, stone_max: 1500000, role: 'boss', drop_table: 'boss_t7' } },
  nether_realm: { tier: 7, monsters: [
    { name: '冥卫', power: 50000, element: 'water', exp: 280000, stone_min: 30000, stone_max: 80000, role: 'balanced', drop_table: 'common_t7' },
    { name: '夺魂使', power: 60000, element: null, exp: 350000, stone_min: 50000, stone_max: 150000, role: 'dps', drop_table: 'uncommon_t7' },
    { name: '冥龙', power: 80000, element: 'water', exp: 450000, stone_min: 80000, stone_max: 250000, role: 'dps', drop_table: 'rare_t7' },
  ], boss: { name: '冥王', power: 180000, element: 'water', exp: 3000000, stone_min: 500000, stone_max: 1500000, role: 'boss', drop_table: 'boss_t7' } },
  immortal_realm: { tier: 8, monsters: [
    { name: '天兵', power: 80000, element: 'metal', exp: 800000, stone_min: 200000, stone_max: 500000, role: 'balanced', drop_table: 'common_t8' },
    { name: '神兽', power: 100000, element: null, exp: 1000000, stone_min: 400000, stone_max: 1000000, role: 'dps', drop_table: 'uncommon_t8' },
    { name: '远古神灵', power: 150000, element: null, exp: 1500000, stone_min: 800000, stone_max: 2000000, role: 'dps', drop_table: 'rare_t8' },
  ], boss: { name: '天帝', power: 300000, element: null, exp: 10000000, stone_min: 2000000, stone_max: 5000000, role: 'boss', drop_table: 'boss_t8' } },
  chaos_origin: { tier: 8, monsters: [
    { name: '混沌兽', power: 180000, element: null, exp: 2000000, stone_min: 200000, stone_max: 500000, role: 'balanced', drop_table: 'common_t8' },
    { name: '太古凶兽', power: 220000, element: null, exp: 2500000, stone_min: 800000, stone_max: 2000000, role: 'dps', drop_table: 'rare_t8' },
    { name: '道之幻影', power: 280000, element: null, exp: 3200000, stone_min: 800000, stone_max: 2000000, role: 'dps', drop_table: 'rare_t8' },
  ], boss: { name: '混沌之主', power: 500000, element: null, exp: 20000000, stone_min: 2000000, stone_max: 5000000, role: 'boss', drop_table: 'boss_t8' } },
  void_holy_land: { tier: 9, monsters: [
    { name: '虚空剑侍', power: 240000, element: 'metal', exp: 5000000, stone_min: 500000, stone_max: 1200000, role: 'balanced', drop_table: 'common_t9' },
    { name: '圣境守护', power: 300000, element: 'earth', exp: 6500000, stone_min: 500000, stone_max: 1200000, role: 'tank', drop_table: 'common_t9' },
    { name: '天凤', power: 360000, element: 'fire', exp: 8000000, stone_min: 1000000, stone_max: 2500000, role: 'dps', drop_table: 'uncommon_t9' },
  ], boss: { name: '太虚帝君', power: 600000, element: 'metal', exp: 40000000, stone_min: 5000000, stone_max: 12000000, role: 'boss', drop_table: 'boss_t9' } },
  hongmeng_realm: { tier: 9, monsters: [
    { name: '鸿蒙异兽', power: 280000, element: 'wood', exp: 6000000, stone_min: 500000, stone_max: 1200000, role: 'balanced', drop_table: 'common_t9' },
    { name: '本源精灵', power: 340000, element: 'water', exp: 7500000, stone_min: 500000, stone_max: 1200000, role: 'balanced', drop_table: 'common_t9' },
    { name: '始祖龙', power: 400000, element: null, exp: 9000000, stone_min: 1500000, stone_max: 3000000, role: 'dps', drop_table: 'uncommon_t9' },
  ], boss: { name: '鸿蒙道尊', power: 720000, element: null, exp: 50000000, stone_min: 6000000, stone_max: 15000000, role: 'boss', drop_table: 'boss_t9' } },
  myriad_battlefield: { tier: 9, monsters: [
    { name: '界域战士', power: 320000, element: 'fire', exp: 7000000, stone_min: 600000, stone_max: 1500000, role: 'balanced', drop_table: 'common_t9' },
    { name: '虚空刺客', power: 380000, element: null, exp: 8500000, stone_min: 600000, stone_max: 1500000, role: 'speed', drop_table: 'uncommon_t9' },
    { name: '远古泰坦', power: 480000, element: 'earth', exp: 10000000, stone_min: 2000000, stone_max: 4000000, role: 'tank', drop_table: 'uncommon_t9' },
  ], boss: { name: '万界战神', power: 800000, element: null, exp: 60000000, stone_min: 8000000, stone_max: 20000000, role: 'boss', drop_table: 'boss_t9' } },
  dao_trial: { tier: 10, monsters: [
    { name: '天道傀儡', power: 225000, element: null, exp: 15000000, stone_min: 2000000, stone_max: 5000000, role: 'balanced', drop_table: 'common_t10' },
    { name: '规则执行者', power: 300000, element: null, exp: 20000000, stone_min: 2000000, stone_max: 5000000, role: 'dps', drop_table: 'uncommon_t10' },
    { name: '命运织者', power: 375000, element: null, exp: 25000000, stone_min: 5000000, stone_max: 10000000, role: 'dps', drop_table: 'uncommon_t10' },
  ], boss: { name: '天道化身', power: 750000, element: null, exp: 100000000, stone_min: 20000000, stone_max: 50000000, role: 'boss', drop_table: 'boss_t10' } },
  eternal_peak: { tier: 10, monsters: [
    { name: '永恒守卫', power: 300000, element: 'metal', exp: 20000000, stone_min: 3000000, stone_max: 8000000, role: 'balanced', drop_table: 'common_t10' },
    { name: '时间领主', power: 450000, element: 'water', exp: 30000000, stone_min: 3000000, stone_max: 8000000, role: 'dps', drop_table: 'uncommon_t10' },
    { name: '创世之灵', power: 600000, element: null, exp: 40000000, stone_min: 8000000, stone_max: 20000000, role: 'dps', drop_table: 'uncommon_t10' },
  ], boss: { name: '永恒之主', power: 1200000, element: null, exp: 200000000, stone_min: 50000000, stone_max: 100000000, role: 'boss', drop_table: 'boss_t10' } },
}

// ===== 副属性自动生成（统一走 server/utils/equipment.ts 的共享池）=====
// 品质 → 保底最大副属性数量，加一点随机让数量有下限变化
const SUB_COUNT_RANGE: [number, number][] = [[0,0],[0,1],[1,2],[2,3],[3,4],[4,4]]
function generateSubStats(rarityIdx: number, tier: number): { stat: string; value: number }[] {
  const [minSubs, maxSubs] = SUB_COUNT_RANGE[rarityIdx] || [0, 0]
  const count = rand(minSubs, maxSubs)
  if (count === 0) return []
  return rollSubStats(rarityIdx, tier, count)
}

// ===== 装备掉落 =====
function generateEquipDrop(tier: number, isBoss: boolean, luckMul: number = 1, monsterElement: string | null = null): any | null {
  const rate = (isBoss ? 1.0 : 0.20) * luckMul
  if (Math.random() >= rate) return null
  const rarities = ['white', 'green', 'blue', 'purple', 'gold', 'red']
  // T1-T2 品质权重上调（前期装备更新频繁带来爽感）
  const weights: Record<number, number[]> = {
    1: [40,40,17,3,0,0], 2: [30,40,22,7,1,0], 3: [20,35,25,15,4.5,0.5],
    4: [5,25,30,25,13,2], 5: [0,10,30,35,22,3], 6: [0,0,20,40,35,5],
    7: [0,0,10,35,45,10], 8: [0,0,5,25,55,15], 9: [0,0,0,20,60,20], 10: [0,0,0,10,60,30],
  }
  const w = weights[tier] || weights[1]
  const total = w.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let idx = 0
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { idx = i; break } }
  const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
  const slotIdx = rand(0, slots.length - 1)
  const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_RATE', pendant: 'SPIRIT' }
  const statMuls = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5]
  const ps = primaryStats[slots[slotIdx]]
  const pv = Math.floor((EQUIP_PRIMARY_BASE[ps] || 30) * tier * statMuls[idx])
  const tierReqLevels: Record<number, number> = { 1:1, 2:15, 3:35, 4:55, 5:80, 6:110, 7:140, 8:170, 9:185, 10:195 }
  const weaponType = slots[slotIdx] === 'weapon' ? ['sword','blade','spear','fan'][rand(0,3)] : null
  const subStats = generateSubStats(idx, tier)
  return {
    name: generateEquipName(rarities[idx], slots[slotIdx], weaponType, tier, ps, monsterElement),
    rarity: rarities[idx],
    primary_stat: ps, primary_value: pv, sub_stats: JSON.stringify(subStats),
    set_id: null, tier, weapon_type: weaponType,
    base_slot: slots[slotIdx], req_level: tierReqLevels[tier] || 1, enhance_level: 0,
  }
}

// ===== 功法掉落（已有功法权重递减） =====
function generateSkillDrop(tier: number, isBoss: boolean, luckMul: number = 1, ownedCounts: Record<string, number> = {}): string | null {
  const rate = (isBoss ? 0.20 : 0.04) * luckMul
  if (Math.random() >= rate) return null
  const pools: Record<number, string[]> = {
    1: ['wind_blade','vine_whip','ice_palm','flame_sword','quake_fist','body_refine','flame_body','water_flow','root_grip','metal_skin'],
    3: ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall'],
    5: ['sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury','wood_heal','mirror_water','crit_master','earth_fortitude','poison_body','fire_mastery'],
    7: ['metal_burst','quake_stomp','life_drain','inferno_burst','storm_blade','heaven_heal','water_mastery','battle_frenzy','heavenly_body','time_stop','heavenly_wrath','dao_heart','five_elements_harmony'],
  }
  let pool = pools[1]
  if (tier >= 7) pool = pools[7]
  else if (tier >= 5) pool = pools[5]
  else if (tier >= 3) pool = pools[3]

  const weightsList = pool.map(skillId => {
    const owned = ownedCounts[skillId] || 0
    if (owned === 0) return 100
    return Math.max(1, Math.floor(100 / Math.pow(2, owned)))
  })
  const totalWeight = weightsList.reduce((a, b) => a + b, 0)
  let r = Math.random() * totalWeight
  for (let i = 0; i < pool.length; i++) {
    r -= weightsList[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

// ===== 灵草掉落 =====
function generateHerbDrop(tier: number, monsterElement: string | null, isBoss: boolean, luckMul: number = 1): any | null {
  const rate = (isBoss ? 0.80 : 0.30) * luckMul
  if (Math.random() >= rate) return null
  const elementToHerb: Record<string, string> = { metal: 'metal_herb', wood: 'wood_herb', water: 'water_herb', fire: 'fire_herb', earth: 'earth_herb' }
  let herbId = monsterElement ? (elementToHerb[monsterElement] || 'common_herb') : 'common_herb'
  if (isBoss && !monsterElement && Math.random() < 0.3) herbId = 'spirit_grass'
  const qualityOrder = ['white', 'green', 'blue', 'purple', 'gold']
  let qIdx = 0
  const r2 = Math.random()
  if (tier >= 7) qIdx = r2 < 0.4 ? 4 : 3
  else if (tier >= 5) qIdx = r2 < 0.5 ? 3 : 2
  else if (tier >= 3) qIdx = r2 < 0.4 ? 2 : 1
  else qIdx = r2 < 0.2 ? 1 : 0
  return { herb_id: herbId, quality: qualityOrder[qIdx], count: isBoss ? 3 : 1 }
}

// ===== 构建玩家战斗属性 =====
function buildPlayerStats(char: any, equipRows: any[], buffRows: any[], caveRows: any[]): { stats: BattlerStats; expBonusPercent: number; luckPercent: number } {
  let atk = Number(char.atk)
  let def = Number(char.def)
  let maxHp = Number(char.max_hp)
  let spd = Number(char.spd)
  let critRate = Number(char.crit_rate || 0.05)
  let critDmg = Number(char.crit_dmg || 1.5)
  let dodge = Number(char.dodge || 0)
  let lifesteal = Number(char.lifesteal || 0)

  // v1.2 附灵运行时状态
  const awaken: any = {
    burnOnHitChance: 0, poisonOnHitChance: 0, bleedOnHitChance: 0,
    chainAttackChance: 0, armorPenPct: 0, executeBonus: 0,
    lowHpAtkBonus: 0, lowHpDefBonus: 0,
    damageReduction: 0, critTakenReduction: 0,
    regenPerTurn: 0, cleanseInterval: 0,
    frenzyOpening: 0, vsBossBonus: 0, vsEliteBonus: 0,
    debuffDurationBonus: 0,
    poisonOnHitTaken: 0, burnOnHitTaken: 0, reflectOnCrit: 0,
  }
  let awakenExpBonus = 0
  let awakenSectContribBonus = 0
  let awakenLuckBonus = 0
  let awakenSpiritDensityBonus = 0

  // 等级加成
  const lv = char.level || 1
  for (let i = 1; i < lv; i++) {
    if (i <= 50)       { maxHp += 5;  atk += 2;  def += 1; spd += 1 }
    else if (i <= 100) { maxHp += 10; atk += 4;  def += 2; spd += 2 }
    else if (i <= 150) { maxHp += 20; atk += 8;  def += 4; spd += 3 }
    else               { maxHp += 40; atk += 15; def += 8; spd += 5 }
  }

  // 境界加成
  const realmTier = char.realm_tier || 1
  const realmStage = char.realm_stage || 1
  const realmBonus = getRealmBonusAtLevel(realmTier, realmStage)
  maxHp += realmBonus.hp
  atk += realmBonus.atk
  def += realmBonus.def
  spd += realmBonus.spd
  critRate += realmBonus.crit_rate
  critDmg += realmBonus.crit_dmg
  dodge += realmBonus.dodge

  // 武器类型加成已从 shared/balance.ts 导入

  // 装备加成
  let armorPen = 0, accuracy = 0, spirit = 0, spiritDensity = 0, luck = 0
  const elementDmg = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }
  let weaponAtkPct = 0, weaponSpdPct = 0, weaponSpiritPct = 0
  let weaponCritRateFlat = 0, weaponCritDmgFlat = 0, weaponLifestealFlat = 0
  // 装备副属性百分比（与武器类型百分比合并一次乘法）
  let equipAtkPct = 0, equipDefPct = 0, equipHpPct = 0, equipSpdPct = 0

  for (const eq of equipRows) {
    if (!eq.slot) continue
    const enhLv = eq.enhance_level || 0
    const primary = Math.floor(eq.primary_value * (1 + enhLv * 0.10))
    if (eq.primary_stat === 'ATK') atk += primary
    else if (eq.primary_stat === 'DEF') def += primary
    else if (eq.primary_stat === 'HP') maxHp += primary
    else if (eq.primary_stat === 'SPD') spd += primary
    else if (eq.primary_stat === 'CRIT_RATE') critRate += primary / 100
    else if (eq.primary_stat === 'SPIRIT') spirit += primary

    // 武器类型加成
    if (eq.weapon_type && WEAPON_BONUS[eq.weapon_type]) {
      const wb = WEAPON_BONUS[eq.weapon_type]
      if (wb.ATK_pct) weaponAtkPct += wb.ATK_pct
      if (wb.SPD_pct) weaponSpdPct += wb.SPD_pct
      if (wb.SPIRIT_pct) weaponSpiritPct += wb.SPIRIT_pct
      if (wb.CRIT_RATE_flat) weaponCritRateFlat += wb.CRIT_RATE_flat
      if (wb.CRIT_DMG_flat) weaponCritDmgFlat += wb.CRIT_DMG_flat
      if (wb.LIFESTEAL_flat) weaponLifestealFlat += wb.LIFESTEAL_flat
    }

    const subs = typeof eq.sub_stats === 'string' ? JSON.parse(eq.sub_stats) : (eq.sub_stats || [])
    for (const sub of subs) {
      if (sub.stat === 'ATK') atk += sub.value
      else if (sub.stat === 'DEF') def += sub.value
      else if (sub.stat === 'HP') maxHp += sub.value
      else if (sub.stat === 'SPD') spd += sub.value
      else if (sub.stat === 'CRIT_RATE') critRate += sub.value / 100
      else if (sub.stat === 'CRIT_DMG') critDmg += sub.value / 100
      else if (sub.stat === 'LIFESTEAL') lifesteal += sub.value / 100
      else if (sub.stat === 'DODGE') dodge += sub.value / 100
      else if (sub.stat === 'ARMOR_PEN') armorPen += sub.value
      else if (sub.stat === 'ACCURACY') accuracy += sub.value
      else if (sub.stat === 'METAL_DMG') elementDmg.metal += sub.value
      else if (sub.stat === 'WOOD_DMG') elementDmg.wood += sub.value
      else if (sub.stat === 'WATER_DMG') elementDmg.water += sub.value
      else if (sub.stat === 'FIRE_DMG') elementDmg.fire += sub.value
      else if (sub.stat === 'EARTH_DMG') elementDmg.earth += sub.value
      else if (sub.stat === 'SPIRIT') spirit += sub.value
      else if (sub.stat === 'SPIRIT_DENSITY') spiritDensity += sub.value
      else if (sub.stat === 'LUCK') luck += sub.value
      else if (sub.stat === 'ATK_PCT') equipAtkPct += sub.value
      else if (sub.stat === 'DEF_PCT') equipDefPct += sub.value
      else if (sub.stat === 'HP_PCT') equipHpPct += sub.value
      else if (sub.stat === 'SPD_PCT') equipSpdPct += sub.value
    }

    // v1.2 附灵聚合（仅 weapon/armor/pendant 槽位有效）
    const aw = typeof eq.awaken_effect === 'string' ? JSON.parse(eq.awaken_effect) : eq.awaken_effect
    if (aw && aw.stat) {
      const v = Number(aw.value) || 0
      switch (aw.stat) {
        // 属性加成类（直接叠加到 BattlerStats）
        case 'lifesteal':          lifesteal += v; break
        case 'critRate':           critRate += v; break
        case 'critDmg':            critDmg += v; break
        case 'dodge':              dodge += v; break
        case 'spirit':             spirit += v; break
        case 'atkPct':             atk = Math.floor(atk * (1 + v)); break
        case 'defPct':             def = Math.floor(def * (1 + v)); break
        case 'hpPct':              maxHp = Math.floor(maxHp * (1 + v)); break
        case 'spdPct':             spd = Math.floor(spd * (1 + v)); break
        case 'harmonyPct':
          atk = Math.floor(atk * (1 + v))
          def = Math.floor(def * (1 + v))
          maxHp = Math.floor(maxHp * (1 + v))
          break
        // 五行·X 元素伤害加成（value 是 0-1 的小数，转到 elementDmg 的百分比值）
        case 'FIRE_DMG_PCT':       elementDmg.fire += v * 100; break
        case 'METAL_DMG_PCT':      elementDmg.metal += v * 100; break
        case 'WATER_DMG_PCT':      elementDmg.water += v * 100; break
        case 'WOOD_DMG_PCT':       elementDmg.wood += v * 100; break
        case 'EARTH_DMG_PCT':      elementDmg.earth += v * 100; break
        // 破甲（叠加到 armor_pen flat）
        case 'armorPenPct':        awaken.armorPenPct = (awaken.armorPenPct || 0) + v; break
        // 命中（flat）
        case 'accuracyBonus':      accuracy += v; break
        // 控制抗性
        case 'ctrlResist':
          if (!(char as any).__resistCtrlAwaken) (char as any).__resistCtrlAwaken = 0
          ;(char as any).__resistCtrlAwaken += v
          break
        // 五系抗性
        case 'allResistBonus':
          if (!(char as any).__resistAllAwaken) (char as any).__resistAllAwaken = 0
          ;(char as any).__resistAllAwaken += v
          break
        // 战斗外奖励类
        case 'luckBonus':          awakenLuckBonus += v; break
        case 'spiritDensityBonus': awakenSpiritDensityBonus += v; break
        case 'expBonus':           awakenExpBonus += v; break
        case 'sectContribBonus':   awakenSectContribBonus += v; break
        // 复用现有钩子（Max-Merge）
        case 'poisonOnHitTaken':   awaken.poisonOnHitTaken = Math.max(awaken.poisonOnHitTaken, v); break
        case 'burnOnHitTaken':     awaken.burnOnHitTaken = Math.max(awaken.burnOnHitTaken, v); break
        case 'reflectOnCrit':      awaken.reflectOnCrit = Math.max(awaken.reflectOnCrit, v); break
        // 运行时触发类（传递到 runWaveBattle）
        case 'burnOnHitChance':    awaken.burnOnHitChance = (awaken.burnOnHitChance || 0) + v; break
        case 'poisonOnHitChance':  awaken.poisonOnHitChance = (awaken.poisonOnHitChance || 0) + v; break
        case 'bleedOnHitChance':   awaken.bleedOnHitChance = (awaken.bleedOnHitChance || 0) + v; break
        case 'chainAttackChance':  awaken.chainAttackChance = (awaken.chainAttackChance || 0) + v; break
        case 'executeBonus':       awaken.executeBonus = (awaken.executeBonus || 0) + v; break
        case 'lowHpAtkBonus':      awaken.lowHpAtkBonus = (awaken.lowHpAtkBonus || 0) + v; break
        case 'lowHpDefBonus':      awaken.lowHpDefBonus = (awaken.lowHpDefBonus || 0) + v; break
        case 'damageReduction':    awaken.damageReduction = Math.min(0.20, (awaken.damageReduction || 0) + v); break
        case 'critTakenReduction': awaken.critTakenReduction = Math.min(0.50, (awaken.critTakenReduction || 0) + v); break
        case 'regenPerTurn':       awaken.regenPerTurn = (awaken.regenPerTurn || 0) + v; break
        case 'cleanseInterval':
          // 取最短间隔（多个洗髓时玩家更舒服）
          if (v > 0) awaken.cleanseInterval = awaken.cleanseInterval ? Math.min(awaken.cleanseInterval, v) : v
          break
        case 'frenzyOpening':      awaken.frenzyOpening = (awaken.frenzyOpening || 0) + v; break
        case 'vsBossBonus':        awaken.vsBossBonus = (awaken.vsBossBonus || 0) + v; break
        case 'vsEliteBonus':       awaken.vsEliteBonus = (awaken.vsEliteBonus || 0) + v; break
        case 'debuffDurationBonus':awaken.debuffDurationBonus = (awaken.debuffDurationBonus || 0) + v; break
      }
    }
  }

  // 应用武器类型 + 装备副属性百分比加成（合并一次乘法，避免多重复利）
  const totalAtkPct = weaponAtkPct + equipAtkPct
  const totalSpdPct = weaponSpdPct + equipSpdPct
  if (totalAtkPct > 0) atk = Math.floor(atk * (1 + totalAtkPct / 100))
  if (equipDefPct > 0) def = Math.floor(def * (1 + equipDefPct / 100))
  if (equipHpPct > 0) maxHp = Math.floor(maxHp * (1 + equipHpPct / 100))
  if (totalSpdPct > 0) spd = Math.floor(spd * (1 + totalSpdPct / 100))
  if (weaponSpiritPct > 0) spirit = Math.floor(spirit * (1 + weaponSpiritPct / 100))
  critRate += weaponCritRateFlat / 100
  critDmg += weaponCritDmgFlat / 100
  lifesteal += weaponLifestealFlat / 100

  // 丹药buff加成 (v3.0 三级体系 + 40% 硬上限)
  // 固定值丹药: 直接累加(受 qf 放大), 无上限
  // 百分比丹药: 累加百分比, 每类属性独立 clamp 到 40%
  const PILL_PCT_CAP = 0.40
  let pillAtkPct = 0, pillDefPct = 0, pillHpPct = 0, pillSpdPct = 0
  let pillAtkFlat = 0, pillDefFlat = 0, pillHpFlat = 0, pillSpdFlat = 0
  let pillCritFlat = 0
  for (const buff of buffRows) {
    if (buff.expire_time && new Date(buff.expire_time).getTime() <= Date.now()) continue
    const qf = Number(buff.quality_factor) || 1.0
    switch (buff.pill_id) {
      // --- 初级固定值 ---
      case 'basic_atk_pill':  pillAtkFlat  += 20  * qf; break
      case 'basic_def_pill':  pillDefFlat  += 15  * qf; break
      case 'basic_hp_pill':   pillHpFlat   += 300 * qf; break
      case 'basic_crit_pill': pillCritFlat += 0.03 * qf; break
      // --- 中级低百分比 ---
      case 'atk_pill_1': pillAtkPct += 0.06 * qf; break
      case 'def_pill_1': pillDefPct += 0.06 * qf; break
      case 'hp_pill_1':  pillHpPct  += 0.08 * qf; break
      // --- 高级中等百分比 ---
      case 'elite_atk_pill': pillAtkPct += 0.10 * qf; break
      case 'elite_def_pill': pillDefPct += 0.10 * qf; break
      case 'elite_hp_pill':  pillHpPct  += 0.12 * qf; break
      case 'crit_pill_1':    pillCritFlat += 0.05 * qf; break
      case 'full_pill_1':
        pillAtkPct += 0.06 * qf
        pillDefPct += 0.06 * qf
        pillHpPct  += 0.06 * qf
        break
    }
  }
  // clamp 百分比到 40%
  pillAtkPct = Math.min(pillAtkPct, PILL_PCT_CAP)
  pillDefPct = Math.min(pillDefPct, PILL_PCT_CAP)
  pillHpPct  = Math.min(pillHpPct,  PILL_PCT_CAP)
  pillSpdPct = Math.min(pillSpdPct, PILL_PCT_CAP)
  // 应用: 固定值先加, 再乘百分比
  atk   = Math.floor((atk   + pillAtkFlat) * (1 + pillAtkPct))
  def   = Math.floor((def   + pillDefFlat) * (1 + pillDefPct))
  maxHp = Math.floor((maxHp + pillHpFlat)  * (1 + pillHpPct))
  spd   = Math.floor((spd   + pillSpdFlat) * (1 + pillSpdPct))
  critRate += pillCritFlat

  // 洞府
  let expBonusPercent = 0
  for (const cave of caveRows) {
    if (cave.building_id === 'martial_hall' && cave.level > 0) expBonusPercent += 5 + (cave.level - 1) * 2
  }

  // 境界百分比加成
  if (realmBonus.hp_pct > 0) maxHp = Math.floor(maxHp * (1 + realmBonus.hp_pct / 100))
  if (realmBonus.atk_pct > 0) atk = Math.floor(atk * (1 + realmBonus.atk_pct / 100))
  if (realmBonus.def_pct > 0) def = Math.floor(def * (1 + realmBonus.def_pct / 100))

  // 永久属性加成(道果结晶)
  const permAtkPct = Number(char.permanent_atk_pct || 0)
  const permDefPct = Number(char.permanent_def_pct || 0)
  const permHpPct = Number(char.permanent_hp_pct || 0)
  if (permAtkPct > 0) atk = Math.floor(atk * (1 + permAtkPct / 100))
  if (permDefPct > 0) def = Math.floor(def * (1 + permDefPct / 100))
  if (permHpPct > 0) maxHp = Math.floor(maxHp * (1 + permHpPct / 100))

  // 宗门加成
  if (char._sectLevel) {
    const sectCfg = getSectLevelConfig(char._sectLevel)
    atk = Math.floor(atk * (1 + sectCfg.atkBonus))
    def = Math.floor(def * (1 + sectCfg.defBonus))
    expBonusPercent += sectCfg.expBonus * 100
  }
  if (char._sectSkills && Array.isArray(char._sectSkills)) {
    for (const ss of char._sectSkills) {
      const skillCfg = getSectSkill(ss.skill_key)
      if (!skillCfg) continue
      const effects = calcSectSkillEffect(skillCfg, ss.level)
      if (effects.spirit_percent) spirit += Math.floor(spirit * effects.spirit_percent / 100)
      if (effects.hp_percent) maxHp = Math.floor(maxHp * (1 + effects.hp_percent / 100))
      if (effects.armor_pen_percent) armorPen += Math.floor(armorPen * effects.armor_pen_percent / 100) + Math.floor(effects.armor_pen_percent)
      if (effects.all_percent) {
        atk = Math.floor(atk * (1 + effects.all_percent / 100))
        def = Math.floor(def * (1 + effects.all_percent / 100))
        maxHp = Math.floor(maxHp * (1 + effects.all_percent / 100))
        spd = Math.floor(spd * (1 + effects.all_percent / 100))
      }
    }
  }

  // 附灵抗性叠加（取自 buildPlayerStats 内部临时挂载到 char 上的字段）
  const awakenCtrlResist = (char as any).__resistCtrlAwaken || 0
  const awakenAllResist = (char as any).__resistAllAwaken || 0
  ;(char as any).__resistCtrlAwaken = 0
  ;(char as any).__resistAllAwaken = 0

  // 玩家属性硬上限 (v3.0 从 shared/balance.ts 读取)
  const cappedCritRate  = Math.min(PLAYER_CAPS.critRate,  critRate)
  const cappedCritDmg   = Math.min(PLAYER_CAPS.critDmg,   critDmg)
  const cappedDodge     = Math.min(PLAYER_CAPS.dodge,     dodge)
  const cappedLifesteal = Math.min(PLAYER_CAPS.lifesteal, lifesteal)
  const cappedArmorPen  = Math.min(PLAYER_CAPS.armorPen,  armorPen)
  const cappedAccuracy  = Math.min(PLAYER_CAPS.accuracy,  accuracy)

  return {
    stats: {
      name: char.name, maxHp, hp: maxHp, atk, def, spd,
      crit_rate: cappedCritRate, crit_dmg: cappedCritDmg,
      dodge: cappedDodge, lifesteal: cappedLifesteal,
      element: char.spiritual_root,
      resists: {
        metal: Number(char.resist_metal || 0) + awakenAllResist,
        wood: Number(char.resist_wood || 0) + awakenAllResist,
        water: Number(char.resist_water || 0) + awakenAllResist,
        fire: Number(char.resist_fire || 0) + awakenAllResist,
        earth: Number(char.resist_earth || 0) + awakenAllResist,
        ctrl: Number(char.resist_ctrl || 0) + awakenCtrlResist,
      },
      spiritualRoot: char.spiritual_root,
      armorPen: cappedArmorPen, accuracy: cappedAccuracy, elementDmg,
      spirit,
      awaken,
    },
    expBonusPercent: expBonusPercent + spiritDensity + awakenExpBonus * 100 + awakenSpiritDensityBonus * 100,
    luckPercent: luck + awakenLuckBonus * 100,
  }
}

// ===== 主战斗 API =====
export default defineEventHandler(async (event) => {
  let lockedCharId: number | null = null
  try {
    const pool = getPool()
    const { map_id, auto_sell, auto_sell_tier } = await readBody(event)
    if (!map_id) return { code: 400, message: '缺少地图ID' }

    const mapData = ALL_MAPS[map_id]
    if (!mapData) return { code: 400, message: '地图数据未找到' }

    // 读取角色
    const { rows: charRows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [event.context.userId])
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const char = charRows[0]

    // 离线挂机中禁止战斗
    if (char.offline_start) {
      return { code: 400, message: '离线挂机中，请先结束离线' }
    }

    // 战斗并发 & 频率限制
    const entry = battleLock.get(char.id) || {}
    const now = Date.now()
    // 1) 上场战斗仍在进行（未超过 10s 超时视为僵尸锁）
    if (entry.inProgressSince && now - entry.inProgressSince < MAX_BATTLE_DURATION_MS) {
      return { code: 409, message: '上场战斗未结束，请稍候' }
    }
    // 2) 冷却窗口内
    if (entry.cooldownUntil && now < entry.cooldownUntil) {
      return { code: 429, message: '战斗冷却中' }
    }
    // 3) 进入战斗，标记 in-progress
    battleLock.set(char.id, { inProgressSince: now })
    lockedCharId = char.id

    // 读取装备、技能、buff、洞府
    const { rows: equipRows } = await pool.query('SELECT * FROM character_equipment WHERE character_id = $1', [char.id])
    const { rows: skillRows } = await pool.query('SELECT * FROM character_skills WHERE character_id = $1 AND equipped = TRUE', [char.id])
    const { rows: buffRows } = await pool.query('SELECT * FROM character_buffs WHERE character_id = $1 AND (expire_time > NOW() OR remaining_fights > 0)', [char.id])
    const { rows: caveRows } = await pool.query('SELECT * FROM character_cave WHERE character_id = $1', [char.id])

    // 读取宗门数据注入到char
    if (char.sect_id) {
      const { rows: sectRows } = await pool.query('SELECT level FROM sects WHERE id = $1', [char.sect_id])
      if (sectRows.length > 0) char._sectLevel = sectRows[0].level
      const { rows: sectSkillRows } = await pool.query('SELECT skill_key, level FROM sect_skills WHERE character_id = $1 AND frozen = FALSE', [char.id])
      char._sectSkills = sectSkillRows
    }

    // 构建玩家属性
    const { stats: playerStats, expBonusPercent, luckPercent } = buildPlayerStats(char, equipRows, buffRows, caveRows)

    // 构建装备技能信息
    const equippedSkills = buildEquippedSkillInfo(skillRows)

    // 查询功法背包（用于掉落权重递减）
    const { rows: skillInvRows } = await pool.query(
      'SELECT skill_id, count FROM character_skill_inventory WHERE character_id = $1', [char.id]
    )
    const ownedSkillCounts: Record<string, number> = {}
    for (const row of skillInvRows) ownedSkillCounts[row.skill_id] = row.count
    for (const row of skillRows) ownedSkillCounts[row.skill_id] = (ownedSkillCounts[row.skill_id] || 0) + 1

    // 生成怪物波次
    const isBoss = mapData.boss && Math.random() < 0.01
    const monsterList: { stats: BattlerStats; template: MonsterTemplate }[] = []

    if (isBoss && mapData.boss) {
      const template: MonsterTemplate = mapData.boss
      monsterList.push({ stats: generateMonsterStats(template), template })
    } else {
      const waveSize = 1 + Math.floor(Math.random() * 5)
      for (let i = 0; i < waveSize; i++) {
        const m = mapData.monsters[rand(0, mapData.monsters.length - 1)]
        const template: MonsterTemplate = m
        monsterList.push({ stats: generateMonsterStats(template), template })
      }
    }

    // 执行战斗
    const result = runWaveBattle(playerStats, monsterList, equippedSkills)

    // 应用经验加成
    const expMul = 1 + (expBonusPercent || 0) / 100
    const totalExp = Math.floor(result.totalExp * expMul)
    // 灵石产出: T1-T3 地图 +20%（新手爽感期）
    const stoneTierBonus = mapData.tier <= 3 ? 1.2 : 1.0
    const totalStone = Math.floor(result.totalStone * stoneTierBonus)
    const levelExp = totalExp

    // 掉落生成
    const luckMul = 1 + (luckPercent || 0) / 100
    const allDrops: { type: string; data: any }[] = []
    for (const killed of result.monstersKilled) {
      const t = killed.template
      const tier = mapData.tier
      const ib = t.role === 'boss'
      const equipDrop = generateEquipDrop(tier, ib, luckMul, t.element)
      if (equipDrop) allDrops.push({ type: 'equipment', data: equipDrop })
      const skillDrop = generateSkillDrop(tier, ib, luckMul, ownedSkillCounts)
      if (skillDrop) {
        allDrops.push({ type: 'skill', data: skillDrop })
        ownedSkillCounts[skillDrop] = (ownedSkillCounts[skillDrop] || 0) + 1
      }
      const herbDrop = generateHerbDrop(tier, t.element, ib, luckMul)
      if (herbDrop) allDrops.push({ type: 'herb', data: herbDrop })
    }

    // 存入数据库（主结算事务化：UPDATE 主属性 + 掉落 INSERT + 自动出售统一原子化）
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      if (result.won && totalExp > 0) {
        // 事务内 FOR UPDATE 取最新基线，避免覆盖并发写入（闭关/使用丹药/洞府领取）
        const { rows: fresh } = await client.query(
          'SELECT cultivation_exp, realm_tier, realm_stage, level_exp, level FROM characters WHERE id = $1 FOR UPDATE',
          [char.id]
        )
        const baseline = fresh[0] || char

        // v3.2: 累加 cultivation_exp (不再自动突破,由玩家手动点击"突破"按钮)
        // applyCultivationExp 现在只做飞升末阶软封顶,不会改 tier/stage
        const newExpTotal = Number(baseline.cultivation_exp || 0) + totalExp
        const br = applyCultivationExp(newExpTotal, baseline.realm_tier || 1, baseline.realm_stage || 1)
        await client.query(
          `UPDATE characters SET cultivation_exp = $1, realm_tier = $2, realm_stage = $3, spirit_stone = spirit_stone + $4, level_exp = level_exp + $5, current_map = $6, last_online = NOW() WHERE id = $7`,
          [br.cultivation_exp, br.realm_tier, br.realm_stage, totalStone, levelExp, map_id, char.id]
        )

        // 检查升级（统一使用 realm.ts 的工具，与前端公式一致）
        const lvResult = applyLevelExp(Number(baseline.level_exp || 0) + levelExp, baseline.level || 1)
        if (lvResult.levelUps > 0) {
          result.logs.push({ turn: 0, text: `等级提升!你已升至【Lv.${lvResult.level}】`, type: 'system', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
          await client.query('UPDATE characters SET level = $1, level_exp = $2 WHERE id = $3', [lvResult.level, lvResult.level_exp, char.id])
        }

        // 自动出售判定
        const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red']
        const autoSellIdx = auto_sell ? RARITY_ORDER.indexOf(auto_sell) : -1
        const autoSellTierLimit = Number(auto_sell_tier) || 0
        const sellPrices: Record<string, number> = { white: 10, green: 50, blue: 200, purple: 1000, gold: 5000, red: 20000 }
        let autoSellIncome = 0

        // 存掉落
        for (const drop of allDrops) {
          if (drop.type === 'equipment') {
            const d = drop.data
            const itemIdx = RARITY_ORDER.indexOf(d.rarity)
            const itemTier = d.tier || 1
            if (autoSellIdx >= 0 && itemIdx <= autoSellIdx && (autoSellTierLimit === 0 || itemTier <= autoSellTierLimit)) {
              const price = Math.floor((sellPrices[d.rarity] || 10) * (d.tier || 1))
              autoSellIncome += price
              result.logs.push({ turn: 0, text: `自动出售【${d.name}】获得 ${price} 灵石`, type: 'system', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
              continue
            }
            await client.query(
              `INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, base_slot, req_level, enhance_level)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
              [char.id, d.name, d.rarity, d.primary_stat, d.primary_value, d.sub_stats, d.set_id, d.tier, d.weapon_type, d.base_slot, d.req_level]
            )
            result.logs.push({ turn: 0, text: `掉落了【${d.name}】!`, type: 'loot', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
          }
          if (drop.type === 'skill') {
            await client.query(
              `INSERT INTO character_skill_inventory (character_id, skill_id, count)
               VALUES ($1, $2, 1)
               ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
              [char.id, drop.data]
            )
            result.logs.push({ turn: 0, text: `掉落了功法!`, type: 'loot', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
          }
          if (drop.type === 'herb') {
            const h = drop.data
            await client.query(
              `INSERT INTO character_materials (character_id, material_id, quality, count)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (character_id, material_id, quality) DO UPDATE SET count = character_materials.count + $5`,
              [char.id, h.herb_id, h.quality, h.count, h.count]
            )
          }
        }

        // 自动出售收入入库
        if (autoSellIncome > 0) {
          await client.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [autoSellIncome, char.id])
        }
      } else if (!result.won) {
        await client.query('UPDATE characters SET spirit_stone = GREATEST(0, spirit_stone - FLOOR(spirit_stone * 0.05)), last_online = NOW() WHERE id = $1', [char.id])
      }

      await client.query('COMMIT')
    } catch (settleErr) {
      await client.query('ROLLBACK').catch(() => {})
      throw settleErr
    } finally {
      client.release()
    }

    // 宗门任务进度
    if (result.won) {
      await updateSectDailyTask(char.id, 'battle', 1)
      await updateSectWeeklyTaskByCharId(char.id, 'weekly_battle', result.monstersKilled.length)
      const hasElite = result.monstersKilled.some(m => m.template.role === 'boss')
      if (hasElite) await updateSectDailyTask(char.id, 'elite', 1)

      // === 成就触发 ===
      checkAchievements(char.id, 'battle_count', 1).catch(() => {})
      if (hasElite) {
        const bossCount = result.monstersKilled.filter(m => m.template.role === 'boss').length
        checkAchievements(char.id, 'boss_kill', bossCount).catch(() => {})
      }
      checkAchievements(char.id, 'total_stone', totalStone).catch(() => {})
      checkAchievements(char.id, 'total_exp', totalExp).catch(() => {})
      for (const drop of allDrops) {
        if (drop.type === 'equipment') {
          const rarity = drop.data.rarity
          if (rarity === 'green') checkAchievements(char.id, 'equip_green', 1).catch(() => {})
          else if (rarity === 'blue') checkAchievements(char.id, 'equip_blue', 1).catch(() => {})
          else if (rarity === 'purple') checkAchievements(char.id, 'equip_purple', 1).catch(() => {})
          else if (rarity === 'gold') checkAchievements(char.id, 'equip_gold', 1).catch(() => {})
          else if (rarity === 'red') checkAchievements(char.id, 'equip_red', 1).catch(() => {})
        }
        if (drop.type === 'skill') {
          checkAchievements(char.id, 'skill_pages', 1).catch(() => {})
        }
      }
      // 等级成就
      const { rows: lvRows } = await pool.query('SELECT level FROM characters WHERE id = $1', [char.id])
      const currentLevel = lvRows?.[0]?.level || 1
      checkAchievements(char.id, 'char_level', currentLevel).catch(() => {})
    }

    // 返回最新角色数据
    const { rows: updatedChar } = await pool.query('SELECT * FROM characters WHERE id = $1', [char.id])

    const monsterNames = monsterList.map(m => m.stats.name)

    // 构建第一个怪物的详细信息
    const firstMonster = monsterList[0]
    const monsterInfo = firstMonster ? {
      name: firstMonster.stats.name,
      element: firstMonster.template.element,
      power: firstMonster.template.power,
      maxHp: firstMonster.stats.maxHp,
      atk: firstMonster.stats.atk,
      def: firstMonster.stats.def,
      spd: firstMonster.stats.spd,
      crit_rate: firstMonster.stats.crit_rate,
      crit_dmg: firstMonster.stats.crit_dmg,
      dodge: firstMonster.stats.dodge,
      lifesteal: firstMonster.stats.lifesteal,
      armorPen: firstMonster.stats.armorPen || 0,
      accuracy: firstMonster.stats.accuracy || 0,
      resists: firstMonster.stats.resists || null,
      role: firstMonster.template.role,
      skills: buildMonsterSkillDescriptions(firstMonster.template),
    } : null

    return {
      code: 200,
      data: {
        won: result.won,
        expGained: totalExp,
        stoneGained: totalStone,
        levelExpGained: levelExp,
        monsterNames,
        monstersMaxHp: monsterList.map(m => m.stats.maxHp),
        monsterInfo,
        logs: result.logs,
        drops: allDrops.map(d => {
          if (d.type === 'equipment') return d.data.name
          if (d.type === 'skill') return SKILL_MAP[d.data]?.name || d.data
          return ''
        }).filter(Boolean),
        character: updatedChar[0],
      },
    }
  } catch (error: any) {
    console.error('战斗失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    // 不论成功或异常，都把 in-progress 锁释放为冷却状态，防止僵尸锁
    if (lockedCharId != null) {
      battleLock.set(lockedCharId, { cooldownUntil: Date.now() + BATTLE_COOLDOWN_MS })
    }
  }
})
