/**
 * 临时验证脚本: HP×2, ATK×0.65 怪物方案对比
 *
 * 跑同一个玩家 build, 在两组怪物参数下各跑 N 局战斗:
 *   - baseline: 当前怪物属性
 *   - 提案 A: HP×2, ATK×1.0 (不削攻击)
 *   - 提案 B: HP×2, ATK×0.65 (推荐)
 *   - 提案 C: HP×2, ATK×0.50 (严格守恒)
 *
 * 用法: npx tsx test/sim-hp2x-atk065.ts
 */

import { buildPlayer } from './sim-build-player'
import { buildMonster, getTierBoss, type MonsterStats } from './sim-build-monster'
import { simulateBattle } from './sim-battle'
import { PRESETS } from './sim-presets'

const RUNS = 3000

function adjust(m: MonsterStats, hpMul: number, atkMul: number): MonsterStats {
  return {
    ...m,
    maxHp: Math.floor(m.maxHp * hpMul),
    atk: Math.floor(m.atk * atkMul),
  }
}

// sim 模型 EHP 偏低（缺金钟罩/回血/免死等被动），T3+ 玩家全灭。
// 临时把玩家 maxHp 放大让战斗能跑完，方便看方案差异。
const PLAYER_HP_BUFF = 30.0
function buffPlayer<T extends { maxHp: number }>(p: T): T {
  return { ...p, maxHp: Math.floor(p.maxHp * PLAYER_HP_BUFF) }
}

function fmtPct(n: number): string { return (n * 100).toFixed(1).padStart(5) + '%' }
function fmtNum(n: number): string { return n.toFixed(1).padStart(7) }

function compareTier(presetKey: string, tier: number) {
  const preset = PRESETS[presetKey]
  if (!preset) return
  const player = buffPlayer(buildPlayer(preset.build))
  const monsterBuild = getTierBoss(tier, null)
  const monsterBase = buildMonster(monsterBuild)

  const variants: { name: string; hp: number; atk: number }[] = [
    { name: 'baseline      ', hp: 1.0, atk: 1.0 },
    { name: 'HP×2, ATK×0.70', hp: 2.0, atk: 0.70 },
    { name: 'HP×2, ATK×0.65', hp: 2.0, atk: 0.65 },
    { name: 'HP×2, ATK×0.60', hp: 2.0, atk: 0.60 },
    { name: 'HP×2, ATK×0.55', hp: 2.0, atk: 0.55 },
    { name: 'HP×2, ATK×0.50', hp: 2.0, atk: 0.50 },
  ]

  console.log(`\n${'='.repeat(96)}`)
  console.log(`  ${preset.name}  vs  T${tier} Boss  (玩家 ATK ${player.atk}, HP ${player.maxHp})`)
  console.log('='.repeat(96))
  console.log(`  ${'方案'.padEnd(16)} | ${'胜率'.padStart(7)} | ${'回合'.padStart(7)} | ${'承伤总'.padStart(10)} | ${'承伤/原HP'.padStart(11)} | ${'剩余HP%'.padStart(9)}`)
  console.log(`  ${'-'.repeat(94)}`)

  for (const v of variants) {
    const monster = adjust(monsterBase, v.hp, v.atk)
    let wins = 0, totalTurns = 0, totalDmgTaken = 0
    const MAX_TURNS = 600 // 拉高 cap 让 T5+ 战斗能完整跑完
    for (let i = 0; i < RUNS; i++) {
      const r = simulateBattle(player, monster, preset.element || null, MAX_TURNS)
      if (r.won) wins++
      totalTurns += r.turns
      totalDmgTaken += r.playerDamageTaken
    }
    const winRate = wins / RUNS
    const avgTurns = totalTurns / RUNS
    const avgDmgTaken = totalDmgTaken / RUNS
    const dmgPctOfRawHp = avgDmgTaken / player.maxHp

    console.log(
      `  ${v.name.padEnd(16)} | ${fmtPct(winRate)} | ${fmtNum(avgTurns)} | ${fmtNum(avgDmgTaken).padStart(10)} | ${fmtNum(dmgPctOfRawHp).padStart(11)} | -`
    )
  }
}

console.log('\n🎯 HP×2 怪物方案验证 (RUNS=' + RUNS + ')\n')
console.log('  说明: 承伤总 = 玩家"等效 HP"(原HP×2 BD) − 战后剩余 HP；承伤/原HP 表示实际损耗折合多少倍裸 HP')
console.log('  目标: ATK×0.65 应让"承伤/原HP"接近 baseline，但战斗回合数 ~×2')

const scenarios: { preset: string; tier: number }[] = [
  { preset: 'T1_early',  tier: 1 },
  { preset: 'T3_mid',    tier: 3 },
  { preset: 'T5_mid',    tier: 5 },
  { preset: 'T7_late',   tier: 7 },
  { preset: 'T9_late',   tier: 9 },
  { preset: 'T10_final', tier: 10 },
]
for (const s of scenarios) {
  compareTier(s.preset, s.tier)
}
console.log('')
