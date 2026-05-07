/**
 * 验证套装效果在 PvP / team 引擎里能被正确触发
 *
 * 跑法：npx tsx test/sim-set-pvp.ts
 */
import { runPvpBattle, type PvpFighterInput } from '~/server/engine/multiBattleEngine'
import { runTeamBattle, type TeamPlayerInput } from '~/server/engine/teamBattleEngine'
import type { BattlerStats } from '~/server/engine/battleEngine'

function mkStats(name: string, opts: { setCounts?: Record<string, number>; weaponType?: string | null; element?: string }): BattlerStats {
  return {
    name,
    maxHp: 50000, hp: 50000,
    atk: 4000, def: 600, spd: 100,
    crit_rate: 0.20, crit_dmg: 1.8,
    dodge: 0.05, lifesteal: 0,
    element: opts.element || 'metal',
    resists: { metal: 0.05, wood: 0.05, water: 0.05, fire: 0.05, earth: 0.05, ctrl: 0.10 },
    spiritualRoot: opts.element || 'metal',
    armorPen: 0, accuracy: 0,
    elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    spirit: 50,
    // 套装信息（buildSetEffects 解析）
    equipSetCounts: opts.setCounts || {},
    weaponType: opts.weaponType || null,
  } as any
}

function mkInput(name: string, opts: { setCounts?: Record<string, number>; weaponType?: string | null; element?: string }): PvpFighterInput {
  return {
    characterId: Math.floor(Math.random() * 10000),
    stats: mkStats(name, opts),
    equippedSkills: {
      activeSkill: { name: '基础剑法', multiplier: 1.0, element: opts.element || 'metal' },
      divineSkills: [
        { name: '万剑归宗', multiplier: 3.5, element: 'metal', cdTurns: 4 } as any,
      ],
      passiveEffects: {
        atkPercent: 0, defPercent: 0, hpPercent: 0, spdPercent: 0,
        critRate: 0, critDmg: 0, dodge: 0, lifesteal: 0,
        resistFire: 0, resistWater: 0, resistWood: 0, resistMetal: 0, resistEarth: 0, resistCtrl: 0,
        regenPerTurn: 0, damageReductionFlat: 0, reflectPercent: 0, skillCdReduction: 0,
      } as any,
    },
  }
}

console.log('=== PvP 1v1：A 装十三枪 vs B 裸装 ===')
const pvpResult = runPvpBattle(
  [mkInput('霸枪剑客', { setCounts: { thirteen_spear: 5 }, weaponType: 'spear' })],
  [mkInput('裸装路人', {})],
  { maxTurns: 15, sideAName: '霸枪方', sideBName: '裸装方' },
)
const setLogs = pvpResult.logs.filter(l => l.type === 'set' || l.text.includes('❖'))
console.log(`总日志: ${pvpResult.logs.length} 条，套装相关: ${setLogs.length} 条`)
for (const l of setLogs.slice(0, 20)) console.log('  ' + l.text)
console.log(`胜方: ${pvpResult.winnerSide === 'a' ? '霸枪方' : '裸装方'} (${pvpResult.totalTurns} 回合)`)

console.log('\n=== PvP 2v2：A 装火神 vs B 裸装 ===')
const pvpTeam = runPvpBattle(
  [
    mkInput('焚天甲', { setCounts: { fire_god: 5 }, element: 'fire' }),
    mkInput('焚天乙', { setCounts: { fire_god: 3 }, element: 'fire' }),
  ],
  [
    mkInput('路人甲', {}),
    mkInput('路人乙', {}),
  ],
  { maxTurns: 20 },
)
const setLogs2 = pvpTeam.logs.filter(l => l.type === 'set' || l.text.includes('❖'))
console.log(`总日志: ${pvpTeam.logs.length} 条，套装相关: ${setLogs2.length} 条`)
for (const l of setLogs2.slice(0, 15)) console.log('  ' + l.text)
console.log(`胜方: ${pvpTeam.winnerSide} (${pvpTeam.totalTurns} 回合)`)

console.log('\n=== team 引擎：秘境组队战 ===')
// 简化测试 — team 引擎结构复杂，仅验证 setEffects 字段被正确解析（不跑完整战斗）
import { runTeamBattle as runTeam } from '~/server/engine/teamBattleEngine'
import { getSecretRealm } from '~/server/engine/secretRealmData'
const realm = getSecretRealm('SR-1')
if (!realm) {
  console.log('  跳过 — 秘境 rusty_grave 未找到')
} else {
  const teamInput: TeamPlayerInput = {
    characterId: 1,
    name: '火神秘境玩家',
    spiritualRoot: 'metal',
    sectId: null,
    stats: mkStats('火神秘境玩家', { setCounts: { fire_god: 3 }, weaponType: 'sword', element: 'metal' }),
    equippedSkills: {
      activeSkill: { name: '基础剑法', multiplier: 1.0, element: 'metal' },
      divineSkills: [{ name: '万剑归宗', multiplier: 3.5, element: 'metal', cdTurns: 4 } as any],
      passiveEffects: {
        atkPercent: 0, defPercent: 0, hpPercent: 0, spdPercent: 0,
        critRate: 0, critDmg: 0, dodge: 0, lifesteal: 0,
        resistFire: 0, resistWater: 0, resistWood: 0, resistMetal: 0, resistEarth: 0, resistCtrl: 0,
        regenPerTurn: 0, damageReductionFlat: 0, reflectPercent: 0, skillCdReduction: 0,
      } as any,
    },
  }
  const teamResult = runTeam(realm, 1, [teamInput])
  const teamSetLogs = teamResult.logs.filter(l => l.text.includes('套装激活') || l.text.includes('【火神套】'))
  console.log(`team 引擎套装日志: ${teamSetLogs.length} 条`)
  for (const l of teamSetLogs.slice(0, 10)) console.log('  ' + l.text)
}

// ====== v2 新增 4 套验证 ======

console.log('\n=== v2 验证 1：剑仙套（PvP）— 期待每次主攻触发 N 次剑气 ===')
const swordResult = runPvpBattle(
  [mkInput('剑仙', { setCounts: { sword_immortal: 5 }, weaponType: 'sword' })],
  [mkInput('靶', { element: 'fire' }), mkInput('靶2', { element: 'fire' })],
  { maxTurns: 6 }
)
const swordQiLogs = swordResult.logs.filter(l => l.text.includes('剑气'))
console.log(`剑气日志: ${swordQiLogs.length} 条`)
for (const l of swordQiLogs.slice(0, 6)) console.log('  ' + l.text)

console.log('\n=== v2 验证 2：刀狂套（PvP）— 期待非会心叠加 / 会心清零 ===')
const bladeResult = runPvpBattle(
  [mkInput('刀狂', { setCounts: { blade_madness: 5 }, weaponType: 'blade' })],
  [mkInput('靶', { element: 'fire' })],
  { maxTurns: 12 }
)
const bladeLogs = bladeResult.logs.filter(l => l.text.includes('刀狂'))
console.log(`刀狂日志: ${bladeLogs.length} 条`)
for (const l of bladeLogs.slice(0, 6)) console.log('  ' + l.text)

console.log('\n=== v2 验证 3：天机套（PvP）— 期待神通后追加额外段 ===')
const fanResult = runPvpBattle(
  [mkInput('天机', { setCounts: { fan_master: 7 }, weaponType: 'fan' })],
  [mkInput('靶', { element: 'fire' })],
  { maxTurns: 8 }
)
const fanLogs = fanResult.logs.filter(l => l.text.includes('天机'))
console.log(`天机日志: ${fanLogs.length} 条`)
for (const l of fanLogs.slice(0, 6)) console.log('  ' + l.text)

console.log('\n=== v2 验证 4：回归基本功（PvP）— 期待禁神通 + 主修变 AOE ===')
const basicResult = runPvpBattle(
  [mkInput('归一', { setCounts: { basic_back: 7 } })],
  [mkInput('靶1', {}), mkInput('靶2', {}), mkInput('靶3', {})],
  { maxTurns: 6 }
)
const basicLogs = basicResult.logs.filter(l => l.text.includes('本源') || l.text.includes('回归基本功') || l.text.includes('套装激活'))
console.log(`基本功相关日志: ${basicLogs.length} 条`)
for (const l of basicLogs.slice(0, 6)) console.log('  ' + l.text)
// 关键验证：归一不应释放神通（万剑归宗是其神通，禁用后不应出现）
const myDivineLogs = basicResult.logs.filter(l => l.text.includes('归一 施展【万剑归宗】') || l.text.includes('归一 【万剑归宗】'))
if (myDivineLogs.length > 0) console.error(`  ❌ basicBackBanDivine 失效，归一神通日志 ${myDivineLogs.length} 条`)
else console.log('  ✅ 归一未释放神通（被禁用）')
// 关键验证：归一主修攻击应触发 AOE
const myAoeLogs = basicResult.logs.filter(l => l.text.includes('归一') && l.text.includes('全体'))
console.log(`  归一主修 AOE 日志：${myAoeLogs.length} 条`)
for (const l of myAoeLogs.slice(0, 4)) console.log('    ' + l.text)

