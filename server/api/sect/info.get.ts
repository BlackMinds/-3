import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { getSectLevelConfig, SECT_LEVELS, ROLE_NAMES } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 200, data: null }

    const sectId = membership.sect_id

    // 成员列表（last_active_at 由 auth 中间件每 5 分钟刷新，比 last_online 更准）
    const { rows: members } = await pool.query(
      `SELECT sm.character_id, sm.role, sm.contribution, sm.total_contribution, sm.weekly_contribution, sm.joined_at,
              c.name, c.level, c.realm_tier, c.realm_stage,
              c.last_active_at,
              EXTRACT(EPOCH FROM (NOW() - c.last_active_at)) AS inactive_seconds
       FROM sect_members sm JOIN characters c ON sm.character_id = c.id
       WHERE sm.sect_id = $1 ORDER BY CASE sm.role WHEN 'leader' THEN 1 WHEN 'vice_leader' THEN 2 WHEN 'elder' THEN 3 WHEN 'inner' THEN 4 WHEN 'outer' THEN 5 END, sm.total_contribution DESC`,
      [sectId]
    )

    const leaderRow = members.find((m: any) => m.role === 'leader')
    const leaderInactiveSeconds = leaderRow ? Number(leaderRow.inactive_seconds ?? 0) : 0

    // 待审批数
    const { rows: pendingCount } = await pool.query(
      'SELECT COUNT(*) as cnt FROM sect_applications WHERE sect_id = $1 AND status = $2',
      [sectId, 'pending']
    )

    const cfg = getSectLevelConfig(membership.sect_level)

    return {
      code: 200,
      data: {
        sect: {
          id: sectId,
          name: membership.sect_name,
          level: membership.sect_level,
          fund: membership.fund,
          join_mode: membership.join_mode,
          announcement: membership.announcement,
          member_count: membership.member_count,
          max_members: cfg.maxMembers,
          atk_bonus: cfg.atkBonus,
          def_bonus: cfg.defBonus,
          exp_bonus: cfg.expBonus,
          next_upgrade_cost: membership.sect_level < 10 ? SECT_LEVELS[membership.sect_level].upgradeCost : null,
          leader_id: membership.leader_id,
          leader_name: leaderRow?.name ?? null,
          leader_inactive_seconds: leaderInactiveSeconds,
        },
        my: {
          role: membership.role,
          role_name: ROLE_NAMES[membership.role],
          contribution: membership.contribution,
          total_contribution: membership.total_contribution,
          weekly_contribution: membership.weekly_contribution,
          daily_donated: membership.daily_donated,
        },
        members,
        pending_count: pendingCount[0].cnt,
      },
    }
  } catch (error) {
    console.error('获取宗门信息失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
