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

// 简化的"技能平均 multiplier"
// 真实战斗: 主修 (1.2-1.5 multiplier, 每回合) + 3 个神通技能 (1.5-7.5 multiplier, CD 5-12)
//          + 套装加成 + 附灵触发(frenzy 开场 45%+ / execute <30% hp +60%) + DOT
// 综合加成约 3-5x (这是模拟器的简化; 真实战斗中 combo 后可到 8-10x)
// 暴露出的问题: 光靠技能 multiplier 不够, 需要玩家刷到"毕业装 + 神通 Lv5 + 红附灵"才能打
const AVG_SKILL_MUL = 4.0

// 元素克制矩阵 (复刻 battleEngine)
const ELEMENT_MATRIX: Record<string, Record<string, number>> = {
  metal: { wood: 1.3, water: 0.7 },
  wood:  { earth: 1.3, metal: 0.7 },
  water: { fire: 1.3, earth: 0.7 },
  fire:  { metal: 1.3, water: 0.7 },
  earth: { water: 1.3, wood: 0.7 },
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
  let playerHp = player.maxHp
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
        AVG_SKILL_MUL,
      )
      if (r.dodged) {
        dodges++ // 玩家被敌人闪避
      } else {
        monsterHp -= r.damage
        playerDmgDealt += r.damage
        if (r.isCrit) crits++
        // 吸血
        if (player.lifesteal > 0 && r.damage > 0) {
          const heal = Math.floor(r.damage * player.lifesteal)
          playerHp = Math.min(player.maxHp, playerHp + heal)
        }
      }
    }
    if (monsterHp <= 0) break

    // 怪物反击
    const r2 = calcDamage(
      monster.atk, player.def,
      monster.critRate, monster.critDmg,
      monster.armorPen, monster.accuracy,
      player.dodge,
      monster.element, playerElement,
      1.0, // 怪物用普攻
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
