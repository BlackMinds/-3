// 宗门系统静态数据

// ===== 宗门等级 =====
export interface SectLevelConfig {
  level: number;
  upgradeCost: number;  // 升级费用(灵石)
  maxMembers: number;
  atkBonus: number;     // 攻击加成(百分比)
  defBonus: number;     // 防御加成
  expBonus: number;     // 修为加成
  shopUnlock: string;   // 商店解锁档次
}

export const SECT_LEVELS: SectLevelConfig[] = [
  { level: 1,  upgradeCost: 0,             maxMembers: 10, atkBonus: 0.02, defBonus: 0.02, expBonus: 0.05, shopUnlock: 'basic' },
  { level: 2,  upgradeCost: 500000,        maxMembers: 15, atkBonus: 0.04, defBonus: 0.04, expBonus: 0.08, shopUnlock: 'basic' },
  { level: 3,  upgradeCost: 1500000,       maxMembers: 20, atkBonus: 0.06, defBonus: 0.06, expBonus: 0.12, shopUnlock: 'advanced' },
  { level: 4,  upgradeCost: 5000000,       maxMembers: 25, atkBonus: 0.08, defBonus: 0.08, expBonus: 0.16, shopUnlock: 'advanced' },
  { level: 5,  upgradeCost: 15000000,      maxMembers: 30, atkBonus: 0.10, defBonus: 0.10, expBonus: 0.20, shopUnlock: 'rare' },
  { level: 6,  upgradeCost: 50000000,      maxMembers: 35, atkBonus: 0.13, defBonus: 0.13, expBonus: 0.25, shopUnlock: 'set' },
  { level: 7,  upgradeCost: 150000000,     maxMembers: 40, atkBonus: 0.16, defBonus: 0.16, expBonus: 0.30, shopUnlock: 'set' },
  { level: 8,  upgradeCost: 500000000,     maxMembers: 45, atkBonus: 0.20, defBonus: 0.20, expBonus: 0.36, shopUnlock: 'legend' },
  { level: 9,  upgradeCost: 1500000000,    maxMembers: 48, atkBonus: 0.25, defBonus: 0.25, expBonus: 0.42, shopUnlock: 'legend' },
  { level: 10, upgradeCost: 5000000000,    maxMembers: 50, atkBonus: 0.30, defBonus: 0.30, expBonus: 0.50, shopUnlock: 'supreme' },
];

export function getSectLevelConfig(level: number): SectLevelConfig {
  return SECT_LEVELS[Math.min(level, 10) - 1] || SECT_LEVELS[0];
}

// ===== 宗门Boss =====
export interface SectBossConfig {
  key: string;
  name: string;
  requiredSectLevel: number;
  startCost: number;      // 宗门资金消耗
  power: number;
  totalHp: number;
  element: string | null;
  maxTurns: number;       // 每人回合上限
  rewardBase: number;     // 基础灵石奖励倍率
}

// v2.0 装备驱动型改版: Boss power/HP 按玩家新战力同步缩放
export const SECT_BOSSES: SectBossConfig[] = [
  { key: 'tiger',  name: '妖兽·裂天虎',     requiredSectLevel: 1, startCost: 20000,    power: 2000,      totalHp: 66000,        element: 'metal', maxTurns: 30, rewardBase: 1 },
  { key: 'blood',  name: '魔修·血煞尊者',   requiredSectLevel: 3, startCost: 80000,    power: 10000,     totalHp: 300000,       element: 'fire',  maxTurns: 30, rewardBase: 3 },
  { key: 'dragon', name: '古妖·九幽蛟龙',   requiredSectLevel: 5, startCost: 400000,   power: 40000,     totalHp: 1500000,      element: 'water', maxTurns: 40, rewardBase: 5 },
  { key: 'demon',  name: '天魔·灭世魔君',   requiredSectLevel: 7, startCost: 2000000,  power: 200000,    totalHp: 6000000,      element: null,    maxTurns: 40, rewardBase: 7 },
  { key: 'chaos',  name: '远古·混沌兽',     requiredSectLevel: 9, startCost: 8000000,  power: 1000000,   totalHp: 30000000,     element: null,    maxTurns: 50, rewardBase: 9 },
];

export function getSectBoss(key: string): SectBossConfig | undefined {
  return SECT_BOSSES.find(b => b.key === key);
}

// ===== 宗门商店 =====
export interface ShopItem {
  key: string;
  name: string;
  description: string;
  cost: number;           // 贡献度价格
  weeklyLimit: number;
  requiredSectLevel: number;
  category: 'basic' | 'advanced' | 'rare' | 'set' | 'legend' | 'supreme';
  effect: ShopItemEffect;
}

export type ShopItemEffect =
  | { type: 'cultivation_exp'; value: number }
  | { type: 'spirit_stone'; value: number }
  | { type: 'enhance_protect'; value: number }
  | { type: 'herb_pack'; minQuality: string; count: number }
  | { type: 'breakthrough_boost'; value: number }
  | { type: 'reroll_sub_stat'; value: number }
  | { type: 'skill_page'; quality: string }
  | { type: 'enhance_guarantee'; maxLevel: number }
  | { type: 'set_fragment'; value: number }
  | { type: 'reset_root'; value: number }
  | { type: 'universal_skill_page'; value: number }
  | { type: 'random_equip_box'; minRarity: string }
  | { type: 'equip_upgrade'; value: number }
  | { type: 'permanent_stat'; value: number }
  | { type: 'unlock_pill_recipe'; pill_id: string }


export const SHOP_ITEMS: ShopItem[] = [
  // 基础 (宗门1级)
  { key: 'sect_exp_pill',      name: '宗门聚灵丹',   description: '修为+2000',              cost: 1000,  weeklyLimit: 5,  requiredSectLevel: 1, category: 'basic', effect: { type: 'cultivation_exp', value: 2000 } },
  { key: 'sect_stone_bag',     name: '宗门灵石袋',   description: '获得50,000灵石',          cost: 2000,  weeklyLimit: 3,  requiredSectLevel: 1, category: 'basic', effect: { type: 'spirit_stone', value: 50000 } },
  { key: 'enhance_protect',    name: '强化保护符',   description: '强化失败不退级(一次性)',    cost: 2000,  weeklyLimit: 3,  requiredSectLevel: 1, category: 'basic', effect: { type: 'enhance_protect', value: 1 } },
  { key: 'herb_seed_pack',     name: '灵草种子礼包', description: '随机3种灵草(蓝品质+)',     cost: 1500,  weeklyLimit: 3,  requiredSectLevel: 1, category: 'basic', effect: { type: 'herb_pack', minQuality: 'blue', count: 3 } },

  // 进阶 (宗门3级)
  { key: 'breakthrough_pill',  name: '宗门突破丹',   description: '突破成功率+20%(一次性)',   cost: 5000,  weeklyLimit: 2,  requiredSectLevel: 3, category: 'advanced', effect: { type: 'breakthrough_boost', value: 20 } },
  { key: 'high_herb_pack',     name: '高级灵草包',   description: '随机3种灵草(紫品质+)',     cost: 4000,  weeklyLimit: 2,  requiredSectLevel: 3, category: 'advanced', effect: { type: 'herb_pack', minQuality: 'purple', count: 3 } },
  { key: 'reroll_sub',         name: '装备鉴定符',   description: '重随装备1条副属性',        cost: 3000,  weeklyLimit: 3,  requiredSectLevel: 3, category: 'advanced', effect: { type: 'reroll_sub_stat', value: 1 } },
  { key: 'recipe_crit',        name: '破妄丹方·残卷', description: '永久解锁【破妄丹】炼制配方', cost: 3000,  weeklyLimit: 1, requiredSectLevel: 3, category: 'advanced', effect: { type: 'unlock_pill_recipe', pill_id: 'crit_pill_1' } },

  // 稀有 (宗门5级)
  { key: 'sect_skill_page',    name: '宗门秘法残页', description: '随机地品功法残页x1',       cost: 10000, weeklyLimit: 1,  requiredSectLevel: 5, category: 'rare', effect: { type: 'skill_page', quality: 'purple' } },
  { key: 'premium_herb_pack',  name: '仙品灵草包',   description: '随机2种灵草(金品质+)',     cost: 8000,  weeklyLimit: 1,  requiredSectLevel: 5, category: 'rare', effect: { type: 'herb_pack', minQuality: 'gold', count: 2 } },
  { key: 'enhance_master',     name: '强化大师符',   description: '+7以下强化必成(一次性)',    cost: 6000,  weeklyLimit: 1,  requiredSectLevel: 5, category: 'rare', effect: { type: 'enhance_guarantee', maxLevel: 6 } },
  { key: 'recipe_elite_atk',   name: '大聚灵丹方',   description: '永久解锁【大聚灵丹】炼制配方', cost: 8000, weeklyLimit: 1, requiredSectLevel: 5, category: 'rare', effect: { type: 'unlock_pill_recipe', pill_id: 'elite_atk_pill' } },
  { key: 'recipe_elite_def',   name: '大铁皮丹方',   description: '永久解锁【大铁皮丹】炼制配方', cost: 8000, weeklyLimit: 1, requiredSectLevel: 5, category: 'rare', effect: { type: 'unlock_pill_recipe', pill_id: 'elite_def_pill' } },
  { key: 'recipe_elite_hp',    name: '大培元丹方',   description: '永久解锁【大培元丹】炼制配方', cost: 8000, weeklyLimit: 1, requiredSectLevel: 5, category: 'rare', effect: { type: 'unlock_pill_recipe', pill_id: 'elite_hp_pill' } },

  // 宗门套装 (宗门6级)
  { key: 'set_fragment',       name: '宗门套装碎片', description: '收集5个合成宗门套装部件',  cost: 15000, weeklyLimit: 1,  requiredSectLevel: 6, category: 'set', effect: { type: 'set_fragment', value: 1 } },
  { key: 'recipe_full',        name: '天元丹方',     description: '永久解锁【天元丹】炼制配方',    cost: 15000, weeklyLimit: 1, requiredSectLevel: 6, category: 'set', effect: { type: 'unlock_pill_recipe', pill_id: 'full_pill_1' } },

  // 传说 (宗门8级)
  { key: 'reset_root',         name: '天道洗髓丹',   description: '重置灵根属性',             cost: 30000, weeklyLimit: 1,  requiredSectLevel: 8, category: 'legend', effect: { type: 'reset_root', value: 1 } },
  { key: 'universal_page',     name: '万能功法残页', description: '可代替任意功法残页x1',      cost: 20000, weeklyLimit: 1,  requiredSectLevel: 8, category: 'legend', effect: { type: 'universal_skill_page', value: 1 } },
  { key: 'premium_equip_box',  name: '极品装备宝箱', description: '随机金品/红品装备x1',      cost: 25000, weeklyLimit: 1,  requiredSectLevel: 8, category: 'legend', effect: { type: 'random_equip_box', minRarity: 'gold' } },

  // 至尊 (宗门10级)
  { key: 'equip_upgrade',      name: '太古精魂',     description: '装备升品(紫→金,金→红)',    cost: 50000, weeklyLimit: 1,  requiredSectLevel: 10, category: 'supreme', effect: { type: 'equip_upgrade', value: 1 } },
  { key: 'permanent_stat',     name: '道果结晶',     description: '永久属性+1%(攻/防/血三选一)', cost: 80000, weeklyLimit: 1,  requiredSectLevel: 10, category: 'supreme', effect: { type: 'permanent_stat', value: 1 } },
];

export function getAvailableShopItems(sectLevel: number): ShopItem[] {
  return SHOP_ITEMS.filter(item => sectLevel >= item.requiredSectLevel);
}

// ===== 宗门功法 =====
export interface SectSkillConfig {
  key: string;
  name: string;
  description: string;
  requiredSectLevel: number;
  learnCost: number;        // 学习贡献度
  type: 'passive';
  effects: Record<string, number>;  // Lv1效果 (每级+10%)
}

export const SECT_SKILLS: SectSkillConfig[] = [
  { key: 'sect_spirit',   name: '宗门心法·凝神', description: '神识提升',     requiredSectLevel: 2, learnCost: 5000,  type: 'passive', effects: { spirit_percent: 5 } },
  { key: 'sect_hp',       name: '宗门心法·固体', description: '气血上限提升', requiredSectLevel: 4, learnCost: 15000, type: 'passive', effects: { hp_percent: 8 } },
  { key: 'sect_armor_pen',name: '宗门心法·破军', description: '破甲提升',     requiredSectLevel: 6, learnCost: 30000, type: 'passive', effects: { armor_pen_percent: 10 } },
  { key: 'sect_all',      name: '宗门心法·天罡', description: '全属性提升',   requiredSectLevel: 8, learnCost: 50000, type: 'passive', effects: { all_percent: 5 } },
];

export function getSectSkill(key: string): SectSkillConfig | undefined {
  return SECT_SKILLS.find(s => s.key === key);
}

// 计算宗门功法等级效果
export function calcSectSkillEffect(skill: SectSkillConfig, level: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(skill.effects)) {
    result[k] = v * (1 + (level - 1) * 0.10);  // 每级+10%
  }
  return result;
}

// ===== 每日任务类型 =====
export interface DailyTaskType {
  type: string;
  name: string;
  description: string;
  baseTarget: number;
  baseContribution: number;
  extraReward?: { type: string; value: number };
}

export const DAILY_TASK_TYPES: DailyTaskType[] = [
  { type: 'battle',   name: '历练修行', description: '完成N场战斗',       baseTarget: 10,  baseContribution: 500,  extraReward: { type: 'spirit_stone', value: 1000 } },
  { type: 'cultivate',name: '闭关修炼', description: '闭关N次',           baseTarget: 2,   baseContribution: 600,  extraReward: { type: 'cultivation_exp', value: 500 } },
  { type: 'pill',     name: '炼丹贡献', description: '炼制N颗丹药',       baseTarget: 2,   baseContribution: 1000, extraReward: { type: 'pill', value: 1 } },
  { type: 'sell',     name: '装备回收', description: '出售N件装备',        baseTarget: 5,   baseContribution: 500,  extraReward: { type: 'spirit_stone', value: 2000 } },
  { type: 'enhance',  name: '强化武装', description: '强化装备N次',        baseTarget: 3,   baseContribution: 700,  extraReward: { type: 'spirit_stone', value: 1500 } },
  { type: 'elite',    name: '击杀精英', description: '击杀N只精英怪/Boss', baseTarget: 1,   baseContribution: 1500 },
  { type: 'cave',     name: '洞府建设', description: '领取洞府产出N次',    baseTarget: 3,   baseContribution: 600,  extraReward: { type: 'spirit_stone', value: 1500 } },
];

// ===== 周常任务类型 =====
export interface WeeklyTaskType {
  type: string;
  name: string;
  description: string;
  baseTarget: number;
  baseContribution: number;
  allReward: { type: string; value: number };
}

export const WEEKLY_TASK_TYPES: WeeklyTaskType[] = [
  { type: 'weekly_battle', name: '万妖讨伐', description: '全宗门累计击杀50000只怪', baseTarget: 50000,  baseContribution: 5000,  allReward: { type: 'spirit_stone', value: 10000 } },
  { type: 'weekly_donate', name: '资源征集', description: '全宗门累计捐献50万灵石', baseTarget: 500000, baseContribution: 8000,  allReward: { type: 'skill_page', value: 1 } },
  { type: 'weekly_pill',   name: '炼丹大会', description: '全宗门累计炼丹2000次',   baseTarget: 2000,   baseContribution: 6000,  allReward: { type: 'pill', value: 2 } },
  { type: 'weekly_enhance',name: '强化竞赛', description: '全宗门累计强化1500次',   baseTarget: 1500,   baseContribution: 5000,  allReward: { type: 'gold_equip', value: 1 } },
];

// ===== 职位权限 =====
export const ROLE_HIERARCHY: Record<string, number> = {
  leader: 5,
  vice_leader: 4,
  elder: 3,
  inner: 2,
  outer: 1,
};

export const ROLE_NAMES: Record<string, string> = {
  leader: '宗主',
  vice_leader: '副宗主',
  elder: '长老',
  inner: '内门弟子',
  outer: '外门弟子',
};

export const ROLE_MAX_COUNT: Record<string, number> = {
  leader: 1,
  vice_leader: 1,
  elder: 3,
  inner: -1,  // unlimited
  outer: -1,
};

export const ROLE_CONTRIBUTION_REQ: Record<string, number> = {
  leader: 0,
  vice_leader: 50000,
  elder: 20000,
  inner: 5000,
  outer: 0,
};

// ===== 创建条件 =====
export const SECT_CREATE_COST = 100000;
export const SECT_CREATE_MIN_REALM_TIER = 3;  // 金丹
export const SECT_CREATE_MIN_LEVEL = 50;
export const SECT_JOIN_MIN_LEVEL = 15; // 10 → 15: 让玩家先完整体验装备/功法系统再接入宗门
export const SECT_QUIT_COOLDOWN_HOURS = 24;

// 每日捐献上限 = 100,000 * 宗门等级
export function getDailyDonateLimit(sectLevel: number): number {
  return 100000 * sectLevel;
}

// 签到贡献 = 100 + 宗门等级 * 20 + 角色境界 * 30
// 高境界玩家给更多贡献（鼓励长线角色）
export function getSignInContribution(sectLevel: number, realmTier: number = 0): number {
  return 100 + sectLevel * 20 + realmTier * 30;
}
