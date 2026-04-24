// DEV ONLY — 给指定账号发放所有石头 + 各品质各类型的空书
// 用法:
//   POST /api/cron/dev-grant-stones?username=testA1
//   Header: Authorization: Bearer $CRON_SECRET
//
// 效果:
//   - 每颗石头 count=99 放入 character_stone_inventory
//   - 每种 (类型×品质) 空书 2 本，共 3×6×2 = 36 本（元素各异）
//   - 石灵碎片 500 颗、拆石丹 100 颗（放 character_materials）

import { getPool } from '~/server/database/db'
import { ALL_STONES } from '~/server/engine/stoneData'
import { ALL_BOOKS } from '~/server/engine/skillBookData'
import type { Rarity, SkillType } from '~/shared/stoneTypes'

const RARITIES: Rarity[] = ['white', 'green', 'blue', 'purple', 'gold', 'red']
const SKILL_TYPES: SkillType[] = ['active', 'divine', 'passive']
const ELEMENT_PAIRS: (string | null)[][] = [
  ['fire', 'none'],
  ['water', 'metal'],
  ['earth', 'wood'],
]

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const q = getQuery(event)
  const username = String(q.username || '').trim()
  if (!username) return { code: 400, message: '缺少 username 参数' }

  const pool = getPool()
  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE username = $1', [username])
  if (userRows.length === 0) return { code: 404, message: `账号 ${username} 不存在` }
  const userId = userRows[0].id

  const { rows: charRows } = await pool.query('SELECT id, name FROM characters WHERE user_id = $1', [userId])
  if (charRows.length === 0) return { code: 404, message: `账号 ${username} 还没创建角色` }
  const charId = charRows[0].id
  const charName = charRows[0].name

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1) 全部石头 count=99
    let stonesGranted = 0
    for (const s of ALL_STONES) {
      const { rows: exist } = await client.query(
        `SELECT id, count FROM character_stone_inventory WHERE character_id = $1 AND stone_id = $2 AND level = 1`,
        [charId, s.id]
      )
      if (exist.length > 0) {
        await client.query(`UPDATE character_stone_inventory SET count = GREATEST(count, 99) WHERE id = $1`, [exist[0].id])
      } else {
        await client.query(
          `INSERT INTO character_stone_inventory (character_id, stone_id, level, count) VALUES ($1, $2, 1, 99)`,
          [charId, s.id]
        )
      }
      stonesGranted++
    }

    // 2) 每种「类型 × 品质」发 2 本空书（元素轮换以便测试匹配）
    let booksGranted = 0
    let pairIdx = 0
    for (const skillType of SKILL_TYPES) {
      for (const rarity of RARITIES) {
        const [e1, e2] = ELEMENT_PAIRS[pairIdx % ELEMENT_PAIRS.length]
        pairIdx++
        for (const elementTag of [e1, e2]) {
          const bookId = `book_${skillType}_${rarity}_${elementTag}`
          // 验证书存在
          if (!ALL_BOOKS.some(b => b.id === bookId)) continue
          await client.query(
            `INSERT INTO character_skill_books (character_id, book_id, stones, level, equipped)
             VALUES ($1, $2, '[]'::jsonb, 1, FALSE)`,
            [charId, bookId]
          )
          booksGranted++
        }
      }
    }

    // 3) 辅助材料
    await grantMaterial(client, charId, 'stone_shard', 500)
    await grantMaterial(client, charId, 'stone_remove_pill', 100)

    await client.query('COMMIT')

    return {
      code: 200,
      data: {
        character: { id: charId, name: charName },
        stonesGranted,       // 应 = ALL_STONES.length
        booksGranted,        // 应 = 36（3类型 × 6品质 × 2本）
        shardsGranted: 500,
        removePillsGranted: 100,
      },
    }
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('发石头失败:', err)
    return { code: 500, message: String(err) }
  } finally {
    client.release()
  }
})

async function grantMaterial(client: any, charId: number, materialId: string, count: number, quality = 'white') {
  const { rows } = await client.query(
    `SELECT id FROM character_materials WHERE character_id = $1 AND material_id = $2 AND quality = $3`,
    [charId, materialId, quality]
  )
  if (rows.length > 0) {
    await client.query(`UPDATE character_materials SET count = GREATEST(count, $1) WHERE id = $2`, [count, rows[0].id])
  } else {
    await client.query(
      `INSERT INTO character_materials (character_id, material_id, quality, count) VALUES ($1, $2, $3, $4)`,
      [charId, materialId, quality, count]
    )
  }
}
