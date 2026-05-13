// 资质重铸 - POST /api/child/reroll-aptitude
// 消耗 fate_pill(夺天造化丹) ×1
// 重滚资质（受父母品质上限约束）, 保底: 新 < 旧 → 保留旧 (design v1.7)
// 资质变 → 重新生成血脉觉醒功法 + 重算 atk/def/max_hp/spd

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import {
  getChildById,
  generateChildAptitude,
  calcChildBaseStats,
  unlockSkillSlotsIfNeeded,
} from '~/server/utils/child'
import { CHILD_SKILL_MAP } from '~/server/engine/childSkillData'
import { APTITUDE_NAMES } from '~/server/utils/child'
import type { ChildAptitude } from '~/server/engine/childTalentData'
import type { SpiritualRoot, CompanionQuality } from '~/server/engine/companionData'

const FATE_PILL_ID = 'fate_pill'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const childId = Number(body?.child_id)
    if (!childId) return { code: 400, message: '参数错误' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getChildById(pool, childId, char.id)
    if (!c) return { code: 404, message: '子女不存在' }
    if (c.has_left_home) return { code: 400, message: '已离家子女不可重铸' }

    // 夺天造化丹检查
    const { rows: pillRows } = await pool.query(
      `SELECT COALESCE(SUM(count), 0)::int AS total FROM character_pills
        WHERE character_id = $1 AND pill_id = $2`,
      [char.id, FATE_PILL_ID]
    )
    if ((pillRows[0]?.total || 0) < 1) {
      return { code: 400, message: '夺天造化丹不足（需 1 个）' }
    }

    // 取道侣品质（决定资质上限）
    let companionQuality: CompanionQuality = (char.aptitude ?? 1) as CompanionQuality
    if (c.parent_companion_id) {
      const { rows: cmpRows } = await pool.query(
        'SELECT quality FROM companions WHERE id = $1',
        [c.parent_companion_id]
      )
      if (cmpRows[0]) companionQuality = cmpRows[0].quality as CompanionQuality
    }

    // 重滚资质
    const newApt = generateChildAptitude(char.aptitude || 1, companionQuality)

    // 保底：新 < 旧 → 保留旧
    let finalAptitude: ChildAptitude = c.aptitude as ChildAptitude
    let finalAwakened = c.awakened
    let kept = false
    if (newApt.aptitude > c.aptitude) {
      finalAptitude = newApt.aptitude
      finalAwakened = newApt.awakened
    } else {
      kept = true
    }

    // 重生 innate skills（V2 改版：资质丹按新资质 + 当前等级重新生成所有应解锁槽位）
    const root = (c.spiritual_root === 'mixed' ? 'mixed' : c.spiritual_root) as SpiritualRoot | 'mixed'

    // 按 当前 level 重算属性
    const newStats = calcChildBaseStats(finalAptitude, c.level)

    // 资质变化后槽位也按新资质重生（圣品多 1 槽）
    const { learnedSkills: newSkills } = unlockSkillSlotsIfNeeded(
      c.level, finalAptitude, root, []
    )

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 扣丹
      await client.query(
        `UPDATE character_pills SET count = count - 1
          WHERE character_id = $1 AND pill_id = $2 AND count > 0
            AND ctid = (SELECT ctid FROM character_pills
                         WHERE character_id = $1 AND pill_id = $2 AND count > 0
                         LIMIT 1)`,
        [char.id, FATE_PILL_ID]
      )

      // 更新子女（含二级属性）
      await client.query(
        `UPDATE children
            SET aptitude = $1, awakened = $2,
                max_hp = $3, atk = $4, def = $5, spd = $6,
                crit_rate = $7, crit_dmg = $8, dodge = $9, lifesteal = $10, spirit = $11, resist_ctrl = $12,
                learned_skills = $13::jsonb,
                avatar_id = $14
          WHERE id = $15`,
        [
          finalAptitude, finalAwakened,
          newStats.maxHp, newStats.atk, newStats.def, newStats.spd,
          newStats.critRate, newStats.critDmg, newStats.dodge, newStats.lifesteal, newStats.spirit, newStats.resistCtrl,
          JSON.stringify(newSkills),
          `child_${c.gender}_${finalAptitude}`,
          childId,
        ]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      message: kept
        ? `重铸结果 ${APTITUDE_NAMES[newApt.aptitude]} 不及原 ${APTITUDE_NAMES[c.aptitude]}，按保底保留原资质`
        : `重铸成功：${APTITUDE_NAMES[c.aptitude]} → ${APTITUDE_NAMES[finalAptitude]}`,
      data: {
        kept,
        oldAptitude: c.aptitude,
        rolledAptitude: newApt.aptitude,
        finalAptitude,
        awakened: finalAwakened,
        // V2 改版：资质丹现在重生所有应解锁槽位的功法，列表化展示
        newSkillIds: newSkills.map(s => s.skill_id),
        newSkillName: newSkills.map(s => CHILD_SKILL_MAP[s.skill_id]?.name || s.skill_id).join(' / '),
        newStats,
      },
    }
  } catch (error) {
    console.error('资质重铸失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
