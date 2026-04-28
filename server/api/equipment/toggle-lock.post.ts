import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'

// 切换装备锁定状态：locked=TRUE 时一键出售跳过
export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { equip_id, locked } = await readBody(event)
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    if (!equip_id) return { code: 400, message: '参数错误' }

    // 显式传 locked 用其值，未传则按当前取反（toggle）
    const { rows } = await pool.query(
      `UPDATE character_equipment
       SET locked = COALESCE($3::boolean, NOT COALESCE(locked, FALSE))
       WHERE id = $1 AND character_id = $2
       RETURNING id, locked`,
      [equip_id, char.id, locked === undefined ? null : !!locked]
    )
    if (rows.length === 0) return { code: 400, message: '装备不存在' }

    return {
      code: 200,
      message: rows[0].locked ? '已锁定' : '已解锁',
      data: { equip_id: rows[0].id, locked: rows[0].locked },
    }
  } catch (err) {
    console.error('切换装备锁定失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
