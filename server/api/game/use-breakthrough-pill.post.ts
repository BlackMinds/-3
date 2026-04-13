import { getPool } from '~/server/database/db'
import { consumeSpecialItem } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows: charRows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1', [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const char = charRows[0]

    const used = await consumeSpecialItem(char.id, 'breakthrough_boost')
    if (!used) return { code: 400, message: '没有宗门突破丹' }

    // 计算当前境界所需修为(与前端公式一致)
    const tier = char.realm_tier || 1
    const stage = char.realm_stage || 1
    const expMultipliers: Record<number, number> = { 1: 1, 2: 10, 3: 50, 4: 200, 5: 800, 6: 3000, 7: 8000, 8: 15000 }
    const required = Math.floor(100 * (expMultipliers[tier] || 1) * Math.pow(stage + 1, 1.6))
    const gain = Math.floor(required * 0.2)

    await pool.query('UPDATE characters SET cultivation_exp = cultivation_exp + $1 WHERE id = $2', [gain, char.id])

    return { code: 200, message: `获得${gain}修为`, data: { gain } }
  } catch (error) {
    console.error('突破丹使用失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
