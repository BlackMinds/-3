// 风云阁：拉取全服广播列表（支持稀有度筛选、宗门筛选）
import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const rarity = (query.rarity as string) || null
    const scope = (query.scope as string) || 'all'    // all / sect
    const limit = Math.min(Number(query.limit) || 50, 100)

    const pool = getPool()

    // 如果查宗门筛选，需要本人宗门 ID
    let sectId: number | null = null
    if (scope === 'sect') {
      const { rows } = await pool.query(
        'SELECT sect_id FROM characters WHERE user_id = $1',
        [event.context.userId]
      )
      if (rows.length > 0) sectId = rows[0].sect_id
      if (!sectId) return { code: 200, data: [] }
    }

    const conds: string[] = []
    const params: any[] = []
    let p = 1
    if (rarity && ['common', 'rare', 'epic', 'legendary'].includes(rarity)) {
      conds.push(`rarity = $${p++}`)
      params.push(rarity)
    }
    if (scope === 'sect' && sectId) {
      conds.push(`sect_id = $${p++}`)
      params.push(sectId)
    }
    const whereClause = conds.length > 0 ? 'WHERE ' + conds.join(' AND ') : ''

    params.push(limit)
    const { rows } = await pool.query(
      `SELECT id, character_id, character_name, sect_id, event_id, rarity, is_positive,
              rendered_text, created_at
         FROM world_broadcast
         ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${p}`,
      params
    )

    return {
      code: 200,
      data: rows.map(r => ({
        id: r.id,
        characterId: r.character_id,
        characterName: r.character_name,
        sectId: r.sect_id,
        eventId: r.event_id,
        rarity: r.rarity,
        isPositive: r.is_positive,
        text: r.rendered_text,
        createdAt: r.created_at,
      })),
    }
  } catch (err: any) {
    console.error('[event/broadcast] 失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
