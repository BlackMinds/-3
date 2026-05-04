import { getPool } from '~/server/database/db'
import { generateMonsterStats, buildEquippedSkillInfo, runWaveBattle, buildMonsterSkillDescriptions, makeHealerTemplate, type BattlerStats, type MonsterTemplate } from '~/server/engine/battleEngine'
import { getSectLevelConfig, getSectSkill, calcSectSkillEffect } from '~/server/engine/sectData'
import { getRealmBonusAtLevel } from '~/server/engine/realmData'
import { generateEquipName } from '~/server/engine/equipNameData'
import { rollEquipSet } from '~/server/engine/equipSetData'
import { updateSectDailyTask, updateSectWeeklyTaskByCharId } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'
import { applyCultivationExp, applyLevelExp } from '~/server/utils/realm'
import { SKILL_MAP } from '~/server/engine/skillData'
import { rollSubStats, EQUIP_SELL_PRICES } from '~/server/utils/equipment'
import { EQUIP_PRIMARY_BASE, WEAPON_BONUS, PLAYER_CAPS, EQUIP_BAG_LIMIT } from '~/shared/balance'
import { getTopAvgLevel, getCatchUpMultiplier } from '~/server/utils/expCap'

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
export interface MapMonster {
  name: string; power: number; element: string | null;
  exp: number; stone_min: number; stone_max: number;
  role: string; drop_table: string;
}

// v3.4.2 经验削减: T1-T3 ×0.9 / T4 ×0.8 / T5 ×0.65 / T6 ×0.55 / T7 ×0.45 / T8+ ×0.4
// v3.4.2 灵石削减: T1-T3 ×0.7 / T4 ×0.4 / T5 ×0.25 / T6 ×0.18 / T7 ×0.12 / T8+ ×0.1
export const ALL_MAPS: Record<string, { tier: number; monsters: MapMonster[]; boss: MapMonster | null }> = {
  qingfeng_valley: {
    tier: 1,
    monsters: [
      { name: '野猪妖', power: 50, element: null, exp: 9, stone_min: 4, stone_max: 11, role: 'balanced', drop_table: 'common_t1' },
      { name: '灰狼', power: 80, element: null, exp: 14, stone_min: 4, stone_max: 11, role: 'balanced', drop_table: 'common_t1' },
      { name: '蛇妖', power: 120, element: 'wood', exp: 23, stone_min: 4, stone_max: 11, role: 'balanced', drop_table: 'common_t1' },
    ],
    boss: { name: '狼王', power: 300, element: null, exp: 180, stone_min: 70, stone_max: 140, role: 'boss', drop_table: 'boss_t1' },
  },
  misty_swamp: {
    tier: 1,
    monsters: [
      { name: '蟾蜍精', power: 200, element: 'water', exp: 18, stone_min: 4, stone_max: 11, role: 'balanced', drop_table: 'common_t1' },
      { name: '沼蛇', power: 280, element: 'water', exp: 27, stone_min: 4, stone_max: 11, role: 'balanced', drop_table: 'common_t1' },
      { name: '泥傀儡', power: 350, element: 'earth', exp: 36, stone_min: 7, stone_max: 21, role: 'tank', drop_table: 'uncommon_t1' },
    ],
    boss: { name: '沼泽蛟', power: 600, element: 'water', exp: 360, stone_min: 70, stone_max: 140, role: 'boss', drop_table: 'boss_t1' },
  },
  sunset_mountain: {
    tier: 2,
    monsters: [
      { name: '火狐妖', power: 640, element: 'fire', exp: 50, stone_min: 14, stone_max: 42, role: 'balanced', drop_table: 'common_t2' },
      { name: '熔岩蜥', power: 800, element: 'fire', exp: 63, stone_min: 14, stone_max: 42, role: 'balanced', drop_table: 'common_t2' },
      { name: '火鸦', power: 1200, element: 'fire', exp: 95, stone_min: 28, stone_max: 70, role: 'dps', drop_table: 'uncommon_t2' },
    ],
    boss: { name: '赤炎蟒', power: 2400, element: 'fire', exp: 945, stone_min: 350, stone_max: 700, role: 'boss', drop_table: 'boss_t2' },
  },
  jade_bamboo_forest: {
    tier: 2,
    monsters: [
      { name: '竹灵', power: 720, element: 'wood', exp: 57, stone_min: 14, stone_max: 42, role: 'balanced', drop_table: 'common_t2' },
      { name: '藤妖', power: 960, element: 'wood', exp: 76, stone_min: 14, stone_max: 42, role: 'balanced', drop_table: 'common_t2' },
      { name: '玉面猴', power: 1280, element: 'wood', exp: 101, stone_min: 28, stone_max: 70, role: 'dps', drop_table: 'uncommon_t2' },
    ],
    boss: { name: '千年竹妖', power: 2800, element: 'wood', exp: 1134, stone_min: 350, stone_max: 700, role: 'boss', drop_table: 'boss_t2' },
  },
  iron_ore_cave: {
    tier: 2,
    monsters: [
      { name: '铁傀儡', power: 960, element: 'metal', exp: 69, stone_min: 14, stone_max: 42, role: 'balanced', drop_table: 'common_t2' },
      { name: '矿蝠', power: 1120, element: 'metal', exp: 82, stone_min: 14, stone_max: 42, role: 'balanced', drop_table: 'common_t2' },
      { name: '晶蚕', power: 1600, element: 'earth', exp: 113, stone_min: 28, stone_max: 70, role: 'dps', drop_table: 'uncommon_t2' },
    ],
    boss: { name: '矿灵王', power: 3200, element: 'metal', exp: 1260, stone_min: 350, stone_max: 700, role: 'boss', drop_table: 'boss_t2' },
  },
  myriad_demon_mountain: { tier: 3, monsters: [
    { name: '树妖', power: 1200, element: 'wood', exp: 144, stone_min: 56, stone_max: 140, role: 'balanced', drop_table: 'common_t3' },
    { name: '熊妖', power: 1650, element: 'earth', exp: 198, stone_min: 56, stone_max: 140, role: 'balanced', drop_table: 'common_t3' },
    { name: '花妖', power: 2100, element: 'wood', exp: 252, stone_min: 105, stone_max: 280, role: 'dps', drop_table: 'uncommon_t3' },
  ], boss: { name: '妖猿王', power: 4500, element: 'earth', exp: 2880, stone_min: 1400, stone_max: 3500, role: 'boss', drop_table: 'boss_t3' } },
  thunderpeak: { tier: 3, monsters: [
    { name: '雷鹰', power: 1500, element: 'metal', exp: 180, stone_min: 56, stone_max: 140, role: 'balanced', drop_table: 'common_t3' },
    { name: '风暴狼', power: 1950, element: 'metal', exp: 234, stone_min: 56, stone_max: 140, role: 'balanced', drop_table: 'common_t3' },
    { name: '雷蛇', power: 2400, element: 'metal', exp: 288, stone_min: 105, stone_max: 280, role: 'dps', drop_table: 'uncommon_t3' },
  ], boss: { name: '雷鹏', power: 5400, element: 'metal', exp: 3240, stone_min: 1400, stone_max: 3500, role: 'boss', drop_table: 'boss_t3' } },
  ancient_ruins: { tier: 3, monsters: [
    { name: '石卫士', power: 1800, element: 'earth', exp: 216, stone_min: 56, stone_max: 140, role: 'balanced', drop_table: 'common_t3' },
    { name: '符傀儡', power: 2400, element: 'earth', exp: 288, stone_min: 105, stone_max: 280, role: 'dps', drop_table: 'uncommon_t3' },
    { name: '远古怨灵', power: 3000, element: null, exp: 360, stone_min: 105, stone_max: 280, role: 'dps', drop_table: 'uncommon_t3' },
  ], boss: { name: '遗迹守护者', power: 6600, element: 'earth', exp: 4320, stone_min: 1400, stone_max: 3500, role: 'boss', drop_table: 'boss_t3' } },
  dark_sea: { tier: 4, monsters: [
    { name: '海蛟', power: 4500, element: 'water', exp: 400, stone_min: 120, stone_max: 320, role: 'balanced', drop_table: 'common_t4' },
    { name: '幽灵鱼', power: 5500, element: 'water', exp: 500, stone_min: 120, stone_max: 320, role: 'balanced', drop_table: 'common_t4' },
    { name: '墨海兽', power: 7500, element: 'water', exp: 700, stone_min: 240, stone_max: 600, role: 'dps', drop_table: 'uncommon_t4' },
  ], boss: { name: '龙龟', power: 15000, element: 'water', exp: 6000, stone_min: 3200, stone_max: 8000, role: 'boss', drop_table: 'boss_t4' } },
  soul_forest: { tier: 4, monsters: [
    { name: '噬魂树', power: 5000, element: 'wood', exp: 440, stone_min: 120, stone_max: 320, role: 'balanced', drop_table: 'common_t4' },
    { name: '幽影猫', power: 6250, element: null, exp: 560, stone_min: 120, stone_max: 320, role: 'balanced', drop_table: 'common_t4' },
    { name: '尸花', power: 8000, element: 'wood', exp: 760, stone_min: 240, stone_max: 600, role: 'dps', drop_table: 'uncommon_t4' },
  ], boss: { name: '噬魂古树', power: 16250, element: 'wood', exp: 7000, stone_min: 3200, stone_max: 8000, role: 'boss', drop_table: 'boss_t4' } },
  desert_of_sands: { tier: 4, monsters: [
    { name: '沙蝎王', power: 6000, element: 'earth', exp: 520, stone_min: 120, stone_max: 320, role: 'balanced', drop_table: 'common_t4' },
    { name: '沙虫', power: 7500, element: 'earth', exp: 640, stone_min: 120, stone_max: 320, role: 'balanced', drop_table: 'common_t4' },
    { name: '蜃狐', power: 9500, element: 'fire', exp: 840, stone_min: 240, stone_max: 600, role: 'dps', drop_table: 'uncommon_t4' },
  ], boss: { name: '流沙帝蝎', power: 20000, element: 'earth', exp: 8000, stone_min: 3200, stone_max: 8000, role: 'boss', drop_table: 'boss_t4' } },
  purgatory: { tier: 5, monsters: [
    { name: '狱卒', power: 9000, element: 'fire', exp: 975, stone_min: 250, stone_max: 750, role: 'balanced', drop_table: 'common_t5' },
    { name: '魔兵', power: 11000, element: 'metal', exp: 1170, stone_min: 500, stone_max: 1500, role: 'dps', drop_table: 'uncommon_t5' },
    { name: '骨龙', power: 15000, element: 'fire', exp: 1755, stone_min: 1250, stone_max: 3000, role: 'dps', drop_table: 'rare_t5' },
  ], boss: { name: '炼狱魔君', power: 35000, element: 'fire', exp: 9750, stone_min: 7500, stone_max: 20000, role: 'boss', drop_table: 'boss_t5' } },
  frozen_abyss: { tier: 5, monsters: [
    { name: '霜巨人', power: 9500, element: 'water', exp: 1073, stone_min: 250, stone_max: 750, role: 'balanced', drop_table: 'common_t5' },
    { name: '冰魄', power: 12000, element: 'water', exp: 1365, stone_min: 500, stone_max: 1500, role: 'dps', drop_table: 'uncommon_t5' },
    { name: '冰蛟龙', power: 16000, element: 'water', exp: 1853, stone_min: 1250, stone_max: 3000, role: 'dps', drop_table: 'rare_t5' },
  ], boss: { name: '寒渊冰帝', power: 38000, element: 'water', exp: 10725, stone_min: 7500, stone_max: 20000, role: 'boss', drop_table: 'boss_t5' } },
  demon_battlefield: { tier: 5, monsters: [
    { name: '魔将', power: 13000, element: 'fire', exp: 1463, stone_min: 500, stone_max: 1500, role: 'dps', drop_table: 'uncommon_t5' },
    { name: '暗骑士', power: 16000, element: 'metal', exp: 1755, stone_min: 500, stone_max: 1500, role: 'dps', drop_table: 'uncommon_t5' },
    { name: '战魔', power: 20000, element: null, exp: 2145, stone_min: 1250, stone_max: 3000, role: 'dps', drop_table: 'rare_t5' },
  ], boss: { name: '魔帅', power: 45000, element: null, exp: 14625, stone_min: 7500, stone_max: 20000, role: 'boss', drop_table: 'boss_t5' } },
  tribulation_wasteland: { tier: 6, monsters: [
    { name: '雷兽', power: 27000, element: 'metal', exp: 2750, stone_min: 900, stone_max: 2700, role: 'balanced', drop_table: 'common_t6' },
    { name: '虚空生物', power: 33000, element: null, exp: 3575, stone_min: 1440, stone_max: 4500, role: 'speed', drop_table: 'uncommon_t6' },
    { name: '堕仙', power: 42000, element: 'metal', exp: 4675, stone_min: 2700, stone_max: 7200, role: 'dps', drop_table: 'rare_t6' },
  ], boss: { name: '雷帝', power: 90000, element: 'metal', exp: 27500, stone_min: 18000, stone_max: 54000, role: 'boss', drop_table: 'boss_t6' } },
  void_rift: { tier: 6, monsters: [
    { name: '虚空猎手', power: 28800, element: null, exp: 3025, stone_min: 900, stone_max: 2700, role: 'balanced', drop_table: 'common_t6' },
    { name: '时光幻影', power: 34800, element: null, exp: 3850, stone_min: 1440, stone_max: 4500, role: 'speed', drop_table: 'uncommon_t6' },
    { name: '混沌元素', power: 45000, element: null, exp: 4950, stone_min: 2700, stone_max: 7200, role: 'dps', drop_table: 'rare_t6' },
  ], boss: { name: '虚空之主', power: 96000, element: null, exp: 30250, stone_min: 18000, stone_max: 54000, role: 'boss', drop_table: 'boss_t6' } },
  celestial_mountain: { tier: 7, monsters: [
    { name: '仙鹤', power: 36000, element: 'metal', exp: 3600, stone_min: 3600, stone_max: 9600, role: 'balanced', drop_table: 'common_t7' },
    { name: '玉麒麟', power: 44000, element: 'earth', exp: 4500, stone_min: 6000, stone_max: 18000, role: 'dps', drop_table: 'uncommon_t7' },
    { name: '金龙', power: 56000, element: 'metal', exp: 5760, stone_min: 9600, stone_max: 30000, role: 'dps', drop_table: 'rare_t7' },
  ], boss: { name: '昆仑仙尊', power: 120000, element: 'metal', exp: 48000, stone_min: 60000, stone_max: 180000, role: 'boss', drop_table: 'boss_t7' } },
  nether_realm: { tier: 7, monsters: [
    { name: '冥卫', power: 50000, element: 'water', exp: 5040, stone_min: 3600, stone_max: 9600, role: 'balanced', drop_table: 'common_t7' },
    { name: '夺魂使', power: 60000, element: null, exp: 6300, stone_min: 6000, stone_max: 18000, role: 'dps', drop_table: 'uncommon_t7' },
    { name: '冥龙', power: 80000, element: 'water', exp: 8100, stone_min: 9600, stone_max: 30000, role: 'dps', drop_table: 'rare_t7' },
  ], boss: { name: '冥王', power: 180000, element: 'water', exp: 72000, stone_min: 60000, stone_max: 180000, role: 'boss', drop_table: 'boss_t7' } },
  immortal_realm: { tier: 8, monsters: [
    { name: '天兵', power: 80000, element: 'metal', exp: 7680, stone_min: 20000, stone_max: 50000, role: 'balanced', drop_table: 'common_t8' },
    { name: '神兽', power: 100000, element: null, exp: 9600, stone_min: 40000, stone_max: 100000, role: 'dps', drop_table: 'uncommon_t8' },
    { name: '远古神灵', power: 150000, element: null, exp: 14400, stone_min: 80000, stone_max: 200000, role: 'dps', drop_table: 'rare_t8' },
  ], boss: { name: '天帝', power: 300000, element: null, exp: 108000, stone_min: 200000, stone_max: 500000, role: 'boss', drop_table: 'boss_t8' } },
  chaos_origin: { tier: 8, monsters: [
    { name: '混沌兽', power: 180000, element: null, exp: 19200, stone_min: 20000, stone_max: 50000, role: 'balanced', drop_table: 'common_t8' },
    { name: '太古凶兽', power: 220000, element: null, exp: 24000, stone_min: 80000, stone_max: 200000, role: 'dps', drop_table: 'rare_t8' },
    { name: '道之幻影', power: 280000, element: null, exp: 30720, stone_min: 80000, stone_max: 200000, role: 'dps', drop_table: 'rare_t8' },
  ], boss: { name: '混沌之主', power: 500000, element: null, exp: 216000, stone_min: 200000, stone_max: 500000, role: 'boss', drop_table: 'boss_t8' } },
  void_holy_land: { tier: 9, monsters: [
    { name: '虚空剑侍', power: 240000, element: 'metal', exp: 24000, stone_min: 50000, stone_max: 120000, role: 'balanced', drop_table: 'common_t9' },
    { name: '圣境守护', power: 300000, element: 'earth', exp: 31200, stone_min: 50000, stone_max: 120000, role: 'tank', drop_table: 'common_t9' },
    { name: '天凤', power: 360000, element: 'fire', exp: 38400, stone_min: 100000, stone_max: 250000, role: 'dps', drop_table: 'uncommon_t9' },
  ], boss: { name: '太虚帝君', power: 600000, element: 'metal', exp: 288000, stone_min: 500000, stone_max: 1200000, role: 'boss', drop_table: 'boss_t9' } },
  hongmeng_realm: { tier: 9, monsters: [
    { name: '鸿蒙异兽', power: 280000, element: 'wood', exp: 28800, stone_min: 50000, stone_max: 120000, role: 'balanced', drop_table: 'common_t9' },
    { name: '本源精灵', power: 340000, element: 'water', exp: 36000, stone_min: 50000, stone_max: 120000, role: 'balanced', drop_table: 'common_t9' },
    { name: '始祖龙', power: 400000, element: null, exp: 43200, stone_min: 150000, stone_max: 300000, role: 'dps', drop_table: 'uncommon_t9' },
  ], boss: { name: '鸿蒙道尊', power: 720000, element: null, exp: 360000, stone_min: 600000, stone_max: 1500000, role: 'boss', drop_table: 'boss_t9' } },
  myriad_battlefield: { tier: 9, monsters: [
    { name: '界域战士', power: 320000, element: 'fire', exp: 33600, stone_min: 60000, stone_max: 150000, role: 'balanced', drop_table: 'common_t9' },
    { name: '虚空刺客', power: 380000, element: null, exp: 40800, stone_min: 60000, stone_max: 150000, role: 'speed', drop_table: 'uncommon_t9' },
    { name: '远古泰坦', power: 480000, element: 'earth', exp: 48000, stone_min: 200000, stone_max: 400000, role: 'tank', drop_table: 'uncommon_t9' },
  ], boss: { name: '万界战神', power: 800000, element: null, exp: 432000, stone_min: 800000, stone_max: 2000000, role: 'boss', drop_table: 'boss_t9' } },
  dao_trial: { tier: 10, monsters: [
    { name: '天道傀儡', power: 225000, element: null, exp: 21600, stone_min: 200000, stone_max: 500000, role: 'balanced', drop_table: 'common_t10' },
    { name: '规则执行者', power: 300000, element: null, exp: 28800, stone_min: 200000, stone_max: 500000, role: 'dps', drop_table: 'uncommon_t10' },
    { name: '命运织者', power: 375000, element: null, exp: 36000, stone_min: 500000, stone_max: 1000000, role: 'dps', drop_table: 'uncommon_t10' },
  ], boss: { name: '天道化身', power: 750000, element: null, exp: 336000, stone_min: 2000000, stone_max: 5000000, role: 'boss', drop_table: 'boss_t10' } },
  eternal_peak: { tier: 10, monsters: [
    { name: '永恒守卫', power: 300000, element: 'metal', exp: 28800, stone_min: 300000, stone_max: 800000, role: 'balanced', drop_table: 'common_t10' },
    { name: '时间领主', power: 450000, element: 'water', exp: 43200, stone_min: 300000, stone_max: 800000, role: 'dps', drop_table: 'uncommon_t10' },
    { name: '创世之灵', power: 500000, element: null, exp: 57600, stone_min: 800000, stone_max: 2000000, role: 'dps', drop_table: 'uncommon_t10' },
  ], boss: { name: '永恒之主', power: 1200000, element: null, exp: 672000, stone_min: 5000000, stone_max: 10000000, role: 'boss', drop_table: 'boss_t10' } },
  // ===== T11 地图（混元境界专属，曲线对 T10 跨度 ~3-4x）=====
  // 经验/灵石继续按 ×0.4 / ×0.1 系数（与 T8+ 一致）
  primal_chaos_sea: { tier: 11, monsters: [
    { name: '鸿蒙巨鲲', power: 1200000, element: 'water', exp: 129600, stone_min: 800000, stone_max: 2000000, role: 'balanced', drop_table: 'common_t11' },
    { name: '本源龙神', power: 1600000, element: null, exp: 172800, stone_min: 800000, stone_max: 2000000, role: 'dps', drop_table: 'uncommon_t11' },
    { name: '虚空圣使', power: 1850000, element: 'metal', exp: 237600, stone_min: 2000000, stone_max: 5000000, role: 'dps', drop_table: 'uncommon_t11' },
  ], boss: { name: '鸿蒙帝君', power: 4500000, element: null, exp: 2280000, stone_min: 10000000, stone_max: 25000000, role: 'boss', drop_table: 'boss_t11' } },
  nine_heavens_court: { tier: 11, monsters: [
    { name: '天庭元帅', power: 1500000, element: 'metal', exp: 151200, stone_min: 800000, stone_max: 2000000, role: 'tank', drop_table: 'common_t11' },
    { name: '星辰大将', power: 2000000, element: 'fire', exp: 194400, stone_min: 1000000, stone_max: 2500000, role: 'dps', drop_table: 'uncommon_t11' },
    { name: '雷霆君主', power: 2200000, element: 'metal', exp: 259200, stone_min: 2500000, stone_max: 6000000, role: 'dps', drop_table: 'uncommon_t11' },
  ], boss: { name: '九霄玉帝', power: 5500000, element: 'metal', exp: 2736000, stone_min: 12000000, stone_max: 30000000, role: 'boss', drop_table: 'boss_t11' } },
  // ===== T12 地图（混元·太极+ 准入，毕业级）=====
  eternal_void: { tier: 12, monsters: [
    { name: '虚空泰坦', power: 4500000, element: null, exp: 480000, stone_min: 4000000, stone_max: 10000000, role: 'tank', drop_table: 'common_t12' },
    { name: '永恒刺客', power: 6000000, element: null, exp: 640000, stone_min: 4000000, stone_max: 10000000, role: 'speed', drop_table: 'uncommon_t12' },
    { name: '本源毁灭者', power: 6700000, element: 'fire', exp: 880000, stone_min: 10000000, stone_max: 25000000, role: 'dps', drop_table: 'uncommon_t12' },
  ], boss: { name: '虚空之主', power: 16000000, element: null, exp: 8000000, stone_min: 50000000, stone_max: 120000000, role: 'boss', drop_table: 'boss_t12' } },
  genesis_realm: { tier: 12, monsters: [
    { name: '创世守卫', power: 6000000, element: 'earth', exp: 640000, stone_min: 6000000, stone_max: 15000000, role: 'tank', drop_table: 'common_t12' },
    { name: '法则裁定者', power: 8500000, element: null, exp: 880000, stone_min: 6000000, stone_max: 15000000, role: 'dps', drop_table: 'uncommon_t12' },
    { name: '终焉先知', power: 10000000, element: null, exp: 1200000, stone_min: 15000000, stone_max: 35000000, role: 'dps', drop_table: 'uncommon_t12' },
  ], boss: { name: '创世道祖', power: 25000000, element: null, exp: 12000000, stone_min: 80000000, stone_max: 200000000, role: 'boss', drop_table: 'boss_t12' } },
  // ===== T13 地图（道域）=====
  astral_dao_field: { tier: 13, monsters: [
    { name: '星辰仲裁者', power: 13000000, element: 'metal', exp: 14000000, stone_min: 12000000, stone_max: 30000000, role: 'tank', drop_table: 'common_t13' },
    { name: '星海掠者', power: 18000000, element: 'water', exp: 20000000, stone_min: 15000000, stone_max: 38000000, role: 'dps', drop_table: 'uncommon_t13' },
    { name: '宙环先知', power: 23000000, element: null, exp: 28000000, stone_min: 35000000, stone_max: 80000000, role: 'dps', drop_table: 'uncommon_t13' },
  ], boss: { name: '天宇道君', power: 60000000, element: 'metal', exp: 152000000, stone_min: 200000000, stone_max: 500000000, role: 'boss', drop_table: 'boss_t13' } },
  myriad_origin_void: { tier: 13, monsters: [
    { name: '万源守阙', power: 15000000, element: 'earth', exp: 15200000, stone_min: 12000000, stone_max: 30000000, role: 'balanced', drop_table: 'common_t13' },
    { name: '本源剑灵', power: 20000000, element: 'metal', exp: 22000000, stone_min: 15000000, stone_max: 38000000, role: 'speed', drop_table: 'uncommon_t13' },
    { name: '本源终焉', power: 26000000, element: 'fire', exp: 30000000, stone_min: 35000000, stone_max: 80000000, role: 'dps', drop_table: 'uncommon_t13' },
  ], boss: { name: '万源道祖', power: 70000000, element: null, exp: 168000000, stone_min: 250000000, stone_max: 600000000, role: 'boss', drop_table: 'boss_t13' } },
  // ===== T14 地图（法则）=====
  causality_sea: { tier: 14, monsters: [
    { name: '因果守律', power: 40000000, element: 'water', exp: 44000000, stone_min: 40000000, stone_max: 100000000, role: 'tank', drop_table: 'common_t14' },
    { name: '命运刺客', power: 55000000, element: null, exp: 64000000, stone_min: 50000000, stone_max: 130000000, role: 'speed', drop_table: 'uncommon_t14' },
    { name: '因果裁决', power: 70000000, element: null, exp: 88000000, stone_min: 120000000, stone_max: 280000000, role: 'dps', drop_table: 'uncommon_t14' },
  ], boss: { name: '因果天尊', power: 180000000, element: 'water', exp: 440000000, stone_min: 600000000, stone_max: 1400000000, role: 'boss', drop_table: 'boss_t14' } },
  spacetime_rift: { tier: 14, monsters: [
    { name: '时序哨卫', power: 45000000, element: 'metal', exp: 48000000, stone_min: 40000000, stone_max: 100000000, role: 'balanced', drop_table: 'common_t14' },
    { name: '空裂幽影', power: 62000000, element: null, exp: 72000000, stone_min: 50000000, stone_max: 130000000, role: 'dps', drop_table: 'uncommon_t14' },
    { name: '裂界吞噬者', power: 78000000, element: 'fire', exp: 96000000, stone_min: 120000000, stone_max: 280000000, role: 'dps', drop_table: 'uncommon_t14' },
  ], boss: { name: '时空之主', power: 220000000, element: null, exp: 520000000, stone_min: 700000000, stone_max: 1600000000, role: 'boss', drop_table: 'boss_t14' } },
  // ===== T15 地图（道祖）=====
  genesis_dawn: { tier: 15, monsters: [
    { name: '初辰守者', power: 130000000, element: 'fire', exp: 152000000, stone_min: 150000000, stone_max: 350000000, role: 'tank', drop_table: 'common_t15' },
    { name: '创世圣使', power: 170000000, element: 'metal', exp: 200000000, stone_min: 180000000, stone_max: 450000000, role: 'dps', drop_table: 'uncommon_t15' },
    { name: '初道化形', power: 210000000, element: null, exp: 280000000, stone_min: 400000000, stone_max: 900000000, role: 'dps', drop_table: 'uncommon_t15' },
  ], boss: { name: '初辰道神', power: 550000000, element: null, exp: 1400000000, stone_min: 2000000000, stone_max: 4500000000, role: 'boss', drop_table: 'boss_t15' } },
  myriad_dao_end: { tier: 15, monsters: [
    { name: '终焉守阙', power: 150000000, element: 'earth', exp: 168000000, stone_min: 150000000, stone_max: 350000000, role: 'tank', drop_table: 'common_t15' },
    { name: '终焉剑魄', power: 200000000, element: 'metal', exp: 224000000, stone_min: 180000000, stone_max: 450000000, role: 'speed', drop_table: 'uncommon_t15' },
    { name: '末劫呼唤者', power: 260000000, element: 'fire', exp: 320000000, stone_min: 400000000, stone_max: 900000000, role: 'dps', drop_table: 'uncommon_t15' },
  ], boss: { name: '终焉道祖', power: 700000000, element: null, exp: 1800000000, stone_min: 3000000000, stone_max: 7000000000, role: 'boss', drop_table: 'boss_t15' } },
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
// 普通怪掉率按 tier 阶梯：前期更新频繁带来爽感；后期件件保值，刷少但精
function getNormalDropRate(tier: number): number {
  if (tier <= 2) return 0.20
  if (tier <= 6) return 0.12
  return 0.08
}
function generateEquipDrop(tier: number, isBoss: boolean, luckMul: number = 1, monsterElement: string | null = null): any | null {
  const rate = (isBoss ? 1.0 : getNormalDropRate(tier)) * luckMul
  if (Math.random() >= rate) return null
  const rarities = ['white', 'green', 'blue', 'purple', 'gold', 'red']
  // T1-T2 品质权重上调（前期装备更新频繁带来爽感）
  // T11/T12 顶级图：紫品起步、金/红主流，白绿全砍
  const weights: Record<number, number[]> = {
    1: [40,40,17,3,0,0], 2: [30,40,22,7,1,0], 3: [20,35,25,15,4.5,0.5],
    4: [5,25,30,25,13,2], 5: [0,10,30,35,22,3], 6: [0,0,20,40,35,5],
    7: [0,0,10,35,45,10], 8: [0,0,5,25,55,15], 9: [0,0,0,20,60,20], 10: [0,0,0,10,60,30],
    11: [0,0,0,5,55,40], 12: [0,0,0,0,50,50],
  }
  const w = weights[tier] || weights[1]
  const total = w.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let idx = 0
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { idx = i; break } }
  const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
  const slotIdx = rand(0, slots.length - 1)
  const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_DMG', pendant: 'SPIRIT' }
  const statMuls = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5]
  const ps = primaryStats[slots[slotIdx]]
  const pv = Math.max(1, Math.floor((EQUIP_PRIMARY_BASE[ps] || 30) * tier * statMuls[idx]))
  const tierReqLevels: Record<number, number> = { 1:1, 2:15, 3:35, 4:55, 5:80, 6:110, 7:140, 8:170, 9:185, 10:195, 11:215, 12:240 }
  const weaponType = slots[slotIdx] === 'weapon' ? ['sword','blade','spear','fan'][rand(0,3)] : null
  const subStats = generateSubStats(idx, tier)
  // 套装注入：白/绿不出套装；蓝~红按品质有概率获得套装碎片身份；boss luck ×1.5
  const setKey = rollEquipSet(rarities[idx], isBoss ? 1.5 : 1.0)
  return {
    name: generateEquipName(rarities[idx], slots[slotIdx], weaponType, tier, ps, monsterElement, '', setKey),
    rarity: rarities[idx],
    primary_stat: ps, primary_value: pv, sub_stats: JSON.stringify(subStats),
    set_id: setKey, tier, weapon_type: weaponType,
    base_slot: slots[slotIdx], req_level: tierReqLevels[tier] || 1, enhance_level: 0,
  }
}

// ===== 功法掉落（已有功法权重递减） =====
// T1-T3 前期慷慨：让新人快速凑满 3 个槽位；T4+ 维持稀缺
function getSkillDropRate(tier: number, isBoss: boolean): number {
  if (tier <= 3) return isBoss ? 0.15 : 0.015
  return isBoss ? 0.10 : 0.008
}
function generateSkillDrop(tier: number, isBoss: boolean, luckMul: number = 1, ownedCounts: Record<string, number> = {}): string | null {
  const rate = getSkillDropRate(tier, isBoss) * luckMul
  if (Math.random() >= rate) return null
  const pools: Record<number, string[]> = {
    1: ['wind_blade','vine_whip','ice_palm','flame_sword','quake_fist','body_refine','flame_body','water_flow','root_grip','metal_skin'],
    3: ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall'],
    5: ['sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury','wood_heal','mirror_water','crit_master','earth_fortitude','poison_body','fire_mastery','dot_amplifier','phantom_step','healing_spring'],
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

// ===== 强化石掉落（仅 T4+ 地图触发，对应 tier 专用，低概率） =====
function generateEnhanceStoneDrop(tier: number, isBoss: boolean, luckMul: number = 1): string | null {
  if (tier < 4) return null
  const base: Record<number, number> = {
    4: 0.020, 5: 0.018, 6: 0.015, 7: 0.012, 8: 0.010, 9: 0.008, 10: 0.006,
    11: 0.004, 12: 0.003,
  }
  let rate = (base[tier] ?? 0) * luckMul
  if (isBoss) rate *= 4
  if (Math.random() >= rate) return null
  return `enhance_stone_t${tier}`
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
export function buildPlayerStats(char: any, equipRows: any[], buffRows: any[], caveRows: any[]): { stats: BattlerStats; expBonusPercent: number; luckPercent: number } {
  let atk = Number(char.atk)
  let def = Number(char.def)
  let maxHp = Number(char.max_hp)
  let spd = Number(char.spd)
  let critRate = Number(char.crit_rate || 0.05)
  let critDmg = Number(char.crit_dmg || 1.0)
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
    if (i <= 50)       { maxHp += 10; atk += 2;  def += 1; spd += 1 }
    else if (i <= 100) { maxHp += 20; atk += 4;  def += 2; spd += 2 }
    else if (i <= 150) { maxHp += 40; atk += 8;  def += 4; spd += 3 }
    else               { maxHp += 80; atk += 15; def += 8; spd += 5 }
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
  // v3.7 加法池：所有非功法被动的 % 累加（小数, 0.10=10%），最后统一一次乘
  // 包含：附灵% / 武器+装备% / 丹药% / 境界% / 道果% / 宗门% / 宗门技能%
  // 不含：功法被动%（在 battleEngine.applyPassive 里加进同一池后一次乘，见 _flatAtk/_pctSumAtk 字段）
  let nonPassiveAtkPct = 0, nonPassiveDefPct = 0, nonPassiveHpPct = 0, nonPassiveSpdPct = 0
  // 附灵 X_PCT 累加（最后并入 nonPassive 池）
  let awakenAtkPct = 0, awakenDefPct = 0, awakenHpPct = 0, awakenSpdPct = 0
  // v3.6 DOT/反伤副属性累计（小数 0.05 = 5%）
  let equipDotDmgPct = 0, equipReflectPct = 0
  // 套装：聚合已穿戴件数（仅统计 slot 非空）+ 记录主武器类型（供十三枪等武器流套装判定）
  const equipSetCounts: Record<string, number> = {}
  let playerWeaponType: string | null = null

  for (const eq of equipRows) {
    if (!eq.slot) continue
    if (eq.set_id) {
      equipSetCounts[eq.set_id] = (equipSetCounts[eq.set_id] || 0) + 1
    }
    if (eq.slot === 'weapon' && eq.weapon_type) {
      playerWeaponType = eq.weapon_type
    }
    const enhLv = eq.enhance_level || 0
    const primary = Math.floor(eq.primary_value * (1 + enhLv * 0.10))
    if (eq.primary_stat === 'ATK') atk += primary
    else if (eq.primary_stat === 'DEF') def += primary
    else if (eq.primary_stat === 'HP') maxHp += primary
    else if (eq.primary_stat === 'SPD') spd += primary
    else if (eq.primary_stat === 'CRIT_RATE') critRate += primary / 100
    else if (eq.primary_stat === 'CRIT_DMG') critDmg += primary / 100
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
      else if (sub.stat === 'DOT_DMG_PCT') equipDotDmgPct += sub.value / 100
      else if (sub.stat === 'REFLECT_PCT') equipReflectPct += sub.value / 100
    }

    // v1.2 附灵聚合（weapon/armor/pendant + v1.3 ring 主修增幅）
    const aw = typeof eq.awaken_effect === 'string' ? JSON.parse(eq.awaken_effect) : eq.awaken_effect
    if (aw && aw.stat) {
      const v = Number(aw.value) || 0
      const meta = aw.meta || null
      switch (aw.stat) {
        // 属性加成类（直接叠加到 BattlerStats）
        case 'lifesteal':          lifesteal += v; break
        case 'critRate':           critRate += v; break
        case 'critDmg':            critDmg += v; break
        case 'dodge':              dodge += v; break
        case 'spirit':             spirit += v; break
        case 'atkPct':             awakenAtkPct += v; break
        case 'defPct':             awakenDefPct += v; break
        case 'hpPct':              awakenHpPct  += v; break
        case 'spdPct':             awakenSpdPct += v; break
        case 'harmonyPct':
          awakenAtkPct += v
          awakenDefPct += v
          awakenHpPct  += v
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
        // v3.6 反伤流派附灵：直接叠加到 equipReflectPct 通道（与副属性 REFLECT_PCT 共用）
        case 'reflectPct':         equipReflectPct += v; break
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
        // ===== v1.3 灵戒附灵·主修功法增幅 =====
        // 通用向
        case 'mainSkillMultBonus':  awaken.mainSkillMultBonus = (awaken.mainSkillMultBonus || 0) + v; break
        case 'mainSkillCritRate':   awaken.mainSkillCritRate = (awaken.mainSkillCritRate || 0) + v; break
        case 'mainSkillArmorPen':   awaken.mainSkillArmorPen = (awaken.mainSkillArmorPen || 0) + v; break
        case 'mainSkillLifesteal':  awaken.mainSkillLifesteal = (awaken.mainSkillLifesteal || 0) + v; break
        // 属性匹配向（运行时按 activeSkill.element 判断生效）
        case 'mainSkillBleedAmp':
          awaken.mainSkillBleedAmp = v
          awaken.mainSkillBleedAmpElem = meta?.requireElement
          break
        case 'mainSkillPoisonAmp':
          awaken.mainSkillPoisonAmp = v
          awaken.mainSkillPoisonAmpElem = meta?.requireElement
          break
        case 'mainSkillFreezeChance':
          awaken.mainSkillFreezeChance = v
          awaken.mainSkillFreezeChanceElem = meta?.requireElement
          break
        case 'mainSkillBurnDuration':
          awaken.mainSkillBurnDuration = v
          awaken.mainSkillBurnDurationElem = meta?.requireElement
          break
        case 'mainSkillBurnAmp':
          awaken.mainSkillBurnAmp = v
          awaken.mainSkillBurnAmpElem = meta?.requireElement
          break
        case 'mainSkillBrittleAmp':
          awaken.mainSkillBrittleAmp = v
          awaken.mainSkillBrittleAmpElem = meta?.requireElement
          break
        // 机制向
        case 'mainSkillChainChance': awaken.mainSkillChainChance = (awaken.mainSkillChainChance || 0) + v; break
        case 'mainSkillCritCdCut':   awaken.mainSkillCritCdCut = true; break
        case 'mainSkillExecute':
          awaken.mainSkillExecuteBonus = v
          awaken.mainSkillExecuteThr = meta?.threshold ?? 0.20
          break
      }
    }
  }

  // 武器类型 + 装备副属性 X_PCT 进加法池（spirit 不在 4 项主属性池里，单独乘）
  nonPassiveAtkPct += (weaponAtkPct + equipAtkPct) / 100
  nonPassiveDefPct += equipDefPct / 100
  nonPassiveHpPct  += equipHpPct / 100
  nonPassiveSpdPct += (weaponSpdPct + equipSpdPct) / 100
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
  // 加法池: 固定值进 flat 段、百分比进非功法 % 池
  atk   += pillAtkFlat
  def   += pillDefFlat
  maxHp += pillHpFlat
  spd   += pillSpdFlat
  nonPassiveAtkPct += pillAtkPct
  nonPassiveDefPct += pillDefPct
  nonPassiveHpPct  += pillHpPct
  nonPassiveSpdPct += pillSpdPct
  critRate += pillCritFlat

  // 洞府
  let expBonusPercent = 0
  for (const cave of caveRows) {
    if (cave.building_id === 'martial_hall' && cave.level > 0) expBonusPercent += 5 + (cave.level - 1) * 2
  }

  // 境界百分比加成 → 加法池
  if (realmBonus.hp_pct > 0) nonPassiveHpPct  += realmBonus.hp_pct / 100
  if (realmBonus.atk_pct > 0) nonPassiveAtkPct += realmBonus.atk_pct / 100
  if (realmBonus.def_pct > 0) nonPassiveDefPct += realmBonus.def_pct / 100

  // 永久属性加成(道果结晶) → 加法池
  const permAtkPct = Number(char.permanent_atk_pct || 0)
  const permDefPct = Number(char.permanent_def_pct || 0)
  const permHpPct = Number(char.permanent_hp_pct || 0)
  if (permAtkPct > 0) nonPassiveAtkPct += permAtkPct / 100
  if (permDefPct > 0) nonPassiveDefPct += permDefPct / 100
  if (permHpPct > 0) nonPassiveHpPct  += permHpPct / 100

  // 宗门加成 → 加法池
  if (char._sectLevel) {
    const sectCfg = getSectLevelConfig(char._sectLevel)
    nonPassiveAtkPct += sectCfg.atkBonus
    nonPassiveDefPct += sectCfg.defBonus
    expBonusPercent += sectCfg.expBonus * 100
  }
  if (char._sectSkills && Array.isArray(char._sectSkills)) {
    for (const ss of char._sectSkills) {
      const skillCfg = getSectSkill(ss.skill_key)
      if (!skillCfg) continue
      const effects = calcSectSkillEffect(skillCfg, ss.level)
      // spirit 不在 4 项主属性加法池里，保留原乘法（spirit 没经历多轮乘子，影响很小）
      if (effects.spirit_percent) spirit += Math.floor(spirit * effects.spirit_percent / 100)
      if (effects.hp_percent) nonPassiveHpPct += effects.hp_percent / 100
      // armorPen 不在 4 项池里
      if (effects.armor_pen_percent) armorPen += Math.floor(armorPen * effects.armor_pen_percent / 100) + Math.floor(effects.armor_pen_percent)
      if (effects.all_percent) {
        nonPassiveAtkPct += effects.all_percent / 100
        nonPassiveDefPct += effects.all_percent / 100
        nonPassiveHpPct  += effects.all_percent / 100
        nonPassiveSpdPct += effects.all_percent / 100
      }
    }
  }

  // 附灵 X_PCT 并入加法池
  nonPassiveAtkPct += awakenAtkPct
  nonPassiveDefPct += awakenDefPct
  nonPassiveHpPct  += awakenHpPct
  nonPassiveSpdPct += awakenSpdPct

  // 加法池一次乘（不含功法被动 — 由 battleEngine.applyPassive 用 _flat/_pctSum 字段并池后再乘）
  // 记录 flat 段总和供 battleEngine 重算使用
  const _flatAtk = atk, _flatDef = def, _flatHp = maxHp, _flatSpd = spd
  atk   = Math.floor(_flatAtk * (1 + nonPassiveAtkPct))
  def   = Math.floor(_flatDef * (1 + nonPassiveDefPct))
  maxHp = Math.floor(_flatHp  * (1 + nonPassiveHpPct))
  spd   = Math.floor(_flatSpd * (1 + nonPassiveSpdPct))

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
      // v3.6 DOT/反伤副属性（小数 0.05 = 5%），由 battleEngine 读取并合并到 dotAmpPct/反伤计算
      equipDotDmgPct,
      equipReflectPct,
      // v1 套装：已穿戴件数 map（如 { fire_god: 5, refresh: 3 }），由 battleEngine 解析为 active set tiers
      equipSetCounts,
      // 主武器类型（sword/blade/spear/fan）— 武器流套装（如十三枪）按此判定
      weaponType: playerWeaponType,
      // v3.7 加法池：flat 段总和 + 非功法 % 之和（小数, 0.10=10%）
      // battleEngine.applyPassive 将功法被动 % 加进同一池，重算 atk/def/hp/spd
      _flatAtk, _flatDef, _flatHp, _flatSpd,
      _pctSumAtk: nonPassiveAtkPct, _pctSumDef: nonPassiveDefPct,
      _pctSumHp: nonPassiveHpPct,   _pctSumSpd: nonPassiveSpdPct,
    } as any,
    expBonusPercent: expBonusPercent + spiritDensity + awakenExpBonus * 100 + awakenSpiritDensityBonus * 100,
    luckPercent: luck + awakenLuckBonus * 100,
  }
}

// ===== 主战斗 API =====
// batch_count: 单次请求连打 N 场（1-10）。共享一次锁/数据加载，每场独立结算事务，
//   死亡或失败立即终止 batch。前端拿到 battles[] 依次播放，全部播完才发下一批。
const BATCH_MAX = 10

export default defineEventHandler(async (event) => {
  let lockedCharId: number | null = null
  let totalLogsLen = 0
  try {
    const pool = getPool()
    const body = await readBody(event)
    const { map_id, auto_sell, auto_sell_tier, auto_sell_set_blacklist } = body
    const setBlacklist: Set<string> = new Set(Array.isArray(auto_sell_set_blacklist) ? auto_sell_set_blacklist : [])
    const batchCount = Math.max(1, Math.min(BATCH_MAX, Number(body.batch_count) || 1))
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

    // 战斗并发 & 频率限制（按整批锁一次）
    const entry = battleLock.get(char.id) || {}
    const now = Date.now()
    if (entry.inProgressSince && now - entry.inProgressSince < MAX_BATTLE_DURATION_MS * batchCount) {
      // 同 ③ 路径：把 DB 守卫到期时间和服务端当前时间一起回吐，前端用差值算剩余毫秒数避开时钟漂移
      const { rows: gRows } = await pool.query(
        `SELECT EXTRACT(EPOCH FROM battle_end_at) * 1000 AS bea_ms,
                EXTRACT(EPOCH FROM NOW()) * 1000 AS now_ms
           FROM characters WHERE id = $1`,
        [char.id]
      )
      const battleEndAt = Number(gRows[0]?.bea_ms) || 0
      const serverNow = Number(gRows[0]?.now_ms) || Date.now()
      return { code: 409, message: '上场战斗未结束，请稍候', data: { battleEndAt, serverNow } }
    }
    if (entry.cooldownUntil && now < entry.cooldownUntil) {
      return { code: 429, message: '战斗冷却中' }
    }
    // DB 持久化守卫：批次保守预占 batchCount * 15s，最后再用精确总时长覆盖
    const guardSeconds = String(batchCount * 15)
    const { rowCount: guardTaken } = await pool.query(
      `UPDATE characters
         SET battle_end_at = NOW() + ($1 || ' seconds')::INTERVAL
       WHERE id = $2
         AND (battle_end_at IS NULL OR battle_end_at <= NOW())`,
      [guardSeconds, char.id]
    )
    if (!guardTaken) {
      // 把守卫到期时间和服务端当前时间一起回吐，前端用 (battleEndAt - serverNow) 算剩余毫秒数避开时钟漂移
      const { rows: gRows } = await pool.query(
        `SELECT EXTRACT(EPOCH FROM battle_end_at) * 1000 AS bea_ms,
                EXTRACT(EPOCH FROM NOW()) * 1000 AS now_ms
           FROM characters WHERE id = $1`,
        [char.id]
      )
      const battleEndAt = Number(gRows[0]?.bea_ms) || 0
      const serverNow = Number(gRows[0]?.now_ms) || Date.now()
      return { code: 409, message: '上场战斗未结束，请稍候', data: { battleEndAt, serverNow } }
    }
    battleLock.set(char.id, { inProgressSince: now })
    lockedCharId = char.id

    // 读取装备、技能、buff、洞府（batch 内共享一次）
    const { rows: equipRows } = await pool.query('SELECT * FROM character_equipment WHERE character_id = $1', [char.id])
    const { rows: skillRows } = await pool.query(
      `SELECT cs.id, cs.character_id, cs.skill_id, cs.skill_type, cs.slot_index,
              cs.equipped, cs.created_at,
              COALESCE(csi.level, cs.level, 1) AS level
         FROM character_skills cs
         LEFT JOIN character_skill_inventory csi
                ON csi.character_id = cs.character_id AND csi.skill_id = cs.skill_id
        WHERE cs.character_id = $1 AND cs.equipped = TRUE
        ORDER BY cs.skill_type, cs.slot_index`,
      [char.id]
    )
    const { rows: buffRows } = await pool.query('SELECT * FROM character_buffs WHERE character_id = $1 AND (expire_time > NOW() OR remaining_fights > 0)', [char.id])
    const { rows: caveRows } = await pool.query('SELECT * FROM character_cave WHERE character_id = $1', [char.id])

    if (char.sect_id) {
      const { rows: sectRows } = await pool.query('SELECT level FROM sects WHERE id = $1', [char.sect_id])
      if (sectRows.length > 0) char._sectLevel = sectRows[0].level
      const { rows: sectSkillRows } = await pool.query('SELECT skill_key, level FROM sect_skills WHERE character_id = $1 AND frozen = FALSE', [char.id])
      char._sectSkills = sectSkillRows
    }

    const equippedSkills = buildEquippedSkillInfo(skillRows)

    const { rows: skillInvRows } = await pool.query(
      'SELECT skill_id, count FROM character_skill_inventory WHERE character_id = $1', [char.id]
    )
    const ownedSkillCounts: Record<string, number> = {}
    for (const row of skillInvRows) ownedSkillCounts[row.skill_id] = row.count
    for (const row of skillRows) ownedSkillCounts[row.skill_id] = (ownedSkillCounts[row.skill_id] || 0) + 1

    const avgLevel = await getTopAvgLevel()

    const battles: any[] = []
    let lastUpdatedChar: any = char

    // -------- batch 循环 --------
    for (let bi = 0; bi < batchCount; bi++) {
      // char 上次结算后字段已 Object.assign 回来，buildPlayerStats 用最新 level/realm 重算
      const { stats: playerStats, expBonusPercent, luckPercent } = buildPlayerStats(char, equipRows, buffRows, caveRows)

      // 生成怪物波次
      const isBoss = mapData.boss && Math.random() < 0.01
      const monsterList: { stats: BattlerStats; template: MonsterTemplate }[] = []
      if (isBoss && mapData.boss) {
        const template: MonsterTemplate = mapData.boss
        monsterList.push({ stats: generateMonsterStats(template), template })
      } else {
        // T1/T2: 1-2 只；T3/T4: 1-4 只；T5+: 2-4 只（其中必出 1 只 healer）
        let waveSize: number
        if (mapData.tier <= 2) waveSize = 1 + Math.floor(Math.random() * 2)
        else if (mapData.tier <= 4) waveSize = 1 + Math.floor(Math.random() * 4)
        else waveSize = 2 + Math.floor(Math.random() * 3)

        const useHealer = mapData.tier >= 5
        const normalCount = useHealer ? waveSize - 1 : waveSize
        for (let i = 0; i < normalCount; i++) {
          const m = mapData.monsters[rand(0, mapData.monsters.length - 1)]
          const template: MonsterTemplate = m
          monsterList.push({ stats: generateMonsterStats(template), template })
        }
        if (useHealer) {
          // healer 战力按本 wave 普通怪平均战力，元素跟随地图主属性
          const avgPower = monsterList.length > 0
            ? Math.floor(monsterList.reduce((s, it) => s + it.template.power, 0) / monsterList.length)
            : (mapData.monsters[0]?.power || 100)
          const elem = mapData.monsters[0]?.element ?? null
          const healerTpl = makeHealerTemplate(mapData.tier, elem, avgPower)
          monsterList.push({ stats: generateMonsterStats(healerTpl), template: healerTpl })
        }
      }
      if (mapData.tier === 2) {
        for (const it of monsterList) {
          it.stats.atk = Math.floor(it.stats.atk * 0.80)
          it.stats.maxHp = Math.floor(it.stats.maxHp * 0.90)
          it.stats.hp = it.stats.maxHp
        }
      } else if (mapData.tier >= 3) {
        for (const it of monsterList) {
          it.stats.atk = Math.floor(it.stats.atk * 0.85)
          it.stats.maxHp = Math.floor(it.stats.maxHp * 0.95)
          it.stats.hp = it.stats.maxHp
        }
      }

      const result = runWaveBattle(playerStats, monsterList, equippedSkills)

      const expMul = 1 + (expBonusPercent || 0) / 100
      const catchUpMul = getCatchUpMultiplier(char.level || 1, avgLevel)
      // v3.4.3: 历练经验整体 ×0.7（修为/等级双经验同步缩）
      const totalExp = Math.floor(result.totalExp * expMul * catchUpMul * 0.7)
      const stoneTierBonus = mapData.tier <= 3 ? 1.2 : 1.0
      const totalStone = Math.floor(result.totalStone * stoneTierBonus)
      const levelExp = totalExp

      if (result.won && catchUpMul < 1.0 && result.totalExp > 0) {
        const diff = Math.floor((char.level || 1) - avgLevel)
        const pct = Math.round(catchUpMul * 100)
        result.logs.push({
          turn: 0,
          text: `[追赶机制] 你已领先榜单前 30 平均等级 ${diff} 级，本场修为与经验获取 ${pct}%`,
          type: 'system',
          playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0,
        })
      }

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
        const stoneDrop = generateEnhanceStoneDrop(tier, ib, luckMul)
        if (stoneDrop) allDrops.push({ type: 'stone', data: { stone_id: stoneDrop, tier } })
      }

      // 单场结算事务（每场独立 BEGIN/COMMIT，失败不影响已完成场次）
      // 装备实际入库的名字（不含自动出售/背包满转售的），返给前端 sessionDrops 用
      const keptDropNames: string[] = []
      let autoSellIncomeOut = 0
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        if (result.won) {
          const { rows: fresh } = await client.query(
            'SELECT cultivation_exp, realm_tier, realm_stage, level_exp, level FROM characters WHERE id = $1 FOR UPDATE',
            [char.id]
          )
          const baseline = fresh[0] || char

          const newExpTotal = Number(baseline.cultivation_exp || 0) + totalExp
          const br = applyCultivationExp(newExpTotal, baseline.realm_tier || 1, baseline.realm_stage || 1)
          await client.query(
            `UPDATE characters SET cultivation_exp = $1, spirit_stone = spirit_stone + $2, level_exp = level_exp + $3, last_online = NOW() WHERE id = $4`,
            [br.cultivation_exp, totalStone, levelExp, char.id]
          )

          const lvResult = applyLevelExp(Number(baseline.level_exp || 0) + levelExp, baseline.level || 1)
          if (lvResult.levelUps > 0) {
            result.logs.push({ turn: 0, text: `等级提升!你已升至【Lv.${lvResult.level}】`, type: 'system', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
            await client.query('UPDATE characters SET level = $1, level_exp = $2 WHERE id = $3', [lvResult.level, lvResult.level_exp, char.id])
          }

          const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red']
          const autoSellIdx = auto_sell ? RARITY_ORDER.indexOf(auto_sell) : -1
          const autoSellTierLimit = Number(auto_sell_tier) || 0
          let autoSellIncome = 0

          // 背包容量：本批掉落入库前先取一次基线，后续 INSERT 用本地计数累加避免每件再 SELECT
          const { rows: bagCountRows } = await client.query(
            'SELECT COUNT(*)::int AS cnt FROM character_equipment WHERE character_id = $1 AND slot IS NULL',
            [char.id]
          )
          let bagCount: number = bagCountRows[0]?.cnt || 0

          for (const drop of allDrops) {
            if (drop.type === 'equipment') {
              const d = drop.data
              const itemIdx = RARITY_ORDER.indexOf(d.rarity)
              const itemTier = d.tier || 1
              // 自动出售默认跳过套装件（玩家不需要手动锁定每件套装；批量出售保留 locked 字段控制）
              // 但若该套装在黑名单内（玩家明确不想要），则跟普通装备一样按品质/阶位规则判定
              const isProtectedSet = !!d.set_id && !setBlacklist.has(d.set_id)
              if (!isProtectedSet && autoSellIdx >= 0 && itemIdx <= autoSellIdx && (autoSellTierLimit === 0 || itemTier <= autoSellTierLimit)) {
                const price = Math.floor((EQUIP_SELL_PRICES[d.rarity] || 10) * (d.tier || 1))
                autoSellIncome += price
                result.logs.push({ turn: 0, text: `自动出售【${d.name}】获得 ${price} 灵石`, type: 'system', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
                continue
              }
              // 背包满（含套装件）→ 转灵石返还
              if (bagCount >= EQUIP_BAG_LIMIT) {
                const price = Math.floor((EQUIP_SELL_PRICES[d.rarity] || 10) * (d.tier || 1))
                autoSellIncome += price
                result.logs.push({ turn: 0, text: `背包已满，自动出售【${d.name}】获得 ${price} 灵石`, type: 'system', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
                continue
              }
              await client.query(
                `INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, base_slot, req_level, enhance_level)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
                [char.id, d.name, d.rarity, d.primary_stat, d.primary_value, d.sub_stats, d.set_id, d.tier, d.weapon_type, d.base_slot, d.req_level]
              )
              bagCount++
              keptDropNames.push(d.name)
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
            if (drop.type === 'stone') {
              const s = drop.data
              await client.query(
                `INSERT INTO character_pills (character_id, pill_id, count, quality_factor)
                 VALUES ($1, $2, 1, 1.0)
                 ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
                [char.id, s.stone_id]
              )
              result.logs.push({ turn: 0, text: `掉落了【强化石·T${s.tier}】!`, type: 'loot', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
            }
          }

          if (autoSellIncome > 0) {
            await client.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [autoSellIncome, char.id])
          }
          autoSellIncomeOut = autoSellIncome
        } else if (!result.won) {
          await client.query(
            `UPDATE characters SET
               cultivation_exp = GREATEST(0, cultivation_exp - FLOOR(cultivation_exp * 0.01)),
               level_exp = GREATEST(0, level_exp - FLOOR(level_exp * 0.01)),
               last_online = NOW()
             WHERE id = $1`,
            [char.id]
          )
        }

        await client.query('COMMIT')
      } catch (settleErr) {
        await client.query('ROLLBACK').catch(() => {})
        throw settleErr
      } finally {
        client.release()
      }

      if (result.won) {
        await updateSectDailyTask(char.id, 'battle', 1)
        await updateSectWeeklyTaskByCharId(char.id, 'weekly_battle', result.monstersKilled.length)
        const hasElite = result.monstersKilled.some(m => m.template.role === 'boss')
        if (hasElite) await updateSectDailyTask(char.id, 'elite', 1)

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

        const bs = result.stats
        if (bs?.elementAdvantageHit) checkAchievements(char.id, 'element_win', 1).catch(() => {})
        if (bs?.lifestealFullRecovery) checkAchievements(char.id, 'lifesteal_full', 1).catch(() => {})
        if (bs && bs.playerCritCount >= 5) checkAchievements(char.id, 'crit_storm', 1).catch(() => {})
        if (bs && bs.playerHitsTaken >= 20) checkAchievements(char.id, 'tank_survive', 1).catch(() => {})
        if (bs?.bossKilledByTurn3) checkAchievements(char.id, 'fast_boss_kill', 1).catch(() => {})
      }

      // 拉一次本场结算后的角色，作为下一场 buildPlayerStats 输入 + 末态返回
      const { rows: updatedRows } = await pool.query('SELECT * FROM characters WHERE id = $1', [char.id])
      lastUpdatedChar = updatedRows[0]
      // 把 DB 字段 patch 回 char（保留临时挂载的 _sectLevel/_sectSkills，避免丢失）
      Object.assign(char, lastUpdatedChar)

      // 等级成就（基于最新 level）
      if (result.won) {
        checkAchievements(char.id, 'char_level', char.level || 1).catch(() => {})
      }

      totalLogsLen += Array.isArray(result.logs) ? result.logs.length : 0

      const monsterNames = monsterList.map(m => m.stats.name)
      const monstersInfo = monsterList.map(m => ({
        name: m.stats.name,
        element: m.template.element,
        power: m.template.power,
        maxHp: m.stats.maxHp,
        atk: m.stats.atk,
        def: m.stats.def,
        spd: m.stats.spd,
        crit_rate: m.stats.crit_rate,
        crit_dmg: m.stats.crit_dmg,
        dodge: m.stats.dodge,
        lifesteal: m.stats.lifesteal,
        armorPen: m.stats.armorPen || 0,
        accuracy: m.stats.accuracy || 0,
        resists: m.stats.resists || null,
        role: m.template.role,
        skills: buildMonsterSkillDescriptions(m.template),
      }))
      // monsterInfo 保留为 monstersInfo[0] 的别名兜底旧前端
      const monsterInfo = monstersInfo[0] || null

      // 装备只算实际入库的（自动出售/背包满转售的不进 sessionDrops，但灵石进 sessionStone）
      const skillDropNames = allDrops
        .filter(d => d.type === 'skill')
        .map(d => SKILL_MAP[d.data]?.name || d.data)
      battles.push({
        won: result.won,
        expGained: totalExp,
        stoneGained: totalStone,
        autoSellGained: autoSellIncomeOut,
        levelExpGained: levelExp,
        monsterNames,
        monstersMaxHp: monsterList.map(m => m.stats.maxHp),
        monsterInfo,
        monstersInfo,
        logs: result.logs,
        drops: [...keptDropNames, ...skillDropNames],
      })

      if (!result.won) break
    }

    // 客户端"每条日志间隔 1s + 第一条立即播 + 场与场之间无间隔"，
    // K 场总日志 totalLogsLen 条 → 真实墙钟 ≈ totalLogsLen - K 秒。
    // battle_end_at 必须 ≤ 客户端真实播放时长，否则下一批 scheduleFight
    // 在播完瞬间发请求会撞到守卫 → 连续 409 "上场战斗未结束"。
    const guardSeconds2 = Math.max(1, totalLogsLen - battles.length)
    // RETURNING 同步回吐 battle_end_at 和服务端 NOW()：前端用 (battleEndAt - serverNow) 算剩余毫秒数，
    // 避免基于 totalLogsLen 估算 + Date.now() 锚点导致的时钟/网络偏差累积撞 409
    const { rows: gRows } = await pool.query(
      `UPDATE characters SET battle_end_at = NOW() + ($1 || ' seconds')::INTERVAL
        WHERE id = $2
        RETURNING EXTRACT(EPOCH FROM battle_end_at) * 1000 AS bea_ms,
                  EXTRACT(EPOCH FROM NOW()) * 1000 AS now_ms`,
      [String(guardSeconds2), char.id]
    )
    const battleEndAt = Number(gRows[0]?.bea_ms) || 0
    const serverNow = Number(gRows[0]?.now_ms) || Date.now()

    return {
      code: 200,
      data: {
        battles,
        character: lastUpdatedChar,
        battleEndAt,
        serverNow,
      },
    }
  } catch (error: any) {
    console.error('战斗失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    if (lockedCharId != null) {
      battleLock.set(lockedCharId, { cooldownUntil: Date.now() + BATTLE_COOLDOWN_MS })
    }
  }
})
