// 合并接口：宗门 Tab 顶部所需 3 项 meta 数据一次性返回
// 替代以前的 mail/unread-count + sect/war/season + spirit-vein/map 三次并行调用
import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'
import { currentSeasonNo, currentStage, currentSeasonStart, currentSeasonEnd } from '~/server/utils/sectWarOdds'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const seasonNo = currentSeasonNo()
    const stage = currentStage()
    const start = currentSeasonStart()
    const end = currentSeasonEnd()

    // === 1. 邮件未读/未领（与 mail/unread-count.get.ts 等价） ===
    const mailQ = pool.query(
      `SELECT
         SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END)::int AS unread,
         SUM(CASE WHEN is_claimed = FALSE THEN 1 ELSE 0 END)::int AS unclaimed
       FROM mails WHERE character_id = $1 AND expires_at > NOW()`,
      [char.id]
    )

    // === 2. 宗门战赛季信息（与 sect/war/season.get.ts 等价，但裁掉前端不用的字段） ===
    const seasonRowQ = pool.query('SELECT * FROM sect_war_season WHERE season_no = $1', [seasonNo])

    // === 3. 灵脉地图占领统计（前端只用 sectOccupyMap[my_sect_id]） ===
    const veinTalliesQ = pool.query(
      `SELECT sect_id, COUNT(*)::int AS cnt FROM spirit_vein_occupation
        WHERE sect_id IS NOT NULL GROUP BY sect_id`
    )

    const [mailRes, seasonRes, veinRes] = await Promise.all([mailQ, seasonRowQ, veinTalliesQ])

    // 处理赛季 row（按需创建/同步 stage）——保持与原 endpoint 行为一致
    let season: any
    if (seasonRes.rows.length === 0) {
      const { rows: created } = await pool.query(
        `INSERT INTO sect_war_season (season_no, start_date, end_date, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (season_no) DO NOTHING RETURNING *`,
        [seasonNo, start, end, stage]
      )
      if (created.length > 0) {
        season = created[0]
      } else {
        const { rows: refetch } = await pool.query('SELECT * FROM sect_war_season WHERE season_no = $1', [seasonNo])
        season = refetch[0]
      }
    } else {
      season = seasonRes.rows[0]
      if (season.status !== stage) {
        await pool.query('UPDATE sect_war_season SET status = $1 WHERE id = $2', [stage, season.id])
        season.status = stage
      }
    }

    const sectOccupyMap = Object.fromEntries(veinRes.rows.map((t: any) => [t.sect_id, t.cnt]))
    const myVeinOccupyCount = char.sect_id ? (sectOccupyMap[char.sect_id] || 0) : 0

    return {
      code: 200,
      message: 'ok',
      data: {
        mail: {
          unread: mailRes.rows[0]?.unread || 0,
          unclaimed: mailRes.rows[0]?.unclaimed || 0,
        },
        sectWar: {
          stage: season.status,
          seasonNo,
        },
        spiritVein: {
          myVeinOccupyCount,
        },
      },
    }
  } catch (err: any) {
    console.error('[sect/tab-meta] 失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
