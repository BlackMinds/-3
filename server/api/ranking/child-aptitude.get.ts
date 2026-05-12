// 最强子女资质榜 - GET /api/ranking/child-aptitude
// 按玩家旗下最高资质子女排序

import { getPool } from '~/server/database/db'

const REALM_NAMES: Record<number, string> = {
  1: '练气', 2: '筑基', 3: '金丹', 4: '元婴',
  5: '化神', 6: '渡劫', 7: '大乘', 8: '飞升', 9: '混元',
}
const APTITUDE_NAMES = ['凡品', '下品', '中品', '上品', '极品', '仙品', '圣品']

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.realm_tier, c.title,
             ch.name AS child_name, ch.aptitude, ch.awakened, ch.level
        FROM children ch
        JOIN characters c ON c.id = ch.character_id
        JOIN (
          SELECT character_id, MAX(aptitude * 1000 + level) AS score
            FROM children
           GROUP BY character_id
        ) m ON m.character_id = ch.character_id AND m.score = ch.aptitude * 1000 + ch.level
       ORDER BY ch.aptitude DESC, ch.level DESC
       LIMIT 50
    `)

    const list = rows.map((r: any, i: number) => ({
      rank: i + 1,
      characterId: r.id,
      name: r.name,
      title: r.title,
      realmName: REALM_NAMES[r.realm_tier] || '',
      childName: r.child_name,
      aptitude: r.aptitude,
      aptitudeName: APTITUDE_NAMES[r.aptitude] || '?',
      awakened: r.awakened,
      childLevel: r.level,
    }))

    return { code: 200, data: { list } }
  } catch (error) {
    console.error('子女资质榜失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
