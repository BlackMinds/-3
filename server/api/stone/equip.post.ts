// 镶嵌/拆卸石头 — 提交整书的石头数组（按孔位顺序，空位 null）
// body: { bookRowId: number, stones: (string|null)[] }
import { getPool } from '~/server/database/db'
import { validateSlotted, resolve } from '~/server/engine/stoneResolver'
import { STONE_MAP } from '~/server/engine/stoneData'
import { BOOK_MAP } from '~/server/engine/skillBookData'
import { getSlotLayout } from '~/shared/stoneTypes'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const body = await readBody<{ bookRowId: number; stones: (string | null)[] }>(event)

    if (!body?.bookRowId || !Array.isArray(body.stones)) {
      return { code: 400, message: '参数错误' }
    }

    const { rows: charRows } = await pool.query('SELECT id FROM characters WHERE user_id = $1', [userId])
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const charId = charRows[0].id

    const { rows: bookRows } = await pool.query(
      `SELECT id, book_id, stones FROM character_skill_books WHERE id = $1 AND character_id = $2`,
      [body.bookRowId, charId]
    )
    if (bookRows.length === 0) return { code: 400, message: '找不到该功法书' }
    const bookRow = bookRows[0]
    const book = BOOK_MAP[bookRow.book_id]
    if (!book) return { code: 500, message: '功法书数据损坏' }

    // 校验孔位层级
    const layout = getSlotLayout(book.rarity)
    if (body.stones.length !== layout.length) {
      return { code: 400, message: `孔位数量不匹配：该书应 ${layout.length} 孔` }
    }

    // 校验镶嵌合法性
    const v = validateSlotted(bookRow.book_id, body.stones)
    if (!v.ok) return { code: 400, message: v.error }

    // 校验玩家持有的石头库存是否充足
    // 计算增量：新 stones 中"新增的石头" vs 旧 stones 中"被取下的石头"
    const oldStones: (string | null)[] = Array.isArray(bookRow.stones) ? bookRow.stones : []
    const oldCount: Record<string, number> = {}
    const newCount: Record<string, number> = {}
    for (const s of oldStones) if (s) oldCount[s] = (oldCount[s] ?? 0) + 1
    for (const s of body.stones) if (s) newCount[s] = (newCount[s] ?? 0) + 1

    // 净新增：newCount - oldCount > 0 的部分需要从库存扣；< 0 的部分退回库存
    const allStoneIds = new Set([...Object.keys(oldCount), ...Object.keys(newCount)])
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      for (const sid of allStoneIds) {
        const diff = (newCount[sid] ?? 0) - (oldCount[sid] ?? 0)
        if (diff > 0) {
          const { rows: inv } = await client.query(
            `SELECT id, count FROM character_stone_inventory
             WHERE character_id = $1 AND stone_id = $2 AND level = 1
             FOR UPDATE`,
            [charId, sid]
          )
          if (inv.length === 0 || inv[0].count < diff) {
            await client.query('ROLLBACK')
            return { code: 400, message: `石头 ${STONE_MAP[sid]?.name ?? sid} 数量不足（需 ${diff}）` }
          }
          await client.query(
            `UPDATE character_stone_inventory SET count = count - $1 WHERE id = $2`,
            [diff, inv[0].id]
          )
        } else if (diff < 0) {
          // 退回库存
          const retAmt = -diff
          const { rows: inv } = await client.query(
            `SELECT id FROM character_stone_inventory
             WHERE character_id = $1 AND stone_id = $2 AND level = 1`,
            [charId, sid]
          )
          if (inv.length > 0) {
            await client.query(
              `UPDATE character_stone_inventory SET count = count + $1 WHERE id = $2`,
              [retAmt, inv[0].id]
            )
          } else {
            await client.query(
              `INSERT INTO character_stone_inventory (character_id, stone_id, level, count) VALUES ($1, $2, 1, $3)`,
              [charId, sid, retAmt]
            )
          }
        }
      }

      // 写回 book 的 stones
      await client.query(
        `UPDATE character_skill_books SET stones = $1::jsonb WHERE id = $2`,
        [JSON.stringify(body.stones), body.bookRowId]
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // 返回解析后的 skill 预览
    const resolved = resolve(bookRow.book_id, body.stones)
    return {
      code: 200,
      data: { preview: resolved.skill, error: resolved.error },
    }
  } catch (err) {
    console.error('镶嵌石头失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
