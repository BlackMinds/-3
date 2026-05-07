// 装备套装数据 — v1 一期上 7 套
// 设计文档：design/套装.txt
//
// 命名约定：
//   - setKey: 套装唯一 ID (snake_case，与 character_equipment.set_id 字段对齐)
//   - prefix: 装备名前缀 (固定 2~3 字，凑套时方便玩家识别)
//   - tiers:  3/5/7 件激活档位的效果描述 + 数据钩子
//
// 战斗钩子约定（battleEngine 后续接入时按 hooks 字段处理，本期暂不实战）：
//   - onSkillCast / onHit / onTakenHit / onDodge / onTurnStart / onKill / onCrit / onMiss
// 一期：仅落地"装备生成 + 命名 + 套装识别 + UI 高亮"，战斗效果二期接入。

export interface EquipSetTier {
  count: number               // 凑齐件数（3 / 5 / 7）
  desc: string                // 玩家可见的效果文本
  hooks?: Record<string, any> // 战斗引擎钩子（二期接入）
}

export interface EquipSet {
  setKey: string              // 唯一 ID
  name: string                // 套装显示名（"火神套" / "万毒套" ...）
  prefix: string              // 装备名前缀（如"焚天"）
  desc: string                // 流派一句话定位
  rarity: 'blue' | 'purple' | 'gold' | 'red'  // 该套装出现于该品质及以上
  tiers: [EquipSetTier, EquipSetTier, EquipSetTier] // 必须 3 档：3/5/7
}

// ===== 实装套装（9 套）=====
export const EQUIP_SETS: EquipSet[] = [
  // 1. 火神套 — 灼烧爆发
  // v3.8.5: 加入 dmgMul（玩家施加灼烧每跳伤害 ×N），让套装在养成轴上有"跳数 × 跳伤"双轴提升
  {
    setKey: 'fire_god',
    name: '火神套',
    prefix: '焚天',
    desc: '灼烧爆发流，配焚天烈魂、焚体诀',
    rarity: 'purple',
    tiers: [
      { count: 3, desc: '附加灼烧时，立即额外结算 1 跳灼烧伤害；玩家施加灼烧每跳 ×1.2',
        hooks: { onApplyBurn: { instantMul: 2, dmgMul: 1.2 } } },
      { count: 5, desc: '附加灼烧时，立即额外结算 2 跳灼烧伤害；玩家施加灼烧每跳 ×1.4',
        hooks: { onApplyBurn: { instantMul: 3, dmgMul: 1.4 } } },
      { count: 7, desc: '附加灼烧时，立即额外结算 4 跳灼烧伤害；玩家施加灼烧每跳 ×1.6；目标已灼烧时额外延长 1 回合（持续 cap 6 回合）',
        hooks: { onApplyBurn: { instantMul: 5, dmgMul: 1.6, extendIfStacked: 1, durationCap: 6 } } },
    ],
  },

  // 2. 万毒套 — 中毒爆发
  {
    setKey: 'venom',
    name: '万毒套',
    prefix: '蚀骨',
    desc: '中毒爆发流，配毒液冲击、百毒不侵',
    rarity: 'purple',
    tiers: [
      { count: 3, desc: '附加中毒时，立即额外结算 1 跳中毒伤害；玩家施加中毒每跳 ×1.2',
        hooks: { onApplyPoison: { instantMul: 2, dmgMul: 1.2 } } },
      { count: 5, desc: '附加中毒时，立即额外结算 2 跳中毒伤害；玩家施加中毒每跳 ×1.4',
        hooks: { onApplyPoison: { instantMul: 3, dmgMul: 1.4 } } },
      { count: 7, desc: '附加中毒时，立即额外结算 4 跳中毒伤害；玩家施加中毒每跳 ×1.6；目标中毒状态下，对其造成的伤害 +15%',
        hooks: { onApplyPoison: { instantMul: 5, dmgMul: 1.6 }, conditional: { ifTargetPoisoned: { dmgAmp: 0.15 } } } },
    ],
  },

  // 3. 血魔套 — 流血爆发
  {
    setKey: 'blood_demon',
    name: '血魔套',
    prefix: '噬魂',
    desc: '流血爆发流，配剑雨纷飞、血雨腥风、十三枪',
    rarity: 'purple',
    tiers: [
      { count: 3, desc: '附加流血时，立即额外结算 1 跳流血伤害；玩家施加流血每跳 ×1.2',
        hooks: { onApplyBleed: { instantMul: 2, dmgMul: 1.2 } } },
      { count: 5, desc: '附加流血时，立即额外结算 2 跳流血伤害；玩家施加流血每跳 ×1.4',
        hooks: { onApplyBleed: { instantMul: 3, dmgMul: 1.4 } } },
      { count: 7, desc: '附加流血时，立即额外结算 4 跳流血伤害；玩家施加流血每跳 ×1.6；目标流血状态下你的吸血 +10%',
        hooks: { onApplyBleed: { instantMul: 5, dmgMul: 1.6 }, conditional: { ifTargetBleeding: { LIFESTEAL_flat: 0.10 } } } },
    ],
  },

  // 4. 极寒套 — 控制冰冻流
  {
    setKey: 'frost',
    name: '极寒套',
    prefix: '玄冰',
    desc: '冰冻控制流，配霜冻新星、明镜止水',
    rarity: 'purple',
    tiers: [
      { count: 3, desc: '冰冻概率 +5%；对冰冻状态敌人伤害 +20%',
        hooks: { freezeChanceBonus: 0.05, dmgVsFrozen: 0.20 } },
      { count: 5, desc: '冰冻概率 +15%；对冰冻状态敌人伤害 +40%',
        hooks: { freezeChanceBonus: 0.15, dmgVsFrozen: 0.40 } },
      { count: 7, desc: '冰冻概率 +20%；对冰冻状态敌人伤害 +70%；冰冻敌人无法闪避',
        hooks: { freezeChanceBonus: 0.20, dmgVsFrozen: 0.70, frozenCannotDodge: true } },
    ],
  },

  // 5. 十三枪 — 武器流之枪，最终伤害堆叠
  {
    setKey: 'thirteen_spear',
    name: '十三枪',
    prefix: '霸枪',
    desc: '武器流·枪，最终伤害堆叠流（需装备「枪」）',
    rarity: 'gold',
    tiers: [
      { count: 3, desc: '装备「枪」时，破甲 +10、吸血 +3%；造成伤害后获得 1 层「十三枪」，每层最终伤害 +5%，最多 13 层',
        hooks: { weaponRequired: 'spear', armorPen: 10, LIFESTEAL_flat: 0.03, stack: { id: 'spear13', perHit: 1, perStack: 0.05, max: 13 } } },
      { count: 5, desc: '装备「枪」时，破甲 +18、吸血 +5%；每层最终伤害 +7%',
        hooks: { weaponRequired: 'spear', armorPen: 18, LIFESTEAL_flat: 0.05, stack: { id: 'spear13', perHit: 1, perStack: 0.07, max: 13 } } },
      { count: 7, desc: '装备「枪」时，破甲 +22、吸血 +5%；每层最终伤害 +8%；满 13 层时下一击必会心，满层会心触发后清零层数',
        hooks: { weaponRequired: 'spear', armorPen: 22, LIFESTEAL_flat: 0.05, stack: { id: 'spear13', perHit: 1, perStack: 0.08, max: 13 }, onMaxStack: { guaranteedCrit: 1 } } },
    ],
  },

  // 6. 回归基本功套 — 反向流派：放弃神通爆发，主修变 AOE 持续清场
  {
    setKey: 'basic_back',
    name: '回归基本功',
    prefix: '本源',
    desc: '反向流派，主修变 AOE 持续清场（无法使用神通）',
    rarity: 'purple',
    tiers: [
      { count: 3, desc: '主修变 AOE，倍率 ×1.0；无法使用神通',
        hooks: { basicBack: { mainAoeMul: 1.0, banDivine: true } } },
      { count: 5, desc: '主修 AOE 倍率 ×1.4；无法使用神通',
        hooks: { basicBack: { mainAoeMul: 1.4, banDivine: true } } },
      { count: 7, desc: '主修 AOE 倍率 ×1.8（仅多于 1 个目标时享有；单体战 ×0.9）；无法使用神通；主修触发 debuff 概率 ×1.5',
        hooks: { basicBack: { mainAoeMul: 1.8, mainAoeMulSingle: 0.9, banDivine: true, debuffChanceMul: 1.5 } } },
    ],
  },

  // 7. 剑仙套 — 武器流之剑，每次造成伤害额外触发剑气
  {
    setKey: 'sword_immortal',
    name: '剑仙套',
    prefix: '御剑',
    desc: '武器流·剑，造成伤害额外触发剑气（需装备「剑」）',
    rarity: 'gold',
    tiers: [
      { count: 3, desc: '装备「剑」时，攻击 +5%、防御 +5%、会心率 +3%；造成伤害额外造成 1 次剑气，倍率 30%',
        hooks: { weaponRequired: 'sword', ATK_pct: 0.05, DEF_pct: 0.05, CRIT_RATE_flat: 0.03, swordQi: { hits: 1, mul: 0.30 } } },
      { count: 5, desc: '装备「剑」时，攻击 +8%、防御 +8%、会心率 +5%；造成伤害额外造成 2 次剑气，倍率 45%',
        hooks: { weaponRequired: 'sword', ATK_pct: 0.08, DEF_pct: 0.08, CRIT_RATE_flat: 0.05, swordQi: { hits: 2, mul: 0.45 } } },
      { count: 7, desc: '装备「剑」时，攻击 +10%、防御 +10%、会心率 +8%；造成伤害额外造成 3 次剑气，倍率 55%',
        hooks: { weaponRequired: 'sword', ATK_pct: 0.10, DEF_pct: 0.10, CRIT_RATE_flat: 0.08, swordQi: { hits: 3, mul: 0.55 } } },
    ],
  },

  // 8. 刀狂套 — 武器流之刀，非会心滚雪球会心
  {
    setKey: 'blade_madness',
    name: '刀狂套',
    prefix: '狂刀',
    desc: '武器流·刀，非会心叠加会心/会伤，会心后清零（需装备「刀」）',
    rarity: 'gold',
    tiers: [
      { count: 3, desc: '装备「刀」时，会心率 +5%、会心伤害 +15%；非会心命中叠加：会心率 +5% / 会心伤害 +15%（会心清零）',
        hooks: { weaponRequired: 'blade', CRIT_RATE_flat: 0.05, CRIT_DMG_flat: 0.15, bladeStack: { critRate: 0.05, critDmg: 0.15 } } },
      { count: 5, desc: '装备「刀」时，会心率 +8%、会心伤害 +25%；非会心叠加：会心率 +10% / 会心伤害 +25%',
        hooks: { weaponRequired: 'blade', CRIT_RATE_flat: 0.08, CRIT_DMG_flat: 0.25, bladeStack: { critRate: 0.10, critDmg: 0.25 } } },
      { count: 7, desc: '装备「刀」时，会心率 +10%、会心伤害 +30%；非会心叠加：会心率 +15% / 会心伤害 +40%（会心仍清零）',
        hooks: { weaponRequired: 'blade', CRIT_RATE_flat: 0.10, CRIT_DMG_flat: 0.30, bladeStack: { critRate: 0.15, critDmg: 0.40 } } },
    ],
  },

  // 9. 天机套 — 武器流之扇，神通额外段
  {
    setKey: 'fan_master',
    name: '天机套',
    prefix: '机扇',
    desc: '武器流·扇，神通释放后追加额外段（需装备「扇」）',
    rarity: 'gold',
    tiers: [
      { count: 3, desc: '装备「扇」时，神识 +15%；释放神通后额外释放 1 次，伤害 30%',
        hooks: { weaponRequired: 'fan', SPIRIT_pct: 0.15, fanExtra: { casts: 1, mul: 0.30 } } },
      { count: 5, desc: '装备「扇」时，神识 +25%；释放神通后额外释放 1 次，伤害 50%',
        hooks: { weaponRequired: 'fan', SPIRIT_pct: 0.25, fanExtra: { casts: 1, mul: 0.50 } } },
      { count: 7, desc: '装备「扇」时，神识 +35%；释放神通后额外释放 2 次，伤害 40%',
        hooks: { weaponRequired: 'fan', SPIRIT_pct: 0.35, fanExtra: { casts: 2, mul: 0.40 } } },
    ],
  },
]

// ===== 工具函数 =====

export const EQUIP_SET_MAP: Record<string, EquipSet> = {}
for (const s of EQUIP_SETS) {
  EQUIP_SET_MAP[s.setKey] = s
}

/**
 * 从已穿戴装备列表统计套装件数
 * @param equipped 已穿戴装备数组（每件含 set_id 字段）
 * @returns { setKey: count } 仅返回 count >= 3 的（未达档位的不返回）
 */
export function countEquippedSets(equipped: Array<{ set_id?: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const eq of equipped) {
    if (!eq?.set_id) continue
    counts[eq.set_id] = (counts[eq.set_id] || 0) + 1
  }
  // 仅返回有意义的（>=3）
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(counts)) {
    if (v >= 3) result[k] = v
  }
  return result
}

/**
 * 从已穿戴装备列表聚合 setCounts + 主武器类型
 * 用于 buildCharacterSnapshot / team start 等需要把套装信息塞进 stats 的场景
 */
export function aggregateEquipmentSetInfo(
  equipRows: Array<{ slot?: string | null; set_id?: string | null; weapon_type?: string | null }>
): { equipSetCounts: Record<string, number>; weaponType: string | null } {
  const equipSetCounts: Record<string, number> = {}
  let weaponType: string | null = null
  for (const eq of equipRows) {
    if (!eq?.slot) continue
    if (eq.set_id) equipSetCounts[eq.set_id] = (equipSetCounts[eq.set_id] || 0) + 1
    if (eq.slot === 'weapon' && eq.weapon_type) weaponType = eq.weapon_type
  }
  return { equipSetCounts, weaponType }
}

/**
 * 给定装备件数，返回当前激活的最高档位（3/5/7），未达 3 件返回 0
 */
export function getActiveTier(count: number): 0 | 3 | 5 | 7 {
  if (count >= 7) return 7
  if (count >= 5) return 5
  if (count >= 3) return 3
  return 0
}

/**
 * 装备掉落时是否注入套装
 *
 * 设计：白/绿不出套装，蓝及以上品质有概率，越稀有越容易出
 * 出 boss/秘境时建议外层 luckMul ×1.5
 *
 * 武器流派套装（hooks.weaponRequired = sword/blade/spear/fan）：
 *   - 当生成的是武器槽（slot === 'weapon'）时，必须 weaponType 一致才允许
 *     —— 避免出现"扇子带刀套"这种永远激活不了的幽灵套装
 *   - 非武器槽不限制：玩家可以自行配合武器激活
 *
 * 保底（2026-05-07）：tier ≥ 10 且 rarity === 'red' 时必出套装
 *   背景：套装总数变多后，目标套装难刷；道域以上（T10+）红装必带套装
 *   让玩家凑套节奏不被纯概率劝退
 *
 * @returns setKey 或 null
 */
export function rollEquipSet(
  rarity: string,
  luckMul: number = 1.0,
  slot?: string,
  weaponType?: string | null,
  tier: number = 1,
): string | null {
  // T10+ 红装保底必出套装
  const guaranteed = rarity === 'red' && tier >= 10
  if (!guaranteed) {
    // 套装爆率（按品质）
    const baseRate: Record<string, number> = {
      white: 0,
      green: 0,
      blue: 0.05,    // 5%
      purple: 0.10,  // 10%
      gold: 0.20,    // 20%
      red: 0.35,     // 35%
    }
    const rate = (baseRate[rarity] || 0) * luckMul
    if (Math.random() >= rate) return null
  }

  // 在该品质允许的池子里随机
  const rarityRank: Record<string, number> = { blue: 1, purple: 2, gold: 3, red: 4 }
  const myRank = rarityRank[rarity] || 0
  const candidates = EQUIP_SETS.filter(s => {
    if ((rarityRank[s.rarity] || 99) > myRank) return false
    const reqWeapon = (s.tiers[0]?.hooks as any)?.weaponRequired
    if (reqWeapon && slot === 'weapon' && reqWeapon !== weaponType) return false
    return true
  })
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)].setKey
}
