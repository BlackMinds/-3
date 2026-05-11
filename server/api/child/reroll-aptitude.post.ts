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
} from '~/server/utils/child'
import { pickInnateSkill } from '~/server/engine/childSkillData'
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

    // 重生 innate skill（按新资质品质重选；若资质不变，仍重滚一次，玩家有概率换功法）
    const root = (c.spiritual_root === 'mixed' ? 'wood' : c.spiritual_root) as SpiritualRoot
    const newSkill = pickInnateSkill(root, finalAptitude)

    // 按 当前 level 重算属性
    const newStats = calcChildBaseStats(finalAptitude, c.level)

    // 保留原 learned_skills 中非 innate 的项（当前模型只有 innate 一项，但留口子）
    const oldSkills = Array.isArray(c.learned_skills) ? c.learned_skills : []
    const nonInnate = oldSkills.filter((s: any) => s.type !== 'innate')
    const newSkills = [
      { skill_id: newSkill.id, level: c.level, type: 'innate' },
      ...nonInnate,
    ]

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

      // 更新子女
      await client.query(
        `UPDATE children
            SET aptitude = $1, awakened = $2,
                max_hp = $3, atk = $4, def = $5, spd = $6,
                learned_skills = $7::jsonb,
                avatar_id = $8
          WHERE id = $9`,
        [
          finalAptitude, finalAwakened,
          newStats.maxHp, newStats.atk, newStats.def, newStats.spd,
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
        newSkillId: newSkill.id,
        newSkillName: newSkill.name,
        newStats,
      },
    }
  } catch (error) {
    console.error('资质重铸失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
