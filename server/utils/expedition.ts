// 游历产出滚卡 - 设计文档 2.2.5
// 6 类产出：邂逅 30% / 道侣培养材料 30% / 红尘玉 20% / 炼丹灵草 10% / 修仙奇遇 5% / 修仙劫难 5%

import type { Pool } from 'pg'
import { rand } from '~/server/utils/random'
import {
  EXPEDITION_LOCATIONS,
  EXPEDITION_CONFIG,
  GIFT_MATERIAL_DROP_TABLE,
  listEligibleLocations,
  calcDailyExpeditionLimit,
  type ExpeditionLocation,
} from '~/server/engine/companionData'
import {
  generatePendingEncounter,
  countUnmarriedCompanions,
  getWeekNumber,
  type PendingEncounter,
} from '~/server/utils/companion'

// ============================================================
// 产出类型
// ============================================================

export type ExpeditionOutcomeType =
  | 'encounter'        // 邂逅道侣
  | 'gift_material'    // 道侣培养材料
  | 'red_jade'         // 红尘玉
  | 'herb'             // 炼丹灵草
  | 'fortune'          // 修仙奇遇
  | 'mishap'           // 修仙劫难

export interface ExpeditionOutcome {
  type: ExpeditionOutcomeType

  // type='encounter' 时
  encounter?: {
    pending: PendingEncounter
    script: { id: string; title: string; scene: string; npcDescription: string; style: string }
  }

  // type='gift_material' 时
  giftMaterials?: Array<{ itemId: string; quantity: number; kind: string }>

  // type='red_jade' 时
  redJade?: number

  // type='herb' 时
  herbs?: Array<{ herbId: string; quality: number; quantity: number }>

  // type='fortune' / 'mishap' 时
  text?: string
  rewardOrPenalty?: {
    redJade?: number
    seeds?: Array<{ itemId: string; quantity: number }>
    spiritStone?: number  // 负数表示损失
    pills?: Array<{ itemId: string; quantity: number }>  // 极低概率出丹（红尘解/夺天造化丹）
  }

  // 所有产出共享：附带灵石（劫难时为负数）
  spiritStoneBonus: number
}

// ============================================================
// 产出滚卡
// ============================================================

// 滚 6 类产出之一（名册满时排除 encounter）
function rollOutcomeType(includeEncounter: boolean): ExpeditionOutcomeType {
  const w = EXPEDITION_CONFIG.outcomeWeights
  const weights: Array<[ExpeditionOutcomeType, number]> = []

  if (includeEncounter) weights.push(['encounter', w.encounter])
  weights.push(['gift_material', w.giftMaterial])
  weights.push(['red_jade', w.redJade])
  weights.push(['herb', w.herb])
  weights.push(['fortune', w.fortune])
  weights.push(['mishap', w.mishap])

  const total = weights.reduce((sum, [, weight]) => sum + weight, 0)
  let r = Math.random() * total
  for (const [type, weight] of weights) {
    r -= weight
    if (r <= 0) return type
  }
  return weights[0][0]
}

// 道侣培养材料子表（30% 主产出展开，参考 2.2.5.1）
function rollGiftMaterial(isFestival: boolean): Array<{ itemId: string; quantity: number; kind: string }> {
  // 红尘花种子仅在七夕活动期间触发
  const eligibleEntries = GIFT_MATERIAL_DROP_TABLE.filter(e => {
    if (e.kind === 'seed_red_dust' && !isFestival) return false
    return true
  })

  const total = eligibleEntries.reduce((sum, e) => sum + e.weight, 0)
  let r = Math.random() * total
  let chosen = eligibleEntries[0]
  for (const e of eligibleEntries) {
    r -= e.weight
    if (r <= 0) {
      chosen = e
      break
    }
  }

  // 从条目的 items 数组随机一个 + 数量
  const itemId = chosen.items[Math.floor(Math.random() * chosen.items.length)]
  const quantity = rand(chosen.qtyMin, chosen.qtyMax)
  return [{ itemId, quantity, kind: chosen.kind }]
}

// 红尘玉拾获子表（按地点等级浮动）
function rollRedJade(location: ExpeditionLocation): number {
  const [min, max] = location.redJadeRange
  return rand(min, max)
}

// 炼丹灵草子表（10% 产出，按地点灵根偏向给五行灵草）
function rollHerb(location: ExpeditionLocation): Array<{ herbId: string; quality: number; quantity: number }> {
  // 主灵草：70% 概率掉本地点偏向五行的灵草，30% 随机
  const ALL_HERBS_BY_ROOT: Record<string, string> = {
    metal: 'metal_herb',
    wood: 'wood_herb',
    water: 'water_herb',
    fire: 'fire_herb',
    earth: 'earth_herb',
  }
  let chosenRoot: string
  if (Math.random() < 0.7 && location.rootBias.length > 0) {
    chosenRoot = location.rootBias[Math.floor(Math.random() * location.rootBias.length)]
  } else {
    const roots = ['metal', 'wood', 'water', 'fire', 'earth']
    chosenRoot = roots[Math.floor(Math.random() * roots.length)]
  }
  const herbId = ALL_HERBS_BY_ROOT[chosenRoot]

  // 品质：地点等级越高，玄品+ 概率越高（简化为 tier 影响）
  const tier = location.realmRequired
  let quality = 0  // 凡品
  const r = Math.random()
  if (tier >= 7) {
    if (r < 0.30) quality = 4       // 天品 30%
    else if (r < 0.65) quality = 3  // 地品 35%
    else if (r < 0.90) quality = 2  // 玄品 25%
    else quality = 1                 // 灵品 10%
  } else if (tier >= 5) {
    if (r < 0.10) quality = 3       // 地品 10%
    else if (r < 0.45) quality = 2  // 玄品 35%
    else if (r < 0.80) quality = 1  // 灵品 35%
    else quality = 0                 // 凡品 20%
  } else {
    // 金丹/元婴
    if (r < 0.05) quality = 2       // 玄品 5%
    else if (r < 0.30) quality = 1  // 灵品 25%
    else quality = 0                 // 凡品 70%
  }

  return [{ herbId, quality, quantity: rand(1, 3) }]
}

// 修仙奇遇库（占位 5 段，复用现有 random-events 风格但本地展开）
const FORTUNE_TEXTS = [
  '你在山林深处偶遇一位垂钓老者，他赠你一颗奇珍灵果。',
  '你于古洞中拾得一枚前辈遗落的玉简，记载着零散修真心得。',
  '你在溪边邂逅一位浣纱姑娘，她解囊赠你一份礼物。',
  '你穿过云雾密布的山道，发现一片野生灵田，采得灵草若干。',
  '你于荒漠中救助一位濒死散修，他将随身携带的物品赠予你。',
]

// 修仙劫难库
const MISHAP_TEXTS = [
  '你不慎闯入散修地盘，被勒索一笔灵石才放行。',
  '你在密林中遇见妖兽偷袭，仓促之间损失了部分修为。',
  '你被山中浓雾困住，体力消耗不少。',
  '你误食了一枚毒果，幸好及时排毒，但元气大伤。',
  '你被一伙劫匪盯上，挣脱时遗落了部分物资。',
]

function rollFortune(location: ExpeditionLocation): { text: string; rewardOrPenalty: ExpeditionOutcome['rewardOrPenalty'] } {
  const text = FORTUNE_TEXTS[Math.floor(Math.random() * FORTUNE_TEXTS.length)]
  const r = Math.random()
  // 5% 奇遇产出特殊丹药（fortune 5% × 子 5% = 整体 0.25% 出红尘解 / 整体 0.05% 出夺天造化丹）
  if (r < 0.05) {
    if (Math.random() < 0.8) {
      return {
        text: '你在山涧深处拾得一枚泛着红光的玉简，似是前人和离遗落的「红尘解」。',
        rewardOrPenalty: { pills: [{ itemId: 'parting_charm', quantity: 1 }] },
      }
    }
    return {
      text: '你于古洞中发现一枚天材地宝，竟是传说中的「夺天造化丹」！',
      rewardOrPenalty: { pills: [{ itemId: 'fate_pill', quantity: 1 }] },
    }
  }
  // 50% 给红尘玉 +50，50% 给情花种子 ×1
  if (r < 0.525) {
    return { text, rewardOrPenalty: { redJade: 50 } }
  }
  return {
    text,
    rewardOrPenalty: {
      seeds: [{ itemId: 'silk_flower_seed', quantity: 1 }],
    },
  }
}

function rollMishap(realmTier: number): { text: string; rewardOrPenalty: ExpeditionOutcome['rewardOrPenalty'] } {
  const text = MISHAP_TEXTS[Math.floor(Math.random() * MISHAP_TEXTS.length)]
  // 损失少量灵石（按境界缩放）
  const penalty = Math.floor(EXPEDITION_CONFIG.baseStoneCostPerExpedition * 0.3 * (realmTier / 3))
  return {
    text,
    rewardOrPenalty: { spiritStone: -penalty },
  }
}

// ============================================================
// 主入口
// ============================================================

export interface ExpeditionContext {
  characterId: number
  realmTier: number
  location: ExpeditionLocation
  isFestival: boolean
  rosterFull: boolean   // 名册是否已满 5 位未结侣
}

// 滚一次完整产出
export function rollExpedition(ctx: ExpeditionContext): ExpeditionOutcome {
  const type = rollOutcomeType(!ctx.rosterFull)

  // 附带灵石（每类产出有不同区间）
  let stoneBonus = 0

  switch (type) {
    case 'encounter': {
      const pending = generatePendingEncounter(ctx.location)
      return {
        type: 'encounter',
        encounter: {
          pending,
          script: {
            id: pending.script.id,
            title: pending.script.title,
            scene: pending.script.scene,
            npcDescription: pending.script.npcDescription,
            style: pending.script.style,
          },
        },
        spiritStoneBonus: 0,
      }
    }

    case 'gift_material': {
      stoneBonus = rand(500, 1500)
      return {
        type: 'gift_material',
        giftMaterials: rollGiftMaterial(ctx.isFestival),
        spiritStoneBonus: stoneBonus,
      }
    }

    case 'red_jade': {
      stoneBonus = rand(200, 800)
      return {
        type: 'red_jade',
        redJade: rollRedJade(ctx.location),
        spiritStoneBonus: stoneBonus,
      }
    }

    case 'herb': {
      stoneBonus = rand(300, 1000)
      return {
        type: 'herb',
        herbs: rollHerb(ctx.location),
        spiritStoneBonus: stoneBonus,
      }
    }

    case 'fortune': {
      stoneBonus = rand(500, 2000)
      const fortune = rollFortune(ctx.location)
      return {
        type: 'fortune',
        text: fortune.text,
        rewardOrPenalty: fortune.rewardOrPenalty,
        spiritStoneBonus: stoneBonus,
      }
    }

    case 'mishap': {
      const mishap = rollMishap(ctx.realmTier)
      return {
        type: 'mishap',
        text: mishap.text,
        rewardOrPenalty: mishap.rewardOrPenalty,
        spiritStoneBonus: 0,
      }
    }
  }
}

// ============================================================
// 数据库操作 - 游历状态
// ============================================================

export interface ExpeditionStatus {
  countToday: number
  date: string | null
  extraToday: number
  extraWeek: number
  weekNumber: number
  realmTier: number
  sectLevel: number
  spiritStone: number
}

// 读取角色当前游历状态
export async function getExpeditionStatus(pool: Pool, characterId: number): Promise<ExpeditionStatus | null> {
  const { rows } = await pool.query(
    `SELECT c.expedition_count_today, c.expedition_date, c.expedition_extra_today,
            c.expedition_extra_week, c.expedition_week_number,
            c.realm_tier, c.spirit_stone,
            COALESCE(s.level, 0) AS sect_level
       FROM characters c
       LEFT JOIN sect_members sm ON sm.character_id = c.id
       LEFT JOIN sects s ON s.id = sm.sect_id
      WHERE c.id = $1`,
    [characterId]
  )
  if (!rows[0]) return null
  return {
    countToday: rows[0].expedition_count_today,
    date: rows[0].expedition_date ? String(rows[0].expedition_date) : null,
    extraToday: rows[0].expedition_extra_today,
    extraWeek: rows[0].expedition_extra_week,
    weekNumber: rows[0].expedition_week_number,
    realmTier: rows[0].realm_tier,
    sectLevel: rows[0].sect_level,
    spiritStone: rows[0].spirit_stone,
  }
}

// 跨日重置 + 跨周重置（懒重置：在每次访问时检查并重置）
export async function ensureExpeditionDailyReset(pool: Pool, characterId: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const week = getWeekNumber()
  await pool.query(
    `UPDATE characters
        SET expedition_count_today = CASE WHEN expedition_date IS DISTINCT FROM $1::date THEN 0 ELSE expedition_count_today END,
            expedition_extra_today = CASE WHEN expedition_date IS DISTINCT FROM $1::date THEN 0 ELSE expedition_extra_today END,
            expedition_date = $1::date,
            expedition_extra_week = CASE WHEN expedition_week_number != $2 THEN 0 ELSE expedition_extra_week END,
            expedition_week_number = $2
      WHERE id = $3`,
    [today, week, characterId]
  )
}

// 计算今日剩余次数
export function calcRemaining(status: ExpeditionStatus, isFestival: boolean): number {
  const limit = calcDailyExpeditionLimit({
    sectLevel: status.sectLevel,
    expeditionExtraToday: status.extraToday,
    isFestival,
  })
  return Math.max(0, limit - status.countToday)
}

// 计算游历灵石消耗（按境界梯度，参考文档 2.2.4：金丹期 = 1万）
// 梯度递增：金丹 1万 / 元婴 3万 / 化神 10万 / 渡劫 30万 / 大乘 100万 / 飞升 300万
export function calcExpeditionCost(realmTier: number): number {
  const TABLE: Record<number, number> = {
    3: 10000,    // 金丹
    4: 30000,    // 元婴
    5: 100000,   // 化神
    6: 300000,   // 渡劫
    7: 1000000,  // 大乘
    8: 3000000,  // 飞升
  }
  return TABLE[realmTier] || 10000
}

// 列出可用地点
export function listAvailableLocations(realmTier: number): ExpeditionLocation[] {
  return listEligibleLocations(realmTier)
}

// 是否名册已满
export async function isRosterFull(pool: Pool, characterId: number): Promise<boolean> {
  const count = await countUnmarriedCompanions(pool, characterId)
  return count >= EXPEDITION_CONFIG.rosterMaxUnmarried
}
