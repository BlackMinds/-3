// 放弃子女 - POST /api/child/abandon
// body: { child_id }
// 消耗 灵石（按境界缩放）
// 流程：扣灵石 / 若助战则清 battling_child_id / 写 child_abandon_history / DELETE 子女
// 离家子女被放弃 → permanent_buff_pct 一并消失（不转存到本体）
// 设计文档 system-companion.md 5.10

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildById } from '~/server/utils/child'

// 灵石代价 = 5000 × 50 × max(1, realmTier - 2)
// tier3 金丹=25万 / tier4 元婴=50万 / tier5 化神=75万 / tier6 炼虚=100万
// 设为和离代价的一半，子女较道侣"易割舍"
function calcAbandonStoneCost(realmTier: number): number {
  const base = 5000
  const tierMul = Math.max(1, realmTier - 2)
  return base * 50 * tierMul
}

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

    // 灵石检查
    const stoneCost = calcAbandonStoneCost(char.realm_tier)
    if (Number(char.spirit_stone) < stoneCost) {
      return { code: 400, message: `灵石不足，需 ${stoneCost.toLocaleString()}` }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. 扣灵石
      await client.query(
        'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2',
        [stoneCost, char.id]
      )

      // 2. 若该子女正在助战 → 清掉 characters.battling_child_id
      await client.query(
        `UPDATE characters SET battling_child_id = NULL
          WHERE id = $1 AND battling_child_id = $2`,
        [char.id, childId]
      )

      // 3. 写历史表（含被放弃前的 buff 快照，仅做记录）
      await client.query(
        `INSERT INTO child_abandon_history
           (character_id, child_name, aptitude, level, stage, permanent_buff_pct, had_left_home)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [char.id, c.name, c.aptitude, c.level, c.stage, c.permanent_buff_pct || 0, !!c.has_left_home]
      )

      // 4. DELETE 子女（child_equipment 通过 ON DELETE CASCADE 一并清掉）
      await client.query('DELETE FROM children WHERE id = $1', [childId])

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      message: `已放弃「${c.name}」，缘尽于此`,
      data: {
        childId,
        stoneCost,
      },
    }
  } catch (error) {
    console.error('放弃子女失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
