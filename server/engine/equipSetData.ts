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
  name: string                // 套装显示名（"刷新套" / "火神套" ...）
  prefix: string              // 装备名前缀（如"周天"）
  desc: string                // 流派一句话定位
  rarity: 'blue' | 'purple' | 'gold' | 'red'  // 该套装出现于该品质及以上
  tiers: [EquipSetTier, EquipSetTier, EquipSetTier] // 必须 3 档：3/5/7
}

// ===== 一期 7 套（按设计文档 ✅ 标记中挑出最稳的 7 套，覆盖 7 大流派）=====
export const EQUIP_SETS: EquipSet[] = [
  // 1. 刷新套 — 主修/神通周转流
  {
    setKey: 'refresh',
    name: '刷新套',
    prefix: '周天',
    desc: '神通周转流，与高 CD 红/金品神通配合最佳',
    rarity: 'blue',
    tiers: [
      { count: 3, desc: '释放主修或神通后，5% 概率重置当前 CD 最短的神通',
        hooks: { onSkillCast: { resetShortestCd: { chance: 0.05 } } } },
      { count: 5, desc: '上述概率提升至 12%',
        hooks: { onSkillCast: { resetShortestCd: { chance: 0.12 } } } },
      { count: 7, desc: '上述概率提升至 22%；战斗第 1 回合所有神通 CD -1',
        hooks: { onSkillCast: { resetShortestCd: { chance: 0.22 } }, onBattleStart: { allCdReduce: 1 } } },
    ],
  },

  // 2. 多重施法套 — 神通爆发流
  {
    setKey: 'multicast',
    name: '多重施法套',
    prefix: '叠浪',
    desc: '神通爆发流，配高倍率单段神通最佳',
    rarity: 'purple',
    tiers: [
      { count: 3, desc: '释放主动神通时，8% 概率额外释放一次（伤害 100%，每回合最多 1 次）',
        hooks: { onSkillCast: { extraCast: { chance: 0.08, mul: 1.0, maxPerTurn: 1 } } } },
      { count: 5, desc: '概率 18%，每回合最多 2 次',
        hooks: { onSkillCast: { extraCast: { chance: 0.18, mul: 1.0, maxPerTurn: 2 } } } },
      { count: 7, desc: '概率 30%，每回合最多 2 次；额外释放伤害降至 80%',
        hooks: { onSkillCast: { extraCast: { chance: 0.30, mul: 0.80, maxPerTurn: 2 } } } },
    ],
  },

  // 3. 火神套 — 灼烧爆发
  {
    setKey: 'fire_god',
    name: '火神套',
    prefix: '焚天',
    desc: '灼烧爆发流，配焚天烈魂、焚体诀',
    rarity: 'purple',
    tiers: [
      { count: 3, desc: '附加灼烧时，下一跳灼烧伤害 ×2 并立即结算 1 次',
        hooks: { onApplyBurn: { instantMul: 2 } } },
      { count: 5, desc: '上述 ×3',
        hooks: { onApplyBurn: { instantMul: 3 } } },
      { count: 7, desc: '上述 ×5；目标已灼烧时额外延长 1 回合（持续 cap 6 回合）',
        hooks: { onApplyBurn: { instantMul: 5, extendIfStacked: 1, durationCap: 6 } } },
    ],
  },

  // 4. 万毒套 — 中毒爆发
  {
    setKey: 'venom',
    name: '万毒套',
    prefix: '蚀骨',
    desc: '中毒爆发流，配毒液冲击、百毒不侵',
    rarity: 'purple',
    tiers: [
      { count: 3, desc: '附加中毒时，下一跳中毒伤害 ×2 并立即结算 1 次',
        hooks: { onApplyPoison: { instantMul: 2 } } },
      { count: 5, desc: '上述 ×3',
        hooks: { onApplyPoison: { instantMul: 3 } } },
      { count: 7, desc: '上述 ×5；中毒可叠加 2 层（每层独立结算）',
        hooks: { onApplyPoison: { instantMul: 5, maxStacks: 2 } } },
    ],
  },

  // 5. 血魔套 — 流血爆发
  {
    setKey: 'blood_demon',
    name: '血魔套',
    prefix: '噬魂',
    desc: '流血爆发流，配剑雨纷飞、血雨腥风、十三枪',
    rarity: 'purple',
    tiers: [
      { count: 3, desc: '附加流血时，下一跳流血伤害 ×2 并立即结算 1 次',
        hooks: { onApplyBleed: { instantMul: 2 } } },
      { count: 5, desc: '上述 ×3',
        hooks: { onApplyBleed: { instantMul: 3 } } },
      { count: 7, desc: '上述 ×5；目标流血状态下你的吸血 +10%',
        hooks: { onApplyBleed: { instantMul: 5 }, conditional: { ifTargetBleeding: { LIFESTEAL_flat: 0.10 } } } },
    ],
  },

  // 6. 极寒套 — 控制冰冻流
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
      { count: 7, desc: '冰冻概率 +30%；对冰冻状态敌人伤害 +70%；冰冻敌人无法闪避',
        hooks: { freezeChanceBonus: 0.30, dmgVsFrozen: 0.70, frozenCannotDodge: true } },
    ],
  },

  // 7. 十三枪 — 武器流之枪，最终伤害堆叠
  {
    setKey: 'thirteen_spear',
    name: '十三枪',
    prefix: '霸枪',
    desc: '武器流·枪，最终伤害堆叠流（需装备「枪」）',
    rarity: 'gold',
    tiers: [
      { count: 3, desc: '装备「枪」时，破甲 +15、吸血 +3%；造成伤害后获得 1 层「十三枪」，每层最终伤害 +5%，最多 13 层',
        hooks: { weaponRequired: 'spear', armorPen: 15, LIFESTEAL_flat: 0.03, stack: { id: 'spear13', perHit: 1, perStack: 0.05, max: 13 } } },
      { count: 5, desc: '装备「枪」时，破甲 +25、吸血 +5%；每层最终伤害 +7%',
        hooks: { weaponRequired: 'spear', armorPen: 25, LIFESTEAL_flat: 0.05, stack: { id: 'spear13', perHit: 1, perStack: 0.07, max: 13 } } },
      { count: 7, desc: '装备「枪」时，破甲 +30、吸血 +5%；每次造成伤害 +2 层，每层 +8%；满 13 层时下一击必暴击',
        hooks: { weaponRequired: 'spear', armorPen: 30, LIFESTEAL_flat: 0.05, stack: { id: 'spear13', perHit: 2, perStack: 0.08, max: 13 }, onMaxStack: { guaranteedCrit: 1 } } },
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
 * @returns setKey 或 null
 */
export function rollEquipSet(rarity: string, luckMul: number = 1.0): string | null {
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

  // 在该品质允许的池子里随机
  const rarityRank: Record<string, number> = { blue: 1, purple: 2, gold: 3, red: 4 }
  const myRank = rarityRank[rarity] || 0
  const candidates = EQUIP_SETS.filter(s => (rarityRank[s.rarity] || 99) <= myRank)
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)].setKey
}
