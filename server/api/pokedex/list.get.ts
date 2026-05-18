/**
 * 妖兽图鉴 - 当前角色全图鉴状态
 * GET /api/pokedex/list
 *
 * 返回：80 条名录 LEFT JOIN character_pokedex 后的卡片数据 + summary
 * 只读，本期不涉及任何写入。
 */
import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import {
  POKEDEX_ROSTER,
  getEntryKey,
  POKEDEX_STAR_THRESHOLDS,
  type PokedexEntry,
} from '~/server/engine/pokedexData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query<{
      entry_key: string
      kill_count: string
      stars: number
      first_killed_at: string | null
      updated_at: string | null
    }>(
      'SELECT entry_key, kill_count, stars, first_killed_at, updated_at FROM character_pokedex WHERE character_id = $1',
      [char.id],
    )
    const byKey = new Map(rows.map(r => [r.entry_key, r]))

    const list = POKEDEX_ROSTER.map((e: PokedexEntry) => {
      const key = getEntryKey(e.mapKey, e.name)
      const row = byKey.get(key)
      const killCount = row ? Number(row.kill_count) : 0
      const stars = (row?.stars ?? 0) as 0 | 1 | 2 | 3 | 4
      const nextThreshold: number | null = stars < 4
        ? POKEDEX_STAR_THRESHOLDS[stars as 0 | 1 | 2 | 3]
        : null
      return {
        entryKey: key,
        mapKey: e.mapKey,
        name: e.name,
        displayName: e.displayName ?? e.name,
        tier: e.tier,
        element: e.element,
        power: e.power,
        role: e.role,
        category: e.category,
        killCount,
        stars,
        nextThreshold,
        unlocked: killCount > 0,
      }
    })

    const unlockedCount = list.filter(c => c.unlocked).length
    const totalStars = list.reduce((s, c) => s + c.stars, 0)

    return {
      code: 200,
      data: {
        list,
        summary: {
          total: list.length,
          unlockedCount,
          totalStars,
          maxStars: list.length * 4,
        },
      },
    }
  } catch (e) {
    console.error('[pokedex] list api error', e)
    return { code: 500, message: '查询失败' }
  }
})
