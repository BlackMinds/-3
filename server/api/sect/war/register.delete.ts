import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { currentSeasonNo, currentStage } from '~/server/utils/sectWarOdds'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const membership = await getMembership(char.id)
  if (!membership) return { code: 400, message: '未加入宗门' }
  if (membership.role !== 'leader' && membership.role !== 'vice_leader') {
    return { code: 403, message: '仅宗主/副宗主可撤回阵容' }
  }
  const stage = currentStage()
  if (stage !== 'registering') return { code: 400, message: '非报名期不可撤回' }
  const pool = getPool()
  const seasonNo = currentSeasonNo()
  const { rows: seasonRows } = await pool.query('SELECT * FROM sect_war_season WHERE season_no = $1', [seasonNo])
  if (seasonRows.length === 0) return { code: 400, message: '赛季不存在' }
  const season = seasonRows[0]
  const { rowCount } = await pool.query(
    'DELETE FROM sect_war_registration WHERE season_id = $1 AND sect_id = $2',
    [season.id, membership.sect_id]
  )
  return { code: 200, message: rowCount ? '已撤回' : '未找到阵容' }
})
