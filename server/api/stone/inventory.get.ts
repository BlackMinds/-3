// 获取角色的石头库存 + 所有功法书列表
import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId

    const { rows: charRows } = await pool.query(
      'SELECT id, stone_migration_done, stone_migration_at FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const charId = charRows[0].id

    const { rows: stones } = await pool.query(
      `SELECT stone_id, level, count
       FROM character_stone_inventory
       WHERE character_id = $1
       ORDER BY stone_id`,
      [charId]
    )

    const { rows: books } = await pool.query(
      `SELECT id, book_id, stones, level, equipped, equipped_slot
       FROM character_skill_books
       WHERE character_id = $1
       ORDER BY id`,
      [charId]
    )

    return {
      code: 200,
      data: {
        stones,
        books,
        migrationDone: charRows[0].stone_migration_done,
        migrationAt: charRows[0].stone_migration_at,
      },
    }
  } catch (err) {
    console.error('获取石头库存失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
