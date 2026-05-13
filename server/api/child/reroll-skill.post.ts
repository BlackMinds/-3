// 子女血脉功法重铸 - POST /api/child/reroll-skill
// body: { child_id, slot: 1|2|3|4, accept_new?: boolean }
// 消耗 bloodline_reroll_pill（血脉重铸丹）×1
// 按当前灵根 + 资质重抽指定槽位的血脉功法
// 旧/新可任选保留（前端弹窗确认，默认 accept_new=true）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildById } from '~/server/utils/child'
import { pickInnateSkill, getSkillSlotUnlockLevels, CHILD_SKILL_MAP } from '~/server/engine/childSkillData'
import type { ChildAptitude } from '~/server/engine/childTalentData'
import type { SpiritualRoot } from '~/server/engine/companionData'

const REROLL_PILL = 'bloodline_reroll_pill'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const childId = Number(body?.child_id)
    const slot = Number(body?.slot)
    const acceptNew = body?.accept_new !== false  // 默认接受

    if (!childId || ![1, 2, 3, 4].includes(slot)) {
      return { code: 400, message: '参数错误' }
    }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getChildById(pool, childId, char.id)
    if (!c) return { code: 404, message: '子女不存在' }
    if (c.has_left_home) return { code: 400, message: '已离家子女不可重铸' }

    // 校验槽位是否已解锁
    const unlockLevels = getSkillSlotUnlockLevels(c.aptitude as ChildAptitude)
    if (slot > unlockLevels.length) {
      return { code: 400, message: '该资质未解锁此槽位（圣品才有第 4 槽）' }
    }
    if (c.level < unlockLevels[slot - 1]) {
      return { code: 400, message: `该槽位需 Lv.${unlockLevels[slot - 1]} 才能解锁` }
    }

    const skills = Array.isArray(c.learned_skills) ? c.learned_skills : []
    const oldEntry = skills.find((s: any) => Number(s.slot) === slot)
    if (!oldEntry) return { code: 400, message: '该槽位无功法（请先升级解锁）' }

    // 检查丹库存
    const { rows: pillRows } = await pool.query(
      `SELECT COALESCE(SUM(count), 0)::int AS total FROM character_pills
        WHERE character_id = $1 AND pill_id = $2`,
      [char.id, REROLL_PILL]
    )
    if ((pillRows[0]?.total || 0) < 1) {
      return { code: 400, message: '血脉重铸丹不足（需 1 颗，可在红尘玉商店购买）' }
    }

    // 重抽
    const root = (c.spiritual_root || 'mixed') as SpiritualRoot | 'mixed'
    const newSkill = pickInnateSkill(root, c.aptitude as ChildAptitude)
    const oldSkillDef = CHILD_SKILL_MAP[oldEntry.skill_id]

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
        [char.id, REROLL_PILL]
      )

      if (acceptNew) {
        const newSkills = skills.map((s: any) =>
          Number(s.slot) === slot
            ? { skill_id: newSkill.id, level: 1, slot, type: 'innate' }
            : s
        )
        await client.query(
          'UPDATE children SET learned_skills = $1::jsonb WHERE id = $2',
          [JSON.stringify(newSkills), childId]
        )
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      message: acceptNew
        ? `重铸成功：${oldSkillDef?.name || '?'} → ${newSkill.name}（${newSkill.rarity}）`
        : `保留原功法 ${oldSkillDef?.name || '?'}（血脉重铸丹仍消耗）`,
      data: {
        slot,
        oldSkill: { id: oldEntry.skill_id, name: oldSkillDef?.name, rarity: oldSkillDef?.rarity },
        newSkill: { id: newSkill.id, name: newSkill.name, rarity: newSkill.rarity, description: newSkill.description, childType: newSkill.childType },
        accepted: acceptNew,
      },
    }
  } catch (error) {
    console.error('血脉重铸失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
