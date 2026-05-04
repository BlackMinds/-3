/**
 * 破甲伤害对照表
 * 固定玩家 build，对各种怪物算「单次确定性伤害」
 * 去掉暴击/闪避随机，纯看公式输出
 *
 * 用法: npx tsx test/sim-armor-pen-table.ts
 */

import { buildPlayer } from './sim-build-player'
import { buildMonster, getTierBoss, type MonsterStats, TIER_BOSS_POWER } from './sim-build-monster'
import { PRESETS } from './sim-presets'
import { BATTLE_FORMULA } from '../shared/balance'

const AP_LEVELS = [0, 10, 20, 50]
const SKILL_MUL = 1.50

// 单次确定性伤害（不带暴击/闪避，纯公式输出）
function calcSingleHit(atk: number, def: number, armorPen: number): number {
  const effectiveDef = def * Math.max(0, 1 - armorPen / 100)
  const ratio = atk / (atk + effectiveDef * BATTLE_FORMULA.atkDefRatioDefWeight)
  return atk * SKILL_MUL * ratio
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function pad(s: string, n: number, right = false): string {
  if (s.length >= n) return s
  return right ? s + ' '.repeat(n - s.length) : ' '.repeat(n - s.length) + s
}

interface Target {
  name: string
  monster: MonsterStats
}

function buildTargets(): Target[] {
  const out: Target[] = []
  // 各 tier boss
  for (let t = 1; t <= 10; t++) {
    out.push({ name: `T${t} Boss`, monster: buildMonster(getTierBoss(t, null)) })
  }
  // T7 / T10 不同 role 对比
  for (const t of [7, 10]) {
    for (const role of ['tank', 'dps', 'balanced'] as const) {
      out.push({
        name: `T${t} ${role.padEnd(8)}`,
        monster: buildMonster({ tier: t, role, power: TIER_BOSS_POWER[t], element: null }),
      })
    }
  }
  return out
}

function printTable(presetKey: string) {
  const preset = PRESETS[presetKey]
  if (!preset) return
  const player = buildPlayer(preset.build)
  const targets = buildTargets()

  console.log('=' .repeat(96))
  console.log(`玩家：${preset.name}   ATK=${fmtNum(player.atk)}  (技能倍率 ${SKILL_MUL.toFixed(2)})`)
  console.log('=' .repeat(96))
  console.log(
    pad('对手', 16, true) + ' | ' +
    pad('对手 DEF', 11) + ' | ' +
    pad('0 破甲', 10) + ' | ' +
    pad('10 破甲', 10) + ' | ' +
    pad('20 破甲', 10) + ' | ' +
    pad('50 破甲', 10) + ' | ' +
    pad('+10 vs 0', 9) + ' | ' +
    pad('+20 vs 0', 9) + ' | ' +
    pad('+50 vs 0', 9)
  )
  console.log('-'.repeat(96))

  for (const t of targets) {
    const dmgs = AP_LEVELS.map(ap => calcSingleHit(player.atk, t.monster.def, ap))
    const base = dmgs[0]
    const deltas = dmgs.slice(1).map(d => ((d / base - 1) * 100))
    console.log(
      pad(t.name, 16, true) + ' | ' +
      pad(fmtNum(t.monster.def), 11) + ' | ' +
      pad(fmtNum(dmgs[0]), 10) + ' | ' +
      pad(fmtNum(dmgs[1]), 10) + ' | ' +
      pad(fmtNum(dmgs[2]), 10) + ' | ' +
      pad(fmtNum(dmgs[3]), 10) + ' | ' +
      pad('+' + deltas[0].toFixed(1) + '%', 9) + ' | ' +
      pad('+' + deltas[1].toFixed(1) + '%', 9) + ' | ' +
      pad('+' + deltas[2].toFixed(1) + '%', 9)
    )
  }
  console.log('')
}

function main() {
  console.log(`# 破甲伤害对照（DEF 权重=${BATTLE_FORMULA.atkDefRatioDefWeight}, 单次确定性伤害, 不含暴击/元素加成）\n`)
  printTable('T5_mid')
  printTable('T7_late')
  printTable('T10_final')
}

main()
