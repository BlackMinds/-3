// 查询当前玩家所在的房间（用于前端刷新后恢复房间状态）
import { getCharacterByUserId, getPlayerCurrentRoomId, getRoomDetail } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const roomId = await getPlayerCurrentRoomId(char.id)
    if (!roomId) return { code: 200, data: { room: null } }

    const detail = await getRoomDetail(roomId)
    return { code: 200, data: { room: detail } }
  } catch (e: any) {
    console.error('查询自身房间失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
