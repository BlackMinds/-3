/**
 * 使用宗门突破丹 (v3.3)
 * 效果: 下次突破成功率 +20% (上限 100%), 不论成败消耗一次
 * 实现: 扣道具 + 置 breakthrough_boost_pending = TRUE, 突破接口读取并清除
 */
import { getPool } from '~/server/database/db'
import { consumeSpecialItem } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows: charRows } = await pool.query(
      'SELECT id, breakthrough_boost_pending FROM characters WHERE user_id = $1', [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const char = charRows[0]

    if (char.breakthrough_boost_pending) {
      return { code: 400, message: '突破丹已激活，先去突破一次再用' }
    }

    const used = await consumeSpecialItem(char.id, 'breakthrough_boost')
    if (!used) return { code: 400, message: '没有宗门突破丹' }

    await pool.query(
      'UPDATE characters SET breakthrough_boost_pending = TRUE WHERE id = $1', [char.id]
    )

    return { code: 200, message: '突破丹已激活 · 下次突破成功率 +20%' }
  } catch (error) {
    console.error('突破丹使用失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
