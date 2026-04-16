import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(`
      SELECT s.id, s.name, s.level, s.fund, s.member_count, s.announcement,
             c.name AS leader_name
      FROM sects s
      LEFT JOIN characters c ON c.id = s.leader_id
      ORDER BY s.level DESC, s.fund DESC, s.member_count DESC
      LIMIT 20
    `)

    const list = rows.map((r, i) => ({
      rank: i + 1,
      sectId: r.id,
      name: r.name,
      level: r.level,
      fund: r.fund,
      memberCount: r.member_count,
      leaderName: r.leader_name,
      announcement: r.announcement,
    }))

    // 我的宗门排名
    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1', [event.context.userId]
    )
    let mySectRank = null
    if (charRows.length > 0) {
      const { rows: smRows } = await pool.query(
        'SELECT sect_id FROM sect_members WHERE character_id = $1', [charRows[0].id]
      )
      if (smRows.length > 0) {
        const sectId = smRows[0].sect_id
        const { rows: myRows } = await pool.query(
          'SELECT level, fund FROM sects WHERE id = $1', [sectId]
        )
        if (myRows.length > 0) {
          const { rows: cntRows } = await pool.query(
            'SELECT COUNT(*) AS cnt FROM sects WHERE level > $1 OR (level = $2 AND fund > $3)',
            [myRows[0].level, myRows[0].level, myRows[0].fund]
          )
          mySectRank = Number(cntRows[0]?.cnt || 0) + 1
        }
      }
    }

    return { code: 200, data: { list, myRank: mySectRank } }
  } catch (error) {
    console.error('宗门榜查询失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
