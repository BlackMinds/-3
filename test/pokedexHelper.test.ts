/**
 * 妖兽图鉴 helper 单测 —— 不连库，mock pg pool 验证纯逻辑分支
 * 用法：npm test（或 npx vitest run test/pokedexHelper.test.ts）
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

// mock 数据库
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
}
vi.mock('~/server/database/db', () => ({
  getPool: () => ({ connect: async () => mockClient }),
}))

const { recordMonsterKills } = await import('../server/utils/pokedex')

describe('recordMonsterKills - 过滤与聚合', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
  })

  it('未命中名录的击杀全部过滤（T1 怪不在册）', async () => {
    const result = await recordMonsterKills(1, [
      { mapKey: 'qingfeng_valley', name: '野猪妖', count: 5 },
    ])
    expect(result.totalRecorded).toBe(0)
    expect(result.deltaStars).toEqual([])
    expect(result.milestones).toEqual([])
    expect(mockClient.query).not.toHaveBeenCalled()
  })

  it('空 kills 数组直接返回', async () => {
    const result = await recordMonsterKills(1, [])
    expect(result).toEqual({ deltaStars: [], milestones: [], totalRecorded: 0 })
    expect(mockClient.query).not.toHaveBeenCalled()
  })

  it('同 entryKey 多条击杀聚合为单次 UPSERT', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockResolvedValueOnce({ rows: [{ stars: 0 }] })           // SELECT old
      .mockResolvedValueOnce({ rows: [{ kill_count: '3' }] })    // INSERT/UPSERT
      .mockResolvedValueOnce({ rows: [] })                       // UPDATE stars (0→1)
      .mockResolvedValueOnce({ rows: [] })                       // COMMIT
    const result = await recordMonsterKills(1, [
      { mapKey: 'purgatory', name: '炼狱魔君', count: 1 },
      { mapKey: 'purgatory', name: '炼狱魔君', count: 2 },
    ])
    expect(result.totalRecorded).toBe(1)
    const insertCall = mockClient.query.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO character_pokedex')
    )
    expect(insertCall?.[1]).toEqual([1, 'purgatory:炼狱魔君', 3])
  })
})

describe('recordMonsterKills - star delta', () => {
  beforeEach(() => mockClient.query.mockReset())

  it('击杀次数 49 → 50 触发 1→2 星跃迁', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockResolvedValueOnce({ rows: [{ stars: 1 }] })           // SELECT old (1 星)
      .mockResolvedValueOnce({ rows: [{ kill_count: '50' }] })   // UPSERT 后 50 杀
      .mockResolvedValueOnce({ rows: [] })                       // UPDATE stars
      .mockResolvedValueOnce({ rows: [] })                       // COMMIT

    const result = await recordMonsterKills(1, [
      { mapKey: 'purgatory', name: '炼狱魔君', count: 1 },
    ])
    expect(result.deltaStars).toHaveLength(1)
    expect(result.deltaStars[0]).toMatchObject({
      entryKey: 'purgatory:炼狱魔君',
      name: '炼狱魔君',
      oldStars: 1,
      newStars: 2,
      newKillCount: 50,
    })
  })

  it('击杀次数 100 → 101 同为 2 星，不产生 delta', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockResolvedValueOnce({ rows: [{ stars: 2 }] })           // SELECT old
      .mockResolvedValueOnce({ rows: [{ kill_count: '101' }] })  // UPSERT
      .mockResolvedValueOnce({ rows: [] })                       // COMMIT (无 UPDATE stars)

    const result = await recordMonsterKills(1, [
      { mapKey: 'purgatory', name: '炼狱魔君', count: 1 },
    ])
    expect(result.deltaStars).toEqual([])
  })

  it('SQL 错误时 ROLLBACK 且 throw 给调用方', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockRejectedValueOnce(new Error('connection lost'))       // SELECT 失败
      .mockResolvedValueOnce({ rows: [] })                       // ROLLBACK

    await expect(
      recordMonsterKills(1, [{ mapKey: 'purgatory', name: '炼狱魔君', count: 1 }])
    ).rejects.toThrow('connection lost')

    const rollbackCalls = mockClient.query.mock.calls.filter(c => c[0] === 'ROLLBACK')
    expect(rollbackCalls.length).toBe(1)
  })
})

describe('recordMonsterKills - kill_count BIGINT 类型', () => {
  beforeEach(() => mockClient.query.mockReset())

  it('pg 返回字符串 kill_count "1000" 时仍能正确算 4 星', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockResolvedValueOnce({ rows: [{ stars: 3 }] })           // SELECT old
      .mockResolvedValueOnce({ rows: [{ kill_count: '1000' }] }) // BIGINT 字符串
      .mockResolvedValueOnce({ rows: [] })                       // UPDATE stars
      .mockResolvedValueOnce({ rows: [] })                       // COMMIT

    const result = await recordMonsterKills(1, [
      { mapKey: 'purgatory', name: '炼狱魔君', count: 1 },
    ])
    expect(result.deltaStars[0].newStars).toBe(4)
    expect(result.deltaStars[0].newKillCount).toBe(1000)
    expect(typeof result.deltaStars[0].newKillCount).toBe('number')
  })
})
