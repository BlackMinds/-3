// 查询单个房间详情
import { getRoomDetail } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const idParam = getRouterParam(event, 'id')
    const roomId = Number(idParam)
    if (!roomId) return { code: 400, message: '房间ID非法' }

    const detail = await getRoomDetail(roomId)
    if (!detail) return { code: 404, message: '房间不存在' }

    return { code: 200, data: { room: detail } }
  } catch (e: any) {
    console.error('查询房间失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
