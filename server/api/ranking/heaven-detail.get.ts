import { getPool } from '~/server/database/db'
import { SKILL_MAP } from '~/server/engine/skillData'

const SKILL_TYPE_LABEL: Record<string, string> = {
  active: '主修',
  divine: '神通',
  passive: '被动',
}

const STAT_LABEL: Record<string, string> = {
  ATK: '攻击', DEF: '防御', HP: '气血', SPD: '身法',
  ATK_PCT: '攻击', DEF_PCT: '防御', HP_PCT: '气血', SPD_PCT: '身法', SPIRIT_PCT: '神识',
  CRIT_RATE: '会心率', CRIT_DMG: '会心伤害',
  SPIRIT: '神识', ARMOR_PEN: '破甲', ACCURACY: '命中',
  METAL_DMG: '金系强化', WOOD_DMG: '木系强化', WATER_DMG: '水系强化',
  FIRE_DMG: '火系强化', EARTH_DMG: '土系强化',
  // v4.0 五行抗性
  METAL_RES: '金系抗性', WOOD_RES: '木系抗性', WATER_RES: '水系抗性',
  FIRE_RES: '火系抗性', EARTH_RES: '土系抗性',
  // v4.0 控制概率/抗性
  CTRL_CHANCE: '控制概率', CTRL_RES: '控制抗性',
  SPIRIT_DENSITY: '灵气浓度', LUCK: '福缘',
  DODGE: '闪避', LIFESTEAL: '吸血',
  DOT_DMG_PCT: 'DOT伤害', REFLECT_PCT: '反伤倍率',
}
const PERCENT_STATS = new Set([
  'CRIT_RATE','CRIT_DMG','ARMOR_PEN','ACCURACY',
  'METAL_DMG','WOOD_DMG','WATER_DMG','FIRE_DMG','EARTH_DMG',
  'METAL_RES','WOOD_RES','WATER_RES','FIRE_RES','EARTH_RES',
  'CTRL_CHANCE','CTRL_RES','SPIRIT_PCT',
  'SPIRIT_DENSITY','LUCK','DODGE','LIFESTEAL',
  'ATK_PCT','DEF_PCT','HP_PCT','SPD_PCT','DOT_DMG_PCT','REFLECT_PCT',
])

function statText(stat: string, value: number): string {
  const label = STAT_LABEL[stat] || stat
  const pct = PERCENT_STATS.has(stat) ? '%' : ''
  return `${label} +${value}${pct}`
}

function parseJson(raw: any): any {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const characterId = Number(query.characterId)
    if (!characterId || Number.isNaN(characterId)) {
      return { code: 400, message: '缺少 characterId' }
    }

    const pool = getPool()

    const { rows: equipRows } = await pool.query(
      `SELECT slot, base_slot, weapon_type, name, rarity,
              primary_stat, primary_value, primary_stat_2, primary_value_2,
              sub_stats, awaken_effect, enhance_level, tier
         FROM character_equipment
        WHERE character_id = $1 AND slot IS NOT NULL
        ORDER BY slot ASC`,
      [characterId]
    )

    const equipments = equipRows.map(r => {
      const subs = parseJson(r.sub_stats) || []
      const awaken = parseJson(r.awaken_effect)
      return {
        slot: r.slot,
        baseSlot: r.base_slot || r.slot,
        weaponType: r.weapon_type || null,
        name: r.name,
        rarity: r.rarity,
        tier: r.tier || 1,
        enhance: r.enhance_level || 0,
        primaryText: statText(r.primary_stat, r.primary_value),
        // v4.0: 属性2（固定，不受强化影响）
        primaryText2: r.primary_stat_2 ? statText(r.primary_stat_2, r.primary_value_2) : null,
        subTexts: Array.isArray(subs) ? subs.map((s: any) => statText(s.stat, s.value)) : [],
        awakenName: awaken?.name || null,
      }
    })

    const { rows: skillRows } = await pool.query(
      `SELECT cs.skill_id, cs.skill_type, cs.slot_index,
              COALESCE(csi.level, cs.level, 1) AS level
         FROM character_skills cs
         LEFT JOIN character_skill_inventory csi
                ON csi.character_id = cs.character_id AND csi.skill_id = cs.skill_id
        WHERE cs.character_id = $1 AND cs.equipped = TRUE
        ORDER BY
          CASE cs.skill_type WHEN 'active' THEN 0 WHEN 'divine' THEN 1 ELSE 2 END,
          cs.slot_index ASC`,
      [characterId]
    )

    const skills = skillRows.map(r => {
      const meta = SKILL_MAP[r.skill_id]
      return {
        skillId: r.skill_id,
        skillType: r.skill_type,
        skillTypeLabel: SKILL_TYPE_LABEL[r.skill_type] || r.skill_type,
        slotIndex: r.slot_index,
        level: r.level,
        name: meta?.name || r.skill_id,
        rarity: meta?.rarity || 'white',
        element: meta?.element || null,
      }
    })

    return { code: 200, data: { equipments, skills } }
  } catch (error) {
    console.error('通天榜详情查询失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
