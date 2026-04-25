/**
 * 模拟器: 简化战斗循环
 * 对应真实逻辑见 server/engine/battleEngine.ts 的 runWaveBattle
 *
 * 简化:
 * - 每回合按 SPD 决定行动顺序
 * - 攻击公式完全复刻 calculateDamage
 * - 技能按"平均 multiplier"估算 (主修 1.2 / 神通 3.0, 按 CD 加权)
 * - 吸血 / 暴击 / 闪避 / 破甲 / 五行克制 完整复刻
 * - 最大 150 回合 (超时视为失败)
 */

import type { PlayerStats } from './sim-build-player'
import type { MonsterStats } from './sim-build-monster'
import { BATTLE_FORMULA } from '../shared/balance'

export interface BattleResult {
  won: boolean
  turns: number
  playerHpLeft: number
  playerDamageDealt: number
  playerDamageTaken: number
  critsLanded: number
  dodgesUsed: number
  playerDps: number // 实际 DPS
}

// v3.5: 玩家主修 ×0.85 + 神通 ×0.60, 怪物攻击型 ×0.60
// 玩家: 主修 1.10 (×30%权重) + 神通均值 1.8 (×70%权重), 综合 ≈ 1.50 (旧 2.3)
// 怪物: 综合 1.4 × 0.60 = 0.84 (旧 1.4)
// 玩家"BD 隐性收益"(金钟罩/回血/免死/斩杀/减伤) 综合 EHP 额外 ×2.0, DPS 额外 ×1.2
const PLAYER_SKILL_MUL = 1.50
const MONSTER_SKILL_MUL = 0.84
const PLAYER_EHP_BD_MUL = 2.0
const PLAYER_DPS_BD_MUL = 1.2

// 元素克制矩阵 (复刻 battleEngine, v3.4: 从 BATTLE_FORMULA 读)
const ELEMENT_MATRIX: Record<string, Record<string, number>> = {
  metal: { wood: BATTLE_FORMULA.elementCounterMul, water: BATTLE_FORMULA.elementResistedMul },
  wood:  { earth: BATTLE_FORMULA.elementCounterMul, metal: BATTLE_FORMULA.elementResistedMul },
  water: { fire: BATTLE_FORMULA.elementCounterMul, earth: BATTLE_FORMULA.elementResistedMul },
  fire:  { metal: BATTLE_FORMULA.elementCounterMul, water: BATTLE_FORMULA.elementResistedMul },
  earth: { water: BATTLE_FORMULA.elementCounterMul, wood: BATTLE_FORMULA.elementResistedMul },
}
function getElementMulti(attacker: string | null, defender: string | null): number {
  if (!attacker || !defender) return 1.0
  return ELEMENT_MATRIX[attacker]?.[defender] || 1.0
}

function calcDamage(
  atkAtk: number, defDef: number,
  atkCritRate: number, atkCritDmg: number,
  atkArmorPen: number, atkAccuracy: number,
  defDodge: number,
  atkElement: string | null, defElement: string | null,
  skillMul: number,
): { damage: number; isCrit: boolean; dodged: boolean } {
  // 破甲
  const effectiveDef = defDef * Math.max(0, 1 - atkArmorPen / 100)
  // atkDefRatio
  const ratio = atkAtk / (atkAtk + effectiveDef * BATTLE_FORMULA.atkDefRatioDefWeight)
  // 元素倍率
  const elemMul = getElementMulti(atkElement, defElement)

  let dmg = atkAtk * skillMul * elemMul * ratio

  // 暴击
  const isCrit = Math.random() < atkCritRate
  if (isCrit) dmg *= atkCritDmg

  // 闪避 (accuracy 抵消)
  const effectiveDodge = Math.max(0, defDodge - atkAccuracy / 100)
  if (Math.random() < effectiveDodge) {
    return { damage: 0, isCrit: false, dodged: true }
  }

  return { damage: Math.max(1, Math.floor(dmg)), isCrit, dodged: false }
}

export function simulateBattle(
  player: PlayerStats,
  monster: MonsterStats,
  playerElement: string | null = null,
  maxTurns: number = 150,
): BattleResult {
  // v3.4: 玩家 BD 隐性 EHP (金钟罩/回血/免死/减伤 综合)
  const playerEffectiveMaxHp = Math.floor(player.maxHp * PLAYER_EHP_BD_MUL)
  let playerHp = playerEffectiveMaxHp
  let monsterHp = monster.maxHp
  let playerDmgDealt = 0
  let playerDmgTaken = 0
  let crits = 0
  let dodges = 0
  let turns = 0

  // 按 SPD 决定先手
  const playerFirst = player.spd >= monster.spd

  while (turns < maxTurns && playerHp > 0 && monsterHp > 0) {
    turns++

    // 玩家出手
    if (playerFirst || turns > 0) {
      const r = calcDamage(
        player.atk, monster.def,
        player.critRate, player.critDmg,
        player.armorPen, player.accuracy,
        monster.dodge,
        playerElement, monster.element,
        PLAYER_SKILL_MUL,
      )
      if (r.dodged) {
        dodges++ // 玩家被敌人闪避
      } else {
        const dmg = Math.floor(r.damage * PLAYER_DPS_BD_MUL) // BD 加成 (斩杀/逆鳞/vs-boss)
        monsterHp -= dmg
        playerDmgDealt += dmg
        if (r.isCrit) crits++
        // 吸血
        if (player.lifesteal > 0 && dmg > 0) {
          const heal = Math.floor(dmg * player.lifesteal)
          playerHp = Math.min(playerEffectiveMaxHp, playerHp + heal)
        }
      }
    }
    if (monsterHp <= 0) break

    // 怪物反击 (v3.4: 用 MONSTER_SKILL_MUL)
    const r2 = calcDamage(
      monster.atk, player.def,
      monster.critRate, monster.critDmg,
      monster.armorPen, monster.accuracy,
      player.dodge,
      monster.element, playerElement,
      MONSTER_SKILL_MUL,
    )
    if (!r2.dodged) {
      playerHp -= r2.damage
      playerDmgTaken += r2.damage
      // 怪物吸血
      if (monster.lifesteal > 0 && r2.damage > 0) {
        const heal = Math.floor(r2.damage * monster.lifesteal)
        monsterHp = Math.min(monster.maxHp, monsterHp + heal)
      }
    }
  }

  const won = monsterHp <= 0 && playerHp > 0
  return {
    won,
    turns,
    playerHpLeft: Math.max(0, playerHp),
    playerDamageDealt: playerDmgDealt,
    playerDamageTaken: playerDmgTaken,
    critsLanded: crits,
    dodgesUsed: dodges,
    playerDps: turns > 0 ? Math.floor(playerDmgDealt / turns) : 0,
  }
}

export interface BatchResult {
  winRate: number
  avgTurns: number
  avgDps: number
  avgHpLeft: number
  critRate: number // 实际暴击率
  dodgeRate: number // 实际被闪避率
}

export function runBatch(
  player: PlayerStats,
  monster: MonsterStats,
  playerElement: string | null = null,
  runs: number = 1000,
): BatchResult {
  let wins = 0, totalTurns = 0, totalDps = 0, totalHpLeft = 0
  let totalCrits = 0, totalDodges = 0, totalAttacks = 0
  for (let i = 0; i < runs; i++) {
    const r = simulateBattle(player, monster, playerElement)
    if (r.won) wins++
    totalTurns += r.turns
    totalDps += r.playerDps
    totalHpLeft += r.playerHpLeft
    totalCrits += r.critsLanded
    totalDodges += r.dodgesUsed
    totalAttacks += r.turns
  }
  return {
    winRate: wins / runs,
    avgTurns: totalTurns / runs,
    avgDps: totalDps / runs,
    avgHpLeft: totalHpLeft / runs,
    critRate: totalAttacks > 0 ? totalCrits / totalAttacks : 0,
    dodgeRate: totalAttacks > 0 ? totalDodges / totalAttacks : 0,
  }
}
