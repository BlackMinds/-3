// 通天塔战斗引擎
// 单人 1-2 怪战斗，每层独立（满血 + CD 满进入）。
// 复用现有 battleEngine.runWaveBattle（不改其内部）；战斗前应用 trait。
// runWaveBattle 内部已默认每场战斗将 player.hp = playerStats.maxHp，buffs/debuffs 重置，
// 所以"每层重置"是天然满足的——只要每场战斗各自调用一次 runWaveBattle 即可。

import {
  generateMonsterStats,
  runWaveBattle,
  buildMonsterSkillDescriptions,
  type BattlerStats,
  type MonsterTemplate,
  type EquippedSkillInfo,
  type WaveBattleResult,
  type BattleLogEntry,
} from './battleEngine'
import { applyTraits } from './towerTraits'
import { getFloorDef, type FloorDef, type FloorMonster } from './towerData'

export interface TowerBattleSetup {
  floor: number
  floorDef: FloorDef
  monsters: { stats: BattlerStats; template: MonsterTemplate; traitIds: string[] }[]
}

/** 为某一层生成怪物（应用 trait 后的 stats），可在 runWaveBattle 之前调用 */
export function buildFloorMonsters(floor: number): TowerBattleSetup | null {
  const floorDef = getFloorDef(floor)
  if (!floorDef) return null

  const monsters: TowerBattleSetup['monsters'] = floorDef.monsters.map((fm: FloorMonster) => {
    const stats = generateMonsterStats(fm.template)
    applyTraits(stats, fm.traits)  // 原地修改
    // 注入 trait 列表，让 battleEngine 主循环能识别 B01/B04/B05 等"回合 hook" trait
    stats._towerTraits = fm.traits.slice()
    return {
      stats,
      template: fm.template,
      traitIds: fm.traits.slice(),
    }
  })

  return { floor, floorDef, monsters }
}

export interface TowerBattleOutcome {
  won: boolean
  logs: BattleLogEntry[]
  totalTurns: number
  damageDealt: number
  damageTaken: number
  /** 怪物起手数据（前端展示用） */
  monstersInfo: Array<{
    name: string
    element: string | null
    role: string
    maxHp: number
    atk: number
    def: number
    spd: number
    crit_rate: number
    crit_dmg: number
    dodge: number
    armorPen: number
    accuracy: number
    resists: any
    skills: string[]
    traits: string[]
  }>
}

/** 跑一场塔战斗 */
export function runTowerBattle(
  playerStats: BattlerStats,
  setup: TowerBattleSetup,
  equippedSkills?: EquippedSkillInfo,
): TowerBattleOutcome {
  // 准备 runWaveBattle 入参
  const monsterList = setup.monsters.map(m => ({
    stats: m.stats,
    template: m.template,
  }))

  // ⚠️ runWaveBattle 内部会用 monsterList[].stats 的副本，
  // 它会把每场玩家 HP 重置为 playerStats.maxHp，buffs/debuffs 清空，
  // 这正好对应通天塔"每层重置"的需求。
  const result: WaveBattleResult = runWaveBattle(playerStats, monsterList, equippedSkills)

  // 统计伤害（从日志近似计算）
  let damageDealt = 0
  let damageTaken = 0
  for (const log of result.logs) {
    // log 类型 'normal' / 'crit' 通常代表实际伤害行
    if (log.type === 'normal' || log.type === 'crit') {
      // 玩家 HP 下降 = 受到伤害；怪物 HP 下降 = 造成伤害
      // 这里简化：每条日志的 playerHp 与 monstersHp 与上一条比较即可，
      // 但是 logs 里 monstersHp 是数组，我们简单以 monsterHp 字段为参考
    }
  }
  // 真正伤害统计：扫一遍 logs，累计 hp 差值
  let prevPlayerHp = playerStats.maxHp
  let prevMonstersHp: Record<string, number> | null = null
  for (const log of result.logs) {
    if (typeof log.playerHp === 'number' && log.playerHp >= 0) {
      const delta = prevPlayerHp - log.playerHp
      if (delta > 0) damageTaken += delta
      prevPlayerHp = log.playerHp
    }
    // monstersHp 数组对应每只怪
    if (Array.isArray(log.monstersHp)) {
      if (prevMonstersHp === null) {
        prevMonstersHp = {}
        log.monstersHp.forEach((hp, i) => { prevMonstersHp![`${i}`] = hp })
      } else {
        log.monstersHp.forEach((hp, i) => {
          const prev = prevMonstersHp![`${i}`] ?? hp
          if (hp >= 0 && prev > hp) damageDealt += (prev - hp)
          prevMonstersHp![`${i}`] = hp
        })
      }
    }
  }

  // 收集怪物展示信息
  const monstersInfo = setup.monsters.map(m => ({
    name: m.stats.name,
    element: m.template.element,
    role: m.template.role,
    maxHp: m.stats.maxHp,
    atk: m.stats.atk,
    def: m.stats.def,
    spd: m.stats.spd,
    crit_rate: m.stats.crit_rate,
    crit_dmg: m.stats.crit_dmg,
    dodge: m.stats.dodge,
    armorPen: m.stats.armorPen || 0,
    accuracy: m.stats.accuracy || 0,
    resists: m.stats.resists || null,
    skills: buildMonsterSkillDescriptions(m.template),
    traits: m.traitIds,
  }))

  // 计算总回合数（取最后一条日志的 turn 字段；没有则 0）
  const totalTurns = result.logs.length > 0
    ? Math.max(0, result.logs[result.logs.length - 1].turn || 0)
    : 0

  return {
    won: result.won,
    logs: result.logs,
    totalTurns,
    damageDealt,
    damageTaken,
    monstersInfo,
  }
}
