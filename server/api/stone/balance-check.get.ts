// 平衡验证端点 — 枚举典型书的合法组合，统计分布 & 检测护栏突破
// GET /api/stone/balance-check
import {
  ALL_STONES,
  CORE_DMG_STONES, CORE_DEBUFF_STONES, CORE_HEAL_STONES, CORE_BUFF_STONES, CORE_PASSIVE_STONES,
  AMP_STONES, AMP_PASSIVE_STONES, TRIGGER_STONES, ULTIMATE_STONES,
  STONE_MAP,
} from '~/server/engine/stoneData'
import { ALL_BOOKS, bookIdOf } from '~/server/engine/skillBookData'
import { resolve, validateSlotted } from '~/server/engine/stoneResolver'
import { getSlotLayout, STONE_CAPS } from '~/shared/stoneTypes'
import type { Stone, Rarity, SkillType } from '~/shared/stoneTypes'

const rarityOrder: Rarity[] = ['white', 'green', 'blue', 'purple', 'gold', 'red']
const rarityIdx = (r: Rarity) => rarityOrder.indexOf(r)

function pickStonesForSlot(slotType: 'core' | 'amp' | 'trigger' | 'ultimate', bookRarity: Rarity, skillType: SkillType): Stone[] {
  const pool = slotType === 'core'
    ? [...CORE_DMG_STONES, ...CORE_DEBUFF_STONES, ...CORE_HEAL_STONES, ...CORE_BUFF_STONES, ...CORE_PASSIVE_STONES]
    : slotType === 'amp' ? [...AMP_STONES, ...AMP_PASSIVE_STONES]
    : slotType === 'trigger' ? TRIGGER_STONES
    : ULTIMATE_STONES

  return pool.filter(s =>
    s.type === slotType &&
    rarityIdx(s.rarity) <= rarityIdx(bookRarity) &&
    (!s.forSkillTypes || s.forSkillTypes.includes(skillType))
  )
}

interface Stat {
  bookId: string
  bookRarity: string
  bookType: string
  enumerated: number
  validCombos: number
  mutexRejected: number
  maxMultiplier: number
  maxMultiplierCombo: string[]
  maxDebuffChance: number
  maxDuration: number
  maxTargetCount: number
  violations: string[]
}

function checkBook(bookId: string, sampleLimit = 4): Stat {
  const book = ALL_BOOKS.find(b => b.id === bookId)!
  const layout = getSlotLayout(book.rarity)
  const stat: Stat = {
    bookId, bookRarity: book.rarity, bookType: book.skillType,
    enumerated: 0, validCombos: 0, mutexRejected: 0,
    maxMultiplier: 0, maxMultiplierCombo: [],
    maxDebuffChance: 0, maxDuration: 0, maxTargetCount: 0, violations: [],
  }

  const candidatesPerSlot = layout.map(t => pickStonesForSlot(t, book.rarity, book.skillType).slice(0, sampleLimit))

  function recur(idx: number, picked: (string | null)[]) {
    if (idx >= layout.length) {
      stat.enumerated++
      const v = validateSlotted(bookId, picked)
      if (!v.ok) {
        if (v.error?.includes('互斥')) stat.mutexRejected++
        return
      }
      const r = resolve(bookId, picked)
      if (!r.ok || !r.skill) return
      stat.validCombos++

      const s = r.skill
      if (s.multiplier > stat.maxMultiplier) {
        stat.maxMultiplier = s.multiplier
        stat.maxMultiplierCombo = picked.filter((x): x is string => x !== null)
      }
      if (s.debuff && s.debuff.chance > stat.maxDebuffChance) stat.maxDebuffChance = s.debuff.chance
      if (s.debuff && s.debuff.duration > stat.maxDuration) stat.maxDuration = s.debuff.duration
      if (s.buff && s.buff.duration > stat.maxDuration) stat.maxDuration = s.buff.duration
      if (s.targetCount && s.targetCount > stat.maxTargetCount) stat.maxTargetCount = s.targetCount

      // 护栏检测
      const core = STONE_MAP[picked[0]!]
      const baseMul = core?.effect.baseMultiplier ?? 0
      if (baseMul > 0) {
        const bonus = (s.multiplier / baseMul) - 1
        if (bonus > STONE_CAPS.multiplierBonusTotal + 0.001) {
          stat.violations.push(`倍率叠加超限 (+${(bonus * 100).toFixed(0)}%): ${picked.filter(Boolean).join(' + ')}`)
        }
      }
      if (s.debuff && s.debuff.chance > 1.0001) {
        stat.violations.push(`debuff 概率 >100%: ${picked.filter(Boolean).join(' + ')}`)
      }
      if (s.debuff && s.debuff.duration > 6) {
        stat.violations.push(`debuff 持续 >6 回合: ${picked.filter(Boolean).join(' + ')}`)
      }
      return
    }
    const opts: (Stone | null)[] = [...candidatesPerSlot[idx]]
    if (idx > 0) opts.push(null)
    for (const o of opts) {
      picked[idx] = o?.id ?? null
      recur(idx + 1, picked)
    }
  }

  recur(0, Array(layout.length).fill(null))
  return stat
}

export default defineEventHandler(() => {
  const testBooks = [
    bookIdOf('active', 'green', 'fire'),
    bookIdOf('active', 'blue', 'fire'),
    bookIdOf('divine', 'blue', 'fire'),
    bookIdOf('divine', 'purple', 'metal'),
    bookIdOf('divine', 'gold', 'metal'),
    bookIdOf('divine', 'red', null),
    bookIdOf('passive', 'green', 'earth'),
    bookIdOf('passive', 'purple', 'wood'),
    bookIdOf('passive', 'red', null),
  ]

  const results = testBooks.map(id => checkBook(id))
  const totalCombos = results.reduce((s, r) => s + r.enumerated, 0)
  const totalValid = results.reduce((s, r) => s + r.validCombos, 0)
  const totalViolations = results.reduce((s, r) => s + r.violations.length, 0)

  const byType = ALL_STONES.reduce<Record<string, number>>((acc, s) => { acc[s.type] = (acc[s.type] ?? 0) + 1; return acc }, {})
  const byRarity = ALL_STONES.reduce<Record<string, number>>((acc, s) => { acc[s.rarity] = (acc[s.rarity] ?? 0) + 1; return acc }, {})

  return {
    code: 200,
    data: {
      summary: {
        stoneCount: ALL_STONES.length,
        bookCount: ALL_BOOKS.length,
        totalEnumerated: totalCombos,
        totalValid,
        totalViolations,
        caps: STONE_CAPS,
      },
      stoneDistribution: { byType, byRarity },
      perBook: results,
    },
  }
})
