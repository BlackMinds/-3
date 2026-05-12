// 道侣品质排行榜 - GET /api/ranking/companion-quality
// 按玩家拥有的最高品质道侣（已结侣优先），相同品质按结侣时间最早排前

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
             cmp.name AS companion_name, cmp.quality AS companion_quality,
             cmp.intimacy, cmp.seal_level, cmp.is_official
        FROM companions cmp
        JOIN characters c ON c.id = cmp.character_id
        JOIN (
          SELECT character_id, MAX(quality) AS max_q
            FROM companions
           GROUP BY character_id
        ) m ON m.character_id = cmp.character_id AND m.max_q = cmp.quality
       ORDER BY cmp.quality DESC, cmp.is_official DESC, cmp.encountered_at ASC
       LIMIT 50
    `)

    const list = rows.map((r: any, i: number) => ({
      rank: i + 1,
      characterId: r.id,
      name: r.name,
      title: r.title,
      realmDisplay: REALM_NAMES[r.realm_tier] || '',
      spiritualRoot: '',  // 不展示灵根，前端 rootColorMap 取空即可
      rootName: '',
      companionName: r.companion_name,
      companionQuality: r.companion_quality,
      qualityName: QUALITY_NAMES[r.companion_quality] || '?',
      intimacy: r.intimacy,
      sealLevel: r.seal_level,
      isOfficial: r.is_official,
    }))

    // 自己的排名
    const { rows: meRows } = await pool.query(
      `SELECT MAX(quality) AS max_q FROM companions
        WHERE character_id = (SELECT id FROM characters WHERE user_id = $1)`,
      [event.context.userId]
    )
    let myRank = null
    if (meRows[0]?.max_q !== null && meRows[0]?.max_q !== undefined) {
      const { rows: cntRows } = await pool.query(
        `SELECT COUNT(DISTINCT character_id) AS cnt FROM companions WHERE quality > $1`,
        [meRows[0].max_q]
      )
      myRank = Number(cntRows[0]?.cnt || 0) + 1
    }

    return { code: 200, data: { list, myRank } }
  } catch (error) {
    console.error('道侣品质榜失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
