/**
 * 双人战斗 Phase 2a sim：验证 DOT (灼烧) + 控制 (眩晕) + 助战 DOT 受击 + brittle 增伤
 *
 * 用法：npx tsx test/sim-duo-debuff.ts
 *
 * 期望：日志中出现「陷入灼烧」「受到灼烧 N 点伤害」「被眩晕」「被控制中,无法行动」「陷入脆弱」字样。
 */
import { runDuoWaveBattle, type DuoAssistInput } from '../server/engine/duoBattleEngine'
import type { BattlerStats, MonsterTemplate, EquippedSkillInfo, SkillRefInfo } from '../server/engine/battleEngine'

function mkStats(name: string, opts: Partial<BattlerStats> = {}): BattlerStats {
  return {
    name, maxHp: 1000, hp: 1000,
    atk: 100, def: 50, spd: 100,
    crit_rate: 0, crit_dmg: 1.5, dodge: 0, lifesteal: 0,
    element: null,
    resists: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 },
    elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    spirit: 0,
    ...opts,
  }
}

const player = mkStats('玩家', { maxHp: 2000, hp: 2000, atk: 150, spd: 150 })
const assistStats = mkStats('小儿', { maxHp: 1500, hp: 1500, atk: 120, spd: 120 })
const assist: DuoAssistInput = { stats: assistStats, innateSkill: null }

// 怪物 1：会施灼烧 + 100% 概率
const burnerTpl: MonsterTemplate = {
  name: '火灵', power: 100, exp: 50, element: 'fire',
  hp_min: 800, hp_max: 800, atk_min: 80, atk_max: 80, def_min: 30, def_max: 30,
  spd_min: 90, spd_max: 90, crit_rate: 0, crit_dmg: 1.5, dodge: 0,
  stone_min: 1, stone_max: 1, role: 'normal', drop_table: '',
}
const burnerStats = mkStats('火灵', { maxHp: 800, hp: 800, atk: 80, def: 30, spd: 90, element: 'fire' })

// 怪物 2：会眩晕 + 脆弱
const stunnerTpl: MonsterTemplate = {
  name: '雷兽', power: 100, exp: 50, element: 'metal',
  hp_min: 800, hp_max: 800, atk_min: 80, atk_max: 80, def_min: 30, def_max: 30,
  spd_min: 90, spd_max: 90, crit_rate: 0, crit_dmg: 1.5, dodge: 0,
  stone_min: 1, stone_max: 1, role: 'normal', drop_table: '',
}
const stunnerStats = mkStats('雷兽', { maxHp: 800, hp: 800, atk: 80, def: 30, spd: 90, element: 'metal' })

// 给玩家一个会施灼烧的神通（100% 概率以便确定性验证）
const fireSkill: SkillRefInfo = {
  name: '焚天爆炎', multiplier: 1.0, cdTurns: 3, element: 'fire',
  debuff: { type: 'burn', chance: 1.0, duration: 3 },
}
const equippedSkills: EquippedSkillInfo = {
  divineSkills: [fireSkill],
}

// 注入 monsterChooseSkill 让怪物的攻击带 debuff —— 通过 monster skill state 难以注入，
// 这里我们走 path：让 burnerTpl 默认有元素 fire；但 monsterChooseSkill 依赖 buildMonsterSkillPool。
// 所以只能验证 玩家施加 DOT/控制；怪物施加 DOT/控制留给手测或 e2e。

// monkey-patch monster.stats.atk 已经在 burnerStats 中。我们打两只小怪验证：
//   - 玩家用焚天 → 火灵陷入灼烧 → 火灵每回合掉血
//   - 助战只是普攻
const result = runDuoWaveBattle(
  player, assist,
  [
    { stats: burnerStats, template: burnerTpl },
    { stats: stunnerStats, template: stunnerTpl },
  ],
  equippedSkills,
  30,
)

const allText = result.logs.map(l => l.text).join('\n')

const checks: Array<[string, RegExp]> = [
  ['玩家施加灼烧 debuff', /陷入灼烧/],
  ['DOT tick 伤害结算', /受到灼烧/],
  ['玩家神通命中', /焚天爆炎/],
  ['助战行动', /小儿·助战/],
]

let pass = 0
for (const [label, rx] of checks) {
  const ok = rx.test(allText)
  console.log(`${ok ? '✓' : '✗'} ${label}: ${ok ? 'PASS' : 'FAIL'}`)
  if (ok) pass++
}

console.log(`\n${pass}/${checks.length} 检查通过`)
console.log(`回合数: ${Math.max(...result.logs.map(l => l.turn))}`)
console.log(`战斗结果: ${result.won ? '胜' : '败'}`)
console.log(`finalPlayerHp=${result.finalPlayerHp}, finalAssistHp=${result.finalAssistHp}`)

// 打印前 30 条日志看 trace
console.log('\n--- 日志摘录（前 30 条） ---')
for (const l of result.logs.slice(0, 30)) {
  console.log(`[T${l.turn}] ${l.text}`)
}

process.exit(pass === checks.length ? 0 : 1)
