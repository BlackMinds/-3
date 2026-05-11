// 仙缘印记升级 - POST /api/companion/seal-upgrade
// LV1 → LV5，消耗红尘玉

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getOfficialCompanion, getNextSealConfig } from '~/server/utils/companion'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getOfficialCompanion(pool, char.id)
    if (!c) return { code: 400, message: '需先正式结侣' }

    const next = getNextSealConfig(c.seal_level)
    if (!next) return { code: 400, message: '仙缘印记已满级 LV5' }

    if ((char.red_jade || 0) < next.costRedJade) {
      return { code: 400, message: `红尘玉不足，需 ${next.costRedJade}` }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        'UPDATE characters SET red_jade = red_jade - $1 WHERE id = $2',
        [next.costRedJade, char.id]
      )
      await client.query(
        'UPDATE companions SET seal_level = $1 WHERE id = $2',
        [next.level, c.id]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      data: { newLevel: next.level, allStatPct: next.allStatPct },
      message: `仙缘印记升至 LV${next.level}，全属性 +${next.allStatPct}%`,
    }
  } catch (error) {
    console.error('仙缘印记升级失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
