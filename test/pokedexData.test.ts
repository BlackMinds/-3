/**
 * 妖兽图鉴名录单元测试
 * 用法：npm test（或 npx vitest run test/pokedexData.test.ts）
 */
import { describe, it, expect, vi } from 'vitest'

// fight.post.ts 用了 Nuxt 自动导入的 defineEventHandler 等全局；vitest 没有 Nuxt 运行时，
// 必须在 import 之前 stub，否则模块顶层求值会抛 ReferenceError
vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>
  g.defineEventHandler = (h: unknown) => h
  g.readBody = async () => ({})
  g.createError = (o: { statusMessage?: string } | string) =>
    new Error(typeof o === 'string' ? o : o?.statusMessage || 'err')
  g.getRequestHeader = () => undefined
  g.getCookie = () => undefined
  g.setCookie = () => undefined
  g.getQuery = () => ({})
  g.useRuntimeConfig = () => ({})
})

import {
  POKEDEX_ROSTER, POKEDEX_BY_KEY, POKEDEX_STAR_THRESHOLDS, POKEDEX_BONUS_PER_STAR,
  getEntryKey, isInRoster, getStarLevel, getBonusForStars,
} from '../server/engine/pokedexData'
import { ALL_MAPS } from '../server/api/battle/fight.post'

describe('POKEDEX_ROSTER 名录完整性', () => {
  it('精选 80 条妖兽（30 boss + 10 rare + 40 uncommon）', () => {
    expect(POKEDEX_ROSTER).toHaveLength(80)
    expect(POKEDEX_ROSTER.filter(e => e.category === 'boss')).toHaveLength(30)
    expect(POKEDEX_ROSTER.filter(e => e.category === 'rare')).toHaveLength(10)
    expect(POKEDEX_ROSTER.filter(e => e.category === 'uncommon')).toHaveLength(40)
  })
  it('所有 (mapKey, name) 在 roster 内唯一（除"虚空之主"两条按 mapKey 区分）', () => {
    const keys = POKEDEX_ROSTER.map(e => getEntryKey(e.mapKey, e.name))
    expect(new Set(keys).size).toBe(POKEDEX_ROSTER.length)
  })
  it('全部 tier 在 5..18', () => {
    for (const e of POKEDEX_ROSTER) {
      expect(e.tier).toBeGreaterThanOrEqual(5)
      expect(e.tier).toBeLessThanOrEqual(18)
    }
  })
  it('重名"虚空之主"恰好 2 条且都有 displayName', () => {
    const dupes = POKEDEX_ROSTER.filter(e => e.name === '虚空之主')
    expect(dupes).toHaveLength(2)
    for (const d of dupes) expect(d.displayName).toBeTruthy()
  })
  it('每条 mapKey 必须存在于 ALL_MAPS', () => {
    for (const e of POKEDEX_ROSTER) {
      expect(ALL_MAPS[e.mapKey], `mapKey ${e.mapKey} 不在 ALL_MAPS`).toBeDefined()
    }
  })
  it('每条 (mapKey, name) 必须能在 ALL_MAPS 的 monsters 或 boss 找到匹配', () => {
    for (const e of POKEDEX_ROSTER) {
      const map = ALL_MAPS[e.mapKey]
      const found = map.boss?.name === e.name || map.monsters.some(m => m.name === e.name)
      expect(found, `${e.mapKey}:${e.name} 在 ALL_MAPS 找不到`).toBe(true)
    }
  })
})

describe('getStarLevel 星级映射', () => {
  it('阈值边界：0/1/49/50/199/200/999/1000', () => {
    expect(getStarLevel(0)).toBe(0)
    expect(getStarLevel(1)).toBe(1)
    expect(getStarLevel(49)).toBe(1)
    expect(getStarLevel(50)).toBe(2)
    expect(getStarLevel(199)).toBe(2)
    expect(getStarLevel(200)).toBe(3)
    expect(getStarLevel(999)).toBe(3)
    expect(getStarLevel(1000)).toBe(4)
    expect(getStarLevel(9999)).toBe(4)
  })
  it('阈值常量正确', () => {
    expect(POKEDEX_STAR_THRESHOLDS).toEqual([1, 50, 200, 1000])
  })
})

describe('getBonusForStars 加成累加', () => {
  it('0 星全 0', () => {
    expect(getBonusForStars(0)).toEqual({ hpPct: 0, atkPct: 0, defPct: 0, critDmg: 0 })
  })
  it('1 星只有 hpPct', () => {
    const b = getBonusForStars(1)
    expect(b.hpPct).toBeCloseTo(0.0005)
    expect(b.atkPct).toBe(0)
  })
  it('4 星累加：hp + atk + def + critDmg', () => {
    const b = getBonusForStars(4)
    expect(b.hpPct).toBeCloseTo(0.0005)
    expect(b.atkPct).toBeCloseTo(0.0005)
    expect(b.defPct).toBeCloseTo(0.0005)
    expect(b.critDmg).toBeCloseTo(0.0003)
  })
  it('满 80 条 × 4 星 = 满档上限 +4% 三维 + 2.4% 暴伤（PRD 数值方案 A）', () => {
    const b = getBonusForStars(4)
    const total = {
      hpPct: b.hpPct! * 80,
      atkPct: b.atkPct! * 80,
      defPct: b.defPct! * 80,
      critDmg: b.critDmg! * 80,
    }
    expect(total.hpPct).toBeCloseTo(0.04, 5)
    expect(total.atkPct).toBeCloseTo(0.04, 5)
    expect(total.defPct).toBeCloseTo(0.04, 5)
    expect(total.critDmg).toBeCloseTo(0.024, 5)
  })
  it('POKEDEX_BONUS_PER_STAR 字面值与方案 A 一致', () => {
    expect(POKEDEX_BONUS_PER_STAR[1].hpPct).toBeCloseTo(0.0005)
    expect(POKEDEX_BONUS_PER_STAR[2].atkPct).toBeCloseTo(0.0005)
    expect(POKEDEX_BONUS_PER_STAR[3].defPct).toBeCloseTo(0.0005)
    expect(POKEDEX_BONUS_PER_STAR[4].critDmg).toBeCloseTo(0.0003)
  })
})

describe('isInRoster / POKEDEX_BY_KEY', () => {
  it('已知 boss 在册', () => {
    expect(isInRoster('purgatory', '炼狱魔君')).toBe(true)
    expect(isInRoster('celestial_mountain', '昆仑仙尊')).toBe(true)
  })
  it('普通怪 / T1-T4 不在册', () => {
    expect(isInRoster('qingfeng_valley', '野猪妖')).toBe(false)
    expect(isInRoster('sunset_mountain', '赤炎蟒')).toBe(false)
  })
  it('POKEDEX_BY_KEY size = roster.length', () => {
    expect(POKEDEX_BY_KEY.size).toBe(POKEDEX_ROSTER.length)
  })
})
