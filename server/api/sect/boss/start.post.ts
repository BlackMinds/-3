import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { ROLE_HIERARCHY, getSectBoss } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { boss_key } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership || ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY['vice_leader']) {
      return { code: 403, message: '需副宗主以上' }
    }

    const bossCfg = getSectBoss(boss_key)
    if (!bossCfg) return { code: 400, message: 'Boss不存在' }
    if (membership.sect_level < bossCfg.requiredSectLevel) return { code: 400, message: '宗门等级不足' }

    if (Number(membership.fund) < bossCfg.startCost) return { code: 400, message: '宗门资金不足' }

    // 检查冷却
    const { rows: recent } = await pool.query(
      "SELECT id FROM sect_bosses WHERE sect_id = $1 AND boss_key = $2 AND status = 'killed' AND finished_at > NOW() - INTERVAL '48 hours'",
      [membership.sect_id, boss_key]
    )
    if (recent.length > 0) return { code: 400, message: 'Boss冷却中(48小时)' }

    // 检查是否已有同Boss active
    const { rows: activeExist } = await pool.query(
      "SELECT id FROM sect_bosses WHERE sect_id = $1 AND boss_key = $2 AND status = 'active'",
      [membership.sect_id, boss_key]
    )
    if (activeExist.length > 0) return { code: 400, message: '该Boss已在战斗中' }

    // 扣资金
    await pool.query('UPDATE sects SET fund = fund - $1 WHERE id = $2', [bossCfg.startCost, membership.sect_id])

    // 创建Boss实例
    await pool.query(
      "INSERT INTO sect_bosses (sect_id, boss_key, total_hp, current_hp, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')",
      [membership.sect_id, boss_key, bossCfg.totalHp, bossCfg.totalHp]
    )

    return { code: 200, message: `【${bossCfg.name}】已出现！全宗门成员可参战` }
  } catch (error) {
    console.error('发起Boss战失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
