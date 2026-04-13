import { getPool } from '~/server/database/db'
import { consumeSpecialItem } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { stat_type } = await readBody(event)

    if (!['atk', 'def', 'hp'].includes(stat_type)) {
      return { code: 400, message: '属性类型错误,只能选 atk/def/hp' }
    }

    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1', [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const charId = charRows[0].id

    const used = await consumeSpecialItem(charId, 'permanent_stat')
    if (!used) return { code: 400, message: '没有道果结晶' }

    const col = `permanent_${stat_type}_pct`
    await pool.query(`UPDATE characters SET ${col} = ${col} + 1 WHERE id = $1`, [charId])

    return { code: 200, message: `永久${stat_type === 'atk' ? '攻击' : stat_type === 'def' ? '防御' : '气血'}+1%` }
  } catch (error) {
    console.error('道果结晶使用失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
