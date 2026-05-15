// 功法掉落池 - 公共数据
//
// 历史：fight.post.ts / offline-claim.post.ts / randomEvent.ts 三处各自硬编码同一份池子，
//      v3.10 起统一从这里读，避免维护漂移。
//
// 入池规则：
//   T1: 绿品主修 + 绿品被动
//   T3: 蓝品神通 + 蓝品被动 + 蓝品主修 (v3.10 新)
//   T5: 紫品神通 (含 v3.10 紫土) + 紫品被动
//   T7: 金品神通 (含 v3.10 金水/金无) + 金品被动 (含 v3.10 三条)
//       + 红品神通 (含 v3.10 红木水火土) + 红品被动 (含 v3.10 红五行)
//
// 留待后续开放（不进通用掉落池）：
//   - 金品五行主修 (heaven_sword / soul_devour / glacier_art / hellfire_chant / mountain_press)
//   - 红品至尊主修 (myriad_origin)
//
// 备注：紫品五行主修 (gale_blade / wither_bloom / frost_art / sky_inferno / mountain_seal)
//      为通天塔每 10 层节点专属掉落，由 tower/challenge.post.ts、tower/sweep.post.ts 内的
//      TOWER_PURPLE_ACTIVE_IDS 独立维护，**不进通用池**。

export const SKILL_DROP_POOLS: Record<number, string[]> = {
  1: [
    // 绿品主修
    'wind_blade', 'vine_whip', 'ice_palm', 'flame_sword', 'quake_fist',
    // 绿品被动
    'body_refine', 'flame_body', 'water_flow', 'root_grip', 'metal_skin',
  ],
  3: [
    // 蓝品神通
    'fire_rain', 'frost_nova', 'earth_shield', 'quake_wave', 'vine_prison', 'golden_bell',
    // 蓝品被动
    'swift_step', 'iron_skin', 'thorn_aura', 'flame_aura', 'earth_wall',
    // v3.10 蓝品主修
    'tempest_blade', 'poison_vine', 'frost_chant', 'blaze_fist', 'stone_strike',
  ],
  5: [
    // 紫品神通（含 v3.6 DOT 流派 4 条 + v3.10 紫土）
    'sword_storm', 'twin_flame', 'flurry_palm', 'spring_heal', 'blood_fury',
    'wood_heal', 'mirror_water', 'venom_burst', 'poison_mist', 'bleed_storm', 'burn_inferno',
    'earth_shatter',
    // 紫品被动
    'crit_master', 'earth_fortitude', 'poison_body', 'fire_mastery',
    'dot_amplifier', 'phantom_step', 'healing_spring',
    // 注：紫品主修 (gale_blade 等 5) 仅通天塔节点掉落，不进通用池
  ],
  7: [
    // 金品神通（含 v3.10 金水 / 金无元素）
    'metal_burst', 'quake_stomp', 'life_drain', 'inferno_burst', 'storm_blade', 'heaven_heal',
    'frost_marrow', 'taichi_reflect',
    // 金品被动（含 v3.10 sword_bone / wood_blessing / fire_heart）
    'water_mastery', 'battle_frenzy', 'heavenly_body',
    'sword_bone', 'wood_blessing', 'fire_heart',
    // 红品神通（含 v3.10 红木水火土 4 条）
    'time_stop', 'heavenly_wrath',
    'myriad_grove', 'abyssal_return', 'hellfire_inferno', 'sky_split',
    // 红品被动（含 v3.10 红五行 5 条）
    'dao_heart', 'five_elements_harmony',
    'sword_throne', 'jade_wood', 'boundless_sea', 'vermilion_blaze', 'black_warrior',
  ],
};

// 按地图 tier 选档：>=7 用 T7，>=5 用 T5，>=3 用 T3，否则 T1
export function getSkillDropPool(tier: number): string[] {
  if (tier >= 7) return SKILL_DROP_POOLS[7];
  if (tier >= 5) return SKILL_DROP_POOLS[5];
  if (tier >= 3) return SKILL_DROP_POOLS[3];
  return SKILL_DROP_POOLS[1];
}

// ============================================================
// GM 后台按品阶发功法（components/AdminPlayerActions.vue 下拉、
// server/api/admin/players/[id]/grant-skills.post.ts 使用）
// 与通用掉落池保持一致：玩家正规渠道能拿到的功法集合。
// 因此：
//   - 紫品五行主修 (gale_blade 等 5) 不入 GM 池，仅通天塔节点掉落
//   - 金品五行主修 + 红品至尊主修 共 6 条未开放，不入 GM 池
// ============================================================
export const SKILL_DROP_POOLS_BY_RARITY: Record<'green' | 'blue' | 'purple' | 'gold' | 'red', string[]> = {
  // 10 = 绿主修 5 + 绿被动 5
  green: [
    'wind_blade', 'vine_whip', 'ice_palm', 'flame_sword', 'quake_fist',
    'body_refine', 'flame_body', 'water_flow', 'root_grip', 'metal_skin',
  ],
  // 16 = 蓝主修 5 + 蓝神通 6 + 蓝被动 5
  blue: [
    'tempest_blade', 'poison_vine', 'frost_chant', 'blaze_fist', 'stone_strike',
    'fire_rain', 'frost_nova', 'earth_shield', 'quake_wave', 'vine_prison', 'golden_bell',
    'swift_step', 'iron_skin', 'thorn_aura', 'flame_aura', 'earth_wall',
  ],
  // 19 = 紫神通 12 (含 earth_shatter) + 紫被动 7
  purple: [
    'sword_storm', 'twin_flame', 'flurry_palm', 'spring_heal', 'blood_fury',
    'wood_heal', 'mirror_water', 'venom_burst', 'poison_mist', 'bleed_storm', 'burn_inferno',
    'earth_shatter',
    'crit_master', 'earth_fortitude', 'poison_body', 'fire_mastery',
    'dot_amplifier', 'phantom_step', 'healing_spring',
  ],
  // 14 = 金神通 8 (含 frost_marrow/taichi_reflect) + 金被动 6 (含 sword_bone/wood_blessing/fire_heart)
  gold: [
    'metal_burst', 'quake_stomp', 'life_drain', 'inferno_burst', 'storm_blade', 'heaven_heal',
    'frost_marrow', 'taichi_reflect',
    'water_mastery', 'battle_frenzy', 'heavenly_body',
    'sword_bone', 'wood_blessing', 'fire_heart',
  ],
  // 13 = 红神通 6 (含 myriad_grove/abyssal_return/hellfire_inferno/sky_split) + 红被动 7 (含红五行 5)
  red: [
    'time_stop', 'heavenly_wrath',
    'myriad_grove', 'abyssal_return', 'hellfire_inferno', 'sky_split',
    'dao_heart', 'five_elements_harmony',
    'sword_throne', 'jade_wood', 'boundless_sea', 'vermilion_blaze', 'black_warrior',
  ],
};

export function getSkillRarityPool(rarity: string): string[] | undefined {
  return (SKILL_DROP_POOLS_BY_RARITY as Record<string, string[]>)[rarity];
}
