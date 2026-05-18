// 木桩演武场战斗：仅用于属性测试。
// - 木桩属性来自前端 body.dummy_stats（用户自定义）
// - 木桩 role=dummy，技能池为空，runWaveBattle 自动走普通攻击 fallback
// - 无奖励、无掉落、不写 DB（不动 cultivation_exp / spirit_stone / battle_end_at 等）
// - 输出与 /battle/fight 相同的 battles[] 格式，前端直接复用 applyBattleEntry 播放
import { getPool } from '~/server/database/db'
import {
  buildEquippedSkillInfo,
  buildMonsterSkillDescriptions,
  runWaveBattle,
  type BattlerStats,
  type MonsterTemplate,
} from '~/server/engine/battleEngine'
import { buildPlayerStats } from '~/server/api/battle/fight.post'
import { getCompanionSealPct } from '~/server/utils/companion'
import { getPokedexBonus } from '~/server/utils/pokedex'

interface DummyStatsInput {
  maxHp?: number
  atk?: number
  def?: number
  spd?: number
  crit_rate?: number
  crit_dmg?: number
  dodge?: number
  armorPen?: number
  accuracy?: number
  element?: string | null
}

function clampNonNegInt(n: any, fallback: number, max: number = 1e15): number {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return fallback
  return Math.min(max, Math.floor(v))
}
function clampPct(n: any, fallback: number, max: number = 1): number {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return fallback
  return Math.min(max, v)
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const input: DummyStatsInput = body?.dummy_stats || {}

    const { rows: charRows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [event.context.userId])
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const char = charRows[0]
    if (char.offline_start) return { code: 400, message: '离线挂机中，请先结束离线' }

    const { rows: equipRows } = await pool.query('SELECT * FROM character_equipment WHERE character_id = $1', [char.id])
    const { rows: skillRows } = await pool.query(
      `SELECT cs.id, cs.character_id, cs.skill_id, cs.skill_type, cs.slot_index,
              cs.equipped, cs.created_at,
              COALESCE(csi.level, cs.level, 1) AS level
         FROM character_skills cs
         LEFT JOIN character_skill_inventory csi
                ON csi.character_id = cs.character_id AND csi.skill_id = cs.skill_id
        WHERE cs.character_id = $1 AND cs.equipped = TRUE
        ORDER BY cs.skill_type, cs.slot_index`,
      [char.id]
    )
    const { rows: buffRows } = await pool.query(
      'SELECT * FROM character_buffs WHERE character_id = $1 AND (expire_time > NOW() OR remaining_fights > 0)',
      [char.id]
    )
    const { rows: caveRows } = await pool.query('SELECT * FROM character_cave WHERE character_id = $1', [char.id])

    if (char.sect_id) {
      const { rows: sectRows } = await pool.query('SELECT level FROM sects WHERE id = $1', [char.sect_id])
      if (sectRows.length > 0) char._sectLevel = sectRows[0].level
      const { rows: sectSkillRows } = await pool.query(
        'SELECT skill_key, level FROM sect_skills WHERE character_id = $1 AND frozen = FALSE',
        [char.id]
      )
      char._sectSkills = sectSkillRows
    }

    // 道侣仙缘印记 buff（与 fight.post.ts 同口径）
    const sealPct = await getCompanionSealPct(pool, char.id)
    if (sealPct > 0) (char as any)._companion_seal_pct = sealPct

    // 妖兽图鉴加成（Phase 4）— buildPlayerStats 是同步，需外部预读后挂到 char
    ;(char as any)._pokedexBonus = await getPokedexBonus(char.id)

    const equippedSkills = buildEquippedSkillInfo(skillRows)
    const { stats: playerStats } = buildPlayerStats(char, equipRows, buffRows, caveRows, equippedSkills)

    // 构造木桩 BattlerStats（直接采纳玩家输入，跳过 generateMonsterStats）
    const validElements = new Set(['metal', 'wood', 'water', 'fire', 'earth'])
    const elem = input.element && validElements.has(input.element) ? input.element : null

    const dummyMaxHp = clampNonNegInt(input.maxHp, 100000)
    const dummyAtk = clampNonNegInt(input.atk, 0)
    const dummyDef = clampNonNegInt(input.def, 0)
    const dummySpd = clampNonNegInt(input.spd, 0, 1e6)
    const dummyCritRate = clampPct(input.crit_rate, 0, 1)
    const dummyCritDmg = Math.max(1, Math.min(10, Number(input.crit_dmg) || 1.5))
    const dummyDodge = clampPct(input.dodge, 0, 0.9)
    const dummyArmorPen = clampNonNegInt(input.armorPen, 0, 100)
    const dummyAccuracy = clampNonNegInt(input.accuracy, 0, 1000)

    const dummyStats: BattlerStats = {
      name: '木桩',
      maxHp: dummyMaxHp,
      hp: dummyMaxHp,
      atk: dummyAtk,
      def: dummyDef,
      spd: dummySpd,
      crit_rate: dummyCritRate,
      crit_dmg: dummyCritDmg,
      dodge: dummyDodge,
      lifesteal: 0,
      element: elem,
      resists: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 },
      armorPen: dummyArmorPen,
      accuracy: dummyAccuracy,
    }
    const dummyTemplate: MonsterTemplate = {
      name: '木桩',
      power: 0,
      element: elem,
      role: 'dummy',
      exp: 0,
      stone_min: 0,
      stone_max: 0,
      drop_table: 'dummy_t0',
    }

    const result = runWaveBattle(playerStats, [{ stats: dummyStats, template: dummyTemplate }], equippedSkills)

    const monstersInfo = [{
      name: dummyStats.name,
      element: dummyTemplate.element,
      power: 0,
      maxHp: dummyStats.maxHp,
      atk: dummyStats.atk,
      def: dummyStats.def,
      spd: dummyStats.spd,
      crit_rate: dummyStats.crit_rate,
      crit_dmg: dummyStats.crit_dmg,
      dodge: dummyStats.dodge,
      lifesteal: 0,
      armorPen: dummyStats.armorPen || 0,
      accuracy: dummyStats.accuracy || 0,
      resists: dummyStats.resists || null,
      role: dummyTemplate.role,
      skills: buildMonsterSkillDescriptions(dummyTemplate),
    }]

    const battle = {
      won: result.won,
      expGained: 0,
      stoneGained: 0,
      autoSellGained: 0,
      levelExpGained: 0,
      monsterNames: [dummyStats.name],
      monstersMaxHp: [dummyStats.maxHp],
      monsterInfo: monstersInfo[0],
      monstersInfo,
      logs: result.logs,
      drops: [],
    }

    return {
      code: 200,
      data: {
        battles: [battle],
        character: char,
        battleEndAt: 0,
        serverNow: Date.now(),
      },
    }
  } catch (err: any) {
    console.error('木桩战斗失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
