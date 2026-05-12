/**
 * Phase 2c-2 sim：玩家 buff / 反伤池 / 复活（不灭金身）
 * 用法：npx tsx test/sim-duo-buffs.ts
 */
import { runDuoWaveBattle, type DuoAssistInput } from '../server/engine/duoBattleEngine'
import type { BattlerStats, MonsterTemplate, EquippedSkillInfo, SkillRefInfo, ActiveBuff } from '../server/engine/battleEngine'

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

// === case 1: frenzyOpening (开场狂怒 → atk_up 4 回合 → 伤害变高) ===
{
  const player = mkStats('狂战', { maxHp: 5000, hp: 5000, atk: 200 })
  ;(player as any).awaken = { frenzyOpening: 0.3 }  // 开场 atk_up 30% 4 回合

  const assist = { stats: mkStats('小儿', { maxHp: 1500, atk: 80 }), innateSkill: null } as DuoAssistInput
  const tpl = {
    name: '木妖', power: 100, exp: 50, element: null,
    hp_min: 50000, hp_max: 50000, atk_min: 50, atk_max: 50, def_min: 30, def_max: 30,
    spd_min: 50, spd_max: 50, crit_rate: 0, crit_dmg: 1.5, dodge: 0,
    stone_min: 1, stone_max: 1, role: 'normal', drop_table: '',
  } as any
  const m = mkStats('木妖', { maxHp: 50000, hp: 50000, atk: 50, def: 30, spd: 50 })

  const result = runDuoWaveBattle(player, assist, [{ stats: m, template: tpl }],
    { divineSkills: [] } as any, 10)

  const t1Damage = result.logs.find(l => l.turn === 1 && /造成 \d+ 点伤害/.test(l.text) && /^\[第1回合\] 你/.test(l.text))?.text
  console.log('case 1 frenzyOpening 玩家 T1 伤害:', t1Damage)
  console.log('  → frenzyOpening 让 mul × 1.3，第 1 回合伤害应比裸值高 30%')
}

// === case 2: shield (注入 shield buff 吸收伤害) ===
{
  const player = mkStats('盾兵', { maxHp: 1000, hp: 1000, atk: 300, def: 50 })
  ;(player as any).preInjectBuff = { type: 'shield', remaining: 5, shieldHp: 5000 }

  const assist = { stats: mkStats('小', { maxHp: 0, atk: 0 }), innateSkill: null } as DuoAssistInput
  const tpl = {
    name: '猛兽', power: 100, exp: 50, element: null,
    hp_min: 30000, hp_max: 30000, atk_min: 800, atk_max: 800, def_min: 30, def_max: 30,
    spd_min: 50, spd_max: 50, crit_rate: 0, crit_dmg: 1.5, dodge: 0,
    stone_min: 1, stone_max: 1, role: 'normal', drop_table: '',
  } as any
  const m = mkStats('猛兽', { maxHp: 30000, hp: 30000, atk: 800, def: 30, spd: 50 })

  // 没有公开 API 注入 buff，直接 hack 进 awaken（实际游戏中 buff 是技能施放产生的）
  // 这里改用一个变通：用 frenzyOpening 注入 atk_up 不能产生 shield。直接修改运行时 player.buffs 不可能。
  // 改成：用具有 shield buff 的神通技能来施放。
  const shieldSkill: SkillRefInfo = {
    name: '金钟罩', multiplier: 0, cdTurns: 99, element: null,
    buff: { type: 'shield' as any, duration: 5, value: 16 },  // shieldHp = atk*16 = 4800
  }

  const result = runDuoWaveBattle(player, assist, [{ stats: m, template: tpl }],
    { divineSkills: [shieldSkill] } as any, 6)

  const shieldHit = result.logs.find(l => /【护盾】吸收/.test(l.text))?.text
  const shieldBuf = result.logs.find(l => /获得护盾/.test(l.text))?.text
  console.log('case 2 shield 注入:', shieldBuf)
  console.log('  shield 吸收日志:', shieldHit || '(未触发)')
}

// === case 3: revive (passiveEffects.reviveOnce → 不灭金身) ===
{
  const player = mkStats('脆皮', { maxHp: 500, hp: 500, atk: 100, def: 10 })

  const assist = { stats: mkStats('小', { maxHp: 0, atk: 0 }), innateSkill: null } as DuoAssistInput
  const tpl = {
    name: '巨灵', power: 100, exp: 50, element: null,
    hp_min: 50000, hp_max: 50000, atk_min: 2000, atk_max: 2000, def_min: 30, def_max: 30,
    spd_min: 50, spd_max: 50, crit_rate: 0, crit_dmg: 1.5, dodge: 0,
    stone_min: 1, stone_max: 1, role: 'normal', drop_table: '',
  } as any
  const m = mkStats('巨灵', { maxHp: 50000, hp: 50000, atk: 2000, def: 30, spd: 50 })

  const result = runDuoWaveBattle(player, assist, [{ stats: m, template: tpl }],
    { divineSkills: [], passiveEffects: { reviveOnce: true } } as any, 4)

  const reviveLog = result.logs.find(l => /不灭金身/.test(l.text))?.text
  console.log('case 3 不灭金身 触发:', reviveLog || '(未触发)')
}

// === case 4: reflect (副属性 equipReflectPct → 反伤池) ===
{
  const player = mkStats('坚甲', { maxHp: 8000, hp: 8000, atk: 200, def: 100 })
  ;(player as any).equipReflectPct = 0.5  // 50% 反伤池

  const assist = { stats: mkStats('小', { maxHp: 0, atk: 0 }), innateSkill: null } as DuoAssistInput
  const tpl = {
    name: '冲撞', power: 100, exp: 50, element: null,
    hp_min: 80000, hp_max: 80000, atk_min: 500, atk_max: 500, def_min: 30, def_max: 30,
    spd_min: 50, spd_max: 50, crit_rate: 0, crit_dmg: 1.5, dodge: 0,
    stone_min: 1, stone_max: 1, role: 'normal', drop_table: '',
  } as any
  const m = mkStats('冲撞', { maxHp: 80000, hp: 80000, atk: 500, def: 30, spd: 50 })

  const result = runDuoWaveBattle(player, assist, [{ stats: m, template: tpl }],
    { divineSkills: [] } as any, 5)

  const reflectLog = result.logs.find(l => /反伤】反弹.*伤害/.test(l.text))?.text
  console.log('case 4 反伤池 触发:', reflectLog || '(未触发)')
}
