// 秘境组队战斗引擎 —— 多人 vs 多怪
// 复用 battleEngine.ts 的伤害计算、怪物技能、debuff 系统

import {
  generateMonsterStats,
  calculateDamage,
  buildMonsterSkillPool,
  initMonsterSkillState,
  monsterChooseSkill,
  tickMonsterCds,
  type BattlerStats,
  type BattleLogEntry,
  type MonsterTemplate,
  type EquippedSkillInfo,
  type SkillRefInfo,
  type MonsterSkillDef,
  type MonsterSkillState,
} from './battleEngine'
import type { SecretRealmDef, SecretRealmDifficultyConfig, SecretRealmWave } from './secretRealmData'
import { scaleMonsterTemplate } from './secretRealmData'
import type { DebuffType, BuffType } from './skillData'

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ========== Debuff / Buff 运行时 ==========
interface ActiveDebuff {
  type: DebuffType
  remaining: number
  damagePerTurn: number
  value?: number
}
interface ActiveBuff {
  type: BuffType | 'atk_up' | 'def_up'
  remaining: number
  value?: number
  valuePercent?: number
}

// ========== 队员运行时状态 ==========
interface TeamPlayer {
  characterId: number
  name: string
  stats: BattlerStats
  baseAtk: number
  baseDef: number
  baseMaxHp: number
  equippedSkills: EquippedSkillInfo | null
  alive: boolean
  divineCds: number[]
  debuffs: ActiveDebuff[]
  buffs: ActiveBuff[]
  frozenTurns: number
  // 统计
  damageDealt: number
  healingDone: number
  damageTaken: number
}

interface TeamMonster {
  stats: BattlerStats
  template: MonsterTemplate
  baseAtk: number
  baseDef: number
  alive: boolean
  skillState: MonsterSkillState
  debuffs: ActiveDebuff[]
  buffs: ActiveBuff[]
  frozenTurns: number
}

export interface TeamBattleReward {
  characterId: number
  name: string
  damageDealt: number
  healingDone: number
  damageTaken: number
  contribution: number
}

export interface KilledMonsterInfo {
  name: string
  element: string | null
  isBoss: boolean
}

export interface TeamBattleResult {
  won: boolean
  wavesCleared: number
  totalTurns: number
  rating: 'S' | 'A' | 'B' | null
  logs: BattleLogEntry[]
  contributions: TeamBattleReward[]
  teamBuffs: string[]
  killedMonsters: KilledMonsterInfo[]
}

export interface TeamPlayerInput {
  characterId: number
  name: string
  stats: BattlerStats
  equippedSkills: EquippedSkillInfo | null
  spiritualRoot: string | null
  sectId: number | null
}

// ========== 队伍 Buff ==========
export function calcTeamBuffs(players: TeamPlayerInput[]): { buffs: string[]; apply: (p: TeamPlayer) => void } {
  const buffs: string[] = []
  const rootCount: Record<string, number> = {}
  for (const p of players) {
    if (p.spiritualRoot) rootCount[p.spiritualRoot] = (rootCount[p.spiritualRoot] || 0) + 1
  }
  const resonantElements: string[] = []
  for (const [e, c] of Object.entries(rootCount)) if (c >= 2) resonantElements.push(e)
  if (resonantElements.length > 0) buffs.push(`元素共鸣（${resonantElements.join('、')}）：该元素伤害+15%`)

  const uniqueRoots = Object.keys(rootCount).length
  const hasAllElement = players.length >= 2 && uniqueRoots >= 3
  if (hasAllElement) buffs.push('全元素阵：全队全属性+5%')

  const sectIds = players.map(p => p.sectId).filter(id => id)
  const allSameSect = sectIds.length === players.length && sectIds.length > 0 && new Set(sectIds).size === 1
  if (allSameSect) buffs.push('宗门之力：全队全属性+10%，经验+15%')

  const apply = (p: TeamPlayer) => {
    if (hasAllElement) {
      p.stats.atk = Math.floor(p.stats.atk * 1.05)
      p.stats.def = Math.floor(p.stats.def * 1.05)
      p.stats.maxHp = Math.floor(p.stats.maxHp * 1.05)
      p.stats.spd = Math.floor(p.stats.spd * 1.05)
    }
    if (allSameSect) {
      p.stats.atk = Math.floor(p.stats.atk * 1.10)
      p.stats.def = Math.floor(p.stats.def * 1.10)
      p.stats.maxHp = Math.floor(p.stats.maxHp * 1.10)
      p.stats.spd = Math.floor(p.stats.spd * 1.10)
    }
    if (!p.stats.elementDmg) p.stats.elementDmg = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }
    for (const e of resonantElements) (p.stats.elementDmg as any)[e] += 15
    p.stats.hp = p.stats.maxHp
    p.baseMaxHp = p.stats.maxHp
    p.baseAtk = p.stats.atk
    p.baseDef = p.stats.def
  }

  return { buffs, apply }
}

export function getTeamExpBonus(players: TeamPlayerInput[]): number {
  const sectIds = players.map(p => p.sectId).filter(id => id)
  const allSameSect = sectIds.length === players.length && sectIds.length > 0 && new Set(sectIds).size === 1
  return allSameSect ? 0.15 : 0
}

// ========== 构建怪物波次 ==========
function buildWaveMonsters(wave: SecretRealmWave, powerMul: number): TeamMonster[] {
  const result: TeamMonster[] = []
  for (let i = 0; i < wave.monsterCount; i++) {
    const tmpl = wave.monsterPool[i % wave.monsterPool.length]
    const scaled = scaleMonsterTemplate(tmpl, powerMul)
    const stats = generateMonsterStats(scaled)
    result.push({
      stats,
      template: scaled,
      baseAtk: stats.atk,
      baseDef: stats.def,
      alive: true,
      skillState: initMonsterSkillState(scaled),
      debuffs: [],
      buffs: [],
      frozenTurns: 0,
    })
  }
  return result
}

// ========== Debuff / Buff 辅助 ==========
function applyDebuffDps(target: TeamPlayer | TeamMonster, debuff: { type: DebuffType; chance: number; duration: number; value?: number }, attackerAtk: number, defenderMaxHp: number) {
  // 命中判定
  if (Math.random() >= debuff.chance) return false
  const d: ActiveDebuff = {
    type: debuff.type,
    remaining: debuff.duration,
    damagePerTurn: 0,
    value: debuff.value,
  }
  // 持续伤害 debuff
  if (debuff.type === 'burn') d.damagePerTurn = Math.floor(attackerAtk * 0.5 + defenderMaxHp * 0.03)
  if (debuff.type === 'poison') d.damagePerTurn = Math.floor(attackerAtk * 0.4 + defenderMaxHp * 0.04)
  if (debuff.type === 'bleed') d.damagePerTurn = Math.floor(attackerAtk * 0.6 + defenderMaxHp * 0.03)
  // 冻结/眩晕：锁定行动回合
  if (debuff.type === 'freeze' || debuff.type === 'stun') {
    ;(target as any).frozenTurns = Math.max((target as any).frozenTurns || 0, debuff.duration)
  }
  target.debuffs.push(d)
  return true
}

function tickDebuffs(unit: TeamPlayer | TeamMonster, logs: BattleLogEntry[], turn: number, unitName: string, isPlayer: boolean): number {
  // 返回本次 tick 受到的伤害（用于统计）
  let tickDamage = 0
  for (let i = unit.debuffs.length - 1; i >= 0; i--) {
    const d = unit.debuffs[i]
    if (d.damagePerTurn > 0) {
      unit.stats.hp -= d.damagePerTurn
      tickDamage += d.damagePerTurn
      const typeName = d.type === 'burn' ? '灼烧' : d.type === 'poison' ? '中毒' : '流血'
      logs.push({
        turn,
        text: `  ${unitName} 因[${typeName}]受到 ${d.damagePerTurn} 伤害`,
        type: 'normal',
        playerHp: isPlayer ? Math.max(0, unit.stats.hp) : 0,
        playerMaxHp: isPlayer ? unit.stats.maxHp : 0,
        monsterHp: !isPlayer ? Math.max(0, unit.stats.hp) : 0,
        monsterMaxHp: !isPlayer ? unit.stats.maxHp : 0,
      })
    }
    d.remaining--
    if (d.remaining <= 0) unit.debuffs.splice(i, 1)
  }
  return tickDamage
}

function tickBuffs(unit: TeamPlayer | TeamMonster) {
  for (let i = unit.buffs.length - 1; i >= 0; i--) {
    unit.buffs[i].remaining--
    if (unit.buffs[i].remaining <= 0) unit.buffs.splice(i, 1)
  }
}

function refreshUnitStatsFromBuffs(unit: TeamPlayer | TeamMonster) {
  // 根据 buffs 重算 atk/def
  let atkMul = 1.0
  let defMul = 1.0
  for (const b of unit.buffs) {
    if (b.type === 'atk_up' && b.value) atkMul += b.value
    if (b.type === 'def_up' && b.value) defMul += b.value
  }
  unit.stats.atk = Math.floor(unit.baseAtk * atkMul)
  unit.stats.def = Math.floor(unit.baseDef * defMul)
}

// ========== 主战斗函数 ==========
export function runTeamBattle(
  realm: SecretRealmDef,
  difficulty: 1 | 2 | 3,
  playerInputs: TeamPlayerInput[],
): TeamBattleResult {
  const cfg: SecretRealmDifficultyConfig = realm.difficulties[difficulty]
  const logs: BattleLogEntry[] = []

  // 构建队员运行时状态
  const players: TeamPlayer[] = playerInputs.map(p => {
    const baseStats = { ...p.stats, hp: p.stats.maxHp }
    if (p.equippedSkills?.passiveEffects) {
      const pe = p.equippedSkills.passiveEffects
      baseStats.atk = Math.floor(baseStats.atk * (1 + pe.atkPercent / 100))
      baseStats.def = Math.floor(baseStats.def * (1 + pe.defPercent / 100))
      baseStats.maxHp = Math.floor(baseStats.maxHp * (1 + pe.hpPercent / 100))
      baseStats.spd = Math.floor(baseStats.spd * (1 + (pe.spdPercent || 0) / 100))
      baseStats.hp = baseStats.maxHp
      baseStats.crit_rate += pe.critRate
      baseStats.crit_dmg += pe.critDmg
      baseStats.dodge = (baseStats.dodge || 0) + (pe.dodge || 0)
      baseStats.lifesteal = (baseStats.lifesteal || 0) + (pe.lifesteal || 0)
    }
    return {
      characterId: p.characterId,
      name: p.name,
      stats: baseStats,
      baseAtk: baseStats.atk,
      baseDef: baseStats.def,
      baseMaxHp: baseStats.maxHp,
      equippedSkills: p.equippedSkills,
      alive: true,
      divineCds: (p.equippedSkills?.divineSkills || []).map(() => 0),
      debuffs: [],
      buffs: [],
      frozenTurns: 0,
      damageDealt: 0,
      healingDone: 0,
      damageTaken: 0,
    }
  })

  // 应用队伍 Buff
  const teamBuffCtx = calcTeamBuffs(playerInputs)
  for (const p of players) teamBuffCtx.apply(p)
  for (const bd of teamBuffCtx.buffs) {
    logs.push({ turn: 0, text: `[队伍增益] ${bd}`, type: 'buff', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
  }

  logs.push({
    turn: 0,
    text: `【${realm.name} · ${cfg.name}】秘境开启！${players.length} 名道友进入历练。`,
    type: 'system', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0,
  })

  // 逐波战斗
  let wavesCleared = 0
  let totalTurns = 0
  let teamWiped = false
  const killedMonsters: KilledMonsterInfo[] = []

  for (let waveIdx = 0; waveIdx < cfg.waves.length; waveIdx++) {
    const wave = cfg.waves[waveIdx]
    const monsters = buildWaveMonsters(wave, cfg.powerMul)
    const monsterNames = monsters.map(m => m.stats.name).join('、')
    logs.push({
      turn: totalTurns,
      text: `[第 ${waveIdx + 1}/${cfg.waves.length} 波] 遭遇 ${monsters.length} 只 ${wave.isBoss ? 'Boss 级' : ''}敌人：${monsterNames}`,
      type: 'system', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0,
    })

    // 动态回合上限：基础 15 + 每只怪 5 回合，最少 20
    const maxTurns = Math.max(20, cfg.turnsPerWave + monsters.length * 5)
    let waveCleared = false

    for (let t = 1; t <= maxTurns; t++) {
      totalTurns++

      // 被动回血 & debuff tick
      for (const p of players) {
        if (!p.alive) continue
        const regen = p.equippedSkills?.passiveEffects?.regenPerTurn || 0
        if (regen > 0 && p.stats.hp < p.stats.maxHp) {
          const heal = Math.floor(p.stats.maxHp * regen)
          p.stats.hp = Math.min(p.stats.maxHp, p.stats.hp + heal)
        }
        // debuff tick
        const dmg = tickDebuffs(p, logs, totalTurns, p.name, true)
        if (dmg > 0) p.damageTaken += dmg
        if (p.stats.hp <= 0) {
          p.alive = false
          logs.push({ turn: totalTurns, text: `${p.name} 因持续伤害倒下！`, type: 'death', playerHp: 0, playerMaxHp: p.stats.maxHp, monsterHp: 0, monsterMaxHp: 0 })
        }
        // buff tick
        tickBuffs(p)
        refreshUnitStatsFromBuffs(p)
      }
      for (const m of monsters) {
        if (!m.alive) continue
        tickDebuffs(m, logs, totalTurns, m.stats.name, false)
        if (m.stats.hp <= 0) {
          m.alive = false
          killedMonsters.push({ name: m.stats.name, element: m.stats.element, isBoss: m.template.role === 'boss' })
          logs.push({ turn: totalTurns, text: `${m.stats.name} 因持续伤害倒下！`, type: 'kill', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
        }
        tickBuffs(m)
        refreshUnitStatsFromBuffs(m)
        tickMonsterCds(m.skillState)
      }

      // 判定是否提前结束
      if (monsters.every(m => !m.alive)) {
        waveCleared = true
        wavesCleared++
        break
      }
      if (players.every(p => !p.alive)) {
        teamWiped = true
        break
      }

      // 全部存活单位按 SPD 排序
      const units: Array<{ kind: 'player'; p: TeamPlayer } | { kind: 'monster'; m: TeamMonster }> = []
      for (const p of players) if (p.alive) units.push({ kind: 'player', p })
      for (const m of monsters) if (m.alive) units.push({ kind: 'monster', m })
      units.sort((a, b) => {
        const as = a.kind === 'player' ? a.p.stats.spd : a.m.stats.spd
        const bs = b.kind === 'player' ? b.p.stats.spd : b.m.stats.spd
        return bs - as
      })

      for (const u of units) {
        if (monsters.every(m => !m.alive)) break
        if (players.every(p => !p.alive)) break

        if (u.kind === 'player') {
          const p = u.p
          if (!p.alive) continue
          // 冻结/眩晕：跳过本回合
          if (p.frozenTurns > 0) {
            p.frozenTurns--
            logs.push({ turn: totalTurns, text: `${p.name} 被控制，无法行动`, type: 'normal', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: 0, monsterMaxHp: 0 })
            continue
          }
          playerTurn(p, players, monsters, totalTurns, logs, killedMonsters)
        } else {
          const m = u.m
          if (!m.alive) continue
          if (m.frozenTurns > 0) {
            m.frozenTurns--
            logs.push({ turn: totalTurns, text: `${m.stats.name} 被控制，无法行动`, type: 'normal', playerHp: 0, playerMaxHp: 0, monsterHp: m.stats.hp, monsterMaxHp: m.stats.maxHp })
            continue
          }
          monsterTurn(m, players, totalTurns, logs)
        }
      }

      if (monsters.every(m => !m.alive)) { waveCleared = true; wavesCleared++; break }
      if (players.every(p => !p.alive)) { teamWiped = true; break }
    }

    if (!waveCleared) {
      if (teamWiped) {
        logs.push({ turn: totalTurns, text: '全队阵亡，秘境失败。', type: 'death', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
      } else {
        logs.push({ turn: totalTurns, text: `第 ${waveIdx + 1} 波战斗超时，秘境失败。`, type: 'system', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
      }
      break
    }

    // 波次间全队回血 20%，清空 debuff
    if (waveIdx < cfg.waves.length - 1) {
      for (const p of players) {
        if (!p.alive) continue
        const heal = Math.floor(p.stats.maxHp * 0.20)
        p.stats.hp = Math.min(p.stats.maxHp, p.stats.hp + heal)
        p.debuffs = []
        p.buffs = []
        p.frozenTurns = 0
        refreshUnitStatsFromBuffs(p)
      }
      logs.push({ turn: totalTurns, text: `第 ${waveIdx + 1} 波清光！全队恢复 20% 气血。`, type: 'buff', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
    }
  }

  const won = wavesCleared === cfg.waves.length

  // 评分
  let rating: 'S' | 'A' | 'B' | null = null
  if (won) {
    const totalMaxTurns = cfg.waves.reduce((s, w) => s + Math.max(20, cfg.turnsPerWave + w.monsterCount * 5), 0)
    const allAlive = players.every(p => p.alive)
    if (allAlive && totalTurns < totalMaxTurns * 0.5) rating = 'S'
    else if (allAlive && totalTurns < totalMaxTurns * 0.7) rating = 'A'
    else rating = 'B'
    logs.push({ turn: totalTurns, text: `秘境通关！评分：${rating}`, type: 'system', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
  }

  // 贡献度
  const totalDmg = players.reduce((s, p) => s + p.damageDealt, 0) || 1
  const totalHeal = players.reduce((s, p) => s + p.healingDone, 0) || 1
  const totalTank = players.reduce((s, p) => s + p.damageTaken, 0) || 1
  const hasDmg = players.some(p => p.damageDealt > 0)
  const hasHeal = players.some(p => p.healingDone > 0)
  const hasTank = players.some(p => p.damageTaken > 0)
  let wDmg = 60, wHeal = 25, wTank = 15
  if (!hasHeal) { wDmg += 25 / 2; wTank += 25 / 2; wHeal = 0 }
  if (!hasTank) { wDmg += 15 / 2; wHeal += 15 / 2; wTank = 0 }
  if (!hasDmg) { wHeal += 60 / 2; wTank += 60 / 2; wDmg = 0 }

  const rawScores = players.map(p =>
    (wDmg * p.damageDealt) / totalDmg
    + (wHeal * p.healingDone) / totalHeal
    + (wTank * p.damageTaken) / totalTank
  )
  const totalScore = rawScores.reduce((a, b) => a + b, 0) || 1
  const contributions: TeamBattleReward[] = players.map((p, i) => ({
    characterId: p.characterId,
    name: p.name,
    damageDealt: p.damageDealt,
    healingDone: p.healingDone,
    damageTaken: p.damageTaken,
    contribution: rawScores[i] / totalScore,
  }))

  return { won, wavesCleared, totalTurns, rating, logs, contributions, teamBuffs: teamBuffCtx.buffs, killedMonsters }
}

// ========== 玩家回合 ==========
function playerTurn(p: TeamPlayer, allPlayers: TeamPlayer[], monsters: TeamMonster[], turn: number, logs: BattleLogEntry[], killedMonsters: KilledMonsterInfo[]) {
  const aliveMonsters = monsters.filter(m => m.alive)
  if (aliveMonsters.length === 0) return

  // 选技能
  let used: SkillRefInfo
  let isDivine = false
  const divines = p.equippedSkills?.divineSkills || []
  const cdReduction = p.equippedSkills?.passiveEffects?.skillCdReduction || 0
  let divineIdx = -1
  for (let i = 0; i < divines.length; i++) {
    if (p.divineCds[i] <= 0) { divineIdx = i; break }
  }
  if (divineIdx >= 0) {
    used = divines[divineIdx]
    p.divineCds[divineIdx] = Math.max(1, (used.cdTurns || 5) - cdReduction)
    isDivine = true
  } else {
    used = p.equippedSkills?.activeSkill || { name: '基础剑法', multiplier: 1.0, element: null }
  }
  for (let i = 0; i < p.divineCds.length; i++) if (p.divineCds[i] > 0) p.divineCds[i]--

  // 灵根共鸣 + 神识
  let mul = used.multiplier
  if (used.element && p.stats.spiritualRoot && used.element === p.stats.spiritualRoot) mul *= 1.2
  if (isDivine && p.stats.spirit && p.stats.spirit > 0) mul *= 1 + p.stats.spirit * 0.001

  // 治疗 / buff 技能
  if (mul === 0) {
    // 治疗：找 HP% 最低的活着队友（如果全队满血则跳过不浪费技能）
    if (used.healAtkRatio) {
      const alivePlayers = allPlayers.filter(ap => ap.alive)
      const target = alivePlayers.reduce((a, b) => (a.stats.hp / a.stats.maxHp < b.stats.hp / b.stats.maxHp ? a : b))
      if (target.stats.hp < target.stats.maxHp) {
        const heal = Math.floor(p.stats.atk * used.healAtkRatio)
        const before = target.stats.hp
        target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + heal)
        const realHeal = target.stats.hp - before
        p.healingDone += realHeal
        logs.push({
          turn,
          text: `${p.name} 施展【${used.name}】为 ${target.name} 恢复 ${realHeal} 气血`,
          type: 'buff',
          playerHp: target.stats.hp, playerMaxHp: target.stats.maxHp, monsterHp: 0, monsterMaxHp: 0,
        })
      } else {
        // 全队满血，愈伤术退回 CD 为 1 回合（下回合可再用），避免浪费
        const divines = p.equippedSkills?.divineSkills || []
        const idx = divines.findIndex(s => s.name === used.name)
        if (idx >= 0) p.divineCds[idx] = 1
      }
    }
    // 自 buff
    if (used.buff) {
      p.buffs.push({
        type: used.buff.type as any,
        remaining: used.buff.duration,
        value: used.buff.valuePercent ? used.buff.valuePercent / 100 : (used.buff.value || 0),
      })
      refreshUnitStatsFromBuffs(p)
      logs.push({ turn, text: `${p.name} 获得【${used.name}】增益`, type: 'buff', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: 0, monsterMaxHp: 0 })
    }
    // AOE debuff（如时光凝滞）
    if (used.debuff && used.isAoe) {
      for (const m of aliveMonsters) applyDebuffDps(m, used.debuff, p.stats.atk, m.stats.maxHp)
    }
    return
  }

  // 攻击技能
  let targets: TeamMonster[]
  if (used.isAoe) {
    targets = aliveMonsters
  } else if (used.targetCount && used.targetCount > 1) {
    const sorted = [...aliveMonsters].sort((a, b) => a.stats.hp - b.stats.hp)
    targets = sorted.slice(0, Math.min(used.targetCount, sorted.length))
  } else {
    targets = [aliveMonsters.reduce((a, b) => a.stats.hp < b.stats.hp ? a : b)]
  }

  const hits = used.hitCount || 1
  const perHitMul = mul / hits
  const labelParts: string[] = []
  if (isDivine) labelParts.push('神通')
  if (used.isAoe) labelParts.push('AOE')
  if (hits > 1) labelParts.push(`${hits}段`)
  const label = labelParts.length > 0 ? `（${labelParts.join('·')}）` : ''

  for (const t of targets) {
    if (t.stats.hp <= 0) continue
    let totalDmg = 0
    let critFlag = false
    for (let h = 0; h < hits; h++) {
      if (t.stats.hp <= 0) break
      const r = calculateDamage(p.stats, t.stats, perHitMul, used.element, used.ignoreDef)
      if (r.damage > 0) {
        t.stats.hp -= r.damage
        totalDmg += r.damage
        if (r.isCrit) critFlag = true
        if (p.stats.lifesteal && p.stats.lifesteal > 0) {
          const ls = Math.floor(r.damage * p.stats.lifesteal)
          p.stats.hp = Math.min(p.stats.maxHp, p.stats.hp + ls)
        }
      }
    }
    if (totalDmg > 0) {
      p.damageDealt += totalDmg
      logs.push({
        turn,
        text: `${p.name} ${critFlag ? '暴击！' : ''}【${used.name}】${label}对 ${t.stats.name} 造成 ${totalDmg} 伤害`,
        type: critFlag ? 'crit' : 'normal',
        playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp,
        monsterHp: Math.max(0, t.stats.hp), monsterMaxHp: t.stats.maxHp,
      })
    }
    // 附加 debuff
    if (used.debuff && t.alive && t.stats.hp > 0) {
      applyDebuffDps(t, used.debuff, p.stats.atk, t.stats.maxHp)
    }
    if (t.stats.hp <= 0) {
      t.alive = false
      killedMonsters.push({ name: t.stats.name, element: t.stats.element, isBoss: t.template.role === 'boss' })
      logs.push({ turn, text: `${p.name} 击杀了 ${t.stats.name}！`, type: 'kill', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: 0, monsterMaxHp: 0 })
    }
  }
}

// ========== 怪物回合 ==========
function monsterTurn(m: TeamMonster, players: TeamPlayer[], turn: number, logs: BattleLogEntry[]) {
  const alivePlayers = players.filter(p => p.alive)
  if (alivePlayers.length === 0) return

  // Boss 狂暴检测
  if (m.template.role === 'boss' && !m.skillState.bossEnrageTriggered && m.stats.hp < m.stats.maxHp * 0.30) {
    m.skillState.bossEnrageTriggered = true
    m.baseAtk = Math.floor(m.baseAtk * 1.30)
    logs.push({
      turn,
      text: `${m.stats.name} 进入狂暴状态！攻击 +30%`,
      type: 'crit',
      playerHp: 0, playerMaxHp: 0, monsterHp: m.stats.hp, monsterMaxHp: m.stats.maxHp,
    })
    refreshUnitStatsFromBuffs(m)
  }

  // 选技能
  const skill: MonsterSkillDef | null = monsterChooseSkill(
    m.skillState, m.stats.hp, m.stats.maxHp, m.template.role === 'boss'
  )

  // 治疗/buff 类技能（multiplier = 0）
  if (skill && skill.multiplier === 0) {
    if (skill.healPercent) {
      const heal = Math.floor(m.stats.maxHp * skill.healPercent)
      m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + heal)
      logs.push({
        turn,
        text: `${m.stats.name} 施展【${skill.name}】，回复 ${heal} 气血`,
        type: 'buff', playerHp: 0, playerMaxHp: 0, monsterHp: m.stats.hp, monsterMaxHp: m.stats.maxHp,
      })
    }
    if (skill.buff) {
      // 合并同类 buff
      const existing = m.buffs.find(b => b.type === skill.buff!.type)
      if (existing) {
        existing.remaining = skill.buff.duration
        existing.value = skill.buff.value
      } else {
        m.buffs.push({ type: skill.buff.type as any, remaining: skill.buff.duration, value: skill.buff.value })
      }
      refreshUnitStatsFromBuffs(m)
      logs.push({
        turn,
        text: `${m.stats.name} 施展【${skill.name}】获得增益`,
        type: 'buff', playerHp: 0, playerMaxHp: 0, monsterHp: m.stats.hp, monsterMaxHp: m.stats.maxHp,
      })
    }
    return
  }

  // 仇恨：按"伤害 + 治疗"加权的软随机（避免集火秒人 + 照顾奶妈拉仇恨）
  // 权重：damageDealt + healingDone × 0.5 + 基础 1（保证 0 伤害玩家也有被点几率）
  // 额外：HP% 低于 30% 的玩家仇恨减半（假死状态避免怪物补刀）
  let target: TeamPlayer
  const weights = alivePlayers.map(p => {
    const base = p.damageDealt + p.healingDone * 0.5 + 100
    const hpRatio = p.stats.hp / p.stats.maxHp
    return hpRatio < 0.3 ? base * 0.5 : base
  })
  const total = weights.reduce((s, w) => s + w, 0)
  let r2 = Math.random() * total
  target = alivePlayers[0]
  for (let i = 0; i < alivePlayers.length; i++) {
    r2 -= weights[i]
    if (r2 <= 0) { target = alivePlayers[i]; break }
  }

  const skillMul = skill ? skill.multiplier : 1.0
  const skillElem = skill ? skill.element : null
  const skillName = skill ? skill.name : '普通攻击'
  const hits = skill?.hitCount || 1
  const perHitMul = skillMul / hits
  const hitsLabel = hits > 1 ? `（${hits}段）` : ''

  if (skill) {
    logs.push({
      turn,
      text: `${m.stats.name} 施展【${skillName}】${hitsLabel} 攻击 ${target.name}`,
      type: 'normal',
      playerHp: target.stats.hp, playerMaxHp: target.stats.maxHp,
      monsterHp: m.stats.hp, monsterMaxHp: m.stats.maxHp,
    })
  }

  for (let h = 0; h < hits; h++) {
    if (!target.alive) break
    const r = calculateDamage(m.stats, target.stats, perHitMul, skillElem)
    if (r.damage === 0) {
      logs.push({
        turn,
        text: `${m.stats.name} 的攻击被 ${target.name} 闪避了`,
        type: 'normal',
        playerHp: target.stats.hp, playerMaxHp: target.stats.maxHp,
        monsterHp: m.stats.hp, monsterMaxHp: m.stats.maxHp,
      })
      continue
    }
    let dmg = r.damage
    const dr = target.equippedSkills?.passiveEffects?.damageReductionFlat || 0
    if (dr > 0) dmg = Math.floor(dmg * (1 - dr))
    target.stats.hp -= dmg
    target.damageTaken += dmg
    const hitText = hits > 1 ? `第${h + 1}段` : ''
    // 有技能时压缩成简短伤害行，否则完整打印"XX 普攻 YY 造成 Z 伤害"
    const lineText = skill
      ? `  ${hitText} ${r.isCrit ? '暴击！' : ''}造成 ${dmg} 伤害`
      : `${m.stats.name} ${r.isCrit ? '暴击！' : ''}普攻 ${target.name}，造成 ${dmg} 伤害`
    logs.push({
      turn,
      text: lineText,
      type: r.isCrit ? 'crit' : 'normal',
      playerHp: Math.max(0, target.stats.hp), playerMaxHp: target.stats.maxHp,
      monsterHp: m.stats.hp, monsterMaxHp: m.stats.maxHp,
    })
    if (target.stats.hp <= 0) {
      target.alive = false
      logs.push({
        turn,
        text: `${target.name} 倒下了！`,
        type: 'death',
        playerHp: 0, playerMaxHp: target.stats.maxHp, monsterHp: 0, monsterMaxHp: 0,
      })
      break
    }
  }

  // 附加 debuff
  if (skill?.debuff && target.alive) {
    applyDebuffDps(target, skill.debuff, m.stats.atk, target.stats.maxHp)
  }
}
