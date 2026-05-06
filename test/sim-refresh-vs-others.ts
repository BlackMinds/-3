/**
 * 套装平衡对照：刷新套(+心剑回响) vs 剑仙套 vs 多重施法套
 *
 * 目的：验证"刷新套7+心剑回响"是否过强
 *
 * 三个 build 共用同一基础属性（atk/def/hp/spd/crit），仅套装+附灵+神通配置不同：
 *  A. 刷新套7 + 心剑回响 + 主修锋锐 + 单红神通（6CD 5.0 倍率）
 *  B. 剑仙套7 + 主修锋锐 + 玄冥(会伤+) + 标准神通（4CD 3.5 倍率）
 *  C. 多重施法套7 + 主修锋锐 + 标准神通（4CD 3.5 倍率）
 *
 * 跑法：npx tsx test/sim-refresh-vs-others.ts
 */
import { runPvpBattle, type PvpFighterInput } from '~/server/engine/multiBattleEngine'
import type { BattlerStats } from '~/server/engine/battleEngine'

const N = 200          // 每对模拟场次
const MAX_TURNS = 30   // 单场最大回合（够长让长 CD 神通至少放 3-4 次）

// ========= 通用基础属性（金品装备 + 中等堆叠） =========
const BASE = {
  maxHp: 80000,
  atk: 5500,
  def: 900,
  spd: 110,
  crit_rate: 0.32,   // 32% 基础会心率
  crit_dmg: 1.85,
  dodge: 0.04,
  lifesteal: 0.02,
  spirit: 60,
}

function mkStats(name: string, opts: {
  setCounts?: Record<string, number>
  weaponType?: string | null
  element?: string
  awaken?: any
  critDmgBonus?: number  // 玄冥附灵把会伤拉高
}): BattlerStats {
  return {
    name,
    maxHp: BASE.maxHp, hp: BASE.maxHp,
    atk: BASE.atk, def: BASE.def, spd: BASE.spd,
    crit_rate: BASE.crit_rate,
    crit_dmg: BASE.crit_dmg + (opts.critDmgBonus || 0),
    dodge: BASE.dodge, lifesteal: BASE.lifesteal,
    element: opts.element || 'metal',
    resists: { metal: 0.05, wood: 0.05, water: 0.05, fire: 0.05, earth: 0.05, ctrl: 0.10 },
    spiritualRoot: opts.element || 'metal',
    armorPen: 0, accuracy: 0,
    elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    spirit: BASE.spirit,
    awaken: opts.awaken || {},
    equipSetCounts: opts.setCounts || {},
    weaponType: opts.weaponType || null,
  } as any
}

// 空被动（统一）
const EMPTY_PASSIVE = {
  atkPercent: 0, defPercent: 0, hpPercent: 0, spdPercent: 0,
  critRate: 0, critDmg: 0, dodge: 0, lifesteal: 0,
  resistFire: 0, resistWater: 0, resistWood: 0, resistMetal: 0, resistEarth: 0, resistCtrl: 0,
  regenPerTurn: 0, damageReductionFlat: 0, reflectPercent: 0, skillCdReduction: 0,
} as any

// ========= 三个 build 配置 =========

// A. 刷新套 7 + 心剑回响 + 主修锋锐 + 单红神通（6CD 5.0）
function buildRefresh(name: string): PvpFighterInput {
  return {
    characterId: Math.floor(Math.random() * 1e9),
    stats: mkStats(name, {
      setCounts: { refresh: 7 },
      awaken: {
        mainSkillCritCdCut: true,    // 心剑回响（红品，会心时全神通 CD-1）
        mainSkillCritRate: 0.14,     // 主修锋锐（红，主修+14% 会心）
      },
    }),
    equippedSkills: {
      activeSkill: { name: '主修', multiplier: 1.0, element: 'metal' },
      divineSkills: [
        { name: '万古凋零', multiplier: 5.0, element: 'metal', cdTurns: 6 } as any,
      ],
      passiveEffects: EMPTY_PASSIVE,
    },
  }
}

// B. 剑仙套 7 + 主修锋锐 + 玄冥 + 标准神通
function buildSword(name: string): PvpFighterInput {
  return {
    characterId: Math.floor(Math.random() * 1e9),
    stats: mkStats(name, {
      setCounts: { sword_immortal: 7 },
      weaponType: 'sword',
      critDmgBonus: 0.35,            // 玄冥（红品 +35% 会伤）
      awaken: {
        mainSkillCritRate: 0.14,     // 主修锋锐
      },
    }),
    equippedSkills: {
      activeSkill: { name: '主修', multiplier: 1.0, element: 'metal' },
      divineSkills: [
        { name: '万剑归宗', multiplier: 3.5, element: 'metal', cdTurns: 4 } as any,
      ],
      passiveEffects: EMPTY_PASSIVE,
    },
  }
}

// C. 多重施法套 7 + 主修锋锐 + 标准神通
function buildMulticast(name: string): PvpFighterInput {
  return {
    characterId: Math.floor(Math.random() * 1e9),
    stats: mkStats(name, {
      setCounts: { multicast: 7 },
      awaken: {
        mainSkillCritRate: 0.14,
      },
    }),
    equippedSkills: {
      activeSkill: { name: '主修', multiplier: 1.0, element: 'metal' },
      divineSkills: [
        { name: '万剑归宗', multiplier: 3.5, element: 'metal', cdTurns: 4 } as any,
      ],
      passiveEffects: EMPTY_PASSIVE,
    },
  }
}

// ========= 模拟一场对决 =========

interface MatchStat {
  winner: 'a' | 'b'
  totalTurns: number
  aDmg: number
  bDmg: number
  aDivineCasts: number
  bDivineCasts: number
}

function simulate(buildA: () => PvpFighterInput, buildB: () => PvpFighterInput, n: number, label: string): {
  aWins: number, bWins: number,
  avgTurns: number,
  avgDmgA: number, avgDmgB: number,
  avgCastsA: number, avgCastsB: number,
} {
  let aWins = 0, bWins = 0
  let totalTurns = 0
  let totalDmgA = 0, totalDmgB = 0
  let totalCastsA = 0, totalCastsB = 0

  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 50 === 0) {
      process.stdout.write(`\r  [${label}] ${i}/${n} 场已模拟...`)
    }
    const a = buildA()
    const b = buildB()
    a.stats.name = 'A'
    b.stats.name = 'B'
    const res = runPvpBattle([a], [b], { maxTurns: MAX_TURNS })
    if (res.winnerSide === 'a') aWins++
    else bWins++
    totalTurns += res.totalTurns

    // 统计各方造成的总伤害（从战斗日志反推）
    const sideA = res.sideA[0]
    const sideB = res.sideB[0]
    totalDmgA += sideA.totalDmgDealt
    totalDmgB += sideB.totalDmgDealt

    // 神通释放次数（从日志计数）
    const castsA = res.logs.filter(l => /A.*【.*】.*造成|施展【.*】.*A/.test(l.text) && l.text.includes('万古') || /^.*A.*万剑/.test(l.text)).length
    const castsB = res.logs.filter(l => /B.*【.*】.*造成|施展【.*】.*B/.test(l.text) && l.text.includes('万古') || /^.*B.*万剑/.test(l.text)).length
    // 更可靠的方式：直接数 sideA.divineCds 起伏不好，简单数日志中"对方名字 + 神通名"出现
    totalCastsA += res.logs.filter(l => l.text.includes('A 【') || l.text.includes('A 施展【')).length
    totalCastsB += res.logs.filter(l => l.text.includes('B 【') || l.text.includes('B 施展【')).length
  }
  process.stdout.write('\r' + ' '.repeat(60) + '\r')

  return {
    aWins, bWins,
    avgTurns: totalTurns / n,
    avgDmgA: totalDmgA / n, avgDmgB: totalDmgB / n,
    avgCastsA: totalCastsA / n, avgCastsB: totalCastsB / n,
  }
}

// ========= 训练假人测试（绝对 DPS） =========
function buildDummy(): PvpFighterInput {
  return {
    characterId: 999,
    stats: {
      name: 'Dummy',
      maxHp: 800000, hp: 800000,
      atk: 100, def: 200, spd: 80,
      crit_rate: 0, crit_dmg: 1.5,
      dodge: 0, lifesteal: 0,
      element: 'wood',  // 金 vs 木 → 攻方 +30%（让两 build 公平享受同样克制）
      resists: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 },
      spiritualRoot: 'wood',
      armorPen: 0, accuracy: 0,
      elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
      spirit: 0,
      awaken: {},
      equipSetCounts: {},
      weaponType: null,
    } as any,
    equippedSkills: {
      activeSkill: { name: '基础', multiplier: 0.5, element: 'wood' },
      divineSkills: [],
      passiveEffects: EMPTY_PASSIVE,
    },
  }
}

function dpsTest(build: () => PvpFighterInput, n: number, label: string): {
  avgDmg: number, p50Dmg: number, p90Dmg: number, avgTurns: number,
} {
  const dmgs: number[] = []
  let totalTurns = 0
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 50 === 0) {
      process.stdout.write(`\r  [${label}] ${i}/${n} 场已模拟...`)
    }
    const player = build()
    player.stats.name = 'P'
    const res = runPvpBattle([player], [buildDummy()], { maxTurns: MAX_TURNS })
    dmgs.push(res.sideA[0].totalDmgDealt)
    totalTurns += res.totalTurns
  }
  process.stdout.write('\r' + ' '.repeat(60) + '\r')
  dmgs.sort((a, b) => a - b)
  return {
    avgDmg: dmgs.reduce((s, x) => s + x, 0) / n,
    p50Dmg: dmgs[Math.floor(n * 0.5)],
    p90Dmg: dmgs[Math.floor(n * 0.9)],
    avgTurns: totalTurns / n,
  }
}

// ========= 跑测 =========

console.log('============================================================')
console.log(`套装平衡对照模拟（每组 ${N} 场，maxTurns=${MAX_TURNS}）`)
console.log('============================================================')
console.log('Build A: 刷新套7 + 心剑回响 + 主修锋锐 + 单红神通(6CD 5.0)')
console.log('Build B: 剑仙套7 + 主修锋锐 + 玄冥(+35%会伤) + 4CD 3.5 神通')
console.log('Build C: 多重施法套7 + 主修锋锐 + 4CD 3.5 神通')
console.log('============================================================\n')

console.log('【1. 假人 DPS 测试 (打 800k HP 木属性假人)】')
console.log('-'.repeat(60))
const dpsA = dpsTest(buildRefresh, N, 'A vs Dummy')
console.log(`Build A (刷新+心剑): avg=${dpsA.avgDmg.toFixed(0)}  p50=${dpsA.p50Dmg.toFixed(0)}  p90=${dpsA.p90Dmg.toFixed(0)}  回合=${dpsA.avgTurns.toFixed(2)}`)
const dpsB = dpsTest(buildSword, N, 'B vs Dummy')
console.log(`Build B (剑仙+玄冥): avg=${dpsB.avgDmg.toFixed(0)}  p50=${dpsB.p50Dmg.toFixed(0)}  p90=${dpsB.p90Dmg.toFixed(0)}  回合=${dpsB.avgTurns.toFixed(2)}`)
const dpsC = dpsTest(buildMulticast, N, 'C vs Dummy')
console.log(`Build C (多重施法): avg=${dpsC.avgDmg.toFixed(0)}  p50=${dpsC.p50Dmg.toFixed(0)}  p90=${dpsC.p90Dmg.toFixed(0)}  回合=${dpsC.avgTurns.toFixed(2)}`)

const baseline = Math.max(dpsB.avgDmg, dpsC.avgDmg)
console.log(`\n相对强度 (以 B/C 中较强者为 100%):`)
console.log(`  A: ${(dpsA.avgDmg / baseline * 100).toFixed(1)}%`)
console.log(`  B: ${(dpsB.avgDmg / baseline * 100).toFixed(1)}%`)
console.log(`  C: ${(dpsC.avgDmg / baseline * 100).toFixed(1)}%`)

console.log('\n【2. 1v1 对战胜率】')
console.log('-'.repeat(60))
const ab = simulate(buildRefresh, buildSword, N, 'A vs B')
console.log(`A (刷新+心剑) vs B (剑仙+玄冥): ${ab.aWins}-${ab.bWins} (A胜率 ${(ab.aWins/N*100).toFixed(1)}%) avg回合=${ab.avgTurns.toFixed(2)}`)
console.log(`  伤害: A=${ab.avgDmgA.toFixed(0)} / B=${ab.avgDmgB.toFixed(0)}`)
const ac = simulate(buildRefresh, buildMulticast, N, 'A vs C')
console.log(`A (刷新+心剑) vs C (多重施法):  ${ac.aWins}-${ac.bWins} (A胜率 ${(ac.aWins/N*100).toFixed(1)}%) avg回合=${ac.avgTurns.toFixed(2)}`)
console.log(`  伤害: A=${ac.avgDmgA.toFixed(0)} / B=${ac.avgDmgB.toFixed(0)}`)
const bc = simulate(buildSword, buildMulticast, N, 'B vs C')
console.log(`B (剑仙+玄冥) vs C (多重施法):  ${bc.aWins}-${bc.bWins} (B胜率 ${(bc.aWins/N*100).toFixed(1)}%) avg回合=${bc.avgTurns.toFixed(2)}`)
console.log(`  伤害: B=${bc.avgDmgA.toFixed(0)} / C=${bc.avgDmgB.toFixed(0)}`)

console.log('\n============================================================')
console.log('结论解读：胜率偏离 50% 越多 → 该 build 越强')
console.log('  · A 胜率 >65% 且 DPS 居首 → 刷新套+心剑确实过强')
console.log('  · A 胜率 50-60% 且 DPS 中等 → 平衡可接受')
console.log('  · A 胜率 <55% → 反而偏弱')
console.log('============================================================')
