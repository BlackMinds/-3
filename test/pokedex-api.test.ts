/**
 * 妖兽图鉴 API 单测 —— mock getPool + getCharacterByUserId
 * 用法：npx vitest run test/pokedex-api.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// stub Nuxt globals 防止 import 链上其他模块顶层求值崩溃
vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>
  g.defineEventHandler = (h: unknown) => h
  g.useRuntimeConfig = () => ({})
})

// mock 数据库 & 角色拉取
const mockPool = { query: vi.fn() }
vi.mock('~/server/database/db', () => ({ getPool: () => mockPool }))
vi.mock('~/server/utils/team', () => ({
  getCharacterByUserId: vi.fn(async () => ({ id: 42 })),
}))

// 依赖 mock 生效后再 import handler
const handler = (await import('../server/api/pokedex/list.get')).default

describe('GET /api/pokedex/list', () => {
  beforeEach(() => {
    mockPool.query.mockReset()
  })

  it('无任何击杀时返回 80 条全 locked', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })
    const res = await (handler as any)({ context: { userId: 1 } })
    expect(res.code).toBe(200)
    expect(res.data.list).toHaveLength(80)
    expect(res.data.summary.unlockedCount).toBe(0)
    expect(res.data.summary.totalStars).toBe(0)
    expect(res.data.summary.total).toBe(80)
    expect(res.data.summary.maxStars).toBe(320)
    expect(res.data.list.every((c: any) => !c.unlocked && c.killCount === 0)).toBe(true)
  })

  it('部分击杀正确拼合（BIGINT 字符串 → number）', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { entry_key: 'purgatory:炼狱魔君', kill_count: '52', stars: 2, first_killed_at: null, updated_at: null },
      ],
    })
    const res = await (handler as any)({ context: { userId: 1 } })
    const item = res.data.list.find((c: any) => c.entryKey === 'purgatory:炼狱魔君')
    expect(item).toBeDefined()
    expect(item.killCount).toBe(52)
    expect(typeof item.killCount).toBe('number')
    expect(item.stars).toBe(2)
    expect(item.unlocked).toBe(true)
    expect(item.nextThreshold).toBe(200) // POKEDEX_STAR_THRESHOLDS[2]
    expect(res.data.summary.unlockedCount).toBe(1)
    expect(res.data.summary.totalStars).toBe(2)
  })

  it('满星条目 nextThreshold = null', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { entry_key: 'purgatory:炼狱魔君', kill_count: '1500', stars: 4, first_killed_at: null, updated_at: null },
      ],
    })
    const res = await (handler as any)({ context: { userId: 1 } })
    const item = res.data.list.find((c: any) => c.entryKey === 'purgatory:炼狱魔君')
    expect(item.stars).toBe(4)
    expect(item.nextThreshold).toBe(null)
    expect(item.killCount).toBe(1500)
  })

  it('角色不存在返回 400', async () => {
    const teamMod = await import('~/server/utils/team') as any
    teamMod.getCharacterByUserId.mockResolvedValueOnce(null)
    const res = await (handler as any)({ context: { userId: 999 } })
    expect(res.code).toBe(400)
    expect(res.message).toBe('角色不存在')
  })
})
