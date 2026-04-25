/**
 * 宗门战赔率计算
 */

export interface OddsPair {
  oddsA: number
  oddsB: number
}

export function computeOdds(totalPowerA: number, totalPowerB: number): OddsPair {
  if (totalPowerA <= 0 || totalPowerB <= 0) return { oddsA: 2, oddsB: 2 }
  const avg = (totalPowerA + totalPowerB) / 2
  const diff = Math.abs(totalPowerA - totalPowerB) / avg
  // diff 范围: 0 ~ 1+

  let oddsStrong: number, oddsWeak: number
  if (diff <= 0.05) {
    oddsStrong = 1.9
    oddsWeak = 1.9
  } else if (diff <= 0.15) {
    oddsStrong = 1.5
    oddsWeak = 2.5
  } else if (diff <= 0.20) {
    oddsStrong = 1.3
    oddsWeak = 3.5
  } else {
    // 战力差 > 20%，理论上不该匹配上，但兜底
    oddsStrong = 1.2
    oddsWeak = 5.0
  }

  if (totalPowerA >= totalPowerB) {
    return { oddsA: oddsStrong, oddsB: oddsWeak }
  } else {
    return { oddsA: oddsWeak, oddsB: oddsStrong }
  }
}

/**
 * 周赛季编号（从某个基准周一开始计数）
 */
const SEASON_EPOCH = Date.UTC(2026, 0, 5) // 2026-01-05 (周一)

export function currentSeasonNo(now: Date = new Date()): number {
  const cnNow = new Date(now.getTime() + 8 * 3600 * 1000)
  // 对齐本周周一 UTC 0:00
  const diffMs = cnNow.getTime() - SEASON_EPOCH
  const weekMs = 7 * 24 * 3600 * 1000
  return Math.max(1, Math.floor(diffMs / weekMs) + 1)
}

export function currentSeasonStart(now: Date = new Date()): Date {
  const seasonNo = currentSeasonNo(now)
  return new Date(SEASON_EPOCH + (seasonNo - 1) * 7 * 24 * 3600 * 1000)
}

export function currentSeasonEnd(now: Date = new Date()): Date {
  const start = currentSeasonStart(now)
  return new Date(start.getTime() + 7 * 24 * 3600 * 1000)
}

/**
 * 当前赛季阶段（压缩节奏 v2：报名/押注/开打全在前两天完成）
 * - registering: 周一 00:00 ~ 周一 20:00
 * - betting:     周一 20:00 ~ 周二 20:00
 * - fighting:    周二 20:00 ~ 周二 20:30
 * - settled:     周二 20:30 ~ 周日 24:00
 */
export function currentStage(now: Date = new Date()): 'registering' | 'betting' | 'fighting' | 'settled' {
  const cnNow = new Date(now.getTime() + 8 * 3600 * 1000)
  const dayOfWeek = cnNow.getUTCDay() // 0=周日
  const hour = cnNow.getUTCHours()
  const mon = dayOfWeek === 1
  const tue = dayOfWeek === 2

  if (mon && hour < 20) return 'registering'
  if (mon && hour >= 20) return 'betting'
  if (tue && hour < 20) return 'betting'
  if (tue && hour === 20) return 'fighting'
  return 'settled'
}
