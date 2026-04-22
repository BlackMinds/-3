/**
 * 模拟器命令行入口
 *
 * 用法:
 *   npx tsx test/sim.ts              # 跑全 preset baseline (T1 → T10)
 *   npx tsx test/sim.ts --preset=T5_mid --tier=5
 *   npx tsx test/sim.ts --preset=T10_final --tier=10
 *
 * 目的: 验证 v3.0 数值设计意图:
 *   - T5 Boss 胜率 ≈ 85% / 回合 22-28
 *   - T7 Boss 胜率 ≈ 75% / 回合 28-35
 *   - T10 Boss 胜率 ≈ 55% / 回合 40-50
 *   - 中档 build 不触顶 / 毕业 build 刚好触顶
 */

import { buildPlayer, type PlayerStats } from './sim-build-player'
import { buildMonster, getTierBoss } from './sim-build-monster'
import { runBatch } from './sim-battle'
import { PRESETS } from './sim-presets'
import { PLAYER_CAPS } from '../shared/balance'

// 解析命令行参数
function parseArgs(): { preset?: string; tier?: number; runs?: number } {
  const args: any = {}
  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.replace(/^--/, '').split('=')
    args[k] = v || true
  }
  return {
    preset: args.preset,
    tier: args.tier ? Number(args.tier) : undefined,
    runs: args.runs ? Number(args.runs) : 1000,
  }
}

function fmtPct(n: number): string { return (n * 100).toFixed(1) + '%' }
function fmtNum(n: number): string { return n.toLocaleString('en-US', { maximumFractionDigits: 1 }) }

function reportBuild(presetKey: string, tier: number, runs: number) {
  const preset = PRESETS[presetKey]
  if (!preset) { console.log(`未知 preset: ${presetKey}`); return }
  const player = buildPlayer(preset.build)
  const monsterBuild = getTierBoss(tier, null)
  const monster = buildMonster(monsterBuild)
  const result = runBatch(player, monster, preset.element || null, runs)

  console.log('=' .repeat(72))
  console.log(`  ${preset.name}  vs  T${tier} Boss (power ${fmtNum(monsterBuild.power)})`)
  console.log('=' .repeat(72))

  console.log('\n【玩家属性】')
  console.log(`  ATK:       ${fmtNum(player.atk)}`)
  console.log(`  DEF:       ${fmtNum(player.def)}`)
  console.log(`  HP:        ${fmtNum(player.maxHp)}`)
  console.log(`  SPD:       ${fmtNum(player.spd)}`)
  console.log(`  暴击率:    ${fmtPct(player.critRate)}${player.rawBeforeCap.critRate > PLAYER_CAPS.critRate ? ` ✂️ cap (原 ${fmtPct(player.rawBeforeCap.critRate)})` : ''}`)
  console.log(`  暴伤:      ${(player.critDmg * 100).toFixed(0)}%${player.rawBeforeCap.critDmg > PLAYER_CAPS.critDmg ? ` ✂️ cap (原 ${(player.rawBeforeCap.critDmg * 100).toFixed(0)}%)` : ''}`)
  console.log(`  闪避:      ${fmtPct(player.dodge)}${player.rawBeforeCap.dodge > PLAYER_CAPS.dodge ? ` ✂️ cap (原 ${fmtPct(player.rawBeforeCap.dodge)})` : ''}`)
  console.log(`  吸血:      ${fmtPct(player.lifesteal)}${player.rawBeforeCap.lifesteal > PLAYER_CAPS.lifesteal ? ` ✂️ cap (原 ${fmtPct(player.rawBeforeCap.lifesteal)})` : ''}`)
  console.log(`  破甲:      ${fmtNum(player.armorPen)}${player.rawBeforeCap.armorPen > PLAYER_CAPS.armorPen ? ` ✂️ cap (原 ${fmtNum(player.rawBeforeCap.armorPen)})` : ''}`)
  console.log(`  命中:      ${fmtNum(player.accuracy)}${player.rawBeforeCap.accuracy > PLAYER_CAPS.accuracy ? ` ✂️ cap (原 ${fmtNum(player.rawBeforeCap.accuracy)})` : ''}`)

  console.log('\n【怪物属性】')
  console.log(`  ATK: ${fmtNum(monster.atk)} / DEF: ${fmtNum(monster.def)} / HP: ${fmtNum(monster.maxHp)} / SPD: ${fmtNum(monster.spd)}`)
  console.log(`  暴击 ${fmtPct(monster.critRate)} / 暴伤 ${(monster.critDmg*100).toFixed(0)}% / 闪避 ${fmtPct(monster.dodge)} / 破甲 ${fmtNum(monster.armorPen)}`)

  console.log(`\n【战斗模拟 ${runs} 次】`)
  const turnRange = getTargetTurns(tier)
  const winRateTarget = getTargetWinRate(tier)
  console.log(`  胜率:          ${fmtPct(result.winRate).padStart(6)}   (目标 ${fmtPct(winRateTarget)})  ${result.winRate >= winRateTarget * 0.85 ? '✅' : '❌'}`)
  console.log(`  平均击杀回合:  ${result.avgTurns.toFixed(1).padStart(6)}   (目标 ${turnRange})     ${inRange(result.avgTurns, turnRange) ? '✅' : '⚠️'}`)
  console.log(`  平均 DPS:      ${fmtNum(result.avgDps).padStart(12)}`)
  console.log(`  平均剩余 HP:   ${fmtNum(result.avgHpLeft).padStart(12)} / ${fmtNum(player.maxHp)} (${fmtPct(result.avgHpLeft / player.maxHp)})`)
  console.log(`  实际暴击率:    ${fmtPct(result.critRate).padStart(6)}   (设定 ${fmtPct(player.critRate)})`)
  console.log(`  被闪避率:      ${fmtPct(result.dodgeRate).padStart(6)}   (怪物 ${fmtPct(monster.dodge)})`)
  console.log('')
}

function getTargetTurns(tier: number): string {
  // v3.0 挑战曲线 (从 intent 文档)
  const targets: Record<number, string> = {
    1: '8-12', 2: '10-15', 3: '12-18', 4: '15-20',
    5: '22-28', 6: '25-32', 7: '28-35', 8: '32-40',
    9: '36-44', 10: '40-50',
  }
  return targets[tier] || '?'
}
function getTargetWinRate(tier: number): number {
  const targets: Record<number, number> = {
    1: 0.98, 2: 0.95, 3: 0.92, 4: 0.88,
    5: 0.85, 6: 0.80, 7: 0.75, 8: 0.70,
    9: 0.65, 10: 0.55,
  }
  return targets[tier] || 0.5
}
function inRange(n: number, range: string): boolean {
  const [lo, hi] = range.split('-').map(Number)
  return n >= lo * 0.8 && n <= hi * 1.2
}

// ===== Main =====
const args = parseArgs()

if (args.preset && args.tier !== undefined) {
  reportBuild(args.preset, args.tier, args.runs || 1000)
} else {
  // 默认: 跑 baseline
  console.log('\n🎯 v3.0 数值体系 baseline 验证\n')
  const scenarios: { preset: string; tier: number }[] = [
    { preset: 'T1_early', tier: 1 },
    { preset: 'T3_mid',   tier: 3 },
    { preset: 'T5_mid',   tier: 5 },
    { preset: 'T7_late',  tier: 7 },
    { preset: 'T10_final', tier: 10 },
  ]
  for (const s of scenarios) {
    reportBuild(s.preset, s.tier, args.runs || 1000)
  }
}
