/**
 * 11 套套装对位模拟（v3.8.5 改动后）
 *
 * 场景：T10 装备 + 配套附灵 + 丹药加成 + 宗门加成 全集
 *   atk 5500 / def 900 / hp 80000 / crit_rate 32% / crit_dmg 1.85x / spirit 60
 *   附灵 玄冥 +35% 暴伤 / 主修锋锐 +14% / 焚烬戒 / 焚天戒 等
 *   丹药假设 atk +30% / def +20% / hp +25% (PILL_PCT_CAP=0.40 各 80% 利用率)
 *   宗门加成假设 atk +10% / def +10% / hp +10%
 *
 * 跑法：npx tsx test/sim-set-comparison-v3-8-5.ts
 */
import { runPvpBattle, type PvpFighterInput } from '~/server/engine/multiBattleEngine'
import type { BattlerStats } from '~/server/engine/battleEngine'

const N = 300                       // 每个 build × 每个回合数 跑场次（取均值）
const TURN_CHECKPOINTS = [5, 15]    // 检查点：5 回合 / 15 回合 总伤
const DUMMY_HP = 1e10               // 假人血量给到永远打不死，确保跑满 maxTurns

// ========= 通用基础属性 (T10 装备 + 附灵 + 丹药 + 宗门，已含百分比加成) =========
//   裸装备/等级/境界 atk≈3000 → +30%丹药 +10%宗门 +10%装备PCT ≈ 5500
const BASE = {
  maxHp: 80000,
  atk: 5500,
  def: 900,
  spd: 110,
  crit_rate: 0.37,    // 装备/等级 32% + 主修锋锐 14%×部分时段 ≈ 37% 期望
  crit_dmg: 1.85,     // 装备/等级 1.85（玄冥附灵在 build 内单独加）
  dodge: 0.04,
  lifesteal: 0.02,
  spirit: 60,
}

const EMPTY_PASSIVE = {
  atkPercent: 0, defPercent: 0, hpPercent: 0, spdPercent: 0,
  critRate: 0, critDmg: 0, dodge: 0, lifesteal: 0,
  resistFire: 0, resistWater: 0, resistWood: 0, resistMetal: 0, resistEarth: 0, resistCtrl: 0,
  regenPerTurn: 0, damageReductionFlat: 0, reflectPercent: 0, skillCdReduction: 0,
} as any

interface BuildOpts {
  setCounts: Record<string, number>
  weaponType?: string | null
  element: string                  // 主修元素
  critDmgBonus?: number            // 玄冥附灵叠加暴伤
  awakenState?: any                // 主修锋锐 / 焚烬戒 / 心剑回响 等
  elementDmg?: Partial<Record<'metal' | 'wood' | 'water' | 'fire' | 'earth', number>>
  active: { name: string; multiplier: number; element: string | null }
  divine: Array<{ name: string; multiplier: number; element: string | null; cdTurns: number; isAoe?: boolean; targetCount?: number; debuff?: any; hitCount?: number }>
}

function mkBuild(name: string, label: string, opts: BuildOpts): PvpFighterInput {
  const stats: any = {
    name,
    maxHp: BASE.maxHp, hp: BASE.maxHp,
    atk: BASE.atk, def: BASE.def, spd: BASE.spd,
    crit_rate: BASE.crit_rate,
    crit_dmg: BASE.crit_dmg + (opts.critDmgBonus || 0),
    dodge: BASE.dodge, lifesteal: BASE.lifesteal,
    element: opts.element,
    resists: { metal: 0.05, wood: 0.05, water: 0.05, fire: 0.05, earth: 0.05, ctrl: 0.10 },
    spiritualRoot: opts.element,
    armorPen: 0, accuracy: 0,
    elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ...(opts.elementDmg || {}) },
    spirit: BASE.spirit,
    awaken: opts.awakenState || {},
    equipSetCounts: opts.setCounts,
    weaponType: opts.weaponType ?? null,
  }
  return {
    characterId: Math.floor(Math.random() * 1e9),
    stats: stats as BattlerStats,
    equippedSkills: {
      activeSkill: opts.active as any,
      divineSkills: opts.divine as any,
      passiveEffects: EMPTY_PASSIVE,
    },
  }
}

// ========= 假人（中性元素，避免任一 build 偏吃克制） =========
function buildDummy(): PvpFighterInput {
  return {
    characterId: 999,
    stats: {
      name: 'Dummy',
      maxHp: DUMMY_HP, hp: DUMMY_HP,
      atk: 100, def: 200, spd: 80,
      crit_rate: 0, crit_dmg: 1.5,
      dodge: 0, lifesteal: 0,
      element: null,
      resists: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 },
      spiritualRoot: null,
      armorPen: 0, accuracy: 0,
      elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
      spirit: 0,
      awaken: {},
      equipSetCounts: {},
      weaponType: null,
    } as any,
    equippedSkills: {
      activeSkill: { name: '基础', multiplier: 0.3, element: null },
      divineSkills: [],
      passiveEffects: EMPTY_PASSIVE,
    },
  }
}

// ============================================================
// 11 套 build 配置
// ============================================================

// 通用神通模板
const STD_DIVINE = (el: string) => ([
  { name: '万剑归宗', multiplier: 3.5, element: el, cdTurns: 4 },
])

const builds: Array<{ key: string; label: string; make: () => PvpFighterInput }> = [
  // 1. 刷新套 — 通用，单红神通（6CD 5.0），附灵 心剑回响 + 主修锋锐
  {
    key: 'refresh', label: '刷新套7 (心剑+锋锐+5.0倍率红神通)',
    make: () => mkBuild('refresh', '刷新套', {
      setCounts: { refresh: 7 }, element: 'metal',
      awakenState: { mainSkillCritCdCut: true, mainSkillCritRate: 0.14 },
      active: { name: '主修', multiplier: 1.0, element: 'metal' },
      divine: [{ name: '万古凋零', multiplier: 5.0, element: 'metal', cdTurns: 6 }],
    }),
  },

  // 2. 多重施法套 — 单体神通（4CD 3.5）
  {
    key: 'multicast', label: '多重施法套7 (单体神通)',
    make: () => mkBuild('multicast', '多重施法', {
      setCounts: { multicast: 7 }, element: 'metal',
      awakenState: { mainSkillCritRate: 0.14 },
      active: { name: '主修', multiplier: 1.0, element: 'metal' },
      divine: STD_DIVINE('metal'),
    }),
  },

  // 3. 火神套 — 火主修 + 焚烬戒 + 火系强化副词条
  {
    key: 'fire_god', label: '火神套7 (火主修+焚烬戒+火系强化)',
    make: () => mkBuild('fire_god', '火神套', {
      setCounts: { fire_god: 7 }, element: 'fire',
      elementDmg: { fire: 77 },           // 7 件全堆 FIRE_DMG=11
      awakenState: { mainSkillBurnAmp: 0.75, mainSkillBurnAmpElem: 'fire', mainSkillCritRate: 0.14 },
      active: { name: '焚体诀', multiplier: 1.0, element: 'fire' },
      divine: [{ name: '焚天烈魂', multiplier: 3.5, element: 'fire', cdTurns: 4, isAoe: true,
        debuff: { type: 'burn', chance: 1.0, duration: 3 } }],
    }),
  },

  // 4. 万毒套 — 木主修 + 木灵戒 + 木系强化副词条
  {
    key: 'venom', label: '万毒套7 (木主修+木灵戒+木系强化)',
    make: () => mkBuild('venom', '万毒套', {
      setCounts: { venom: 7 }, element: 'wood',
      elementDmg: { wood: 77 },
      awakenState: { mainSkillPoisonAmp: 0.85, mainSkillPoisonAmpElem: 'wood', mainSkillCritRate: 0.14 },
      active: { name: '百毒不侵', multiplier: 1.0, element: 'wood' },
      divine: [{ name: '毒液冲击', multiplier: 3.5, element: 'wood', cdTurns: 4, isAoe: true,
        debuff: { type: 'poison', chance: 1.0, duration: 3 } }],
    }),
  },

  // 5. 血魔套 — 金主修 + 金鸣戒 + 金系强化副词条
  {
    key: 'blood_demon', label: '血魔套7 (金主修+金鸣戒+金系强化)',
    make: () => mkBuild('blood_demon', '血魔套', {
      setCounts: { blood_demon: 7 }, element: 'metal',
      elementDmg: { metal: 77 },
      awakenState: { mainSkillBleedAmp: 0.75, mainSkillBleedAmpElem: 'metal', mainSkillCritRate: 0.14 },
      active: { name: '剑雨纷飞', multiplier: 1.0, element: 'metal' },
      divine: [{ name: '血雨腥风', multiplier: 3.5, element: 'metal', cdTurns: 4, isAoe: true,
        debuff: { type: 'bleed', chance: 1.0, duration: 3 } }],
    }),
  },

  // 6. 极寒套 — 水主修 + 水蕴戒
  {
    key: 'frost', label: '极寒套7 (水主修+水蕴戒+冻结)',
    make: () => mkBuild('frost', '极寒套', {
      setCounts: { frost: 7 }, element: 'water',
      elementDmg: { water: 77 },
      awakenState: { mainSkillFreezeChance: 0.28, mainSkillFreezeChanceElem: 'water', mainSkillCritRate: 0.14 },
      active: { name: '水流诀', multiplier: 1.0, element: 'water' },
      divine: [{ name: '霜冻新星', multiplier: 3.5, element: 'water', cdTurns: 4, isAoe: true,
        debuff: { type: 'freeze', chance: 0.6, duration: 1 } }],
    }),
  },

  // 7. 十三枪 — 枪武器，金主修
  {
    key: 'thirteen_spear', label: '十三枪7 (枪武器+主修锋锐)',
    make: () => mkBuild('thirteen_spear', '十三枪', {
      setCounts: { thirteen_spear: 7 }, element: 'metal', weaponType: 'spear',
      awakenState: { mainSkillCritRate: 0.14 },
      active: { name: '主修', multiplier: 1.0, element: 'metal' },
      divine: STD_DIVINE('metal'),
    }),
  },

  // 8. 回归基本功 — 主修 AOE，禁神通
  {
    key: 'basic_back', label: '回归基本功7 (主修AOE，禁神通)',
    make: () => mkBuild('basic_back', '回归基本功', {
      setCounts: { basic_back: 7 }, element: 'metal',
      awakenState: { mainSkillCritRate: 0.14 },
      active: { name: '主修(AOE)', multiplier: 1.0, element: 'metal' },
      divine: [],   // 神通被禁 — 留空
    }),
  },

  // 9. 剑仙套 — 剑武器，金主修，玄冥附灵
  {
    key: 'sword_immortal', label: '剑仙套7 (剑武器+玄冥+剑气)',
    make: () => mkBuild('sword_immortal', '剑仙套', {
      setCounts: { sword_immortal: 7 }, element: 'metal', weaponType: 'sword',
      critDmgBonus: 0.35,            // 玄冥红 +35%
      awakenState: { mainSkillCritRate: 0.14 },
      active: { name: '主修', multiplier: 1.0, element: 'metal' },
      divine: STD_DIVINE('metal'),
    }),
  },

  // 10. 刀狂套 — 刀武器，金主修
  {
    key: 'blade_madness', label: '刀狂套7 (刀武器+暴击叠加)',
    make: () => mkBuild('blade_madness', '刀狂套', {
      setCounts: { blade_madness: 7 }, element: 'metal', weaponType: 'blade',
      awakenState: { mainSkillCritRate: 0.14 },
      active: { name: '主修', multiplier: 1.0, element: 'metal' },
      divine: STD_DIVINE('metal'),
    }),
  },

  // 11. 天机套 — 扇武器，金主修
  {
    key: 'fan_master', label: '天机套7 (扇武器+神通额外段)',
    make: () => mkBuild('fan_master', '天机套', {
      setCounts: { fan_master: 7 }, element: 'metal', weaponType: 'fan',
      awakenState: { mainSkillCritRate: 0.14 },
      active: { name: '主修', multiplier: 1.0, element: 'metal' },
      divine: STD_DIVINE('metal'),
    }),
  },
]

// ============================================================
// 模拟单 build 在 maxTurns 回合内造成的总伤害
// ============================================================
function dpsTest(make: () => PvpFighterInput, n: number, maxTurns: number, label: string): { avg: number; p50: number; p90: number } {
  const dmgs: number[] = []
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 60 === 0) {
      process.stdout.write(`\r  [${label}] T${maxTurns} ${i}/${n}...`)
    }
    const player = make()
    player.stats.name = 'P'
    const res = runPvpBattle([player], [buildDummy()], { maxTurns })
    dmgs.push(res.sideA[0].totalDmgDealt)
  }
  process.stdout.write('\r' + ' '.repeat(60) + '\r')
  dmgs.sort((a, b) => a - b)
  const sum = dmgs.reduce((s, x) => s + x, 0)
  return { avg: sum / n, p50: dmgs[Math.floor(n * 0.5)], p90: dmgs[Math.floor(n * 0.9)] }
}

// ============================================================
// 主流程
// ============================================================
console.log('============================================================')
console.log(`v3.8.5 套装对位模拟 (T10 装备 + 附灵 + 丹药 + 宗门加成)`)
console.log(`每组 ${N} 场 × 检查点 ${TURN_CHECKPOINTS.join(',')} 回合，PvP balance: 1v1`)
console.log(`基础面板: atk=${BASE.atk} def=${BASE.def} hp=${BASE.maxHp} crit=${(BASE.crit_rate*100).toFixed(0)}%/${BASE.crit_dmg.toFixed(2)}x`)
console.log('============================================================\n')

interface RowResult { key: string; label: string; t5: number; t15: number }
const results: RowResult[] = []

for (const b of builds) {
  const t5 = dpsTest(b.make, N, 5, b.key)
  const t15 = dpsTest(b.make, N, 15, b.key)
  results.push({ key: b.key, label: b.label, t5: t5.avg, t15: t15.avg })
  console.log(`${b.label.padEnd(48)} | 5回合: ${t5.avg.toFixed(0).padStart(10)} | 15回合: ${t15.avg.toFixed(0).padStart(10)} | 15/5: ${(t15.avg / Math.max(1, t5.avg)).toFixed(2)}x`)
}

console.log('\n============================================================')
console.log('排序 - 5 回合伤害（从高到低）：')
console.log('============================================================')
const t5sorted = [...results].sort((a, b) => b.t5 - a.t5)
const t5Top = t5sorted[0].t5
for (const r of t5sorted) {
  const pct = (r.t5 / t5Top * 100).toFixed(1)
  console.log(`  ${r.label.padEnd(48)} ${r.t5.toFixed(0).padStart(12)}  (${pct}%)`)
}

console.log('\n排序 - 15 回合伤害（从高到低）：')
console.log('============================================================')
const t15sorted = [...results].sort((a, b) => b.t15 - a.t15)
const t15Top = t15sorted[0].t15
for (const r of t15sorted) {
  const pct = (r.t15 / t15Top * 100).toFixed(1)
  console.log(`  ${r.label.padEnd(48)} ${r.t15.toFixed(0).padStart(12)}  (${pct}%)`)
}

console.log('\n============================================================')
console.log('解读：')
console.log('  - 同一行 5/15 回合伤害比反映"长战 / 短战"特性（DOT 套应该 >3x，刷新套约 3x，纯爆发套 <3x）')
console.log('  - 任一回合数下偏离 baseline ±20% 视为不平衡，需要再调')
console.log('============================================================')
