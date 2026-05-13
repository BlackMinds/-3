// 召回外出历练子女 - POST /api/child/recall-home
// body: { child_id }
// 把 has_left_home 改回 FALSE，permanent_buff_pct 保留（已积攒的加成不清零）
// 召回后子女可重新被设为助战；下一次成年选择再次外出历练仍从当前 buff 继续累积

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildById } from '~/server/utils/child'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const childId = Number(body?.child_id)

    if (!childId) {
      return { code: 400, message: '参数错误' }
    }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getChildById(pool, childId, char.id)
    if (!c) return { code: 404, message: '子女不存在' }
    if (!c.has_left_home) return { code: 400, message: '该子女并未外出历练' }

    await pool.query(
      `UPDATE children
          SET has_left_home = FALSE,
              last_visit_at = NULL
        WHERE id = $1`,
      [childId]
    )

    const pct = (Number(c.permanent_buff_pct) * 100).toFixed(1)
    return {
      code: 200,
      message: `「${c.name}」已被召回回家（保留累计 +${pct}% 永久属性）`,
      data: { childId, hasLeftHome: false, permanentBuffPct: Number(c.permanent_buff_pct) },
    }
  } catch (error) {
    console.error('召回子女失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
