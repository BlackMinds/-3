// 石头 → 功法效果 解析管线
// 输入: 书ID + 石头ID 数组（按孔位顺序）
// 输出: 可被 battleEngine 消费的 ResolvedSkill

import { STONE_MAP } from './stoneData'
import { BOOK_MAP } from './skillBookData'
import type { Skill, PassiveEffect, SkillDebuff, SkillBuff } from './skillData'
import type { Stone, StoneEffect, SkillBook, PassiveStatBlock } from '../../shared/stoneTypes'
import { STONE_CAPS, getSlotLayout, canSlotStone } from '../../shared/stoneTypes'

export interface ResolvedSkill extends Skill {
  // 触发元数据（battleEngine 读取，根据 type 决定战斗钩子）
  trigger?: {
    type:
      | 'echo' | 'swap_aoe' | 'combo_burn' | 'extra_bleed'
      | 'counter' | 'skill_swap' | 'last_stand'
    value?: number
    threshold?: number
    duration?: number
  }
  // 质变元数据
  ultimate?: {
    type: 'lifesteal' | 'overflow_dmg' | 'overflow_heal' | 'chain' | 'heal_share'
       | 'reflect' | 'dot_detonate' | 'shield_to_dmg' | 'regen_to_atk' | 'true_damage'
    value?: number
  }
}

export interface ResolveOptions {
  // 若角色灵根匹配书元素，追加 +20% 伤害/+15% 概率/+1回合
  // 这一层也可以留给 battleEngine 做，这里只给出"书 × 石头"的纯净值
  applyRootMatch?: boolean
  characterRoot?: 'metal' | 'wood' | 'water' | 'fire' | 'earth' | null
}

export interface ResolveResult {
  ok: boolean
  skill?: ResolvedSkill
  error?: string
}

// 验证镶嵌合法性（孔位类型、品质、互斥、唯一）
export function validateSlotted(bookId: string, stones: (string | null)[]): { ok: boolean; error?: string } {
  const book = BOOK_MAP[bookId]
  if (!book) return { ok: false, error: `未知功法书: ${bookId}` }
  const layout = getSlotLayout(book.rarity)
  if (stones.length > layout.length) {
    return { ok: false, error: `孔位超限: 该品质最多 ${layout.length} 孔` }
  }

  const seenMutex = new Set<string>()
  let hasCore = false
  let ultCount = 0
  let triggerCount = 0

  for (let i = 0; i < stones.length; i++) {
    const sid = stones[i]
    if (!sid) continue
    const s = STONE_MAP[sid]
    if (!s) return { ok: false, error: `未知石头: ${sid}` }
    const expected = layout[i]
    if (s.type !== expected) {
      return { ok: false, error: `第 ${i + 1} 孔应装 ${expected}，实际装了 ${s.type}（${s.name}）` }
    }
    if (!canSlotStone(book.rarity, s.rarity)) {
      return { ok: false, error: `石头 ${s.name} 品质高于书，无法镶嵌` }
    }
    if (s.forSkillTypes && !s.forSkillTypes.includes(book.skillType)) {
      return { ok: false, error: `石头 ${s.name} 不适用于 ${book.skillType} 书` }
    }
    if (s.type === 'core') hasCore = true
    if (s.type === 'ultimate') ultCount++
    if (s.type === 'trigger') triggerCount++

    // 互斥标签检查
    if (s.effect.mutexTags) {
      for (const tag of s.effect.mutexTags) {
        if (seenMutex.has(tag)) {
          return { ok: false, error: `石头 ${s.name} 与已有石头在标签 [${tag}] 上互斥` }
        }
      }
      for (const tag of s.effect.mutexTags) seenMutex.add(tag)
    }
  }

  if (book.rarity !== 'white' && !hasCore && stones.some(Boolean)) {
    // 非白品：允许未镶嵌（此书此时无效）；镶嵌了但没核心石视为违规
    if (stones.some(s => s !== null)) {
      const nonEmpty = stones.filter(Boolean).length
      if (nonEmpty > 0 && !hasCore) return { ok: false, error: '镶嵌了石头但缺核心石' }
    }
  }
  if (ultCount > 1) return { ok: false, error: '每本书最多 1 颗质变石' }
  if (triggerCount > 1) return { ok: false, error: '每本书最多 1 颗触发石' }
  return { ok: true }
}

// 克隆核心石的 effect 作为基础
function baseFromCore(core: Stone): ResolvedSkill {
  const ce = core.effect
  const skill: ResolvedSkill = {
    id: `resolved_${core.id}`,
    name: core.name,
    type: 'active',
    rarity: core.rarity,
    element: core.element,
    multiplier: ce.baseMultiplier ?? 0,
    description: core.description,
  }
  if (ce.debuff) skill.debuff = { ...ce.debuff }
  if (ce.buff) skill.buff = { ...ce.buff }
  if (ce.healAtkRatio !== undefined) skill.healAtkRatio = ce.healAtkRatio
  if (ce.isAoe) skill.isAoe = true
  if (ce.targetCount !== undefined) skill.targetCount = ce.targetCount
  if (ce.hitCount !== undefined) skill.hitCount = ce.hitCount
  if (ce.ignoreDef !== undefined) skill.ignoreDef = ce.ignoreDef
  if (ce.passive) skill.effect = { ...ce.passive } as PassiveEffect
  return skill
}

function mergePassive(dst: PassiveEffect | undefined, add: PassiveStatBlock): PassiveEffect {
  const out: PassiveEffect = { ...(dst ?? {}) }
  for (const [k, v] of Object.entries(add)) {
    if (typeof v === 'number') {
      const cur = (out as Record<string, unknown>)[k]
      ;(out as Record<string, unknown>)[k] = typeof cur === 'number' ? cur + v : v
    } else {
      // boolean 字段直接覆盖
      ;(out as Record<string, unknown>)[k] = v
    }
  }
  return out
}

export function resolve(bookId: string, stones: (string | null)[], opts: ResolveOptions = {}): ResolveResult {
  const book = BOOK_MAP[bookId]
  if (!book) return { ok: false, error: `未知功法书: ${bookId}` }
  const vv = validateSlotted(bookId, stones)
  if (!vv.ok) return { ok: false, error: vv.error }

  const layout = getSlotLayout(book.rarity)
  const coreStoneId = stones[0]
  if (!coreStoneId) {
    // 未镶嵌核心 = 空书无效果（白品除外：白品只有一孔，如果是空书也无效）
    return { ok: false, error: '未装核心石，书无效' }
  }
  const core = STONE_MAP[coreStoneId]
  if (!core || core.type !== 'core') return { ok: false, error: '核心孔必须装核心石' }

  const skill = baseFromCore(core)
  skill.type = book.skillType
  skill.rarity = book.rarity

  // 累积器
  let multiplierBonus = 0
  let chanceBonus = 0
  let durationBonus = 0
  let targetCountBonus = 0
  let hitCountOverride: number | undefined
  let cdCut = 0
  let extraIgnoreDef = 0
  let forceAoe = false

  // 遍历剩余孔
  for (let i = 1; i < stones.length; i++) {
    const sid = stones[i]
    if (!sid) continue
    const s = STONE_MAP[sid]
    if (!s) continue
    const e = s.effect

    if (s.type === 'amp') {
      if (e.multiplierBonus) multiplierBonus += e.multiplierBonus
      if (e.chanceBonus) chanceBonus += e.chanceBonus
      if (e.durationBonus) durationBonus += e.durationBonus
      if (e.targetCountBonus) targetCountBonus += e.targetCountBonus
      if (e.hitCountBonus) hitCountOverride = e.hitCountBonus
      if (e.cdCut) cdCut += e.cdCut
      if (e.extraIgnoreDef) extraIgnoreDef += e.extraIgnoreDef
      if (e.isAoe) forceAoe = true
      if (e.passive) skill.effect = mergePassive(skill.effect as PassiveEffect | undefined, e.passive)
    } else if (s.type === 'trigger') {
      if (e.triggerType) {
        skill.trigger = {
          type: e.triggerType,
          value: e.triggerValue,
          threshold: e.triggerThreshold,
          duration: e.triggerDuration,
        }
      }
      // 被动触发石可能有 passive 效果
      if (e.passive) skill.effect = mergePassive(skill.effect as PassiveEffect | undefined, e.passive)
    } else if (s.type === 'ultimate') {
      if (e.ultType) {
        skill.ultimate = { type: e.ultType, value: e.ultValue }
      }
    }
  }

  // 数值护栏 clamp
  multiplierBonus = Math.min(multiplierBonus, STONE_CAPS.multiplierBonusTotal)
  chanceBonus = Math.min(chanceBonus, STONE_CAPS.chanceBonusTotal)
  durationBonus = Math.min(durationBonus, STONE_CAPS.durationBonusTotal)

  // 灵根匹配 bonus
  let rootDmgBonus = 0
  let rootChanceBonus = 0
  let rootDurationBonus = 0
  if (opts.applyRootMatch && book.element && opts.characterRoot === book.element) {
    rootDmgBonus = 0.20
    rootChanceBonus = 0.15
    rootDurationBonus = 1
  }

  // 应用到最终 skill
  if (skill.multiplier > 0) {
    skill.multiplier = skill.multiplier * (1 + multiplierBonus + rootDmgBonus)
  }
  if (skill.debuff) {
    skill.debuff.chance = Math.min(1, skill.debuff.chance + chanceBonus + rootChanceBonus)
    skill.debuff.duration = skill.debuff.duration + durationBonus + rootDurationBonus
  }
  if (skill.buff) {
    skill.buff.duration = skill.buff.duration + durationBonus + rootDurationBonus
  }
  if (targetCountBonus > 0 && !skill.isAoe) {
    skill.targetCount = (skill.targetCount ?? 1) + targetCountBonus
  }
  if (hitCountOverride !== undefined && !skill.isAoe) {
    skill.hitCount = hitCountOverride
  }
  if (forceAoe) skill.isAoe = true
  if (cdCut > 0 && skill.cdTurns) {
    skill.cdTurns = Math.max(1, skill.cdTurns - cdCut)
  }
  if (extraIgnoreDef > 0) {
    const total = (skill.ignoreDef ?? 0) + extraIgnoreDef
    skill.ignoreDef = Math.min(STONE_CAPS.ignoreDefTotal, total)
  }

  // 质变石·真伤：倍率降为 70% 并标记
  if (skill.ultimate?.type === 'true_damage' && skill.multiplier > 0) {
    skill.multiplier = skill.multiplier * 0.70
    skill.ignoreDef = 1.0 // 无视所有防御（实际抗性扣除由 battleEngine 处理）
  }

  // 重建 description
  skill.description = buildDescription(skill, book)
  skill.id = `resolved_${book.id}_${coreStoneId}`
  skill.name = buildSkillName(skill, book, core)

  return { ok: true, skill }
}

function buildSkillName(skill: ResolvedSkill, book: SkillBook, core: Stone): string {
  return core.name.replace('核心', '').replace('基础斩击', '斩击') + '·自定义'
}

function buildDescription(skill: ResolvedSkill, book: SkillBook): string {
  const parts: string[] = []
  if (skill.multiplier > 0) {
    const pct = Math.round(skill.multiplier * 100)
    if (skill.isAoe) parts.push(`[群攻] 全体${pct}%伤害`)
    else if (skill.hitCount && skill.hitCount > 1) parts.push(`[${skill.hitCount}段] 单体${skill.hitCount}×${Math.round(pct / skill.hitCount)}%伤害`)
    else if (skill.targetCount && skill.targetCount > 1) parts.push(`[${skill.targetCount}目标] ${pct}%伤害`)
    else parts.push(`造成${pct}%伤害`)
  }
  if (skill.debuff) {
    const ch = Math.round(skill.debuff.chance * 100)
    parts.push(`${ch}%${debuffName(skill.debuff.type)}${skill.debuff.duration}回合`)
  }
  if (skill.buff) {
    if (skill.buff.type === 'regen') parts.push(`每回合回${Math.round((skill.buff.valuePercent ?? 0) * 100)}%气血${skill.buff.duration}回合`)
    else if (skill.buff.type === 'shield') parts.push(`护盾${Math.round((skill.buff.value ?? 0) * 100)}%ATK${skill.buff.duration}回合`)
    else parts.push(`${buffName(skill.buff.type)}${skill.buff.duration}回合`)
  }
  if (skill.healAtkRatio) parts.push(`回复${Math.round(skill.healAtkRatio * 100)}%攻击力气血`)
  if (skill.ignoreDef) parts.push(`无视${Math.round(skill.ignoreDef * 100)}%防御`)
  if (skill.ultimate) parts.push(`[${ultDescription(skill.ultimate.type, skill.ultimate.value)}]`)
  if (skill.trigger) parts.push(`<${triggerDescription(skill.trigger.type, skill.trigger.value, skill.trigger.threshold, skill.trigger.duration)}>`)
  return parts.join('，') || '(空书)'
}

function debuffName(t: string): string {
  const m: Record<string, string> = {
    burn: '灼烧', poison: '中毒', bleed: '流血', freeze: '冻结',
    stun: '眩晕', slow: '减速', brittle: '脆弱', atk_down: '攻击削弱',
    root: '束缚', silence: '封印',
  }
  return m[t] || t
}

function buffName(t: string): string {
  const m: Record<string, string> = {
    atk_up: '攻击提升', def_up: '防御提升', spd_up: '速度提升',
    crit_up: '暴击提升', shield: '护盾', regen: '持续回血',
    reflect: '反弹', immune: '免疫',
  }
  return m[t] || t
}

function ultDescription(t: string, v?: number): string {
  const pct = v !== undefined ? `${Math.round(v * 100)}%` : ''
  switch (t) {
    case 'lifesteal':     return `吸血 ${pct || '30%'}`
    case 'overflow_dmg':  return '目标死亡时溢出伤害到下一只'
    case 'overflow_heal': return '治疗溢出转化为对敌方伤害'
    case 'chain':         return `连锁：对第二目标造成 ${pct || '60%'} 伤害`
    case 'heal_share':    return '同时治疗血量最低的第二人'
    case 'reflect':       return `反弹受击伤害 ${pct || '20%'}`
    case 'dot_detonate':  return `DOT 层数 ×${pct || '15%'} 作为直接伤害`
    case 'shield_to_dmg': return '护盾消失时 50% 转化为伤害还击'
    case 'regen_to_atk':  return '回血时叠加 ATK buff'
    case 'true_damage':   return '真伤（倍率 70%，无视防御抗性）'
    default:              return t
  }
}

function triggerDescription(t: string, v?: number, th?: number, dur?: number): string {
  const pct = v !== undefined ? `${Math.round(v * 100)}%` : ''
  switch (t) {
    case 'echo':        return '暴击时再打一次'
    case 'swap_aoe':    return `血量<${Math.round((th ?? 0.3) * 100)}% 时变群攻`
    case 'combo_burn':  return `引爆灼烧（层数×${pct || '15%'} ATK）`
    case 'extra_bleed': return `暴击附加流血 ${dur ?? 3} 回合`
    case 'counter':     return '闪避后立刻反击一次'
    case 'skill_swap':  return '下回合主修变群攻'
    case 'last_stand':  return `免死 1 次（保留 ${pct || '20%'} 血）`
    default:            return t
  }
}
