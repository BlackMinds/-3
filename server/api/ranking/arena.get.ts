import { getPool } from '~/server/database/db'
import { getArenaRank } from '~/shared/arenaRanks'

const REALM_NAMES: Record<number, string> = {
  1: '练气', 2: '筑基', 3: '金丹', 4: '元婴',
  5: '化神', 6: '渡劫', 7: '大乘', 8: '飞升',
}
const STAGE_NAMES_DEFAULT = ['初期', '中期', '后期']
const STAGE_NAMES_QI = ['一层','二层','三层','四层','五层','六层','七层','八层','九层']
const STAGE_NAMES_FLY = ['散仙', '真仙', '金仙', '太乙金仙', '大罗金仙']

function getRealmDisplay(tier: number, stage: number): string {
  const realm = REALM_NAMES[tier] || '未知'
  if (tier === 1) return realm + (STAGE_NAMES_QI[stage - 1] || '')
  if (tier === 8) return STAGE_NAMES_FLY[stage - 1] || realm
  return realm + (STAGE_NAMES_DEFAULT[stage - 1] || '')
}

const ROOT_NAMES: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
}

function formatCharRow(row: any, rank: number) {
  const score = Number(row.arena_score || 0)
  const arenaRank = getArenaRank(score)
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
    arenaScore: score,
    arenaRankName: arenaRank.name,
    arenaRankColor: arenaRank.color,
    sectName: row.sect_name || null,
    title: row.title || null,
  }
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.spiritual_root, c.realm_tier, c.realm_stage,
             c.level, c.arena_score, c.title,
             s.name AS sect_name
      FROM characters c
      LEFT JOIN sect_members sm ON sm.character_id = c.id
      LEFT JOIN sects s ON s.id = sm.sect_id
      ORDER BY c.arena_score DESC, c.realm_tier DESC, c.realm_stage DESC, c.level DESC
      LIMIT 50
    `)

    const list = rows.map((r, i) => formatCharRow(r, i + 1))

    // 查自己的排名（按 arena_score 排）
    const { rows: charRows } = await pool.query(
      'SELECT id, arena_score FROM characters WHERE user_id = $1', [event.context.userId]
    )
    let myRank = null
    if (charRows.length > 0) {
      const c = charRows[0]
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*) AS cnt FROM characters WHERE arena_score > $1',
        [c.arena_score || 0]
      )
      myRank = Number(countRows[0]?.cnt || 0) + 1
    }

    // 最近一次斗法榜发奖日的获奖名单（top3 给金银铜称号）
    // 复用 cron 写入 mails 的幂等记录（ref_type='arena_daily_reward', ref_id=YYYY-MM-DD）
    // 从 mail.title 中正则解析"第 X 名"以避免 created_at 同秒的排序歧义
    const { rows: winnerRows } = await pool.query(`
      SELECT m.character_id, m.title AS mail_title, m.ref_id,
             c.name, c.spiritual_root, c.realm_tier, c.realm_stage
      FROM mails m
      JOIN characters c ON c.id = m.character_id
      WHERE m.ref_type = 'arena_daily_reward'
        AND m.ref_id = (SELECT MAX(ref_id) FROM mails WHERE ref_type = 'arena_daily_reward')
      LIMIT 10
    `)
    const titleByRank: Record<number, string> = { 1: '论道魁首', 2: '斗法翘楚', 3: '斗法翘楚' }
    const latestWinners = winnerRows
      .map((r: any) => {
        const m = /第\s*(\d+)\s*名/.exec(String(r.mail_title || ''))
        const rank = m ? Number(m[1]) : 99
        return {
          rank,
          characterId: r.character_id,
          name: r.name,
          spiritualRoot: r.spiritual_root,
          rootName: ROOT_NAMES[r.spiritual_root] || '',
          realmDisplay: getRealmDisplay(r.realm_tier, r.realm_stage),
          title: titleByRank[rank] || null,
        }
      })
      .filter(w => w.rank <= 3)
      .sort((a, b) => a.rank - b.rank)
    const latestRewardDate = winnerRows[0]?.ref_id || null

    return { code: 200, data: { list, myRank, latestWinners, latestRewardDate } }
  } catch (error) {
    console.error('斗法榜查询失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
