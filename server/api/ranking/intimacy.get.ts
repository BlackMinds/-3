// 最高亲密度排行 - GET /api/ranking/intimacy

import { getPool } from '~/server/database/db'

const REALM_NAMES: Record<number, string> = {
  1: '练气', 2: '筑基', 3: '金丹', 4: '元婴',
  5: '化神', 6: '渡劫', 7: '大乘', 8: '飞升', 9: '混元',
}
const QUALITY_NAMES = ['凡品', '下品', '中品', '上品', '极品', '仙品']

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.realm_tier, c.title,
             cmp.name AS companion_name, cmp.quality, cmp.intimacy
        FROM companions cmp
        JOIN characters c ON c.id = cmp.character_id
        JOIN (
          SELECT character_id, MAX(intimacy) AS max_i
            FROM companions
           GROUP BY character_id
        ) m ON m.character_id = cmp.character_id AND m.max_i = cmp.intimacy
       ORDER BY cmp.intimacy DESC
       LIMIT 50
    `)

    const list = rows.map((r: any, i: number) => ({
      rank: i + 1,
      characterId: r.id,
      name: r.name,
      title: r.title,
      realmDisplay: REALM_NAMES[r.realm_tier] || '',
      spiritualRoot: '',
      rootName: '',
      companionName: r.companion_name,
      qualityName: QUALITY_NAMES[r.quality] || '?',
      intimacy: r.intimacy,
    }))

    return { code: 200, data: { list } }
  } catch (error) {
    console.error('亲密度榜失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
