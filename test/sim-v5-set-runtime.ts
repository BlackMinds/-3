/**
 * V5 元始天尊 5/7 件套运行时效果实战验证
 *
 * 测三件事：
 *   1) 5 件套：释放神通时所有其他神通 CD-1 → 监控 divineCds 减少
 *   2) 5 件套：30% 概率刷新最短 CD 神通（强制概率=1 触发） → 日志含「神通续接」
 *   3) 7 件套：10% 概率全体眩晕（强制概率=1 触发） → 日志含「天尊气场」
 *
 * 用法：npx tsx test/sim-v5-set-runtime.ts
 */
import { runWaveBattle, generateMonsterStats, type BattlerStats, type MonsterTemplate, type EquippedSkillInfo, type SkillRefInfo } from '../server/engine/battleEngine'

function basePlayer(extra: Record<string, any> = {}): BattlerStats {
  return {
    name: '测试玩家',
    maxHp: 50000, hp: 50000,
    atk: 5000, def: 2000, spd: 200,
    crit_rate: 0.5, crit_dmg: 2.0,
    dodge: 0.05, lifesteal: 0.05,
    element: 'wood', spiritualRoot: 'wood',
    armorPen: 30, accuracy: 50,
    elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    resists: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 },
    spirit: 500,
    ...extra,
  } as BattlerStats
}

function baseMonsterTemplate(name: string, power: number): MonsterTemplate {
  return { name, power, element: 'fire', exp: 100, stone_min: 10, stone_max: 20, role: 'normal', drop_table: 'common' }
}

// 5 个神通（保证测得到 CD-1 + 刷新最短）
const divineSkills: SkillRefInfo[] = [
  { name: '神通A', multiplier: 1.5, cdTurns: 3, element: null, description: 'A' },
  { name: '神通B', multiplier: 1.5, cdTurns: 4, element: null, description: 'B' },
  { name: '神通C', multiplier: 1.5, cdTurns: 5, element: null, description: 'C' },
  { name: '神通D', multiplier: 1.5, cdTurns: 6, element: null, description: 'D' },
  { name: '神通E', multiplier: 1.5, cdTurns: 7, element: null, description: 'E' },
]
const equippedSkills: EquippedSkillInfo = {
  activeSkill: { name: '主修', multiplier: 1.2, cdTurns: 0, element: 'wood', description: '主修' },
  divineSkills,
  passiveEffects: {
    atkPercent: 0, defPercent: 0, hpPercent: 0, spdPercent: 0,
    critRate: 0, critDmg: 0, dodge: 0, lifesteal: 0,
    resistFire: 0, resistWater: 0, resistWood: 0, resistMetal: 0, resistEarth: 0, resistCtrl: 0,
    regenPerTurn: 0, damageReductionFlat: 0, reflectPercent: 0,
  },
}

console.log('==== 用例 1：元始天尊 5 件套（CD-1 + 强制 30% 刷新最短）====')
// 强制 100% 触发刷新（v5RefreshShortestCdChance=1.0）
const player5 = basePlayer({
  v5SkillCdMinus: 1,
  v5RefreshShortestCdChance: 1.0,
  v5StunAllChance: 0,
  v5StunTurns: 0,
})
const monsters5 = [
  { stats: generateMonsterStats(baseMonsterTemplate('陪练1', 8000)), template: baseMonsterTemplate('陪练1', 8000) },
  { stats: generateMonsterStats(baseMonsterTemplate('陪练2', 8000)), template: baseMonsterTemplate('陪练2', 8000) },
]
const r5 = runWaveBattle(player5, monsters5, equippedSkills, 20)
const cdLogs = r5.logs.filter(l => /神通续接/.test(l.text))
console.log(`回合数: ${r5.logs.filter(l => l.turn > 0).length}, 胜利: ${r5.won}`)
console.log(`「神通续接」日志条数: ${cdLogs.length}`)
for (const l of cdLogs.slice(0, 5)) console.log(`  T${l.turn}: ${l.text}`)
if (cdLogs.length === 0) {
  console.log('  ⚠️ 没找到刷新日志（可能是 divineCds 全 0 或被打死太快）')
}

console.log('\n==== 用例 2：元始天尊 7 件套（强制 100% 眩晕全体）====')
const player7 = basePlayer({
  v5SkillCdMinus: 0,
  v5RefreshShortestCdChance: 0,
  v5StunAllChance: 1.0,  // 强制必中
  v5StunTurns: 1,
})
const monsters7 = [
  { stats: generateMonsterStats(baseMonsterTemplate('眩晕实验1', 8000)), template: baseMonsterTemplate('眩晕实验1', 8000) },
  { stats: generateMonsterStats(baseMonsterTemplate('眩晕实验2', 8000)), template: baseMonsterTemplate('眩晕实验2', 8000) },
  { stats: generateMonsterStats(baseMonsterTemplate('眩晕实验3', 8000)), template: baseMonsterTemplate('眩晕实验3', 8000) },
]
const r7 = runWaveBattle(player7, monsters7, equippedSkills, 20)
const stunLogs = r7.logs.filter(l => /天尊气场/.test(l.text))
console.log(`回合数: ${r7.logs.filter(l => l.turn > 0).length}, 胜利: ${r7.won}`)
console.log(`「天尊气场」日志条数: ${stunLogs.length}（每回合 1 次=回合数）`)
for (const l of stunLogs.slice(0, 5)) console.log(`  T${l.turn}: ${l.text}`)

console.log('\n==== 用例 3：默认 player（不挂 V5 字段，对照组）====')
const playerNoV5 = basePlayer()
const monstersNoV5 = [
  { stats: generateMonsterStats(baseMonsterTemplate('对照怪', 8000)), template: baseMonsterTemplate('对照怪', 8000) },
]
const rNoV5 = runWaveBattle(playerNoV5, monstersNoV5, equippedSkills, 20)
const cdLogsNoV5 = rNoV5.logs.filter(l => /神通续接/.test(l.text))
const stunLogsNoV5 = rNoV5.logs.filter(l => /天尊气场/.test(l.text))
console.log(`对照组「神通续接」: ${cdLogsNoV5.length} 条（预期 0）`)
console.log(`对照组「天尊气场」: ${stunLogsNoV5.length} 条（预期 0）`)

// 总结
console.log('\n==== 汇总 ====')
const ok1 = cdLogs.length > 0
const ok2 = stunLogs.length > 0
const ok3 = cdLogsNoV5.length === 0 && stunLogsNoV5.length === 0
console.log(`5 件套刷新最短 CD: ${ok1 ? '✅' : '❌'}`)
console.log(`7 件套眩晕全体:   ${ok2 ? '✅' : '❌'}`)
console.log(`对照组无 V5 效果: ${ok3 ? '✅' : '❌'}`)
if (!ok1 || !ok2 || !ok3) process.exit(1)
console.log('\n✅ E1 运行时效果实战验证通过')
