import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership, todayStr } from '~/server/utils/sect'
import { getSignInContribution } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    const today = todayStr()
    const lastSign = membership.last_sign_date
      ? new Date(membership.last_sign_date).toISOString().slice(0, 10)
      : null
    if (lastSign === today) return { code: 400, message: '今日已签到' }

    const contribution = getSignInContribution(membership.sect_level, char.realm_tier || 0)

    await pool.query(
      'UPDATE sect_members SET contribution = contribution + $1, weekly_contribution = weekly_contribution + $2, last_sign_date = $3 WHERE sect_id = $4 AND character_id = $5',
      [contribution, contribution, today, membership.sect_id, char.id]
    )

    return { code: 200, message: `签到成功，获得${contribution}贡献`, data: { contribution } }
  } catch (error) {
    console.error('签到失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
