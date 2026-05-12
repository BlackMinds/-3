/**
 * Phase 2c-1 sim：附灵 13 hooks 验证
 * 用法：npx tsx test/sim-duo-awaken.ts
 *
 * 期望：
 *   - regenPerTurn  → ✦【回春】回复 X 点气血
 *   - damageReduction → 玩家受到伤害比基线少（缺基线对照，用日志关键字）
 *   - burnOnHitChance → ✦【焚魂】 出现
 *   - mainSkillBurnAmp (主修 fire 元素) → ✦焚烬 标签
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
// 注入附灵 awakenState：覆盖 4 大类钩子
;(player as any).awaken = {
  regenPerTurn: 0.05,        // 每回合回 5% 最大气血
  damageReduction: 0.2,      // 受伤 -20%
  burnOnHitChance: 1.0,      // 100% 命中追加灼烧
  mainSkillBurnAmp: 0.5,     // 主修火元素 → 灼烧每跳 ×1.5
  mainSkillBurnAmpElem: 'fire',
}

const assistStats = mkStats('娘子', { maxHp: 3000, hp: 3000, atk: 100, spd: 80 })
const assist: DuoAssistInput = { stats: assistStats, innateSkill: null }

const tpl: MonsterTemplate = {
  name: '木妖', power: 100, exp: 50, element: 'wood',
  hp_min: 8000, hp_max: 8000, atk_min: 80, atk_max: 80, def_min: 30, def_max: 30,
  spd_min: 50, spd_max: 50, crit_rate: 0, crit_dmg: 1.5, dodge: 0,
  stone_min: 1, stone_max: 1, role: 'normal', drop_table: '',
} as any
const mStats = mkStats('木妖', { maxHp: 8000, hp: 8000, atk: 200, def: 30, spd: 50, element: 'wood' })

// activeSkill 主修走 fire + 自带 burn debuff（验证 mainSkillBurnAmp 在主修触发时的 ✦焚烬 标签）
const activeSkill: SkillRefInfo = {
  name: '焚天烈魂', multiplier: 1.0, element: 'fire',
  debuff: { type: 'burn' as any, chance: 1.0, duration: 2 },
}
const equippedSkills: EquippedSkillInfo = { activeSkill, divineSkills: [] } as any

const result = runDuoWaveBattle(player, assist,
  [{ stats: mStats, template: tpl }],
  equippedSkills, 30)

const allText = result.logs.map(l => l.text).join('\n')

const checks: Array<[string, RegExp]> = [
  ['regenPerTurn 回春', /✦【回春】回复/],
  ['burnOnHitChance 焚魂', /✦【焚魂】/],
  ['mainSkillBurnAmp 焚烬标签', /✦焚烬\+50%/],
]
let pass = 0
for (const [label, rx] of checks) {
  const ok = rx.test(allText)
  console.log(`${ok ? '✓' : '✗'} ${label}: ${ok ? 'PASS' : 'FAIL'}`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} 检查通过`)

console.log('\n--- 附灵相关日志 ---')
for (const l of result.logs.slice(0, 25)) {
  if (/✦|回春|焚魂|淬毒|裂魂|灼烧|洗髓|反伤/.test(l.text)) {
    console.log(`[T${l.turn}] ${l.text}`)
  }
}

process.exit(pass === checks.length ? 0 : 1)
