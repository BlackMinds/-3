/**
 * Phase 2b sim：duoBattleEngine 套装 9 套 hook 验证
 * 用法：npx tsx test/sim-duo-setEffects.ts
 *
 * 期望日志中出现：
 *   ❖ 套装激活：火神套 (7/7 · 7 件套)
 *   ❖ 套装激活：极寒套 (7/7 · 7 件套)
 *   ❖【火神套】灼烧立即额外结算 4 跳，对... — instantMul=5 → extra=4
 *   chance bonus 标签 ❖极寒+xx%（如果有 freeze 施加路径）
 *   灼烧每跳 dmg 比基线大（dmgMul=1.6）
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

const player = mkStats('玩家', { maxHp: 5000, hp: 5000, atk: 200, spd: 200 })
// 触发 7 件火神套 + 7 件极寒套（两套都 7 件，意味着各 7 个槽位独立挂套装）
;(player as any).equipSetCounts = { fire_god: 7, frost: 7 }

const assistStats = mkStats('娘子', { maxHp: 3000, hp: 3000, atk: 100, spd: 80 })
const assist: DuoAssistInput = { stats: assistStats, innateSkill: null }

const dummyTpl: MonsterTemplate = {
  name: '木妖', power: 100, exp: 50, element: 'wood',
  hp_min: 5000, hp_max: 5000, atk_min: 80, atk_max: 80, def_min: 30, def_max: 30,
  spd_min: 50, spd_max: 50, crit_rate: 0, crit_dmg: 1.5, dodge: 0,
  stone_min: 1, stone_max: 1, role: 'normal', drop_table: '',
}
const dummyStats = mkStats('木妖', { maxHp: 5000, hp: 5000, atk: 80, def: 30, spd: 50, element: 'wood' })

// 玩家神通：burn duration=4 + cdTurns=1，让玩家每回合都能重施 burn（验证 extendIfStacked）
const fireSkill: SkillRefInfo = {
  name: '焚天爆炎', multiplier: 1.0, cdTurns: 1, element: 'fire',
  debuff: { type: 'burn', chance: 1.0, duration: 4 },
}
const equippedSkills: EquippedSkillInfo = { divineSkills: [fireSkill] }

const result = runDuoWaveBattle(player, assist,
  [{ stats: dummyStats, template: dummyTpl }],
  equippedSkills, 30)

const allText = result.logs.map(l => l.text).join('\n')

const checks: Array<[string, RegExp]> = [
  ['火神套激活日志',  /套装激活：火神套/],
  ['极寒套激活日志',  /套装激活：极寒套/],
  ['火神套 instantMul', /火神套.*灼烧立即额外结算/],
  ['焚天延 (extendIfStacked)', /❖焚天延/],
]
let pass = 0
for (const [label, rx] of checks) {
  const ok = rx.test(allText)
  console.log(`${ok ? '✓' : '✗'} ${label}: ${ok ? 'PASS' : 'FAIL'}`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} 检查通过`)

console.log('\n--- 套装相关日志 ---')
for (const l of result.logs) {
  if (/❖|套装|火神|极寒|灼烧/.test(l.text)) {
    console.log(`[T${l.turn}] ${l.text}`)
  }
}

process.exit(pass === checks.length ? 0 : 1)
