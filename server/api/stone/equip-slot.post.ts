// 把已镶嵌的功法书装备到角色技能槽
// body: { bookRowId: number, slotType: 'active'|'divine'|'passive', slotIndex: number }
import { getPool } from '~/server/database/db'
import { BOOK_MAP } from '~/server/engine/skillBookData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const body = await readBody<{ bookRowId: number; slotType: 'active' | 'divine' | 'passive'; slotIndex: number }>(event)
    if (!body?.bookRowId || !body?.slotType || body.slotIndex == null) return { code: 400, message: '参数错误' }
    if (body.slotType === 'active' && body.slotIndex !== 0) return { code: 400, message: '主修槽位只有 0' }
    if (body.slotType === 'divine' && ![0, 1, 2].includes(body.slotIndex)) return { code: 400, message: '神通槽位 0~2' }
    if (body.slotType === 'passive' && ![0, 1, 2].includes(body.slotIndex)) return { code: 400, message: '被动槽位 0~2' }

    const { rows: charRows } = await pool.query('SELECT id FROM characters WHERE user_id = $1', [userId])
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const charId = charRows[0].id

    const { rows: bookRows } = await pool.query(
      `SELECT id, book_id FROM character_skill_books WHERE id = $1 AND character_id = $2`,
      [body.bookRowId, charId]
    )
    if (bookRows.length === 0) return { code: 400, message: '书不存在' }
    const book = BOOK_MAP[bookRows[0].book_id]
    if (!book) return { code: 500, message: '书数据损坏' }
    if (book.skillType !== body.slotType) {
      return { code: 400, message: `书类型 ${book.skillType} 与槽位 ${body.slotType} 不匹配` }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // 先把同槽位的其他书卸下
      await client.query(
        `UPDATE character_skill_books
         SET equipped = FALSE, equipped_slot = NULL
         WHERE character_id = $1 AND equipped = TRUE AND equipped_slot = $2
           AND book_id IN (SELECT book_id FROM character_skill_books WHERE id = $3)`,
        [charId, body.slotIndex, body.bookRowId]
      )
      // 装备本书
      await client.query(
        `UPDATE character_skill_books SET equipped = TRUE, equipped_slot = $1 WHERE id = $2`,
        [body.slotIndex, body.bookRowId]
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return { code: 200, data: { equipped: true, slotIndex: body.slotIndex } }
  } catch (err) {
    console.error('装备书失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
