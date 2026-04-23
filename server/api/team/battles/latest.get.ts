// 查询某房间最近一场战斗详情 —— 给队员打完后查看战报用
// 鉴权：调用者必须曾经在该房间的 team_members 里
import { getPool } from '~/server/database/db'
import { getCharacterByUserId, fetchBattleDetail } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)
    const roomId = Number(q.room_id)
    if (!roomId) return { code: 400, message: '缺少 room_id' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const pool = getPool()
    // 必须是该房间的成员
    const { rows: memberRows } = await pool.query(
      'SELECT 1 FROM team_members WHERE room_id = $1 AND character_id = $2 LIMIT 1',
      [roomId, char.id]
    )
    if (memberRows.length === 0) return { code: 403, message: '你不在该房间中' }

    const { rows: bRows } = await pool.query(
      'SELECT id FROM secret_realm_battles WHERE room_id = $1 ORDER BY id DESC LIMIT 1',
      [roomId]
    )
    if (bRows.length === 0) return { code: 404, message: '该房间尚无战斗记录' }

    const detail = await fetchBattleDetail(bRows[0].id)
    if (!detail) return { code: 404, message: '战斗记录不存在' }

    return { code: 200, data: detail }
  } catch (e: any) {
    console.error('查询最近一场战斗失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
