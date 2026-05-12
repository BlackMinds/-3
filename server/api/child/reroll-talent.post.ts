// 子女单天赋重铸 - POST /api/child/reroll-talent
// body: { child_id, slot_level: 20|40|60|80|100|120|140 }
// 消耗 reset_root（天道洗髓丹，项目现有道具）×1
// 按当前资质权重重滚单槽（无论新旧好坏都消耗一颗，保留旧选项靠前端弹窗）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildById } from '~/server/utils/child'
import { rollTalentByAptitude, CHILD_TALENT_MAP, type ChildAptitude } from '~/server/engine/childTalentData'

const RESET_PILL = 'reset_root'  // 项目现有"天道洗髓丹"，复用做天赋重铸
const VALID_SLOTS = [20, 40, 60, 80, 100, 120, 140]

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const childId = Number(body?.child_id)
    const slotLevel = Number(body?.slot_level)
    const acceptNew = body?.accept_new !== false   // 默认接受新天赋，前端可传 false 保留旧

    if (!childId || !VALID_SLOTS.includes(slotLevel)) {
      return { code: 400, message: '参数错误' }
    }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getChildById(pool, childId, char.id)
    if (!c) return { code: 404, message: '子女不存在' }
    if (c.has_left_home) return { code: 400, message: '已离家子女不可重铸' }
    if (c.level < slotLevel) return { code: 400, message: `该槽位需 Lv.${slotLevel} 才能觉醒` }

    const talents = Array.isArray(c.awakened_talents) ? c.awakened_talents : []
    const oldSlot = talents.find((t: any) => t.level === slotLevel)
    if (!oldSlot) return { code: 400, message: '该槽位尚未觉醒' }

    // 检查洗髓丹库存
    const { rows: pillRows } = await pool.query(
      `SELECT COALESCE(SUM(count), 0)::int AS total FROM character_pills
        WHERE character_id = $1 AND pill_id = $2`,
      [char.id, RESET_PILL]
    )
    if ((pillRows[0]?.total || 0) < 1) {
      return { code: 400, message: '天道洗髓丹不足（需 1 颗，可在红尘玉商店购买或仙玉商城）' }
    }

    // 滚新天赋
    const newTalent = rollTalentByAptitude(c.aptitude as ChildAptitude)
    const oldTalentDef = CHILD_TALENT_MAP[oldSlot.talent_id]

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
        [char.id, RESET_PILL]
      )

      // 决定是否替换
      if (acceptNew) {
        const newTalents = talents.map((t: any) =>
          t.level === slotLevel
            ? { level: slotLevel, talent_id: newTalent.id, rarity: newTalent.rarity }
            : t
        )
        await client.query(
          'UPDATE children SET awakened_talents = $1::jsonb WHERE id = $2',
          [JSON.stringify(newTalents), childId]
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
        ? `重铸成功：${oldTalentDef?.name || '?'} → ${newTalent.name}（${newTalent.rarity}）`
        : `保留原天赋 ${oldTalentDef?.name || '?'}（洗髓丹仍消耗）`,
      data: {
        slotLevel,
        oldTalent: { id: oldSlot.talent_id, name: oldTalentDef?.name, rarity: oldSlot.rarity },
        newTalent: { id: newTalent.id, name: newTalent.name, rarity: newTalent.rarity, description: newTalent.description },
        accepted: acceptNew,
      },
    }
  } catch (error) {
    console.error('天赋重铸失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
