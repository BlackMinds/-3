/**
 * 破甲对照实验
 * 控制变量：固定 build，仅修改 player.armorPen，对比 DPS 与回合数
 *
 * 用法: npx tsx test/sim-armor-pen.ts
 */

import { buildPlayer } from './sim-build-player'
import { buildMonster, getTierBoss } from './sim-build-monster'
import { runBatch } from './sim-battle'
import { PRESETS } from './sim-presets'
import { BATTLE_FORMULA } from '../shared/balance'

const RUNS = 2000
const ARMOR_PEN_LEVELS = [0, 10, 20, 30, 40, 60]

interface Row {
  preset: string
  bossTier: number
  monsterDef: number
  playerAtk: number
  rows: Array<{ ap: number; winRate: number; dps: number; turns: number; deltaPctVsZero: number }>
}

function runOne(presetKey: string, bossTier: number): Row | null {
  const preset = PRESETS[presetKey]
  if (!preset) return null
  const basePlayer = buildPlayer(preset.build)
  const monsterBuild = getTierBoss(bossTier, null)
  const monster = buildMonster(monsterBuild)

  const rows: Row['rows'] = []
  let baselineDps = 0
  for (const ap of ARMOR_PEN_LEVELS) {
    const player = { ...basePlayer, armorPen: ap }
    const r = runBatch(player, monster, preset.element || null, RUNS)
    if (ap === 0) baselineDps = r.avgDps
    rows.push({
      ap,
      winRate: r.winRate,
      dps: r.avgDps,
      turns: r.avgTurns,
      deltaPctVsZero: baselineDps > 0 ? (r.avgDps / baselineDps - 1) * 100 : 0,
    })
  }
  return {
    preset: preset.name,
    bossTier,
    monsterDef: monster.def,
    playerAtk: basePlayer.atk,
    rows,
  }
}

function fmt(n: number, d = 1): string { return n.toFixed(d) }
function fmtNum(n: number): string { return n.toLocaleString('en-US', { maximumFractionDigits: 0 }) }

function printRow(r: Row) {
  console.log('─'.repeat(86))
  console.log(`${r.preset}  vs  T${r.bossTier} Boss   |   玩家 ATK ${fmtNum(r.playerAtk)}   |   怪物 DEF ${fmtNum(r.monsterDef)}`)
  console.log(`atk/def 比 = ${fmt(r.playerAtk / r.monsterDef, 2)}`)
  console.log('─'.repeat(86))
  console.log(`  破甲  |  胜率   |  平均 DPS   |  平均回合  |  vs 0 破甲 增幅`)
  for (const row of r.rows) {
    const ap = String(row.ap).padStart(3)
    const wr = (row.winRate * 100).toFixed(1).padStart(5) + '%'
    const dps = fmtNum(row.dps).padStart(11)
    const turns = fmt(row.turns, 1).padStart(7)
    const delta = (row.deltaPctVsZero >= 0 ? '+' : '') + fmt(row.deltaPctVsZero, 2) + '%'
    console.log(`  ${ap}    |  ${wr}  |  ${dps}  |  ${turns}    |  ${delta}`)
  }
  console.log('')
}

function main() {
  console.log('=' .repeat(86))
  console.log(`破甲对照实验  (DEF 权重 = ${BATTLE_FORMULA.atkDefRatioDefWeight}, 每档跑 ${RUNS} 场)`)
  console.log('=' .repeat(86) + '\n')

  const cases: Array<[string, number]> = [
    ['T5_mid', 5],
    ['T5_mid', 7],   // 越级 1-2 阶看高防场景
    ['T7_late', 7],
    ['T7_late', 9],
    ['T10_final', 10],
    ['T10_final', 10], // 毕业打 T10 boss 重复一次基线
  ]
  for (const [key, tier] of cases) {
    const r = runOne(key, tier)
    if (r) printRow(r)
  }
}

main()
