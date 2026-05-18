/**
 * Phase 4 · 妖兽图鉴加成 helper 单测
 * 覆盖：recomputePokedexBonusCache / getPokedexBonus / recordMonsterKills cache 重算触发
 * 用法：npx vitest run test/pokedex-bonus.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// stub Nuxt globals 防止 import 链上其他 server 模块顶层求值崩溃
vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>
  g.defineEventHandler = (h: unknown) => h
  g.readBody = async () => ({})
  g.createError = (o: { statusMessage?: string } | string) =>
    new Error(typeof o === 'string' ? o : o?.statusMessage || 'err')
  g.useRuntimeConfig = () => ({})
})

// mock 数据库：pool 同时支持 query（cache 读） + connect（事务/独立 recompute）
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
}
const mockPool = {
  query: vi.fn(),
  connect: async () => mockClient,
}
vi.mock('~/server/database/db', () => ({
  getPool: () => mockPool,
}))

const { recomputePokedexBonusCache, getPokedexBonus, recordMonsterKills } = await import('../server/utils/pokedex')

// ====================================================================
// recomputePokedexBonusCache · 数值守门
// ====================================================================
describe('recomputePokedexBonusCache - 数值守门', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
    mockClient.release.mockReset()
    mockPool.query.mockReset()
  })

  it('满档：80 行 stars=4 → UPSERT 全字段满档值', async () => {
    const fullRows = Array.from({ length: 80 }, () => ({ stars: 4 }))
    mockClient.query
      .mockResolvedValueOnce({ rows: fullRows }) // SELECT stars
      .mockResolvedValueOnce({ rows: [] })       // UPSERT

    const result = await recomputePokedexBonusCache(1)

    // 满档：每只 stars=4 贡献 {hp:0.01, atk:0.01, def:0.01, critDmg:0.011}
    // 80 只 → {hp:0.80, atk:0.80, def:0.80, critDmg:0.88}
    expect(result.hpPct).toBeCloseTo(0.80, 6)
    expect(result.atkPct).toBeCloseTo(0.80, 6)
    expect(result.defPct).toBeCloseTo(0.80, 6)
    expect(result.critDmg).toBeCloseTo(0.88, 6)

    const upsertCall = mockClient.query.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO character_pokedex_bonus_cache')
    )
    expect(upsertCall).toBeDefined()
    expect(upsertCall![1][0]).toBe(1) // characterId
    expect(upsertCall![1][1]).toBeCloseTo(0.80, 6)
    expect(upsertCall![1][2]).toBeCloseTo(0.80, 6)
    expect(upsertCall![1][3]).toBeCloseTo(0.80, 6)
    expect(upsertCall![1][4]).toBeCloseTo(0.88, 6)

    // 独立模式必须 release
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })

  it('半档：20 行 stars=2 → 仅 hp/atk 累加', async () => {
    const rows = Array.from({ length: 20 }, () => ({ stars: 2 }))
    mockClient.query
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: [] })

    const result = await recomputePokedexBonusCache(1)

    // stars=2: getBonusForStars(2) = 1段+2段 = {hp:0.01, atk:0.01}
    // 20 只 → {hp:0.20, atk:0.20, def:0, critDmg:0}
    expect(result.hpPct).toBeCloseTo(0.20, 6)
    expect(result.atkPct).toBeCloseTo(0.20, 6)
    expect(result.defPct).toBe(0)
    expect(result.critDmg).toBe(0)
  })

  it('空：0 行（玩家未击杀任何精选怪） → UPSERT 全 0', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await recomputePokedexBonusCache(42)

    expect(result).toEqual({ hpPct: 0, atkPct: 0, defPct: 0, critDmg: 0 })

    const upsertCall = mockClient.query.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO character_pokedex_bonus_cache')
    )
    expect(upsertCall![1]).toEqual([42, 0, 0, 0, 0])
  })

  it('传入 client（事务模式）：不调 connect / 不 release', async () => {
    const txClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ stars: 1 }] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    }

    const result = await recomputePokedexBonusCache(7, txClient as any)

    expect(result.hpPct).toBeCloseTo(0.01, 6)
    expect(txClient.release).not.toHaveBeenCalled() // 调用方负责 release
    expect(mockClient.query).not.toHaveBeenCalled()
  })
})

// ====================================================================
// getPokedexBonus · cache hit / miss
// ====================================================================
describe('getPokedexBonus - cache 读取', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
    mockClient.release.mockReset()
    mockPool.query.mockReset()
  })

  it('cache hit：NUMERIC 列返回 string，必须 Number() 转换', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ hp_pct: '0.800000', atk_pct: '0.800000', def_pct: '0.800000', crit_dmg: '0.880000' }],
    })

    const result = await getPokedexBonus(1)

    expect(result.hpPct).toBe(0.80)
    expect(result.atkPct).toBe(0.80)
    expect(result.defPct).toBe(0.80)
    expect(result.critDmg).toBe(0.88)
    // 类型守门：必须是 number 不是 string
    expect(typeof result.hpPct).toBe('number')
    expect(typeof result.critDmg).toBe('number')
    // cache hit 不应触发 recompute
    expect(mockClient.query).not.toHaveBeenCalled()
  })

  it('cache miss：lazy backfill 调 recompute + 写入', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] }) // cache 0 行
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ stars: 1 }, { stars: 1 }, { stars: 1 }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await getPokedexBonus(99)

    // 3 行 stars=1 → hp:3×0.01=0.03
    expect(result.hpPct).toBeCloseTo(0.03, 6)
    expect(result.atkPct).toBe(0)

    const upsertCall = mockClient.query.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO character_pokedex_bonus_cache')
    )
    expect(upsertCall).toBeDefined()
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })

  it('cache miss + character_pokedex 0 行：写入全 0 cache 行（新玩家）', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await getPokedexBonus(123)

    expect(result).toEqual({ hpPct: 0, atkPct: 0, defPct: 0, critDmg: 0 })
  })
})

// ====================================================================
// recordMonsterKills · cache 重算触发
// ====================================================================
describe('recordMonsterKills - cache 重算触发', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
    mockClient.release.mockReset()
    mockPool.query.mockReset()
  })

  it('星级跃迁（49→50, 1→2 星）：同事务触发 recompute UPSERT', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockResolvedValueOnce({ rows: [{ stars: 1 }] })           // SELECT old
      .mockResolvedValueOnce({ rows: [{ kill_count: '50' }] })   // UPSERT character_pokedex
      .mockResolvedValueOnce({ rows: [] })                       // UPDATE stars 1→2
      // —— Phase 4 新增：cache recompute ——
      .mockResolvedValueOnce({ rows: [{ stars: 2 }] })           // SELECT character_pokedex stars > 0
      .mockResolvedValueOnce({ rows: [] })                       // UPSERT cache
      .mockResolvedValueOnce({ rows: [] })                       // COMMIT

    const result = await recordMonsterKills(1, [
      { mapKey: 'purgatory', name: '炼狱魔君', count: 1 },
    ])
    expect(result.deltaStars).toHaveLength(1)

    // 确认 cache UPSERT 被调用了
    const cacheUpsert = mockClient.query.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO character_pokedex_bonus_cache')
    )
    expect(cacheUpsert).toBeDefined()
    // 同事务：复用同一 client；finally 仅 release 一次
    expect(mockClient.release).toHaveBeenCalledTimes(1)
  })

  it('无星级跃迁（100→101，仍 2 星）：不调 recompute', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockResolvedValueOnce({ rows: [{ stars: 2 }] })           // SELECT old
      .mockResolvedValueOnce({ rows: [{ kill_count: '101' }] })  // UPSERT character_pokedex
      .mockResolvedValueOnce({ rows: [] })                       // COMMIT

    const result = await recordMonsterKills(1, [
      { mapKey: 'purgatory', name: '炼狱魔君', count: 1 },
    ])
    expect(result.deltaStars).toEqual([])

    // 性能守门：无跃迁不该触发 cache UPSERT
    const cacheUpsert = mockClient.query.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO character_pokedex_bonus_cache')
    )
    expect(cacheUpsert).toBeUndefined()
  })
})
