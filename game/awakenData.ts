// 装备附灵系统：效果池定义 + 随机生成
// 作用于 weapon / armor / pendant / ring 四种槽位
// 蓝+ 品装备可附灵；数值按品质取档（blue/purple/gold/red）
//
// ring 池效果方向：主修功法增幅（与其他三槽通用 buff 互补）
//   通用向（4条）：心法贯通 / 主修锋锐 / 主修破玄 / 主修噬灵
//   属性匹配向（5条）：主修属性=金/木/水/火/土 时才触发
//   机制向（3条）：紫电连华 / 心剑回响 / 灵戒裂魂

export type AwakenRarity = 'blue' | 'purple' | 'gold' | 'red';
export type AwakenElement = 'metal' | 'wood' | 'water' | 'fire' | 'earth';

export interface AwakenTiers {
  blue: number;
  purple: number;
  gold: number;
  red: number;
}

export interface AwakenDef {
  id: string;
  name: string;
  slot: 'weapon' | 'armor' | 'pendant' | 'ring';
  stat: string;
  tiers: AwakenTiers;
  /** 主修属性匹配条件（仅 ring 池用）；当玩家主修功法元素与该字段匹配时才生效 */
  requireElement?: AwakenElement;
  desc: (value: number, meta?: any) => string;
}

export interface AwakenEffect {
  id: string;
  name: string;
  stat: string;
  value: number;
  meta?: Record<string, any> | null;
}

// ============ 兵器（13 条 / 输出向）============
const WEAPON_POOL: AwakenDef[] = [
  { id: 'aw_bloodlust', name: '嗜血', slot: 'weapon', stat: 'lifesteal',
    // v3.4: tiers -50%
    tiers: { blue: 0.015, purple: 0.025, gold: 0.035, red: 0.05 },
    desc: (v) => `攻击吸血 +${(v * 100).toFixed(1)}%` },
  { id: 'aw_soulburn', name: '焚魂', slot: 'weapon', stat: 'burnOnHitChance',
    tiers: { blue: 0.08, purple: 0.12, gold: 0.18, red: 0.25 },
    desc: (v) => `命中时 ${(v * 100).toFixed(0)}% 概率灼烧 2 回合` },
  { id: 'aw_venomfang', name: '淬毒', slot: 'weapon', stat: 'poisonOnHitChance',
    tiers: { blue: 0.08, purple: 0.12, gold: 0.18, red: 0.25 },
    desc: (v) => `命中时 ${(v * 100).toFixed(0)}% 概率中毒 2 回合` },
  { id: 'aw_bloodrend', name: '裂魂', slot: 'weapon', stat: 'bleedOnHitChance',
    tiers: { blue: 0.08, purple: 0.12, gold: 0.18, red: 0.25 },
    desc: (v) => `命中时 ${(v * 100).toFixed(0)}% 概率流血 2 回合` },
  { id: 'aw_keen', name: '锋锐', slot: 'weapon', stat: 'critRate',
    tiers: { blue: 0.03, purple: 0.05, gold: 0.08, red: 0.12 },
    desc: (v) => `暴击率 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_shatter', name: '破军', slot: 'weapon', stat: 'atkPct',
    tiers: { blue: 0.05, purple: 0.08, gold: 0.12, red: 0.18 },
    desc: (v) => `攻击 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_frenzy', name: '狂怒', slot: 'weapon', stat: 'frenzyOpening',
    tiers: { blue: 0.12, purple: 0.20, gold: 0.30, red: 0.45 },
    desc: (v) => `开场 4 回合攻击 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_pierce', name: '破甲', slot: 'weapon', stat: 'armorPenPct',
    tiers: { blue: 0.05, purple: 0.08, gold: 0.12, red: 0.18 },
    desc: (v) => `无视目标 ${(v * 100).toFixed(0)}% 防御` },
  { id: 'aw_execute', name: '斩杀', slot: 'weapon', stat: 'executeBonus',
    tiers: { blue: 0.15, purple: 0.25, gold: 0.40, red: 0.60 },
    desc: (v) => `目标气血 <30% 时伤害 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_wrath', name: '逆鳞', slot: 'weapon', stat: 'lowHpAtkBonus',
    tiers: { blue: 0.10, purple: 0.18, gold: 0.28, red: 0.40 },
    desc: (v) => `自身气血 <50% 时攻击 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_five_elements', name: '五行', slot: 'weapon', stat: 'ELEMENT_DMG_PCT',
    tiers: { blue: 0.08, purple: 0.13, gold: 0.18, red: 0.25 },
    desc: (v, m) => `${ELEM_NAME[m?.element] || ''}系伤害 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_chain', name: '连击', slot: 'weapon', stat: 'chainAttackChance',
    tiers: { blue: 0.05, purple: 0.08, gold: 0.12, red: 0.18 },
    desc: (v) => `普攻 ${(v * 100).toFixed(0)}% 概率再打 1 次（60% 伤害）` },
  { id: 'aw_crit_bonus', name: '噬心', slot: 'weapon', stat: 'critDmg',
    tiers: { blue: 0.10, purple: 0.18, gold: 0.28, red: 0.40 },
    desc: (v) => `暴击伤害 +${(v * 100).toFixed(0)}%` },
];

// ============ 法袍（13 条 / 生存向）============
const ARMOR_POOL: AwakenDef[] = [
  { id: 'aw_adamant', name: '金刚', slot: 'armor', stat: 'defPct',
    tiers: { blue: 0.06, purple: 0.10, gold: 0.15, red: 0.22 },
    desc: (v) => `防御 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_bastion', name: '磐石', slot: 'armor', stat: 'hpPct',
    tiers: { blue: 0.06, purple: 0.10, gold: 0.15, red: 0.22 },
    desc: (v) => `气血 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_thorns', name: '荆棘', slot: 'armor', stat: 'reflectOnCrit',
    tiers: { blue: 0.15, purple: 0.25, gold: 0.35, red: 0.50 },
    desc: (v) => `受暴击时 ${(v * 100).toFixed(0)}% 反弹伤害` },
  { id: 'aw_venomshell', name: '毒刺甲', slot: 'armor', stat: 'poisonOnHitTaken',
    tiers: { blue: 0.10, purple: 0.15, gold: 0.20, red: 0.30 },
    desc: (v) => `受击时 ${(v * 100).toFixed(0)}% 概率使对方中毒` },
  { id: 'aw_flameward', name: '烈焰甲', slot: 'armor', stat: 'burnOnHitTaken',
    tiers: { blue: 0.10, purple: 0.15, gold: 0.20, red: 0.30 },
    desc: (v) => `受击时 ${(v * 100).toFixed(0)}% 概率使对方灼烧` },
  { id: 'aw_evasion', name: '疾影', slot: 'armor', stat: 'dodge',
    // v3.4: tiers -50%
    tiers: { blue: 0.015, purple: 0.025, gold: 0.035, red: 0.05 },
    desc: (v) => `闪避 +${(v * 100).toFixed(1)}%` },
  { id: 'aw_regen', name: '回春', slot: 'armor', stat: 'regenPerTurn',
    tiers: { blue: 0.02, purple: 0.03, gold: 0.05, red: 0.07 },
    desc: (v) => `每回合回复 ${(v * 100).toFixed(0)}% 最大气血` },
  { id: 'aw_mitigation', name: '护佑', slot: 'armor', stat: 'damageReduction',
    tiers: { blue: 0.03, purple: 0.05, gold: 0.08, red: 0.10 },
    desc: (v) => `受到伤害减免 ${(v * 100).toFixed(0)}%` },
  { id: 'aw_unyield', name: '不屈', slot: 'armor', stat: 'lowHpDefBonus',
    tiers: { blue: 0.15, purple: 0.25, gold: 0.40, red: 0.60 },
    desc: (v) => `自身气血 <30% 时防御 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_free', name: '脱困', slot: 'armor', stat: 'ctrlResist',
    tiers: { blue: 0.08, purple: 0.15, gold: 0.22, red: 0.30 },
    desc: (v) => `控制抗性 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_cleanse', name: '洗髓', slot: 'armor', stat: 'cleanseInterval',
    tiers: { blue: 6, purple: 5, gold: 4, red: 3 },
    desc: (v) => `每 ${v} 回合清除 1 个减益` },
  { id: 'aw_hexward', name: '无相', slot: 'armor', stat: 'allResistBonus',
    tiers: { blue: 0.03, purple: 0.05, gold: 0.07, red: 0.10 },
    desc: (v) => `五系抗性 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_crit_shield', name: '金钟罩', slot: 'armor', stat: 'critTakenReduction',
    tiers: { blue: 0.10, purple: 0.18, gold: 0.25, red: 0.35 },
    desc: (v) => `受暴击时伤害再减 ${(v * 100).toFixed(0)}%` },
];

// ============ 灵佩（12 条 / 辅助向）============
const PENDANT_POOL: AwakenDef[] = [
  { id: 'aw_swift', name: '疾风', slot: 'pendant', stat: 'spdPct',
    tiers: { blue: 0.06, purple: 0.10, gold: 0.15, red: 0.22 },
    desc: (v) => `身法 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_doom', name: '玄冥', slot: 'pendant', stat: 'critDmg',
    // v3.4: red 60→50 (-10pp); 戒指改 CRIT_DMG 主属性后再 ×0.7 (red 50→35) 让玄冥不再独大
    tiers: { blue: 0.08, purple: 0.15, gold: 0.24, red: 0.35 },
    desc: (v) => `暴伤 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_insight', name: '神识', slot: 'pendant', stat: 'spirit',
    // v3.4: red 60→50 (-17%), 其他 tier 按比例
    tiers: { blue: 8, purple: 17, gold: 30, red: 50 },
    desc: (v) => `神识 +${v} 点（+${(v * 0.1).toFixed(1)}% 神通伤害）` },
  { id: 'aw_harmony', name: '聚元', slot: 'pendant', stat: 'harmonyPct',
    tiers: { blue: 0.03, purple: 0.05, gold: 0.07, red: 0.10 },
    desc: (v) => `攻击/气血/防御 同时 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_fortune', name: '福缘', slot: 'pendant', stat: 'luckBonus',
    tiers: { blue: 0.05, purple: 0.08, gold: 0.12, red: 0.18 },
    desc: (v) => `装备/功法/灵草掉率 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_spirit_gather', name: '聚灵', slot: 'pendant', stat: 'spiritDensityBonus',
    tiers: { blue: 0.05, purple: 0.08, gold: 0.12, red: 0.18 },
    desc: (v) => `战斗获得灵石 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_exp_gain', name: '悟道', slot: 'pendant', stat: 'expBonus',
    tiers: { blue: 0.05, purple: 0.08, gold: 0.12, red: 0.18 },
    desc: (v) => `战斗获得经验 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_vs_boss', name: '破妄', slot: 'pendant', stat: 'vsBossBonus',
    tiers: { blue: 0.05, purple: 0.08, gold: 0.12, red: 0.18 },
    desc: (v) => `对首领伤害 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_vs_elite', name: '惩戒', slot: 'pendant', stat: 'vsEliteBonus',
    tiers: { blue: 0.05, purple: 0.08, gold: 0.12, red: 0.15 },
    desc: (v) => `对精英怪伤害 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_debuff_lord', name: '天师', slot: 'pendant', stat: 'debuffDurationBonus',
    tiers: { blue: 0, purple: 1, gold: 1, red: 1 },
    desc: (v) => `施加减益持续回合 +${v}（不含控制类）` },
  { id: 'aw_accuracy', name: '洞悉', slot: 'pendant', stat: 'accuracyBonus',
    // v3.4: tiers -50%
    tiers: { blue: 3, purple: 4, gold: 6, red: 9 },
    desc: (v) => `命中 +${v}` },
  { id: 'aw_sect_bonus', name: '弘愿', slot: 'pendant', stat: 'sectContribBonus',
    tiers: { blue: 0.05, purple: 0.08, gold: 0.12, red: 0.18 },
    desc: (v) => `宗门贡献获得 +${(v * 100).toFixed(0)}%` },
];

// ============ 灵戒（12 条 / 主修功法增幅向）============
// 灵戒 1 件 cap：12 条择 1，不跨件叠加
const RING_POOL: AwakenDef[] = [
  // —— 通用向（4 条）：任意主修都生效 ——
  { id: 'aw_main_amp', name: '心法贯通', slot: 'ring', stat: 'mainSkillMultBonus',
    tiers: { blue: 0.08, purple: 0.13, gold: 0.20, red: 0.28 },
    desc: (v) => `主修伤害倍率 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_main_crit', name: '主修锋锐', slot: 'ring', stat: 'mainSkillCritRate',
    tiers: { blue: 0.04, purple: 0.07, gold: 0.10, red: 0.14 },
    desc: (v) => `主修攻击额外暴击率 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_main_pierce', name: '主修破玄', slot: 'ring', stat: 'mainSkillArmorPen',
    tiers: { blue: 0.06, purple: 0.10, gold: 0.15, red: 0.22 },
    desc: (v) => `主修无视目标 ${(v * 100).toFixed(0)}% 防御` },
  { id: 'aw_main_lifesteal', name: '主修噬灵', slot: 'ring', stat: 'mainSkillLifesteal',
    tiers: { blue: 0.015, purple: 0.025, gold: 0.04, red: 0.06 },
    desc: (v) => `主修命中回复 ${(v * 100).toFixed(1)}% 最大气血` },
  // —— 属性匹配向（5 条）：主修元素匹配才触发 ——
  { id: 'aw_metal_resonance', name: '金鸣戒', slot: 'ring', stat: 'mainSkillBleedAmp', requireElement: 'metal',
    tiers: { blue: 0.20, purple: 0.35, gold: 0.50, red: 0.75 },
    desc: (v) => `[主修=金] 主修施加流血每跳伤害 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_wood_resonance', name: '木灵戒', slot: 'ring', stat: 'mainSkillPoisonAmp', requireElement: 'wood',
    tiers: { blue: 0.30, purple: 0.45, gold: 0.65, red: 0.85 },
    desc: (v) => `[主修=木] 主修施加中毒每跳伤害 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_water_resonance', name: '水蕴戒', slot: 'ring', stat: 'mainSkillFreezeChance', requireElement: 'water',
    tiers: { blue: 0.08, purple: 0.13, gold: 0.20, red: 0.28 },
    desc: (v) => `[主修=水] 主修冻结概率 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_fire_resonance', name: '焚天戒', slot: 'ring', stat: 'mainSkillBurnDuration', requireElement: 'fire',
    tiers: { blue: 1, purple: 1, gold: 2, red: 2 },
    desc: (v) => `[主修=火] 主修灼烧持续 +${v} 回合` },
  // v3.6 火焰 DOT 流派支持：与焚天戒互为 2 选 1，玩家可选"持续"或"伤害"流
  { id: 'aw_fire_burn_amp', name: '焚天烬戒', slot: 'ring', stat: 'mainSkillBurnAmp', requireElement: 'fire',
    tiers: { blue: 0.20, purple: 0.35, gold: 0.50, red: 0.75 },
    desc: (v) => `[主修=火] 主修施加灼烧每跳伤害 +${(v * 100).toFixed(0)}%` },
  { id: 'aw_earth_resonance', name: '厚土戒', slot: 'ring', stat: 'mainSkillBrittleAmp', requireElement: 'earth',
    tiers: { blue: 0.10, purple: 0.15, gold: 0.22, red: 0.30 },
    desc: (v) => `[主修=土] 主修脆弱减防加深 +${(v * 100).toFixed(0)}%` },
  // —— 机制向（3 条）：高阶 build 解锁 ——
  { id: 'aw_main_chain', name: '紫电连华', slot: 'ring', stat: 'mainSkillChainChance',
    tiers: { blue: 0.08, purple: 0.13, gold: 0.20, red: 0.28 },
    desc: (v) => `主修 ${(v * 100).toFixed(0)}% 概率追击一次（60% 倍率，与兵器连击互斥取大）` },
  { id: 'aw_main_cdcut', name: '心剑回响', slot: 'ring', stat: 'mainSkillCritCdCut',
    tiers: { blue: 1, purple: 1, gold: 1, red: 1 },
    desc: () => `主修暴击时所有神通 CD -1（每回合至多 1 次）` },
  { id: 'aw_main_execute', name: '灵戒裂魂', slot: 'ring', stat: 'mainSkillExecute',
    // value = 加成百分比，threshold 通过 meta 在 rollAwakenEffect 内按品质注入
    tiers: { blue: 0.30, purple: 0.45, gold: 0.60, red: 0.85 },
    desc: (v, m) => {
      const thr = m?.threshold ?? 0.20;
      return `主修对气血<${(thr * 100).toFixed(0)}% 目标伤害 +${(v * 100).toFixed(0)}%`;
    } },
];

// 合集
export const AWAKEN_POOLS: Record<string, AwakenDef[]> = {
  weapon: WEAPON_POOL,
  armor: ARMOR_POOL,
  pendant: PENDANT_POOL,
  ring: RING_POOL,
};

// 按 id 查询（用于 UI 渲染）
export const AWAKEN_DEF_MAP: Record<string, AwakenDef> = {};
for (const pool of Object.values(AWAKEN_POOLS)) {
  for (const d of pool) AWAKEN_DEF_MAP[d.id] = d;
}

// 五行名称
const ELEM_NAME: Record<string, string> = {
  fire: '火', metal: '金', water: '水', wood: '木', earth: '土',
};
const ELEMENTS: Array<keyof typeof ELEM_NAME> = ['fire', 'metal', 'water', 'wood', 'earth'];

// 支持附灵的槽位（v1.3: 加入 ring 槽位 - 主修功法增幅）
export const AWAKEN_SLOTS = ['weapon', 'armor', 'pendant', 'ring'];

// 支持附灵的品质
export const AWAKEN_RARITIES: AwakenRarity[] = ['blue', 'purple', 'gold', 'red'];

export function canSlotAwaken(slot: string): boolean {
  return AWAKEN_SLOTS.includes(slot);
}

export function canRarityAwaken(rarity: string): boolean {
  return (AWAKEN_RARITIES as string[]).includes(rarity);
}

/**
 * 按槽位和品质随机生成一条附灵
 * @param slot 装备槽位（weapon/armor/pendant）
 * @param rarity 装备品质（决定数值档位）
 * @param excludeId 排除的附灵 id（灵枢玉洗练时传当前 id，保证洗出来的不同）
 */
export function rollAwakenEffect(
  slot: string,
  rarity: string,
  excludeId?: string,
): AwakenEffect | null {
  if (!canSlotAwaken(slot) || !canRarityAwaken(rarity)) return null;
  const pool = AWAKEN_POOLS[slot];
  if (!pool || pool.length === 0) return null;

  // 排除当前 id
  const candidates = excludeId ? pool.filter(d => d.id !== excludeId) : pool;
  if (candidates.length === 0) return null;

  const def = candidates[Math.floor(Math.random() * candidates.length)];
  const value = def.tiers[rarity as AwakenRarity];

  // 五行·X 需再选一个元素
  let meta: Record<string, any> | null = null;
  let finalStat = def.stat;
  let finalName = def.name;
  if (def.id === 'aw_five_elements') {
    const elem = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    meta = { element: elem };
    finalStat = `${elem.toUpperCase()}_DMG_PCT`;
    finalName = `五行·${ELEM_NAME[elem]}`;
  }
  // 灵戒裂魂：阈值跟随品质，独立于 value（value 仅存伤害加成）
  if (def.id === 'aw_main_execute') {
    const thrByRarity: Record<AwakenRarity, number> = {
      blue: 0.20, purple: 0.25, gold: 0.30, red: 0.35,
    };
    meta = { threshold: thrByRarity[rarity as AwakenRarity] };
  }
  // ring 池属性匹配向：把 requireElement 写入 meta 供战斗引擎判断
  if (def.requireElement) {
    meta = { ...(meta || {}), requireElement: def.requireElement };
  }

  return {
    id: def.id,
    name: finalName,
    stat: finalStat,
    value,
    meta,
  };
}

/**
 * 根据 AwakenEffect 渲染描述（前端 / 战斗日志通用）
 */
export function describeAwakenEffect(eff: AwakenEffect): string {
  const def = AWAKEN_DEF_MAP[eff.id];
  if (!def) return `${eff.name} +${eff.value}`;
  return def.desc(eff.value, eff.meta);
}

/**
 * 获取某槽位某品质档位下的最高数值（用于 UI 显示潜力提示）
 */
export function getAwakenMaxValue(slot: string, rarity: string): number {
  const pool = AWAKEN_POOLS[slot];
  if (!pool) return 0;
  return pool.reduce((max, d) => Math.max(max, d.tiers[rarity as AwakenRarity] || 0), 0);
}
