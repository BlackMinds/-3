// 斗法台积分段位 + 跨境界积分加权
// 前后端共用：服务器算积分增减，前端显示段位 chip

export interface ArenaRank {
  min: number
  max: number       // 包含
  name: string
  color: string
}

export const ARENA_RANKS: ArenaRank[] = [
  { min: 0,    max: 999,        name: '武徒',   color: '#7a8088' },
  { min: 1000, max: 1199,       name: '斗者',   color: '#9da9bc' },
  { min: 1200, max: 1399,       name: '斗师',   color: '#6baa7d' },
  { min: 1400, max: 1599,       name: '大斗师', color: '#5b8eaa' },
  { min: 1600, max: 1799,       name: '斗灵',   color: '#9966cc' },
  { min: 1800, max: 1999,       name: '斗王',   color: '#cc8a4a' },
  { min: 2000, max: 2199,       name: '斗皇',   color: '#d4a85c' },
  { min: 2200, max: 2399,       name: '斗宗',   color: '#e84a3a' },
  { min: 2400, max: 2599,       name: '斗尊',   color: '#ff6b00' },
  { min: 2600, max: Infinity,   name: '斗圣',   color: '#ffd700' },
]

export function getArenaRank(score: number): ArenaRank {
  const s = Math.max(0, Math.floor(score))
  for (const r of ARENA_RANKS) {
    if (s >= r.min && s <= r.max) return r
  }
  return ARENA_RANKS[ARENA_RANKS.length - 1]
}

// 跨境界积分计算
// diff = winnerTier - loserTier
//   <0  低境界打赢高境界（逆袭，奖励）
//   =0  同境界（标准 +20 / -10）
//   >0  高境界打低境界（欺负小的，奖励少）
const WIN_TABLE: Record<number, number> = {
  '-4': 60, '-3': 44, '-2': 36, '-1': 28,
  '0': 20,
  '1': 14, '2': 8, '3': 5,
}
const LOSS_TABLE: Record<number, number> = {
  '-3': 28, '-2': 22, '-1': 16,
  '0': 10,
  '1': 7, '2': 4, '3': 2,
}

export function arenaScoreOnWin(winnerTier: number, loserTier: number): number {
  const diff = Math.max(-4, Math.min(3, winnerTier - loserTier))
  return WIN_TABLE[diff] ?? 20
}

export function arenaScoreOnLoss(loserTier: number, winnerTier: number): number {
  // 返回正数（扣减绝对值）
  const diff = Math.max(-3, Math.min(3, loserTier - winnerTier))
  return LOSS_TABLE[diff] ?? 10
}
