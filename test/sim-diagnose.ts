/**
 * v3.4 战斗合理性诊断
 *
 * 相比 sim 的简化战斗, 这里用"理论 DPS/EHP 比例"判断每个 tier 的合理性,
 * 并对比改动前 (v3.3) 和改动后 (v3.4) 的差距.
 *
 * 目标: 让各 tier 玩家 DPS ≥ 怪物 DPS, EHP 比值稳定, 理论回合数接近设计目标
 */

import { buildPlayer } from './sim-build-player'
import { buildMonster, getTierBoss } from './sim-build-monster'
import { PRESETS } from './sim-presets'

interface Diag {
  tier: number
  presetName: string
  player: { atk: number; def: number; hp: number; critRate: number; critDmg: number }
  monster: { atk: number; def: number; hp: number; critRate: number; critDmg: number }
  playerDps: number
  monsterDps: number
  playerEhp: number
  monsterEhp: number
  playerKillTurns: number  // 玩家杀怪需要的回合
  monsterKillTurns: number // 怪物杀玩家需要的回合
  winIfFirst: boolean      // 玩家先手是否赢
  targetTurns: string
}

// v3.4 公式常量
const DEF_WEIGHT = 0.8
const ELEM_NEUTRAL = 1.0

// sim 对技能 mul / BD 的建模
const PLAYER_SKILL_MUL = 2.3   // 主修 1.3 + 神通均摊
const MONSTER_SKILL_MUL = 1.4  // 普攻 + 技能均摊
const PLAYER_EHP_BD = 2.0      // 金钟罩/回血/免死/减伤综合
const PLAYER_DPS_BD = 1.2      // 斩杀/逆鳞/vs_boss

function computeDiag(presetKey: string, tier: number): Diag {
  const preset = PRESETS[presetKey]
  const player = buildPlayer(preset.build)
  const monsterBuild = getTierBoss(tier, null)
  const monster = buildMonster(monsterBuild)

  // 玩家对怪物平均单发伤害
  const pRatio = player.atk / (player.atk + monster.def * DEF_WEIGHT)
  const pCritMul = 1 + player.critRate * (player.critDmg - 1)
  const pSingle = player.atk * PLAYER_SKILL_MUL * ELEM_NEUTRAL * pRatio * pCritMul * PLAYER_DPS_BD

  // 怪物对玩家平均单发伤害
  const mRatio = monster.atk / (monster.atk + player.def * DEF_WEIGHT)
  const mCritMul = 1 + monster.critRate * (monster.critDmg - 1)
  // 玩家闪避 (命中抵消后)
  const effDodge = Math.max(0, player.dodge - monster.accuracy / 100)
  const mSingle = monster.atk * MONSTER_SKILL_MUL * ELEM_NEUTRAL * mRatio * mCritMul * (1 - effDodge)

  const playerEhp = player.maxHp * PLAYER_EHP_BD
  const monsterEhp = monster.maxHp

  const playerKillTurns = monsterEhp / Math.max(1, pSingle)
  const monsterKillTurns = playerEhp / Math.max(1, mSingle)

  // 先手: 玩家 spd >= 怪物 spd 则先手; 先手方多打 0.5 回合
  const playerFirst = player.spd >= monster.spd
  const winIfFirst = playerFirst ? playerKillTurns <= monsterKillTurns + 0.5 : playerKillTurns <= monsterKillTurns - 0.5

  return {
    tier,
    presetName: preset.name,
    player: { atk: player.atk, def: player.def, hp: player.maxHp, critRate: player.critRate, critDmg: player.critDmg },
    monster: { atk: monster.atk, def: monster.def, hp: monster.maxHp, critRate: monster.critRate, critDmg: monster.critDmg },
    playerDps: Math.floor(pSingle),
    monsterDps: Math.floor(mSingle),
    playerEhp: Math.floor(playerEhp),
    monsterEhp: Math.floor(monsterEhp),
    playerKillTurns: playerKillTurns,
    monsterKillTurns: monsterKillTurns,
    winIfFirst,
    targetTurns: getTargetTurns(tier),
  }
}

function getTargetTurns(tier: number): string {
  const targets: Record<number, string> = {
    1: '8-12', 2: '10-15', 3: '12-18', 4: '15-20',
    5: '22-28', 6: '25-32', 7: '28-35', 8: '32-40',
    9: '36-44', 10: '40-50',
  }
  return targets[tier] || '?'
}
function inRange(n: number, range: string): boolean {
  const [lo, hi] = range.split('-').map(Number)
  return n >= lo * 0.7 && n <= hi * 1.3
}
function fmtNum(n: number): string { return n.toLocaleString('en-US', { maximumFractionDigits: 0 }) }

// Main
const scenarios: { preset: string; tier: number }[] = [
  { preset: 'T1_early',  tier: 1 },
  { preset: 'T2_early',  tier: 2 },
  { preset: 'T3_mid',    tier: 3 },
  { preset: 'T4_mid',    tier: 4 },
  { preset: 'T5_mid',    tier: 5 },
  { preset: 'T6_mid',    tier: 6 },
  { preset: 'T7_late',   tier: 7 },
  { preset: 'T8_late',   tier: 8 },
  { preset: 'T9_late',   tier: 9 },
  { preset: 'T10_final', tier: 10 },
]

console.log('\n🎯 v3.4 战斗合理性诊断 (T1-T10, 含玩家 BD ×2.0 EHP / ×1.2 DPS)\n')
console.log('| Tier | 玩家 DPS | 怪物 DPS | DPS 比 | 玩家 EHP | 怪物 EHP | 玩家杀怪 | 怪物杀玩家 | 目标回合 | 判定 |')
console.log('|---|---|---|---|---|---|---|---|---|---|')

const diags = scenarios.map(s => computeDiag(s.preset, s.tier))

for (const d of diags) {
  const ratio = (d.playerDps / d.monsterDps).toFixed(2)
  const pkt = d.playerKillTurns.toFixed(1)
  const mkt = d.monsterKillTurns.toFixed(1)
  const actual = Math.min(d.playerKillTurns, d.monsterKillTurns)
  const inTarget = inRange(actual, d.targetTurns)
  // 判定: 玩家 DPS ≥ 怪物 DPS 且实际回合在目标范围 70-130%
  let verdict: string
  if (d.playerKillTurns < d.monsterKillTurns && inTarget) verdict = '✅ 合理'
  else if (d.playerKillTurns >= d.monsterKillTurns) verdict = '❌ 玩家打不过'
  else if (actual < Number(d.targetTurns.split('-')[0]) * 0.7) verdict = '⚠️ 过快'
  else verdict = '⚠️ 过慢'
  console.log(`| T${d.tier} | ${fmtNum(d.playerDps)} | ${fmtNum(d.monsterDps)} | ${ratio}x | ${fmtNum(d.playerEhp)} | ${fmtNum(d.monsterEhp)} | ${pkt} 回合 | ${mkt} 回合 | ${d.targetTurns} | ${verdict} |`)
}

console.log('\n【详细诊断】')
for (const d of diags) {
  console.log(`\nT${d.tier}: ${d.presetName}`)
  console.log(`  玩家: ATK ${fmtNum(d.player.atk)} / DEF ${fmtNum(d.player.def)} / HP ${fmtNum(d.player.hp)} / 暴伤 ${(d.player.critDmg * 100).toFixed(0)}%`)
  console.log(`  怪物: ATK ${fmtNum(d.monster.atk)} / DEF ${fmtNum(d.monster.def)} / HP ${fmtNum(d.monster.hp)}`)
  console.log(`  玩家 DPS ${fmtNum(d.playerDps)} (BD ×1.2) / 怪物 DPS ${fmtNum(d.monsterDps)}`)
  console.log(`  EHP: 玩家 ${fmtNum(d.playerEhp)} (BD ×2.0) / 怪物 ${fmtNum(d.monsterEhp)}`)
  console.log(`  → 玩家 ${d.playerKillTurns.toFixed(1)} 回合杀怪 vs 怪物 ${d.monsterKillTurns.toFixed(1)} 回合杀玩家`)
}
