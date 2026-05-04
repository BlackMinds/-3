/**
 * T1-T12 怪物攻击统计图
 * 从 server/api/battle/fight.post.ts 读取 ALL_MAPS，按 tier 分组算 ATK
 *
 * 公式 (server/engine/battleEngine.ts generateMonsterStats):
 *   atk = floor(power * r.atk * ATK_SCALE * MONSTER_ATK_MUL)
 *   ATK_SCALE = 0.665
 *   MONSTER_ATK_MUL = 0.62  (v3.7 加法池补偿)
 *   r.atk: balanced=0.30 / tank=0.15 / dps=0.45 / speed=0.25 / boss=0.30 / healer=0.15
 *   power 实际还乘 randFloat(0.85, 1.15)，下面取期望值（×1.0）
 *
 * 运行: npx tsx test/sim-monster-atk.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const FIGHT_PATH = join(process.cwd(), 'server', 'api', 'battle', 'fight.post.ts')
const src = readFileSync(FIGHT_PATH, 'utf8')

const ATK_SCALE = 0.665
const R_ATK: Record<string, number> = {
  balanced: 0.30, tank: 0.15, dps: 0.45, speed: 0.25, boss: 0.30, healer: 0.15,
}

// v3.7.1/v3.7.2: 镜像 generateMonsterStats 里的 tier 调整
function getMonsterAtkMul(tier: number): number {
  let mul = 0.62
  if (tier >= 5) mul *= 0.80
  if (tier === 11) mul *= 0.50
  if (tier === 12) mul *= 0.30
  if (tier === 13) mul *= 0.18
  if (tier === 14) mul *= 0.10
  if (tier === 15) mul *= 0.06
  return mul
}

function calcAtk(power: number, role: string, tier: number): number {
  const r = R_ATK[role] ?? 0.30
  return Math.floor(power * r * ATK_SCALE * getMonsterAtkMul(tier))
}

interface Monster { name: string; tier: number; power: number; role: string; isBoss: boolean }

// 解析：定位 export const ALL_MAPS 段，平衡花括号截块；行扫描时同时识别行首和行内的 tier 字段。
const monsters: Monster[] = []
const startMatch = /export\s+const\s+ALL_MAPS\s*[:=]/.exec(src)
const startIdx = startMatch ? startMatch.index : 0
const braceStart = src.indexOf('{', src.indexOf('=', startIdx))
let depth = 0, endIdx = braceStart
for (let i = braceStart; i < src.length; i++) {
  const ch = src[i]
  if (ch === '{') depth++
  else if (ch === '}') { depth--; if (depth === 0) { endIdx = i + 1; break } }
}
const block = src.slice(braceStart, endIdx)

const lines = block.split('\n')
let curTier = 0
let tierHits = 0
// tier 可能出现在行首（独立缩进）或行内（{ tier: N, monsters: [...] }），都识别
const tierRe = /\btier:\s*(\d+)\s*,/g
const monRe = /\{\s*name:\s*'([^']+)'[\s\S]*?power:\s*(\d+)[\s\S]*?role:\s*'(\w+)'[\s\S]*?\}/g
for (const line of lines) {
  // 1) 先扫 tier 字段，更新当前 tier（行内可能多次出现，取最后一个）
  let lastTier = -1
  let t: RegExpExecArray | null
  tierRe.lastIndex = 0
  while ((t = tierRe.exec(line)) !== null) { lastTier = Number(t[1]); tierHits++ }
  if (lastTier > 0) curTier = lastTier
  // 2) 扫怪物（每件 { name, power, role } 对象），可能多次出现
  if (curTier > 0) {
    let mm: RegExpExecArray | null
    monRe.lastIndex = 0
    while ((mm = monRe.exec(line)) !== null) {
      monsters.push({
        name: mm[1], tier: curTier, power: Number(mm[2]), role: mm[3], isBoss: mm[3] === 'boss',
      })
    }
  }
}
console.log(`(已解析 ${monsters.length} 个怪物，含 ${monsters.filter(m => m.isBoss).length} 个 Boss)\n`)

console.log('='.repeat(96))
console.log('T1-T12 怪物攻击统计 (公式: floor(power × r.atk × 0.665 × 0.62), v3.7 加法池补偿)')
console.log('='.repeat(96))

// ===== 按 tier 分组 =====
type TierStat = {
  tier: number
  count: number
  bossCount: number
  normalAtks: number[]
  bossAtks: number[]
  rolesSeen: Set<string>
}
const tiers = new Map<number, TierStat>()
for (const mon of monsters) {
  let s = tiers.get(mon.tier)
  if (!s) {
    s = { tier: mon.tier, count: 0, bossCount: 0, normalAtks: [], bossAtks: [], rolesSeen: new Set() }
    tiers.set(mon.tier, s)
  }
  s.count++
  s.rolesSeen.add(mon.role)
  const atk = calcAtk(mon.power, mon.role, mon.tier)
  if (mon.isBoss) { s.bossCount++; s.bossAtks.push(atk) }
  else s.normalAtks.push(atk)
}

const sortedTiers = [...tiers.values()].sort((a, b) => a.tier - b.tier)

// ===== 表格输出 =====
console.log('\n┌─────┬──────┬──────────┬───────────┬───────────┬──────────────┬──────────────┐')
console.log('│Tier │普通  │ 普通最低 │ 普通中位  │ 普通最高  │  Boss 最低   │  Boss 最高   │')
console.log('├─────┼──────┼──────────┼───────────┼───────────┼──────────────┼──────────────┤')
const fmt = (n: number) => n.toLocaleString().padStart(10)
function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.floor((s[m - 1] + s[m]) / 2)
}
for (const s of sortedTiers) {
  const n = s.normalAtks
  const b = s.bossAtks
  const minN = n.length ? Math.min(...n) : 0
  const maxN = n.length ? Math.max(...n) : 0
  const medN = median(n)
  const minB = b.length ? Math.min(...b) : 0
  const maxB = b.length ? Math.max(...b) : 0
  console.log(`│ T${String(s.tier).padStart(2)} │ ${String(s.count - s.bossCount).padStart(4)} │${fmt(minN)}│${fmt(medN)} │${fmt(maxN)} │${fmt(minB).padStart(13)} │${fmt(maxB).padStart(13)} │`)
}
console.log('└─────┴──────┴──────────┴───────────┴───────────┴──────────────┴──────────────┘')

// ===== ASCII 条形图：普通怪中位 ATK =====
console.log('\n' + '='.repeat(96))
console.log('普通怪 中位 ATK (按 tier)')
console.log('='.repeat(96))
const medians = sortedTiers.map(s => ({ tier: s.tier, atk: median(s.normalAtks) }))
const maxMed = Math.max(...medians.map(d => d.atk))
const BAR_W = 60
for (const d of medians) {
  const len = Math.round((d.atk / maxMed) * BAR_W)
  const bar = '█'.repeat(len)
  console.log(`T${String(d.tier).padStart(2)} ${d.atk.toLocaleString().padStart(8)} │${bar}`)
}

// ===== ASCII 条形图：Boss 平均 ATK =====
console.log('\n' + '='.repeat(96))
console.log('Boss 平均 ATK (按 tier)')
console.log('='.repeat(96))
const bossAvgs = sortedTiers.map(s => ({
  tier: s.tier,
  atk: s.bossAtks.length ? Math.floor(s.bossAtks.reduce((a, b) => a + b, 0) / s.bossAtks.length) : 0,
}))
const maxBoss = Math.max(...bossAvgs.map(d => d.atk))
for (const d of bossAvgs) {
  const len = maxBoss ? Math.round((d.atk / maxBoss) * BAR_W) : 0
  const bar = '█'.repeat(len)
  console.log(`T${String(d.tier).padStart(2)} ${d.atk.toLocaleString().padStart(9)} │${bar}`)
}

// ===== 各 tier 增长率（Boss-to-Boss）=====
console.log('\n' + '='.repeat(96))
console.log('Boss ATK 跨 tier 倍率 (上一 tier → 本 tier)')
console.log('='.repeat(96))
let prev = 0
for (const d of bossAvgs) {
  const mul = prev > 0 ? (d.atk / prev).toFixed(2) : '—'
  console.log(`T${String(d.tier).padStart(2)}  Boss ATK ${d.atk.toLocaleString().padStart(9)}   ×${mul}`)
  if (d.atk > 0) prev = d.atk
}

console.log('\n注: power 实际有 ±15% 随机浮动，上面用期望值（×1.0）。')
console.log('    各怪 ATK = power × r.atk(role) × 0.665 × MUL(tier)')
console.log('    MUL(tier): T1-4=0.62, T5-10=0.50, T11=0.25, T12=0.15, T13=0.089, T14=0.050, T15=0.030')
console.log('    role 系数: balanced/boss=0.30, dps=0.45, speed=0.25, tank/healer=0.15')
