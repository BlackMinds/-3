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

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // FOR UPDATE 锁宗门行 + 条件扣费，防并发重复升级导致基金为负
      const { rows: sectRows } = await client.query(
        'SELECT level, fund FROM sects WHERE id = $1 FOR UPDATE',
        [membership.sect_id]
      )
      if (Number(sectRows[0]?.level) !== currentLevel) {
        await client.query('ROLLBACK')
        return { code: 400, message: '宗门等级已变化，请刷新后重试' }
      }
      if (Number(sectRows[0]?.fund) < cost) {
        await client.query('ROLLBACK')
        return { code: 400, message: `宗门资金不足，需${cost}灵石` }
      }

      await client.query(
        'UPDATE sects SET fund = fund - $1, level = level + 1 WHERE id = $2',
        [cost, membership.sect_id]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }

    return { code: 200, message: `宗门升至${currentLevel + 1}级`, data: { newLevel: currentLevel + 1 } }
  } catch (error) {
    console.error('宗门升级失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
