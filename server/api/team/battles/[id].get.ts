// 查询单场秘境战斗详情（含完整日志）
// 鉴权：调用者必须是该场战斗的参与者
import { getCharacterByUserId, fetchBattleDetail, isCharacterInBattle } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const idParam = getRouterParam(event, 'id')
    const battleId = Number(idParam)
    if (!battleId) return { code: 400, message: '战斗ID非法' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const inBattle = await isCharacterInBattle(char.id, battleId)
    if (!inBattle) return { code: 403, message: '你未参与该场战斗' }

    const detail = await fetchBattleDetail(battleId)
    if (!detail) return { code: 404, message: '战斗记录不存在' }

    return { code: 200, data: detail }
  } catch (e: any) {
    console.error('查询战斗详情失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
