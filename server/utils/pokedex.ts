/**
 * 妖兽图鉴运行时 helper —— 击杀事件 → character_pokedex 累加 + 星级重算
 * Phase 2 · 后端核心（仅写入，无 UI / 加成 / 邮件）
 */
import { getPool } from '~/server/database/db'
import { getEntryKey, isInRoster, getStarLevel } from '~/server/engine/pokedexData'

// ========== 类型定义 ==========

export interface MonsterKill {
  mapKey: string
  name: string
  count: number  // 通常为 1；duoBattle 子女补刀也只算一次
}

export interface PokedexDelta {
  entryKey: string
  name: string
  oldStars: 0 | 1 | 2 | 3 | 4
  newStars: 0 | 1 | 2 | 3 | 4
  newKillCount: number
}

export interface RecordResult {
  deltaStars: PokedexDelta[]   // 星级跃迁条目（Phase 3 toast / Phase 5 邮件）
  milestones: string[]         // 里程碑 ID 列表（Phase 5 接入，本期始终为空）
  totalRecorded: number        // 本次成功 UPSERT 的条数（命中名录的）
}

// ========== 主函数 ==========

/**
 * 把战斗结算的击杀列表累加到 character_pokedex，并按 getStarLevel 重算 stars 列。
 * 调用方应 fire-and-forget：`recordMonsterKills(charId, kills).catch(err => console.error(...))`
 *
 * 性能：每场战斗击杀通常 ≤ 20 条，单事务批量 UPSERT。
 * 错误：任何 SQL 错误抛出给调用方的 .catch，不在内部吞掉。
 */
export async function recordMonsterKills(
  characterId: number,
  kills: MonsterKill[]
): Promise<RecordResult> {
  // 1) 过滤：只保留命中名录的击杀，并按 entryKey 聚合 count
  const aggregated = new Map<string, { mapKey: string; name: string; count: number }>()
  for (const k of kills) {
    if (!isInRoster(k.mapKey, k.name)) continue
    const key = getEntryKey(k.mapKey, k.name)
    const existing = aggregated.get(key)
    if (existing) existing.count += k.count
    else aggregated.set(key, { mapKey: k.mapKey, name: k.name, count: k.count })
  }
  if (aggregated.size === 0) {
    return { deltaStars: [], milestones: [], totalRecorded: 0 }
  }

  // 2) 单事务批量 UPSERT，并查回 old/new 状态用于计算 delta
  const pool = getPool()
  const client = await pool.connect()
  const deltaStars: PokedexDelta[] = []
  try {
    await client.query('BEGIN')

    for (const [entryKey, { count, name }] of aggregated) {
      // 先读旧 stars（不存在则 oldStars = 0）
      const { rows: oldRows } = await client.query<{ stars: number }>(
        'SELECT stars FROM character_pokedex WHERE character_id = $1 AND entry_key = $2',
        [characterId, entryKey]
      )
      const oldStars = (oldRows[0]?.stars ?? 0) as 0 | 1 | 2 | 3 | 4

      // UPSERT：kill_count 累加（对齐 fight.post.ts:1288 风格，DO UPDATE 引用 table_name.column）
      const { rows: upRows } = await client.query<{ kill_count: string }>(
        `INSERT INTO character_pokedex (character_id, entry_key, kill_count, stars, first_killed_at, updated_at)
         VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (character_id, entry_key)
         DO UPDATE SET
           kill_count = character_pokedex.kill_count + EXCLUDED.kill_count,
           updated_at = CURRENT_TIMESTAMP
         RETURNING kill_count`,
        [characterId, entryKey, count]
      )

      // pg BIGINT 返回字符串，必须 Number() 转换，否则 getStarLevel 字符串比较出错
      const newKillCount = Number(upRows[0].kill_count)
      const newStars = getStarLevel(newKillCount)

      // 如果 stars 跃迁，写回
      if (newStars !== oldStars) {
        await client.query(
          'UPDATE character_pokedex SET stars = $1 WHERE character_id = $2 AND entry_key = $3',
          [newStars, characterId, entryKey]
        )
        deltaStars.push({ entryKey, name, oldStars, newStars, newKillCount })
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }

  // 3) 里程碑触发（Phase 5 接入，本期返回空）
  const milestones: string[] = []

  return { deltaStars, milestones, totalRecorded: aggregated.size }
}
