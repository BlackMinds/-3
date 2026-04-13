import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { SECT_LEVELS } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership || membership.role !== 'leader') return { code: 403, message: '仅宗主可操作' }

    const currentLevel = membership.sect_level
    if (currentLevel >= 10) return { code: 400, message: '已达最高等级' }

    const nextCfg = SECT_LEVELS[currentLevel]
    const cost = nextCfg.upgradeCost

    if (Number(membership.fund) < cost) return { code: 400, message: `宗门资金不足，需${cost}灵石` }

    await pool.query('UPDATE sects SET fund = fund - $1, level = level + 1 WHERE id = $2', [cost, membership.sect_id])

    return { code: 200, message: `宗门升至${currentLevel + 1}级`, data: { newLevel: currentLevel + 1 } }
  } catch (error) {
    console.error('宗门升级失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
