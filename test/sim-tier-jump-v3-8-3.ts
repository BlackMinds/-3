/**
 * v3.8.3 跨 tier 跳幅 + 真实玩家胜率验证
 *
 * [1] 怪物 effective stats 表（验证每 tier ×1.85 跨幅设计目标）
 * [2] 完整玩家 sim：buildPlayerStats + runWaveBattle，包含
 *     装备/副属性/附灵/套装/丹药/宗门加成/洞府/技能（主修+神通+被动）
 *
 * 运行: npx tsx test/sim-tier-jump-v3-8-3.ts
 */
import {
  generateMonsterStats, runWaveBattle, buildEquippedSkillInfo, makeHealerTemplate,
  type BattlerStats, type MonsterTemplate,
} from '../server/engine/battleEngine'
import { rollSubStats } from '../server/utils/equipment'
import { EQUIP_PRIMARY_BASE, RARITY_STAT_MUL, getEquipTierWeight } from '../shared/balance'

// fight.post.ts 用 Nuxt 全局 defineEventHandler — mock 后 dynamic import
;(globalThis as any).defineEventHandler = (h: any) => h
;(globalThis as any).readBody = async (e: any) => e?.body
;(globalThis as any).getRouterParam = (e: any, k: string) => e?.context?.params?.[k]
const { buildPlayerStats } = await import('../server/api/battle/fight.post')

// ───────── 怪物模板 ─────────
const BOSSES: Record<number, MonsterTemplate> = {
  10: { name: '永恒之主',  power: 1_200_000,   element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'boss', drop_table: 'boss_t10' },
  11: { name: '鸿蒙帝君',  power: 4_500_000,   element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'boss', drop_table: 'boss_t11' },
  12: { name: '虚空之主',  power: 16_000_000,  element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'boss', drop_table: 'boss_t12' },
  13: { name: '万源道祖',  power: 70_000_000,  element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'boss', drop_table: 'boss_t13' },
  14: { name: '时空之主',  power: 220_000_000, element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'boss', drop_table: 'boss_t14' },
  15: { name: '终焉道祖',  power: 700_000_000, element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'boss', drop_table: 'boss_t15' },
}

const NORMAL_DPS: Record<number, MonsterTemplate> = {
  10: { name: '命运织者',  power: 375_000,     element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'dps', drop_table: 'uncommon_t10' },
  11: { name: '虚空圣使',  power: 1_850_000,   element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'dps', drop_table: 'uncommon_t11' },
  12: { name: '本源毁灭者', power: 6_700_000,  element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'dps', drop_table: 'uncommon_t12' },
  13: { name: '本源终焉',  power: 26_000_000,  element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'dps', drop_table: 'uncommon_t13' },
  14: { name: '裂界吞噬者', power: 78_000_000, element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'dps', drop_table: 'uncommon_t14' },
  15: { name: '末劫呼唤者', power: 260_000_000, element: null, exp: 0, stone_min: 0, stone_max: 0, role: 'dps', drop_table: 'uncommon_t15' },
}

function fmtNum(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + '万'
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// ───────── [1] 静态属性表 ─────────
console.log('═══════════════════════════════════════════════════════════════════════════')
console.log(' [1] 怪物 effective stats（generateMonsterStats 输出，50 次平均）')
console.log('═══════════════════════════════════════════════════════════════════════════')

function avgMonster(tpl: MonsterTemplate): { hp: number; atk: number; def: number } {
  let hp = 0, atk = 0, def = 0
  for (let i = 0; i < 50; i++) {
    const s = generateMonsterStats(tpl)
    hp += s.maxHp; atk += s.atk; def += s.def
  }
  return { hp: hp / 50, atk: atk / 50, def: def / 50 }
}

function printTable(label: string, src: Record<number, MonsterTemplate>) {
  console.log(`\n【${label}】`)
  console.log('Tier | HP            | ATK          | DEF          | HP↑/T | ATK↑/T | DEF↑/T')
  console.log('-----|---------------|--------------|--------------|-------|--------|-------')
  let prev: { hp: number; atk: number; def: number } | null = null
  for (const tier of [10, 11, 12, 13, 14, 15]) {
    const s = avgMonster(src[tier])
    const hpJ = prev ? (s.hp / prev.hp).toFixed(2) + 'x' : '—'
    const atkJ = prev ? (s.atk / prev.atk).toFixed(2) + 'x' : '—'
    const defJ = prev ? (s.def / prev.def).toFixed(2) + 'x' : '—'
    console.log(
      `T${String(tier).padEnd(3)}| ${fmtNum(s.hp).padEnd(14)}| ${fmtNum(s.atk).padEnd(13)}| ${fmtNum(s.def).padEnd(13)}| ${hpJ.padEnd(6)}| ${atkJ.padEnd(7)}| ${defJ}`
    )
    prev = s
  }
}

printTable('Boss', BOSSES)
printTable('Normal-DPS', NORMAL_DPS)

// ───────── [2] 完整玩家配置 ─────────
const SLOTS = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant'] as const
const PRIMARY_BY_SLOT: Record<string, string> = {
  weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD',
  treasure: 'ATK', ring: 'CRIT_DMG', pendant: 'SPIRIT',
}
// 红色附灵典型配置（每件一种，按部位分配）
const AWAKEN_BY_SLOT: Record<string, { stat: string; value: number }> = {
  weapon:  { stat: 'mainSkillMultBonus', value: 0.15 }, // 主修攻击 +15%
  armor:   { stat: 'damageReduction',    value: 0.08 }, // 减伤 8%
  helmet:  { stat: 'harmonyPct',         value: 0.08 }, // 攻防血同 +8%
  boots:   { stat: 'critRate',           value: 0.10 }, // 会心率 +10%
  treasure:{ stat: 'atkPct',             value: 0.12 }, // 攻击 +12%
  ring:    { stat: 'mainSkillCritRate',  value: 0.10 }, // 主修会心率 +10%
  pendant: { stat: 'lifesteal',          value: 0.06 }, // 吸血 +6%
}

function buildEquipRows(equipTier: number, charId: number): any[] {
  const rows: any[] = []
  const tw = getEquipTierWeight(equipTier)
  const qm = RARITY_STAT_MUL[5]  // 红 2.5
  const factor = tw * qm
  for (const slot of SLOTS) {
    const ps = PRIMARY_BY_SLOT[slot]
    const primaryValue = Math.max(1, Math.floor((EQUIP_PRIMARY_BASE[ps] || 30) * factor))
    const subStats = rollSubStats(5, equipTier, 4)  // 红装 4 条副词条
    const weaponType = slot === 'weapon' ? 'sword' : null
    rows.push({
      id: rows.length + 1,
      character_id: charId,
      slot,                         // 已穿戴
      base_slot: slot,
      weapon_type: weaponType,
      name: `T${equipTier}红装-${slot}`,
      rarity: 'red',
      primary_stat: ps,
      primary_value: primaryValue,
      sub_stats: JSON.stringify(subStats),
      awaken_effect: JSON.stringify(AWAKEN_BY_SLOT[slot]),
      set_id: 'fire_god',          // 4 件套：火神
      enhance_level: 10,           // +10 满强化（×2.0 主属性）
      req_level: 1,
    })
  }
  return rows
}

// 丹药 buff（高级 + 基础组合）
function buildBuffRows(charId: number): any[] {
  const future = new Date(Date.now() + 86400_000)  // 1 天后过期
  return [
    { id: 1, character_id: charId, pill_id: 'elite_atk_pill', quality_factor: 1.0, expire_time: future, remaining_fights: 100 },
    { id: 2, character_id: charId, pill_id: 'elite_def_pill', quality_factor: 1.0, expire_time: future, remaining_fights: 100 },
    { id: 3, character_id: charId, pill_id: 'elite_hp_pill',  quality_factor: 1.0, expire_time: future, remaining_fights: 100 },
    { id: 4, character_id: charId, pill_id: 'basic_crit_pill', quality_factor: 1.0, expire_time: future, remaining_fights: 100 },
  ]
}

// 洞府演武堂 lv 5（仅加 expBonus，对战斗力影响小）
function buildCaveRows(charId: number): any[] {
  return [{ id: 1, character_id: charId, building_id: 'martial_hall', level: 5 }]
}

// 技能行（红色主修 + 紫色神通×3 + 红色被动×2，全 lv 5）
function buildSkillRows(charId: number): any[] {
  return [
    { id: 1, character_id: charId, skill_id: 'heavenly_wrath',         skill_type: 'active',  slot_index: 0, level: 5, equipped: true },
    { id: 2, character_id: charId, skill_id: 'sword_storm',            skill_type: 'divine',  slot_index: 0, level: 5, equipped: true },
    { id: 3, character_id: charId, skill_id: 'twin_flame',             skill_type: 'divine',  slot_index: 1, level: 5, equipped: true },
    { id: 4, character_id: charId, skill_id: 'blood_fury',             skill_type: 'divine',  slot_index: 2, level: 5, equipped: true },
    { id: 5, character_id: charId, skill_id: 'dao_heart',              skill_type: 'passive', slot_index: 0, level: 5, equipped: true },
    { id: 6, character_id: charId, skill_id: 'five_elements_harmony', skill_type: 'passive', slot_index: 1, level: 5, equipped: true },
  ]
}

// 角色对象
function buildChar(equipTier: number): any {
  // 等级按 equipTier 阶梯分配（与 fight.post.ts req_level 对齐）
  // 境界顶点是 tier 9 (混元) stage 5 (无极) — REALM_BONUSES 只到 tier 9
  const LEVELS: Record<number, number>      = { 10: 200, 11: 230, 12: 255, 13: 280, 14: 305, 15: 325 }
  const REALM_TIER: Record<number, number>  = { 10: 8,   11: 9,   12: 9,   13: 9,   14: 9,   15: 9   }
  const REALM_STAGE: Record<number, number> = { 10: 10,  11: 3,   12: 5,   13: 5,   14: 5,   15: 5   }
  // 顶级毕业号配置 — 道果 50% + 高 base（修补 sim 单纯走"装备+境界"无法达到实战水平的差距）
  return {
    id: 1, name: `Player T${equipTier}`,
    level: LEVELS[equipTier], realm_tier: REALM_TIER[equipTier], realm_stage: REALM_STAGE[equipTier],
    spiritual_root: 'metal',
    max_hp: 50000, hp: 50000, atk: 3000, def: 1500, spd: 200,
    crit_rate: 0.20, crit_dmg: 2.0, dodge: 0.10, lifesteal: 0.03, spirit: 200,
    resist_metal: 0.15, resist_wood: 0.15, resist_water: 0.15, resist_fire: 0.15, resist_earth: 0.15, resist_ctrl: 0.30,
    permanent_atk_pct: 80, permanent_def_pct: 80, permanent_hp_pct: 80,
    sect_id: 1,
    _sectLevel: 10,                     // 顶级宗门（atkBonus/defBonus/expBonus 加成）
    _sectSkills: [
      { skill_key: 'sect_spirit',   level: 5 },
      { skill_key: 'sect_hp',       level: 5 },
      { skill_key: 'sect_armor_pen', level: 5 },
      { skill_key: 'sect_all',      level: 5 },
    ],
  }
}

function buildPlayer(equipTier: number): { stats: BattlerStats; skills: any } {
  const char = buildChar(equipTier)
  const equipRows = buildEquipRows(equipTier, char.id)
  const buffRows = buildBuffRows(char.id)
  const caveRows = buildCaveRows(char.id)
  const skillRows = buildSkillRows(char.id)
  const { stats } = buildPlayerStats(char, equipRows, buffRows, caveRows)
  const skills = buildEquippedSkillInfo(skillRows)
  return { stats, skills }
}

// ───────── [2] 跑战斗 sim ─────────
console.log('\n═══════════════════════════════════════════════════════════════════════════')
console.log(' [2] 完整玩家 sim — 装备 + 副词条 + 红附灵 + 火神 4 件套 + 高级丹药 + 宗门 lv10 + 演武堂 lv5')
console.log('═══════════════════════════════════════════════════════════════════════════')

function simBoss(playerTier: number, bossTier: number, runs: number): { winRate: number; avgWonTurns: number } {
  const { stats: pStats, skills } = buildPlayer(playerTier)
  let wins = 0, wonTurns = 0
  for (let i = 0; i < runs; i++) {
    const monster = generateMonsterStats(BOSSES[bossTier])
    const playerCopy: BattlerStats = { ...pStats, hp: pStats.maxHp }
    const result = runWaveBattle(playerCopy, [{ stats: monster, template: BOSSES[bossTier] }], skills)
    if (result.won) {
      wins++
      const turns = result.logs[result.logs.length - 1]?.turn ?? 0
      wonTurns += turns
    }
  }
  return { winRate: wins / runs, avgWonTurns: wins > 0 ? wonTurns / wins : 0 }
}

function simWave(playerTier: number, mapTier: number, runs: number): { winRate: number; avgTurns: number } {
  const { stats: pStats, skills } = buildPlayer(playerTier)
  let wins = 0, totalTurns = 0
  for (let i = 0; i < runs; i++) {
    // wave: 2 个 dps + 1 个 healer (T5+ 默认配置)
    const tpl = NORMAL_DPS[mapTier]
    const monsterList = [
      { stats: generateMonsterStats(tpl), template: tpl },
      { stats: generateMonsterStats(tpl), template: tpl },
      (() => {
        const ht = makeHealerTemplate(mapTier, null, tpl.power)
        return { stats: generateMonsterStats(ht), template: ht }
      })(),
    ]
    const playerCopy: BattlerStats = { ...pStats, hp: pStats.maxHp }
    const result = runWaveBattle(playerCopy, monsterList, skills)
    if (result.won) wins++
    totalTurns += result.logs[result.logs.length - 1]?.turn ?? 0
  }
  return { winRate: wins / runs, avgTurns: totalTurns / runs }
}

const RUNS = 200

console.log('\n— 装备同 tier 的 BOSS 战 —')
for (const t of [10, 11, 12, 13, 14, 15]) {
  const r = simBoss(t, t, RUNS)
  const { stats } = buildPlayer(t)
  console.log(
    `T${t} 玩家 vs T${t} Boss: 胜率 ${(r.winRate * 100).toFixed(1)}%, 胜场均回合 ${r.avgWonTurns.toFixed(1)} ` +
    `(玩家 ATK ${fmtNum(stats.atk)} / DEF ${fmtNum(stats.def)} / HP ${fmtNum(stats.maxHp)})`
  )
}

console.log('\n— 拿 T10 装备硬挑高 tier BOSS —')
for (const t of [11, 12, 13, 14, 15]) {
  const r = simBoss(10, t, RUNS)
  console.log(`T10 玩家 vs T${t} Boss: 胜率 ${(r.winRate * 100).toFixed(1)}%, 胜场均回合 ${r.avgWonTurns.toFixed(1)}`)
}

console.log('\n— 装备同 tier 的普通历练 wave (2 dps + 1 healer) —')
for (const t of [10, 11, 12, 13, 14, 15]) {
  const r = simWave(t, t, RUNS)
  console.log(`T${t} 玩家 vs T${t} 历练 wave: 胜率 ${(r.winRate * 100).toFixed(1)}%, 平均回合 ${r.avgTurns.toFixed(1)}`)
}

console.log('\n— 拿 T10 装备硬刷高 tier wave —')
for (const t of [11, 12, 13, 14, 15]) {
  const r = simWave(10, t, RUNS)
  console.log(`T10 玩家 vs T${t} 历练 wave: 胜率 ${(r.winRate * 100).toFixed(1)}%, 平均回合 ${r.avgTurns.toFixed(1)}`)
}

console.log('\n— 装备跨档：T11 / T12 / T13 装备打 T14 —')
for (const pt of [11, 12, 13, 14]) {
  const rW = simWave(pt, 14, RUNS)
  const rB = simBoss(pt, 14, RUNS)
  console.log(`T${pt} 玩家 vs T14: wave 胜率 ${(rW.winRate * 100).toFixed(1)}% / Boss 胜率 ${(rB.winRate * 100).toFixed(1)}%`)
}

console.log('')
console.log('═══════════════════════════════════════════════════════════════════════════')
console.log(' 期望:')
console.log('   同档应 60-90% 胜率(留挑战感)；跨 1 tier 胜率应明显下降；T10 打 T14 应接近 0%')
console.log('═══════════════════════════════════════════════════════════════════════════')
