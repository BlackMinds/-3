// 追赶机制：基于排行榜前 30 等级均值，对领先者削减经验获取
// 防止头部玩家第一天就冲到化神，与 numerical-balance.md 的目标节奏（Day 7 元婴 2）对齐。
import { getPool } from '~/server/database/db'

const CACHE_TTL_MS = 5 * 60 * 1000

let cache: { avgLevel: number; refreshedAt: number } | null = null
let refreshing: Promise<number> | null = null

async function refresh(): Promise<number> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT AVG(level)::float AS avg FROM (SELECT level FROM characters ORDER BY level DESC LIMIT 30) t'
  )
  const avg = Number(rows[0]?.avg)
  // 没数据时返回极大值，等同于不生效（所有玩家 level < avg → 系数 1.0）
  const safe = avg && avg >= 1 ? avg : 999
  cache = { avgLevel: safe, refreshedAt: Date.now() }
  return safe
}

export async function getTopAvgLevel(): Promise<number> {
  const now = Date.now()
  if (cache && now - cache.refreshedAt < CACHE_TTL_MS) return cache.avgLevel
  if (refreshing) return refreshing
  refreshing = refresh().finally(() => { refreshing = null })
  return refreshing
}

// 平滑渐降：超平均值越多减越狠，保留 5 级缓冲区避免断崖
// v3.4.2: 强化斜率,领先者更明显降速
// diff ≤ 0  → 1.0x
// diff ∈ (0, 5]   → 1.0x → 0.8x 线性
// diff ∈ (5, 15]  → 0.8x → 0.4x 线性 (原 0.5x)
// diff ∈ (15, 25] → 0.4x → 0.2x 线性 (新增硬砍档)
// diff > 25       → 0.2x (原 0.5x, 榜首段直接 1/5)
export function getCatchUpMultiplier(playerLevel: number, avgLevel: number): number {
  const diff = playerLevel - avgLevel
  if (diff <= 0) return 1.0
  if (diff <= 5) return 1.0 - (diff / 5) * 0.2
  if (diff <= 15) return 0.8 - ((diff - 5) / 10) * 0.4
  if (diff <= 25) return 0.4 - ((diff - 15) / 10) * 0.2
  return 0.2
}
