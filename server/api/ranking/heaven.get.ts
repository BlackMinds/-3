import { getPool } from '~/server/database/db'

const REALM_NAMES: Record<number, string> = {
  1: '练气', 2: '筑基', 3: '金丹', 4: '元婴',
  5: '化神', 6: '渡劫', 7: '大乘', 8: '飞升', 9: '混元',
}
const STAGE_NAMES_DEFAULT = ['初期', '中期', '后期']
const STAGE_NAMES_QI = ['一层','二层','三层','四层','五层','六层','七层','八层','九层']
const STAGE_NAMES_FLY = ['散仙', '真仙', '金仙', '太乙金仙', '大罗金仙']
const STAGE_NAMES_HUNYUAN = ['合道', '证道', '太上', '太极', '无极']

function getRealmDisplay(tier: number, stage: number): string {
  const realm = REALM_NAMES[tier] || '未知'
  if (tier === 1) return realm + (STAGE_NAMES_QI[stage - 1] || '')
  if (tier === 8) return STAGE_NAMES_FLY[stage - 1] || realm
  if (tier === 9) return STAGE_NAMES_HUNYUAN[stage - 1] || realm
  return realm + (STAGE_NAMES_DEFAULT[stage - 1] || '')
}

const ROOT_NAMES: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
}

function formatRow(row: any, rank: number) {
  return {
    rank,
    characterId: row.id,
    name: row.name,
    spiritualRoot: row.spiritual_root,
    rootName: ROOT_NAMES[row.spiritual_root] || '',
    realmTier: row.realm_tier,
    realmStage: row.realm_stage,
    realmDisplay: getRealmDisplay(row.realm_tier, row.realm_stage),
    level: row.level || 1,
    floor: Number(row.tower_max_floor || 0),
    sectName: row.sect_name || null,
    title: row.title || null,
  }
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    // 通天榜：按通天塔最高层数排
    // 并列时以境界 → 等级为次序，让"同层数高境界更费力"排在前
    // 不过滤 floor=0：保持上榜规模，方便大家看到自己潜在排名
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.spiritual_root, c.realm_tier, c.realm_stage,
             c.level, c.title, c.tower_max_floor,
             s.name AS sect_name
      FROM characters c
      LEFT JOIN sect_members sm ON sm.character_id = c.id
      LEFT JOIN sects s ON s.id = sm.sect_id
      ORDER BY c.tower_max_floor DESC,
               c.realm_tier DESC, c.realm_stage DESC,
               c.level DESC, c.id ASC
      LIMIT 50
    `)

    const list = rows.map((r, i) => formatRow(r, i + 1))

    // 我的排名
    const { rows: charRows } = await pool.query(
      `SELECT id, tower_max_floor, realm_tier, realm_stage, level
         FROM characters WHERE user_id = $1`,
      [event.context.userId]
    )
    let myRank: number | null = null
    if (charRows.length > 0) {
      const me = charRows[0]
      const myFloor = Number(me.tower_max_floor || 0)
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM characters
           WHERE tower_max_floor > $1
              OR (tower_max_floor = $2 AND realm_tier > $3)
              OR (tower_max_floor = $4 AND realm_tier = $5 AND realm_stage > $6)
              OR (tower_max_floor = $7 AND realm_tier = $8 AND realm_stage = $9 AND level > $10)
              OR (tower_max_floor = $11 AND realm_tier = $12 AND realm_stage = $13 AND level = $14 AND id < $15)`,
        [myFloor, myFloor, me.realm_tier,
         myFloor, me.realm_tier, me.realm_stage,
         myFloor, me.realm_tier, me.realm_stage, me.level,
         myFloor, me.realm_tier, me.realm_stage, me.level, me.id]
      )
      myRank = Number(countRows[0]?.cnt || 0) + 1
    }

    return { code: 200, data: { list, myRank } }
  } catch (error) {
    console.error('通天榜查询失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
