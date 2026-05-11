// 正式结侣 - POST /api/companion/marry
// 亲密度 ≥ 600 + 当前无正式道侣时可触发

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getCompanionById, getOfficialCompanion, canMarry } from '~/server/utils/companion'
import { INTIMACY_CONFIG } from '~/server/engine/companionData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const id = Number(body?.companion_id)
    if (!id) return { code: 400, message: '参数错误' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getCompanionById(pool, id, char.id)
    if (!c) return { code: 404, message: '道侣不存在' }
    if (c.is_official) return { code: 400, message: '已经是正式道侣' }
    if (!canMarry(c.intimacy)) {
      return { code: 400, message: `亲密度不足，需达 ${INTIMACY_CONFIG.marryThreshold}` }
    }

    // 和离冷却检查
    if (char.divorce_cooldown && new Date(char.divorce_cooldown).getTime() > Date.now()) {
      return { code: 400, message: '和离冷却中，暂不可结侣' }
    }

    // 已有正式道侣检查
    const existing = await getOfficialCompanion(pool, char.id)
    if (existing) return { code: 400, message: '已有正式道侣，需先和离' }

    // 事务：标记为正式道侣 + 仙缘印记 LV1
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE companions
            SET is_official = TRUE, married_at = CURRENT_TIMESTAMP, seal_level = 1
          WHERE id = $1`,
        [id]
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
      message: `与「${c.name}」结为道侣，仙缘印记 LV 1 已激活（全属性 +3%）`,
      data: { companionId: id, sealLevel: 1 },
    }
  } catch (error) {
    console.error('结侣失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
