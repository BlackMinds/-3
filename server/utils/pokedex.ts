/**
 * 妖兽图鉴运行时 helper —— 击杀事件 → character_pokedex 累加 + 星级重算
 * Phase 2 · 后端核心（仅写入，无 UI / 加成 / 邮件）
 * Phase 4 · 加成生效：星级跃迁 → 重算 character_pokedex_bonus_cache；战斗结算读 cache
 */
import type { PoolClient } from 'pg'
import { getPool } from '~/server/database/db'
import { getEntryKey, isInRoster, getStarLevel, getBonusForStars } from '~/server/engine/pokedexData'

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

    // 星级跃迁则同事务重算 bonus cache（Phase 4 接入）
    if (deltaStars.length > 0) {
      await recomputePokedexBonusCache(characterId, client)
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

// ========== Phase 4 · 加成 cache ==========

export interface PokedexBonusValues {
  hpPct: number
  atkPct: number
  defPct: number
  critDmg: number
}

/**
 * 重算指定角色的图鉴加成总和并 UPSERT 到 character_pokedex_bonus_cache。
 * - 在 recordMonsterKills 内星级跃迁时调用（同事务，传入 client）
 * - 独立模式（无 client）用于 lazy backfill / 后台任务
 * 返回最新加成（数值会被 pg 自动 round 到 NUMERIC(10,6) 精度）
 */
export async function recomputePokedexBonusCache(
  characterId: number,
  client?: PoolClient
): Promise<PokedexBonusValues> {
  const useClient = client ?? (await getPool().connect())
  const ownClient = !client
  try {
    const { rows } = await useClient.query<{ stars: number }>(
      'SELECT stars FROM character_pokedex WHERE character_id = $1 AND stars > 0',
      [characterId]
    )
    let hpPct = 0
    let atkPct = 0
    let defPct = 0
    let critDmg = 0
    for (const r of rows) {
      const stars = Number(r.stars) as 0 | 1 | 2 | 3 | 4
      const b = getBonusForStars(stars)
      hpPct += b.hpPct ?? 0
      atkPct += b.atkPct ?? 0
      defPct += b.defPct ?? 0
      critDmg += b.critDmg ?? 0
    }
    await useClient.query(
      `INSERT INTO character_pokedex_bonus_cache (character_id, hp_pct, atk_pct, def_pct, crit_dmg, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (character_id)
       DO UPDATE SET
         hp_pct = EXCLUDED.hp_pct,
         atk_pct = EXCLUDED.atk_pct,
         def_pct = EXCLUDED.def_pct,
         crit_dmg = EXCLUDED.crit_dmg,
         updated_at = CURRENT_TIMESTAMP`,
      [characterId, hpPct, atkPct, defPct, critDmg]
    )
    return { hpPct, atkPct, defPct, critDmg }
  } finally {
    if (ownClient) useClient.release()
  }
}

/**
 * 读取图鉴加成（buildPlayerStats / buildCharacterSnapshot 调用）。
 * cache miss 时即时重算并写入（lazy backfill），保证既有玩家无需后台任务。
 * cache hit 时不重算，O(1)。
 *
 * NUMERIC 列返回字符串，必须 Number() 转换，否则后续 nonPassive 池会变成字符串拼接。
 */
export async function getPokedexBonus(characterId: number): Promise<PokedexBonusValues> {
  const pool = getPool()
  const { rows } = await pool.query<{ hp_pct: string; atk_pct: string; def_pct: string; crit_dmg: string }>(
    'SELECT hp_pct, atk_pct, def_pct, crit_dmg FROM character_pokedex_bonus_cache WHERE character_id = $1',
    [characterId]
  )
  if (rows.length > 0) {
    return {
      hpPct: Number(rows[0].hp_pct),
      atkPct: Number(rows[0].atk_pct),
      defPct: Number(rows[0].def_pct),
      critDmg: Number(rows[0].crit_dmg),
    }
  }
  return await recomputePokedexBonusCache(characterId)
}
