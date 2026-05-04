// 秘境组队战斗引擎 —— 多人 vs 多怪
// 复用 battleEngine.ts 的伤害计算、怪物技能、debuff 系统

import {
  generateMonsterStats,
  calculateDamage,
  buildMonsterSkillPool,
  initMonsterSkillState,
  monsterChooseSkill,
  tickMonsterCds,
  makeHealerTemplate,
  buildSetEffects,
  buildActiveSetTiers,
  type BattlerStats,
  type BattleLogEntry,
  type MonsterTemplate,
  type EquippedSkillInfo,
  type SkillRefInfo,
  type MonsterSkillDef,
  type MonsterSkillState,
  type SetEffectsState,
} from './battleEngine'
import type { SecretRealmDef, SecretRealmDifficultyConfig, SecretRealmWave } from './secretRealmData'
import { scaleMonsterTemplate } from './secretRealmData'
import type { DebuffType, BuffType } from './skillData'
import { DOT_FORMULA, PLAYER_CAPS } from '~/shared/balance'

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
  // v1 套装运行时状态
  setEffects: SetEffectsState
  spearStacks: number
  guaranteedCritNext: boolean
  _multicastThisTurn: number
  _setInstantTriggered: Record<string, boolean>
  // 刀狂套叠加状态
  _bladeAddedRate: number
  _bladeAddedDmg: number
  _bladeStackCount: number
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
  _setInstantTriggered: Record<string, boolean>
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
function buildWaveMonsters(
  wave: SecretRealmWave,
  powerMul: number,
  realmDropTier: number,
  realmElement: string | null,
): TeamMonster[] {
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
      _setInstantTriggered: {},
    })
  }

  // T5+ 秘境（dropTier ≥ 5）非 boss wave 自动追加 1 只 healer
  // boss wave 不加（boss 是孤狼挑战，多个 boss + healer 会卡死战斗）
  if (realmDropTier >= 5 && !wave.isBoss) {
    const avgPower = result.length > 0
      ? Math.floor(result.reduce((s, m) => s + m.template.power, 0) / result.length)
      : Math.floor((wave.monsterPool[0]?.power || 100) * powerMul)
    // healer tier 跟随秘境 dropTier，让奶量与 wave 强度匹配
    const healerTpl = makeHealerTemplate(realmDropTier, realmElement, avgPower)
    const stats = generateMonsterStats(healerTpl)
    result.push({
      stats,
      template: healerTpl,
      baseAtk: stats.atk,
      baseDef: stats.def,
      alive: true,
      skillState: initMonsterSkillState(healerTpl),
      debuffs: [],
      buffs: [],
      frozenTurns: 0,
      _setInstantTriggered: {},
    })
  }

  return result
}

// ========== Debuff / Buff 辅助 ==========
function applyDebuffDps(
  target: TeamPlayer | TeamMonster,
  debuff: { type: DebuffType; chance: number; duration: number; value?: number },
  attackerAtk: number,
  defenderMaxHp: number,
  opts?: { inflictor?: TeamPlayer; turn?: number; logs?: BattleLogEntry[]; targetName?: string },
): boolean {
  // ❖ 极寒套：施加方装备时，冰冻/眩晕命中率 +X
  let effChance = debuff.chance
  const inflictor = opts?.inflictor
  if (inflictor && (debuff.type === 'freeze' || debuff.type === 'stun' || debuff.type === 'root') &&
      inflictor.setEffects?.freezeChanceBonus > 0) {
    effChance = Math.min(1, effChance + inflictor.setEffects.freezeChanceBonus)
  }
  // ❖ 回归基本功 7 件套：施加方主修攻击触发 debuff 概率 ×1.5（该套禁神通，所以玩家施加必然来自主修）
  if (inflictor && inflictor.setEffects?.basicBackDebuffMul > 1) {
    effChance = Math.min(1, effChance * inflictor.setEffects.basicBackDebuffMul)
  }
  if (Math.random() >= effChance) return false
  const d: ActiveDebuff = {
    type: debuff.type,
    remaining: debuff.duration,
    damagePerTurn: 0,
    value: debuff.value,
  }
  // 持续伤害 debuff
  // v3.7: 统一走 DOT_FORMULA，与 battleEngine / multiBattleEngine 保持一致
  if (debuff.type === 'burn') d.damagePerTurn = Math.max(1, Math.floor(attackerAtk * DOT_FORMULA.burnPerTurnAtkRatio))
  if (debuff.type === 'poison') d.damagePerTurn = Math.max(1, Math.floor(defenderMaxHp * DOT_FORMULA.poisonPerTurnHpRatio))
  if (debuff.type === 'bleed') d.damagePerTurn = Math.max(1, Math.floor(attackerAtk * DOT_FORMULA.bleedPerTurnAtkRatio))
  // 冻结/眩晕：锁定行动回合
  if (debuff.type === 'freeze' || debuff.type === 'stun') {
    ;(target as any).frozenTurns = Math.max((target as any).frozenTurns || 0, debuff.duration)
  }
  target.debuffs.push(d)

  // ❖ 火神/万毒/血魔套：施加 burn/poison/bleed 时立即多结算 (instantMul - 1) 次
  // 每场每目标每种 debuff 每回合限触发 1 次（避免多段技能滚雪球）
  const isDotType = debuff.type === 'burn' || debuff.type === 'poison' || debuff.type === 'bleed'
  if (inflictor && isDotType && d.damagePerTurn > 0 && opts?.turn !== undefined) {
    const se = inflictor.setEffects
    let instantMul = 1
    let setName = ''
    if (debuff.type === 'burn'   && se.burnInstantMul   > 1) { instantMul = se.burnInstantMul;   setName = '火神套' }
    if (debuff.type === 'poison' && se.poisonInstantMul > 1) { instantMul = se.poisonInstantMul; setName = '万毒套' }
    if (debuff.type === 'bleed'  && se.bleedInstantMul  > 1) { instantMul = se.bleedInstantMul;  setName = '血魔套' }
    if (instantMul > 1) {
      const triggered = (target as any)._setInstantTriggered as Record<string, boolean>
      const key = `${debuff.type}_${opts.turn}`
      if (!triggered[key]) {
        triggered[key] = true
        const extraTicks = instantMul - 1
        const totalDmg = d.damagePerTurn * extraTicks
        target.stats.hp = Math.max(0, target.stats.hp - totalDmg)
        if (opts.logs) {
          const tName = opts.targetName || target.stats.name
          const typeName = debuff.type === 'burn' ? '灼烧' : debuff.type === 'poison' ? '中毒' : '流血'
          opts.logs.push({
            turn: opts.turn,
            text: `  ❖【${setName}】${typeName}立即结算 ×${extraTicks}，对${tName}造成 ${totalDmg} 伤害`,
            type: 'buff',
            playerHp: 0, playerMaxHp: 0,
            monsterHp: Math.max(0, target.stats.hp), monsterMaxHp: target.stats.maxHp,
          })
        }
      }
    }
  }
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

function tickBuffs(unit: TeamPlayer | TeamMonster, logs?: BattleLogEntry[], turn?: number, isPlayer?: boolean) {
  for (let i = unit.buffs.length - 1; i >= 0; i--) {
    const b = unit.buffs[i]
    // regen: 每回合按 value(百分比) 回复 maxHp
    if (b.type === 'regen' && b.value && unit.stats.hp > 0 && unit.stats.hp < unit.stats.maxHp) {
      const heal = Math.max(1, Math.floor(unit.stats.maxHp * b.value))
      unit.stats.hp = Math.min(unit.stats.maxHp, unit.stats.hp + heal)
      if (logs && turn !== undefined) {
        const name = isPlayer ? (unit as TeamPlayer).name : (unit as TeamMonster).stats.name
        logs.push({
          turn,
          text: `${name} 持续回复了 ${heal} 气血`,
          type: 'buff',
          playerHp: isPlayer ? unit.stats.hp : 0,
          playerMaxHp: isPlayer ? unit.stats.maxHp : 0,
          monsterHp: !isPlayer ? unit.stats.hp : 0,
          monsterMaxHp: !isPlayer ? unit.stats.maxHp : 0,
        })
      }
    }
    b.remaining--
    if (b.remaining <= 0) unit.buffs.splice(i, 1)
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
      // v3.7 加法池：team/start.post.ts buildPlayerBattleStats 已挂 _flat/_pctSum，把功法 % 加进同池后一次乘
      const sx: any = p.stats as any
      if (sx._flatAtk !== undefined) {
        baseStats.atk   = Math.floor(sx._flatAtk * (1 + (sx._pctSumAtk || 0) + pe.atkPercent / 100))
        baseStats.def   = Math.floor(sx._flatDef * (1 + (sx._pctSumDef || 0) + pe.defPercent / 100))
        baseStats.maxHp = Math.floor(sx._flatHp  * (1 + (sx._pctSumHp  || 0) + pe.hpPercent / 100))
        baseStats.spd   = Math.floor(sx._flatSpd * (1 + (sx._pctSumSpd || 0) + (pe.spdPercent || 0) / 100))
      } else {
        // 旧路径回退
        baseStats.atk = Math.floor(baseStats.atk * (1 + pe.atkPercent / 100))
        baseStats.def = Math.floor(baseStats.def * (1 + pe.defPercent / 100))
        baseStats.maxHp = Math.floor(baseStats.maxHp * (1 + pe.hpPercent / 100))
        baseStats.spd = Math.floor(baseStats.spd * (1 + (pe.spdPercent || 0) / 100))
      }
      baseStats.hp = baseStats.maxHp
      baseStats.crit_rate += pe.critRate
      baseStats.crit_dmg += pe.critDmg
      baseStats.dodge = (baseStats.dodge || 0) + (pe.dodge || 0)
      baseStats.lifesteal = (baseStats.lifesteal || 0) + (pe.lifesteal || 0)
    }
    // v1 套装：根据 stats 上的 equipSetCounts/weaponType 解析运行时效果
    const sx: any = p.stats as any
    const setEffects = buildSetEffects(sx.equipSetCounts, sx.weaponType || null)
    // 十三枪静态加成（破甲 / 吸血）应用到 baseStats 上
    baseStats.armorPen = (baseStats.armorPen || 0) + setEffects.spearArmorPen
    baseStats.lifesteal = Math.min(0.25, (baseStats.lifesteal || 0) + setEffects.spearLifesteal)
    // 剑仙套静态加成（持「剑」激活）
    if (setEffects.swordActive) {
      baseStats.atk = Math.floor(baseStats.atk * (1 + setEffects.swordAtkPct))
      baseStats.def = Math.floor(baseStats.def * (1 + setEffects.swordDefPct))
      baseStats.crit_rate = Math.min(PLAYER_CAPS.critRate, baseStats.crit_rate + setEffects.swordCritRateFlat)
    }
    // 刀狂套静态加成（持「刀」激活）
    if (setEffects.bladeActive) {
      baseStats.crit_rate = Math.min(PLAYER_CAPS.critRate, baseStats.crit_rate + setEffects.bladeBaseCritRate)
      baseStats.crit_dmg = Math.min(PLAYER_CAPS.critDmg, baseStats.crit_dmg + setEffects.bladeBaseCritDmg)
    }
    // 天机套静态加成（持「扇」激活）
    if (setEffects.fanActive && setEffects.fanSpiritPct > 0) {
      baseStats.spirit = Math.floor((baseStats.spirit || 0) * (1 + setEffects.fanSpiritPct))
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
      setEffects,
      spearStacks: 0,
      guaranteedCritNext: false,
      _multicastThisTurn: 0,
      _setInstantTriggered: {},
      _bladeAddedRate: 0,
      _bladeAddedDmg: 0,
      _bladeStackCount: 0,
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

  // v1 套装：开局展示每位队员激活的套装 + 应用刷新套 7 件 CD-1
  for (const p of players) {
    const sx: any = (p.stats as any)
    const setCounts = sx.equipSetCounts || {}
    const activeSets = buildActiveSetTiers(setCounts)
    for (const s of activeSets) {
      logs.push({ turn: 0, text: `❖ ${p.name} 套装激活：${s.name} (${s.count}/7 · ${s.tier} 件套)`, type: 'buff', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
    }
    const reduce = p.setEffects.refreshOpenCdReduce
    if (reduce > 0 && p.divineCds.length > 0) {
      for (let i = 0; i < p.divineCds.length; i++) p.divineCds[i] = Math.max(0, p.divineCds[i] - reduce)
      logs.push({ turn: 0, text: `  ❖【刷新套】${p.name} 开局所有神通 CD -${reduce}`, type: 'buff', playerHp: 0, playerMaxHp: 0, monsterHp: 0, monsterMaxHp: 0 })
    }
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
    const monsters = buildWaveMonsters(wave, cfg.powerMul, realm.dropTier, realm.element)
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
        tickBuffs(p, logs, totalTurns, true)
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
        tickBuffs(m, logs, totalTurns, false)
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
          monsterTurn(m, players, totalTurns, logs, monsters)
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

  // ❖ 套装：本回合多重施法触发计数清零
  p._multicastThisTurn = 0

  // 选技能（回归基本功套禁神通）
  let used: SkillRefInfo
  let isDivine = false
  const divines = p.setEffects.basicBackBanDivine ? [] : (p.equippedSkills?.divineSkills || [])
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
      for (const m of aliveMonsters) applyDebuffDps(m, used.debuff, p.stats.atk, m.stats.maxHp, { inflictor: p, turn, logs })
    }
    return
  }

  // 攻击技能
  // ❖ 回归基本功套：主修攻击强制 AOE，倍率 ×basicBackMul
  const isMainSkill = !isDivine
  const basicBackMain = isMainSkill && p.setEffects.basicBackActive && p.setEffects.basicBackMul > 0
  if (basicBackMain) {
    mul = mul * p.setEffects.basicBackMul
  }
  let targets: TeamMonster[]
  if (used.isAoe || basicBackMain) {
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
  if (used.isAoe || basicBackMain) labelParts.push('AOE')
  if (hits > 1) labelParts.push(`${hits}段`)
  const label = labelParts.length > 0 ? `（${labelParts.join('·')}）` : ''

  // 套装伤害结算 helper（接 dmgVsFrozen / spearStacks 加成 / 血魔吸血 / 十三枪加层）
  const se = p.setEffects
  const applySetDamage = (t: TeamMonster, rawDmg: number, isCrit: boolean, opts?: { chained?: boolean }): { final: number; lifestealHeal: number } => {
    let dmg = rawDmg
    if (se.dmgVsFrozen > 0 && t.frozenTurns > 0) dmg = Math.floor(dmg * (1 + se.dmgVsFrozen))
    if (se.spearActive && p.spearStacks > 0) {
      dmg = Math.floor(dmg * (1 + p.spearStacks * se.spearStackDmgPerLevel))
    }
    t.stats.hp -= dmg

    const targetBleeding = t.debuffs.some(d => d.type === 'bleed')
    let lsRate = p.stats.lifesteal || 0
    if (targetBleeding && se.bleedLifestealIfBleeding > 0) {
      lsRate = Math.min(0.25, lsRate + se.bleedLifestealIfBleeding)
    }
    let lifestealHeal = 0
    if (lsRate > 0 && p.stats.hp > 0 && p.stats.hp < p.stats.maxHp) {
      const heal = Math.floor(dmg * lsRate)
      if (heal > 0) {
        lifestealHeal = Math.min(heal, p.stats.maxHp - p.stats.hp)
        p.stats.hp += lifestealHeal
      }
    }

    if (se.spearActive && !opts?.chained && p.spearStacks < se.spearMaxStacks) {
      const before = p.spearStacks
      const next = Math.min(se.spearMaxStacks, before + se.spearStackPerHit)
      p.spearStacks = next
      if (next === se.spearMaxStacks && se.spearGuaranteedCritOnMax && before < se.spearMaxStacks) {
        p.guaranteedCritNext = true
        logs.push({ turn, text: `  ❖【十三枪】${p.name} 满 ${se.spearMaxStacks} 层！下一击必暴击`, type: 'buff', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: Math.max(0, t.stats.hp), monsterMaxHp: t.stats.maxHp })
      }
    }
    return { final: dmg, lifestealHeal }
  }

  // ❖ 刀狂套：每次主攻命中后判定（暴击清零叠加；非暴击叠加 +1 层，cap 截断）
  const triggerBladeStack = (isCrit: boolean) => {
    if (!se.bladeActive) return
    if (isCrit) {
      if (p._bladeStackCount > 0) {
        p.stats.crit_rate = Math.max(0, p.stats.crit_rate - p._bladeAddedRate)
        p.stats.crit_dmg = Math.max(1, p.stats.crit_dmg - p._bladeAddedDmg)
        const cnt = p._bladeStackCount
        p._bladeAddedRate = 0; p._bladeAddedDmg = 0; p._bladeStackCount = 0
        logs.push({ turn, text: `  ❖【刀狂套】${p.name} 暴击触发，叠加层 ×${cnt} 清零`, type: 'buff', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: 0, monsterMaxHp: 0 })
      }
    } else {
      const newRate = Math.min(PLAYER_CAPS.critRate, p.stats.crit_rate + se.bladeStackCritRate)
      const newDmg = Math.min(PLAYER_CAPS.critDmg, p.stats.crit_dmg + se.bladeStackCritDmg)
      const addedRate = newRate - p.stats.crit_rate
      const addedDmg = newDmg - p.stats.crit_dmg
      if (addedRate > 0 || addedDmg > 0) {
        p.stats.crit_rate = newRate
        p.stats.crit_dmg = newDmg
        p._bladeAddedRate += addedRate
        p._bladeAddedDmg += addedDmg
        p._bladeStackCount++
      }
    }
  }
  // ❖ 剑仙套：每次主攻动作触发 N 次剑气（chained）
  const triggerSwordQi = (mainTarget: TeamMonster) => {
    if (!se.swordActive || se.swordQiHits <= 0) return
    for (let i = 0; i < se.swordQiHits; i++) {
      let t = mainTarget.alive && mainTarget.stats.hp > 0 ? mainTarget : aliveMonsters.find(m => m.alive && m.stats.hp > 0)
      if (!t) return
      const ignoreDodgeQi = !!(se.frozenCannotDodge && t.frozenTurns > 0)
      const dr = calculateDamage(p.stats, t.stats, se.swordQiMul, used.element, used.ignoreDef, ignoreDodgeQi)
      if (dr.damage > 0) {
        const { final } = applySetDamage(t, dr.damage, dr.isCrit, { chained: true })
        const critText = dr.isCrit ? '暴击!' : ''
        logs.push({ turn, text: `  ❖【剑仙·剑气 ${i + 1}/${se.swordQiHits}】${critText}对 ${t.stats.name} 造成 ${final} 伤害 (${(se.swordQiMul * 100).toFixed(0)}%)`, type: 'buff', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: Math.max(0, t.stats.hp), monsterMaxHp: t.stats.maxHp })
        if (t.stats.hp <= 0) {
          t.alive = false
          killedMonsters.push({ name: t.stats.name, element: t.stats.element, isBoss: t.template.role === 'boss' })
        }
      }
    }
  }

  for (const t of targets) {
    if (t.stats.hp <= 0) continue
    let totalDmg = 0
    let totalHeal = 0
    let critFlag = false
    let dodgedHits = 0
    for (let h = 0; h < hits; h++) {
      if (t.stats.hp <= 0) break
      const ignoreDodgeFrost = !!(se.frozenCannotDodge && t.frozenTurns > 0)
      const r = calculateDamage(p.stats, t.stats, perHitMul, used.element, used.ignoreDef, ignoreDodgeFrost)
      // ❖ 十三枪满层标记：本击必暴击（消耗后清零）
      if (p.guaranteedCritNext) {
        r.isCrit = true
        p.guaranteedCritNext = false
      }
      if (r.damage > 0) {
        const { final, lifestealHeal } = applySetDamage(t, r.damage, r.isCrit)
        totalDmg += final
        if (r.isCrit) critFlag = true
        totalHeal += lifestealHeal
        triggerBladeStack(r.isCrit)
      } else {
        dodgedHits++
      }
    }
    if (totalDmg > 0) {
      p.damageDealt += totalDmg
      const healSuffix = totalHeal > 0 ? `（吸血 +${totalHeal}）` : ''
      logs.push({
        turn,
        text: `${p.name} ${critFlag ? '暴击！' : ''}【${used.name}】${label}对 ${t.stats.name} 造成 ${totalDmg} 伤害${healSuffix}`,
        type: critFlag ? 'crit' : 'normal',
        playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp,
        monsterHp: Math.max(0, t.stats.hp), monsterMaxHp: t.stats.maxHp,
      })
    }
    if (dodgedHits > 0) {
      const dodgeText = hits > 1
        ? `${p.name} 的【${used.name}】被 ${t.stats.name} 闪避了 ${dodgedHits} 次`
        : `${p.name} 的【${used.name}】被 ${t.stats.name} 闪避了`
      logs.push({
        turn,
        text: dodgeText,
        type: 'normal',
        playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp,
        monsterHp: Math.max(0, t.stats.hp), monsterMaxHp: t.stats.maxHp,
      })
    }
    // 附加 debuff
    if (used.debuff && t.alive && t.stats.hp > 0) {
      applyDebuffDps(t, used.debuff, p.stats.atk, t.stats.maxHp, { inflictor: p, turn, logs })
    }
    if (t.stats.hp <= 0) {
      t.alive = false
      killedMonsters.push({ name: t.stats.name, element: t.stats.element, isBoss: t.template.role === 'boss' })
      logs.push({ turn, text: `${p.name} 击杀了 ${t.stats.name}！`, type: 'kill', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: 0, monsterMaxHp: 0 })
    }
  }

  // ❖ 套装：刷新套 / 多重施法套（攻击型神通/主修释放后）
  // 刷新套：释放主修或神通后概率重置 CD 最短的神通
  if (se.refreshChance > 0 && Math.random() < se.refreshChance) {
    let minIdx = -1, minCd = Infinity
    for (let i = 0; i < p.divineCds.length; i++) {
      if (p.divineCds[i] > 0 && p.divineCds[i] < minCd) { minCd = p.divineCds[i]; minIdx = i }
    }
    if (minIdx >= 0) {
      p.divineCds[minIdx] = 0
      const sk = (p.equippedSkills?.divineSkills || [])[minIdx]
      logs.push({ turn, text: `  ❖【刷新套】${p.name} 神通【${sk?.name || '?'}】CD 重置`, type: 'buff', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: 0, monsterMaxHp: 0 })
    }
  }
  // 多重施法套：单体神通追加一个新目标（不是再次释放神通，所以不结算 buff/debuff）
  const isSingleTarget = isDivine && !used.isAoe && (!used.targetCount || used.targetCount <= 1)
  if (isSingleTarget && se.multicastChance > 0 && se.multicastMaxPerTurn > 0 && mul > 0) {
    if (p._multicastThisTurn < se.multicastMaxPerTurn && Math.random() < se.multicastChance) {
      const extraTarget = monsters
        .filter(m => m.alive && m.stats.hp > 0 && !targets.includes(m))
        .sort((a, b) => a.stats.hp - b.stats.hp)[0]
      if (extraTarget) {
        p._multicastThisTurn++
        const extraMul = mul * se.multicastMul
        const r = calculateDamage(p.stats, extraTarget.stats, extraMul, used.element, used.ignoreDef)
        if (r.damage > 0) {
          const { final } = applySetDamage(extraTarget, r.damage, r.isCrit, { chained: true })
          p.damageDealt += final
          const critText = r.isCrit ? '暴击!' : ''
          logs.push({ turn, text: `  ❖【多重施法】${critText}【${used.name}】波及 ${extraTarget.stats.name} 造成 ${final} 伤害 (${(se.multicastMul * 100).toFixed(0)}%)`, type: 'buff', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: Math.max(0, extraTarget.stats.hp), monsterMaxHp: extraTarget.stats.maxHp })
          if (extraTarget.stats.hp <= 0) {
            extraTarget.alive = false
            killedMonsters.push({ name: extraTarget.stats.name, element: extraTarget.stats.element, isBoss: extraTarget.template.role === 'boss' })
            logs.push({ turn, text: `${p.name} 击杀了 ${extraTarget.stats.name}！`, type: 'kill', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: 0, monsterMaxHp: 0 })
          }
        }
      }
    }
  }
  // ❖ 剑仙套：每次主攻动作触发 N 次剑气（按主目标）
  triggerSwordQi(targets[0])
  // ❖ 天机套：神通释放后追加 N 次额外段（chained）
  if (isDivine && se.fanActive && se.fanExtraCasts > 0 && se.fanExtraMul > 0 && mul > 0) {
    for (let i = 0; i < se.fanExtraCasts; i++) {
      let t = targets[0]?.alive && targets[0].stats.hp > 0
        ? targets[0]
        : monsters.find(m => m.alive && m.stats.hp > 0)
      if (!t) break
      const ignoreDodgeFrost = !!(se.frozenCannotDodge && t.frozenTurns > 0)
      const fanMul = mul * se.fanExtraMul
      const r = calculateDamage(p.stats, t.stats, fanMul, used.element, used.ignoreDef, ignoreDodgeFrost)
      if (r.damage > 0) {
        const { final } = applySetDamage(t, r.damage, r.isCrit, { chained: true })
        p.damageDealt += final
        const critText = r.isCrit ? '暴击!' : ''
        logs.push({ turn, text: `  ❖【天机·额外段 ${i + 1}/${se.fanExtraCasts}】${critText}【${used.name}】对 ${t.stats.name} 造成 ${final} 伤害 (${(se.fanExtraMul * 100).toFixed(0)}%)`, type: 'buff', playerHp: p.stats.hp, playerMaxHp: p.stats.maxHp, monsterHp: Math.max(0, t.stats.hp), monsterMaxHp: t.stats.maxHp })
        if (t.stats.hp <= 0) {
          t.alive = false
          killedMonsters.push({ name: t.stats.name, element: t.stats.element, isBoss: t.template.role === 'boss' })
        }
      }
    }
  }
}

// ========== 怪物回合 ==========
function monsterTurn(m: TeamMonster, players: TeamPlayer[], turn: number, logs: BattleLogEntry[], allMonsters?: TeamMonster[]) {
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
  const isHealer = m.template.role === 'healer'
  const aliveAllies = (allMonsters || [m]).filter(mm => mm.alive)
  const teamMinHpRatio = isHealer
    ? aliveAllies.reduce((min, mm) => Math.min(min, mm.stats.hp / mm.stats.maxHp), 1)
    : undefined
  const skill: MonsterSkillDef | null = monsterChooseSkill(
    m.skillState, m.stats.hp, m.stats.maxHp, m.template.role === 'boss',
    { activeBuffTypes: m.buffs.map(b => b.type), teamMinHpRatio, isHealer },
  )

  // 治疗/buff 类技能（multiplier = 0）
  if (skill && skill.multiplier === 0) {
    const targets = (isHealer && skill.isAoe) ? aliveAllies : [m]

    if (skill.healPercent) {
      const needHeal = targets.filter(t => t.stats.hp < t.stats.maxHp)
      if (needHeal.length === 0 && isHealer && skill.isAoe) {
        // 全队满血，CD 退回 1 回合不浪费
        const idx = m.skillState.skills.findIndex(s => s === skill)
        if (idx >= 0) m.skillState.cds[idx] = 1
      } else {
        const healTargets = needHeal.length > 0 ? needHeal : targets
        let totalHealed = 0
        for (const t of healTargets) {
          const before = t.stats.hp
          const heal = Math.floor(t.stats.maxHp * skill.healPercent)
          t.stats.hp = Math.min(t.stats.maxHp, t.stats.hp + heal)
          totalHealed += t.stats.hp - before
        }
        const scope = (isHealer && skill.isAoe)
          ? `全队回复 ${totalHealed} 气血（${healTargets.length} 目标）`
          : `回复 ${totalHealed} 气血`
        logs.push({
          turn,
          text: `${m.stats.name} 施展【${skill.name}】${scope}`,
          type: 'buff', playerHp: 0, playerMaxHp: 0, monsterHp: m.stats.hp, monsterMaxHp: m.stats.maxHp,
        })
      }
    }
    if (skill.buff) {
      for (const t of targets) {
        const existing = t.buffs.find(b => b.type === skill.buff!.type)
        if (existing) {
          existing.remaining = skill.buff.duration
          existing.value = skill.buff.value
        } else {
          t.buffs.push({ type: skill.buff.type as any, remaining: skill.buff.duration, value: skill.buff.value })
        }
        refreshUnitStatsFromBuffs(t)
      }
      const scope = (isHealer && skill.isAoe) ? '全队' : ''
      logs.push({
        turn,
        text: `${m.stats.name} 施展【${skill.name}】${scope}获得增益`,
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
