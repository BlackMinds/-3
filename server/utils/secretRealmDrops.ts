// 秘境奖励生成：装备 / 灵草 / 功法
// 复用 battle/fight.post.ts 的逻辑，但加入秘境特有的"品质权重上移 + Boss 保底"机制

import { generateEquipName } from '../engine/equipNameData'
import { rollSubStats } from './equipment'
import { EQUIP_PRIMARY_BASE } from '~/shared/balance'

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 副属性走统一池（server/utils/equipment.ts）
function generateSubStats(rarityIdx: number, tier: number): { stat: string; value: number }[] {
  const counts = [0, 1, 2, 3, 4, 4] // 白/绿/蓝/紫/金/红
  const n = counts[rarityIdx] || 0
  return rollSubStats(rarityIdx, tier, n)
}

// ========== 装备生成（秘境品质权重） ==========
const RARITIES = ['white', 'green', 'blue', 'purple', 'gold', 'red']

// 秘境专用权重（文档 5.6.2）：品质整体上移
const SR_EQUIP_WEIGHTS: Record<number, number[]> = {
  1: [0, 40, 35, 12, 8, 1],    // 普通：紫色权重让位给金红，让稀有品质更突出
  2: [0, 10, 40, 35, 13, 2],   // 困难
  3: [0, 0, 20, 45, 27, 8],    // 噩梦
}

// Boss 保底品质索引
function bossGuaranteedRarityIdx(difficulty: 1 | 2 | 3): number {
  if (difficulty === 1) return 3 // 紫
  if (difficulty === 2) return 4 // 金
  // 噩梦：金保底，20% 升红
  return Math.random() < 0.2 ? 5 : 4
}

export function generateSecretRealmEquip(
  tier: number,
  difficulty: 1 | 2 | 3,
  isBoss: boolean,
  monsterElement: string | null = null,
  forceRarityIdx?: number, // v3.4: S 评级奖励等强制指定品质的场景
): any {
  // 品质
  let rarityIdx: number
  if (forceRarityIdx !== undefined) {
    rarityIdx = forceRarityIdx
  } else if (isBoss) {
    rarityIdx = bossGuaranteedRarityIdx(difficulty)
  } else {
    const w = SR_EQUIP_WEIGHTS[difficulty] || SR_EQUIP_WEIGHTS[1]
    const total = w.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    rarityIdx = 0
    for (let i = 0; i < w.length; i++) {
      r -= w[i]
      if (r <= 0) { rarityIdx = i; break }
    }
  }

  // 槽位
  const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
  const slotIdx = rand(0, slots.length - 1)
  const primaryStats: Record<string, string> = {
    weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD',
    treasure: 'ATK', ring: 'CRIT_DMG', pendant: 'SPIRIT',
  }
  const statMuls = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5]
  const ps = primaryStats[slots[slotIdx]]
  const pv = Math.max(1, Math.floor((EQUIP_PRIMARY_BASE[ps] || 30) * tier * statMuls[rarityIdx]))
  const tierReqLevels: Record<number, number> = {
    1: 1, 2: 15, 3: 35, 4: 55, 5: 80, 6: 110, 7: 140, 8: 170, 9: 185, 10: 195,
  }
  const weaponType = slots[slotIdx] === 'weapon' ? ['sword', 'blade', 'spear', 'fan'][rand(0, 3)] : null
  const subStats = generateSubStats(rarityIdx, tier)
  return {
    name: generateEquipName(RARITIES[rarityIdx], slots[slotIdx], weaponType, tier, ps, monsterElement),
    rarity: RARITIES[rarityIdx],
    primary_stat: ps,
    primary_value: pv,
    sub_stats: JSON.stringify(subStats),
    set_id: null,
    tier,
    weapon_type: weaponType,
    base_slot: slots[slotIdx],
    req_level: tierReqLevels[tier] || 1,
    enhance_level: 0,
  }
}

// ========== 灵草掉落 ==========
export function generateSecretRealmHerb(tier: number, element: string | null, isBoss: boolean): any | null {
  // 秘境灵草掉落率比单人刷图高
  const rate = isBoss ? 0.9 : 0.35
  if (Math.random() >= rate) return null
  const elementToHerb: Record<string, string> = {
    metal: 'metal_herb', wood: 'wood_herb', water: 'water_herb', fire: 'fire_herb', earth: 'earth_herb',
  }
  let herbId = element ? (elementToHerb[element] || 'common_herb') : 'common_herb'
  if (isBoss && Math.random() < 0.35) herbId = 'spirit_grass'
  // 品质按 tier 上移（秘境整体品质权重略高）
  const qualityOrder = ['white', 'green', 'blue', 'purple', 'gold']
  let qIdx = 0
  const r = Math.random()
  if (tier >= 7) qIdx = r < 0.4 ? 4 : 3
  else if (tier >= 5) qIdx = r < 0.5 ? 3 : 2
  else if (tier >= 3) qIdx = r < 0.5 ? 2 : 1
  else qIdx = r < 0.3 ? 1 : 0
  return { herb_id: herbId, quality: qualityOrder[qIdx], count: isBoss ? 3 : 1 }
}

// ========== 功法残页 ==========
export function generateSecretRealmSkillPage(tier: number, isBoss: boolean, ownedCounts: Record<string, number> = {}): string | null {
  const rate = isBoss ? 0.40 : 0.06
  if (Math.random() >= rate) return null
  const pools: Record<number, string[]> = {
    1: ['wind_blade', 'vine_whip', 'ice_palm', 'flame_sword', 'quake_fist', 'body_refine', 'flame_body', 'water_flow', 'root_grip', 'metal_skin'],
    3: ['fire_rain', 'frost_nova', 'earth_shield', 'quake_wave', 'vine_prison', 'golden_bell', 'swift_step', 'iron_skin', 'thorn_aura', 'flame_aura', 'earth_wall'],
    5: ['sword_storm', 'twin_flame', 'flurry_palm', 'spring_heal', 'blood_fury', 'wood_heal', 'mirror_water', 'crit_master', 'earth_fortitude', 'poison_body', 'fire_mastery', 'dot_amplifier', 'phantom_step', 'healing_spring'],
    7: ['metal_burst', 'quake_stomp', 'life_drain', 'inferno_burst', 'storm_blade', 'heaven_heal', 'water_mastery', 'battle_frenzy', 'heavenly_body', 'time_stop', 'heavenly_wrath', 'dao_heart', 'five_elements_harmony'],
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

// ========== 附灵道具掉落 ==========
// 附灵石 awaken_stone: 整场 roll 一次（普通 20% / 困难 40% / 噩梦 60%），每只 Boss 怪保底 +1
// 灵枢玉 awaken_reroll: 整场 roll 一次（普通 3% / 困难 10% / 噩梦 22%），噩梦 Boss 18% 额外追加
function rollAwakenStoneBase(difficulty: 1 | 2 | 3): number {
  const rate = difficulty === 1 ? 0.20 : difficulty === 2 ? 0.40 : 0.60
  return Math.random() < rate ? 1 : 0
}
function rollAwakenStoneBossBonus(difficulty: 1 | 2 | 3): number {
  // 每只 Boss 怪都触发保底（噩梦原 ×2 拉得太猛，改回 ×1）
  return 1
}
function rollRerollStoneBase(difficulty: 1 | 2 | 3): number {
  const rate = difficulty === 1 ? 0.03 : difficulty === 2 ? 0.10 : 0.22
  return Math.random() < rate ? 1 : 0
}
function rollRerollStoneBossBonus(difficulty: 1 | 2 | 3): number {
  if (difficulty !== 3) return 0
  return Math.random() < 0.18 ? 1 : 0
}

// 强化石（T4+ 秘境）：整场基础 roll + Boss 保底追加
// 概率略高于普通本，但考虑队伍均分所以人均到手接近
function rollEnhanceStoneBase(difficulty: 1 | 2 | 3, dropTier: number): number {
  if (dropTier < 4) return 0
  const rate = difficulty === 1 ? 0.20 : difficulty === 2 ? 0.35 : 0.55
  return Math.random() < rate ? 1 : 0
}
function rollEnhanceStoneBossBonus(difficulty: 1 | 2 | 3, dropTier: number): number {
  if (dropTier < 4) return 0
  const rate = difficulty === 1 ? 0.40 : difficulty === 2 ? 0.60 : 0.80
  return Math.random() < rate ? 1 : 0
}

// ========== 掉落批量生成（按秘境设计） ==========
export interface SecretRealmDropResult {
  equipments: any[]          // 全部装备列表（未分配）
  bossEquipments: any[]      // Boss 保底装备
  herbs: any[]               // 灵草
  skillPages: string[]       // 功法残页 ID 列表
  awakenStones: number       // 附灵石总数
  rerollStones: number       // 灵枢玉总数
  enhanceStones: number      // 强化石总数（全部对应 dropTier）
}

/**
 * 生成一场秘境战斗的总掉落（不含分配逻辑）
 * @param dropTier 秘境 dropTier（对应装备 T 级）
 * @param difficulty 难度
 * @param killedMonsters 击杀的怪物列表（来自战斗结果）
 * @param teamSize 队伍人数（影响装备数量）
 * @param ownedSkillCounts 全队功法拥有情况（聚合所有人的）
 */
export function generateSecretRealmDrops(
  dropTier: number,
  difficulty: 1 | 2 | 3,
  killedMonsters: { element: string | null; isBoss: boolean }[],
  teamSize: number,
  ownedSkillCounts: Record<string, number> = {},
): SecretRealmDropResult {
  const equipments: any[] = []
  const bossEquipments: any[] = []
  const herbs: any[] = []
  const skillPages: string[] = []
  let awakenStones = 0
  let rerollStones = 0
  let enhanceStones = 0

  // 整场一次附灵道具 roll
  awakenStones += rollAwakenStoneBase(difficulty)
  rerollStones += rollRerollStoneBase(difficulty)
  enhanceStones += rollEnhanceStoneBase(difficulty, dropTier)

  // 每只怪物有概率掉落常规装备（数量按秘境设计，每场 2-6 件）
  // 粗略：普通 40% / 困难 55% / 噩梦 70%
  const regularDropRate = difficulty === 1 ? 0.35 : difficulty === 2 ? 0.5 : 0.65
  const bossExtraCount = difficulty === 1 ? 1 : difficulty === 2 ? 1 : 2

  // 功法残页每场硬上限：普通 1 / 困难 2 / 噩梦 3
  // 原来按怪逐个 roll，噩梦 7 波堆下来能爆 5-8 个，过量
  const skillPageCap = difficulty === 1 ? 1 : difficulty === 2 ? 2 : 3

  for (const m of killedMonsters) {
    // 常规装备（任何怪物）
    if (Math.random() < regularDropRate) {
      equipments.push(generateSecretRealmEquip(dropTier, difficulty, false, m.element))
    }
    // Boss 保底装备
    if (m.isBoss) {
      for (let i = 0; i < bossExtraCount; i++) {
        bossEquipments.push(generateSecretRealmEquip(dropTier, difficulty, true, m.element))
      }
      // Boss 波附灵道具保底
      awakenStones += rollAwakenStoneBossBonus(difficulty)
      rerollStones += rollRerollStoneBossBonus(difficulty)
      enhanceStones += rollEnhanceStoneBossBonus(difficulty, dropTier)
    }
    // 灵草
    const herb = generateSecretRealmHerb(dropTier, m.element, m.isBoss)
    if (herb) herbs.push(herb)
    // 功法残页（受每场上限约束）
    if (skillPages.length < skillPageCap) {
      const sp = generateSecretRealmSkillPage(dropTier, m.isBoss, ownedSkillCounts)
      if (sp) {
        skillPages.push(sp)
        ownedSkillCounts[sp] = (ownedSkillCounts[sp] || 0) + 1
      }
    }
  }

  // 每人保底：如果总装备数 < 队伍人数，补齐到 teamSize
  const totalEquipCount = equipments.length + bossEquipments.length
  if (totalEquipCount < teamSize) {
    const needCount = teamSize - totalEquipCount
    for (let i = 0; i < needCount; i++) {
      equipments.push(generateSecretRealmEquip(dropTier, difficulty, false, null))
    }
  }

  return { equipments, bossEquipments, herbs, skillPages, awakenStones, rerollStones, enhanceStones }
}

/**
 * 强化石分配：按人头均分，余数随机给一位队员
 * 返回每个队员分到的强化石数量
 */
export function distributeEnhanceStones(
  stones: number,
  contributions: { characterId: number; contribution: number }[],
): Map<number, number> {
  const result = new Map<number, number>()
  for (const c of contributions) result.set(c.characterId, 0)
  if (stones <= 0 || contributions.length === 0) return result
  const per = Math.floor(stones / contributions.length)
  const remainder = stones % contributions.length
  for (const c of contributions) result.set(c.characterId, per)
  const shuffled = [...contributions].sort(() => Math.random() - 0.5)
  for (let i = 0; i < remainder; i++) {
    const id = shuffled[i].characterId
    result.set(id, (result.get(id) || 0) + 1)
  }
  return result
}

/**
 * 附灵道具分配：附灵石按人头均分（余数随机），灵枢玉按贡献加权
 */
export function distributeAwakenItems(
  awakenStones: number,
  rerollStones: number,
  contributions: { characterId: number; contribution: number }[],
): Map<number, { awaken_stone: number; awaken_reroll: number }> {
  const result = new Map<number, { awaken_stone: number; awaken_reroll: number }>()
  for (const c of contributions) result.set(c.characterId, { awaken_stone: 0, awaken_reroll: 0 })

  if (contributions.length === 0) return result

  // 附灵石：均分
  const stonePerPerson = Math.floor(awakenStones / contributions.length)
  const stoneRemainder = awakenStones % contributions.length
  for (const c of contributions) {
    result.get(c.characterId)!.awaken_stone = stonePerPerson
  }
  // 余数随机分配
  const shuffled = [...contributions].sort(() => Math.random() - 0.5)
  for (let i = 0; i < stoneRemainder; i++) {
    result.get(shuffled[i].characterId)!.awaken_stone += 1
  }

  // 灵枢玉：按贡献加权（贡献第一 ×1.5）
  if (rerollStones > 0) {
    const sortedByContrib = [...contributions].sort((a, b) => b.contribution - a.contribution)
    const topId = sortedByContrib[0].characterId
    for (let i = 0; i < rerollStones; i++) {
      const weights = contributions.map(c => {
        const w = c.contribution + 0.1
        return c.characterId === topId ? w * 1.5 : w
      })
      const total = weights.reduce((a, b) => a + b, 0)
      let r = Math.random() * total
      let target = contributions[0].characterId
      for (let j = 0; j < contributions.length; j++) {
        r -= weights[j]
        if (r <= 0) { target = contributions[j].characterId; break }
      }
      result.get(target)!.awaken_reroll += 1
    }
  }

  return result
}

/**
 * 按贡献度加权分配装备给队员
 * 规则：
 * - 红色：贡献最高者
 * - 金色：贡献第一权重 ×2
 * - 其他：按贡献加权（权重 ×1.5 给最高）
 * - 保底：每人至少 1 件
 */
export function distributeEquipments(
  allEquipments: any[],
  contributions: { characterId: number; contribution: number }[],
): Map<number, any[]> {
  const result = new Map<number, any[]>()
  for (const c of contributions) result.set(c.characterId, [])

  if (allEquipments.length === 0) return result
  if (contributions.length === 0) return result

  // 找贡献最高者
  const topContributor = contributions.reduce((a, b) => a.contribution > b.contribution ? a : b).characterId

  // 按贡献加权（贡献第一 ×1.5）
  const sorted = [...contributions].sort((a, b) => b.contribution - a.contribution)
  const topId = sorted[0].characterId

  // 先处理红色/金色装备（高价值装备）
  const highValue = allEquipments.filter(e => e.rarity === 'red' || e.rarity === 'gold')
  const lowValue = allEquipments.filter(e => e.rarity !== 'red' && e.rarity !== 'gold')

  // 红色给贡献第一；金色 70% 概率给第一
  for (const eq of highValue) {
    if (eq.rarity === 'red') {
      result.get(topContributor)!.push(eq)
    } else {
      const goTop = Math.random() < 0.7
      const target = goTop ? topContributor : contributions[rand(0, contributions.length - 1)].characterId
      result.get(target)!.push(eq)
    }
  }

  // 低品质装备：每人至少 1 件保底
  const unassigned = [...lowValue]
  // 先保底
  for (const c of contributions) {
    if (result.get(c.characterId)!.length === 0 && unassigned.length > 0) {
      const idx = rand(0, unassigned.length - 1)
      result.get(c.characterId)!.push(unassigned[idx])
      unassigned.splice(idx, 1)
    }
  }
  // 剩余按贡献加权
  for (const eq of unassigned) {
    const weights = contributions.map(c => {
      const w = c.contribution + 0.1
      return c.characterId === topId ? w * 1.5 : w
    })
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    let target = contributions[0].characterId
    for (let i = 0; i < contributions.length; i++) {
      r -= weights[i]
      if (r <= 0) { target = contributions[i].characterId; break }
    }
    result.get(target)!.push(eq)
  }

  return result
}
