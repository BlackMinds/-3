import { getPool } from '~/server/database/db'
import { SKILL_MAP } from '~/server/engine/skillData'

const SKILL_TYPE_LABEL: Record<string, string> = {
  active: '主修',
  divine: '神通',
  passive: '被动',
}

// 同时支持 V4（大写如 ATK）与 V5（小写如 atk / wuxing_dmg / hp_pct_or_def_pct）
// lookup 统一转 lower-case
const STAT_LABEL: Record<string, string> = {
  // 基础四维
  atk: '攻击', def: '防御', hp: '气血', spd: '身法', spirit: '神识',
  atk_pct: '攻击', def_pct: '防御', hp_pct: '气血', spd_pct: '身法', spirit_pct: '神识',
  // 双向主属（V5 灵佩）
  hp_pct_or_def_pct: '气血/防御',
  // 会心 / 闪避 / 吸血 / 破甲 / 命中
  crit_rate: '会心率', crit_dmg: '会心伤害',
  dodge: '闪避', lifesteal: '吸血', armor_pen: '破甲',
  accuracy: '命中', accuracy_pct: '命中',
  // V5 五行强化（合并字段）
  wuxing_dmg: '五行强化',
  // V4 分五行强化
  metal_dmg: '金系强化', wood_dmg: '木系强化', water_dmg: '水系强化',
  fire_dmg: '火系强化', earth_dmg: '土系强化',
  // V4 五行抗性
  metal_res: '金系抗性', wood_res: '木系抗性', water_res: '水系抗性',
  fire_res: '火系抗性', earth_res: '土系抗性',
  // 控制概率 / 抗性
  ctrl_chance: '控制概率', ctrl_res: '控制抗性',
  // V5 通用抗性、减伤
  res_pct: '抗性', dmg_reduction: '减伤',
  // 福缘 / 灵气浓度
  luck: '福缘', luck_pct: '福缘',
  spirit_density: '灵气浓度', spirit_density_pct: '灵气浓度',
  // DOT / 反伤
  dot_dmg: 'DOT伤害', dot_dmg_pct: 'DOT伤害',
  reflect: '反伤倍率', reflect_pct: '反伤倍率',
}
// 显示时带 % 的 stat（小写，lookup 已 lower-case 化）
const PERCENT_STATS = new Set([
  // 四维百分比
  'atk_pct','def_pct','hp_pct','spd_pct','spirit_pct','hp_pct_or_def_pct',
  // 会心 / 闪避 / 吸血 / 破甲（V5 全是百分比）
  'crit_rate','crit_dmg','dodge','lifesteal','armor_pen',
  // 命中%（flat accuracy 不带 %）
  'accuracy_pct',
  // 五行强化 / 抗性
  'wuxing_dmg',
  'metal_dmg','wood_dmg','water_dmg','fire_dmg','earth_dmg',
  'metal_res','wood_res','water_res','fire_res','earth_res',
  'ctrl_chance','ctrl_res',
  'res_pct','dmg_reduction',
  // 福缘% / 灵气浓度%
  'luck_pct','spirit_density_pct',
  // DOT / 反伤
  'dot_dmg','dot_dmg_pct','reflect','reflect_pct',
])

function statText(stat: string, value: number): string {
  const key = String(stat || '').toLowerCase()
  const label = STAT_LABEL[key] || stat
  const pct = PERCENT_STATS.has(key) ? '%' : ''
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
