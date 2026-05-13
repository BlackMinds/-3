// 子女天赋池 - 设计文档 5.6.3
// 50 个天赋，每 20 等级觉醒 1 个（最多 7 个槽位）
// 每个天赋直接对应 PassiveEffect 接口（参考 server/engine/skillData.ts）
// 战斗引擎零改造，与玩家本体被动功法走同一管线

import type { PassiveEffect } from './skillData'

export type TalentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface ChildTalent {
  id: string
  name: string
  rarity: TalentRarity
  description: string
  effect: PassiveEffect
}

// ============================================================
// 完整天赋池（50 个）
// ============================================================

export const CHILD_TALENTS: ChildTalent[] = [
  // ---------- 普通 Common (15) ----------
  { id: 't_atk_1',          name: '拳脚扎实', rarity: 'common', description: '攻击 +3%',     effect: { ATK_percent: 3 } },
  { id: 't_def_1',          name: '皮糙肉厚', rarity: 'common', description: '防御 +3%',     effect: { DEF_percent: 3 } },
  { id: 't_hp_1',           name: '血气方刚', rarity: 'common', description: '气血 +4%',     effect: { HP_percent: 4 } },
  { id: 't_spd_1',          name: '步法轻盈', rarity: 'common', description: '速度 +3%',     effect: { SPD_percent: 3 } },
  { id: 't_dodge_1',        name: '灵巧',     rarity: 'common', description: '闪避 +2%',     effect: { DODGE_flat: 0.02 } },
  { id: 't_crit_1',         name: '锋芒初现', rarity: 'common', description: '会心率 +2%',   effect: { CRIT_RATE_flat: 0.02 } },
  { id: 't_critdmg_1',      name: '重击',     rarity: 'common', description: '会心伤害 +6%', effect: { CRIT_DMG_flat: 0.06 } },
  { id: 't_resist_metal_1', name: '金身初成', rarity: 'common', description: '金抗 +5%',     effect: { RESIST_METAL: 0.05 } },
  { id: 't_resist_wood_1',  name: '抗毒体质', rarity: 'common', description: '木抗 +5%',     effect: { RESIST_WOOD: 0.05 } },
  { id: 't_resist_water_1', name: '御寒之体', rarity: 'common', description: '水抗 +5%',     effect: { RESIST_WATER: 0.05 } },
  { id: 't_resist_fire_1',  name: '火灵亲和', rarity: 'common', description: '火抗 +5%',     effect: { RESIST_FIRE: 0.05 } },
  { id: 't_resist_earth_1', name: '土行壮体', rarity: 'common', description: '土抗 +5%',     effect: { RESIST_EARTH: 0.05 } },
  { id: 't_regen_1',        name: '自愈',     rarity: 'common', description: '每回合回 0.5% 气血', effect: { regen_per_turn_percent: 0.005 } },
  { id: 't_lifesteal_1',    name: '食血',     rarity: 'common', description: '吸血 +2%',     effect: { LIFESTEAL_flat: 0.02 } },
  { id: 't_resist_ctrl_1',  name: '心智坚定', rarity: 'common', description: '控制抗性 +5%', effect: { RESIST_CTRL: 0.05 } },

  // ---------- 优秀 Uncommon (12) ----------
  { id: 't_atk_2',         name: '父母庇佑·攻', rarity: 'uncommon', description: '攻击 +6%',                effect: { ATK_percent: 6 } },
  { id: 't_def_2',         name: '父母庇佑·防', rarity: 'uncommon', description: '防御 +6%，气血 +3%',      effect: { DEF_percent: 6, HP_percent: 3 } },
  { id: 't_hp_2',          name: '血脉茁壮',     rarity: 'uncommon', description: '气血 +8%',                effect: { HP_percent: 8 } },
  { id: 't_spd_2',         name: '风行',         rarity: 'uncommon', description: '速度 +6%，闪避 +2%',     effect: { SPD_percent: 6, DODGE_flat: 0.02 } },
  { id: 't_crit_2',        name: '一击必中',     rarity: 'uncommon', description: '会心率 +4%，会心伤害 +8%', effect: { CRIT_RATE_flat: 0.04, CRIT_DMG_flat: 0.08 } },
  { id: 't_dot_amp_1',     name: '蛊毒之心',     rarity: 'uncommon', description: '灼烧/中毒/流血伤害 +10%', effect: { dot_amplifier_percent: 10 } },
  { id: 't_reflect_1',     name: '棘刺甲',       rarity: 'uncommon', description: '反弹 5% 伤害',           effect: { reflect_damage_percent: 0.05 } },
  { id: 't_resist_dual_1', name: '阴阳调和',     rarity: 'uncommon', description: '水抗 +8%，火抗 +8%',     effect: { RESIST_WATER: 0.08, RESIST_FIRE: 0.08 } },
  { id: 't_lifesteal_2',   name: '噬血',         rarity: 'uncommon', description: '吸血 +4%，攻击 +3%',     effect: { LIFESTEAL_flat: 0.04, ATK_percent: 3 } },
  { id: 't_regen_2',       name: '春回大地',     rarity: 'uncommon', description: '每回合回 1.2% 气血',     effect: { regen_per_turn_percent: 0.012 } },
  { id: 't_dr_1',          name: '厚实',         rarity: 'uncommon', description: '受伤减免 5%，气血 +3%', effect: { damage_reduction_flat: 0.05, HP_percent: 3 } },
  { id: 't_resist_ctrl_2', name: '不动如山·小', rarity: 'uncommon', description: '控制抗性 +12%',          effect: { RESIST_CTRL: 0.12 } },

  // ---------- 稀有 Rare (12) ----------
  { id: 't_blood_awaken',     name: '血脉觉醒',   rarity: 'rare', description: '攻击 +6%，会心率 +5%，会心伤害 +12%', effect: { ATK_percent: 6, CRIT_RATE_flat: 0.05, CRIT_DMG_flat: 0.12 } },
  { id: 't_iron_will',        name: '铁骨铮铮',   rarity: 'rare', description: '防御 +10%，控抗 +10%',                effect: { DEF_percent: 10, RESIST_CTRL: 0.10 } },
  { id: 't_phantom',          name: '鬼魅步',     rarity: 'rare', description: '闪避 +6%，速度 +6%，闪避后下次必会心', effect: { DODGE_flat: 0.06, SPD_percent: 6, crit_after_dodge: true } },
  { id: 't_dot_amp_2',        name: '万毒归宗',   rarity: 'rare', description: '灼烧/中毒/流血伤害 +20%，木抗 +10%',  effect: { dot_amplifier_percent: 20, RESIST_WOOD: 0.10 } },
  { id: 't_reflect_burn',     name: '焚身报复',   rarity: 'rare', description: '被攻击 15% 概率灼烧反击 2 回合',     effect: { burn_on_hit_taken_chance: 0.15 } },
  { id: 't_reflect_poison',   name: '蛊毒之躯',   rarity: 'rare', description: '被攻击 15% 概率施加中毒 2 回合',     effect: { poison_on_hit_taken_chance: 0.15 } },
  { id: 't_crit_reflect',     name: '镜面反击',   rarity: 'rare', description: '被会心反弹 15%，防御 +5%',           effect: { reflect_on_crit_taken: 0.15, DEF_percent: 5 } },
  { id: 't_heavy_strike',     name: '雷霆万钧',   rarity: 'rare', description: '攻击 +5%，会心伤害 +20%',           effect: { ATK_percent: 5, CRIT_DMG_flat: 0.20 } },
  { id: 't_balanced_warrior', name: '攻守兼备',   rarity: 'rare', description: '攻击 +5%，防御 +5%，气血 +5%',      effect: { ATK_percent: 5, DEF_percent: 5, HP_percent: 5 } },
  { id: 't_full_resist',      name: '五行通体',   rarity: 'rare', description: '全五行抗 +5%',                       effect: { RESIST_METAL: 0.05, RESIST_WOOD: 0.05, RESIST_WATER: 0.05, RESIST_FIRE: 0.05, RESIST_EARTH: 0.05 } },
  { id: 't_heal_master',      name: '妙手仁心',   rarity: 'rare', description: '受到治疗 +25%，每回合回 1% 气血',   effect: { heal_amplifier_percent: 25, regen_per_turn_percent: 0.01 } },
  { id: 't_resist_ctrl_3',    name: '心如止水',   rarity: 'rare', description: '控制抗性 +20%，速度 +3%',           effect: { RESIST_CTRL: 0.20, SPD_percent: 3 } },

  // ---------- 史诗 Epic (8) ----------
  { id: 't_battle_god',     name: '战神血脉', rarity: 'epic', description: '攻击 +10%，会心率 +6%，会心伤害 +20%',
    effect: { ATK_percent: 10, CRIT_RATE_flat: 0.06, CRIT_DMG_flat: 0.20 } },
  { id: 't_immortal_body',  name: '不坏金身', rarity: 'epic', description: '防御 +12%，气血 +8%，受伤减免 8%',
    effect: { DEF_percent: 12, HP_percent: 8, damage_reduction_flat: 0.08 } },
  { id: 't_revive_blood',   name: '浴血重生', rarity: 'epic', description: '致命伤害时复活一次（保留 25% 气血）',
    effect: { revive_once: true } },
  { id: 't_dot_amp_3',      name: '蚀骨噬魂', rarity: 'epic', description: 'DOT 伤害 +30%，被攻击 20% 概率施加中毒 3 回合',
    effect: { dot_amplifier_percent: 30, poison_on_hit_taken_chance: 0.20 } },
  { id: 't_phantom_strike', name: '鬼影连斩', rarity: 'epic', description: '闪避 +8%，速度 +10%，闪避后下次必会心，会心伤害 +15%',
    effect: { DODGE_flat: 0.08, SPD_percent: 10, crit_after_dodge: true, CRIT_DMG_flat: 0.15 } },
  { id: 't_blood_thirst',   name: '嗜血狂魔', rarity: 'epic', description: '吸血 +8%，攻击 +8%',
    effect: { LIFESTEAL_flat: 0.08, ATK_percent: 8 } },
  { id: 't_thorn_god',      name: '荆棘之王', rarity: 'epic', description: '反弹 12% 伤害，被会心反弹 20%，木抗 +15%',
    effect: { reflect_damage_percent: 0.12, reflect_on_crit_taken: 0.20, RESIST_WOOD: 0.15 } },
  { id: 't_storm_heart',    name: '神识澄明', rarity: 'epic', description: '全五行抗 +8%，控抗 +15%，速度 +5%',
    effect: { RESIST_METAL: 0.08, RESIST_WOOD: 0.08, RESIST_WATER: 0.08, RESIST_FIRE: 0.08, RESIST_EARTH: 0.08, RESIST_CTRL: 0.15, SPD_percent: 5 } },

  // ---------- 传说 Legendary (3) ----------
  { id: 't_dao_heart',       name: '道心通明（弱化版）', rarity: 'legendary', description: '全属性 +8%，控抗 +15%',
    effect: { ATK_percent: 8, DEF_percent: 8, HP_percent: 8, RESIST_CTRL: 0.15 } },
  { id: 't_five_elements',   name: '五行轮转', rarity: 'legendary', description: '全五行抗 +12%，攻防血各 +5%',
    effect: { ATK_percent: 5, DEF_percent: 5, HP_percent: 5, RESIST_METAL: 0.12, RESIST_WOOD: 0.12, RESIST_WATER: 0.12, RESIST_FIRE: 0.12, RESIST_EARTH: 0.12 } },
  { id: 't_phoenix_rebirth', name: '浴火重生', rarity: 'legendary', description: '致命伤害复活一次（保留 30% 气血），每回合回 1.5% 气血，火抗 +15%',
    effect: { revive_once: true, regen_per_turn_percent: 0.015, RESIST_FIRE: 0.15 } },
]

export const CHILD_TALENT_MAP: Record<string, ChildTalent> = {}
for (const t of CHILD_TALENTS) CHILD_TALENT_MAP[t.id] = t

// ============================================================
// 资质 → 觉醒池权重（参考文档 5.6.3）
// ============================================================

// 子女资质 0=凡品 ... 6=圣品
export type ChildAptitude = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const TALENT_WEIGHT_BY_APTITUDE: Record<ChildAptitude, Record<TalentRarity, number>> = {
  0: { common: 100, uncommon: 0,   rare: 0,   epic: 0,   legendary: 0 },
  1: { common: 90,  uncommon: 10,  rare: 0,   epic: 0,   legendary: 0 },
  2: { common: 70,  uncommon: 25,  rare: 5,   epic: 0,   legendary: 0 },
  3: { common: 50,  uncommon: 30,  rare: 15,  epic: 5,   legendary: 0 },
  4: { common: 30,  uncommon: 30,  rare: 25,  epic: 12,  legendary: 3 },
  5: { common: 15,  uncommon: 25,  rare: 30,  epic: 22,  legendary: 8 },
  6: { common: 5,   uncommon: 15,  rare: 30,  epic: 30,  legendary: 20 },
}

// 按资质权重滚一个天赋
/**
 * 按资质权重抽天赋
 * @param excludeIds 已有天赋 id 列表（避免重复，最多 10 次重试后放弃避重）
 */
export function rollTalentByAptitude(aptitude: ChildAptitude, excludeIds: string[] = []): ChildTalent {
  const weights = TALENT_WEIGHT_BY_APTITUDE[aptitude]
  const totalWeight = (Object.values(weights) as number[]).reduce((a, b) => a + b, 0)

  const rollRarity = (): TalentRarity => {
    let r = Math.random() * totalWeight
    for (const [rarity, w] of Object.entries(weights)) {
      r -= w as number
      if (r <= 0) return rarity as TalentRarity
    }
    return 'common'
  }

  // 最多 10 次重试：roll rarity → 在该 rarity 池中找未排除的
  for (let attempt = 0; attempt < 10; attempt++) {
    const chosenRarity = rollRarity()
    const pool = CHILD_TALENTS.filter(t => t.rarity === chosenRarity && !excludeIds.includes(t.id))
    if (pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)]
    }
  }
  // 10 次都没找到非重复：放弃避重，按原逻辑抽（极罕见，比如某 rarity 池被全部排除）
  const chosenRarity = rollRarity()
  const pool = CHILD_TALENTS.filter(t => t.rarity === chosenRarity)
  return pool[Math.floor(Math.random() * pool.length)] || CHILD_TALENTS[0]
}
