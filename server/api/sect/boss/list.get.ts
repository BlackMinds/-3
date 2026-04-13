import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { SECT_BOSSES } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    // 过期检查
    await pool.query(
      "UPDATE sect_bosses SET status = 'expired' WHERE sect_id = $1 AND status = 'active' AND expires_at < NOW()",
      [membership.sect_id]
    )

    const { rows: active } = await pool.query(
      "SELECT * FROM sect_bosses WHERE sect_id = $1 AND status = 'active'", [membership.sect_id]
    )

    // 可发起的Boss列表
    const available = SECT_BOSSES.filter(b => b.requiredSectLevel <= membership.sect_level)

    // 冷却检查
    const { rows: recentKills } = await pool.query(
      "SELECT boss_key, finished_at FROM sect_bosses WHERE sect_id = $1 AND status = 'killed' AND finished_at > NOW() - INTERVAL '48 hours'",
      [membership.sect_id]
    )
    const onCooldown = new Set(recentKills.map((r: any) => r.boss_key))

    return {
      code: 200,
      data: {
        active,
        available: available.map(b => ({ ...b, onCooldown: onCooldown.has(b.key) })),
      },
    }
  } catch (error) {
    console.error('Boss列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
