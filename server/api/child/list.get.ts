// 子女列表 - GET /api/child/list

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildrenByCharacter, APTITUDE_NAMES } from '~/server/utils/child'

const STAGE_NAMES: Record<string, string> = {
  infant: '婴幼期', child: '童年期', youth: '少年期',
  adult_youth: '青年期', adult: '成年', grown: '已离家',
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const children = await getChildrenByCharacter(pool, char.id)
    const list = children.map(c => ({
      id: c.id,
      name: c.name,
      gender: c.gender,
      avatarId: c.avatar_id,
      aptitude: c.aptitude,
      aptitudeName: APTITUDE_NAMES[c.aptitude] || '凡品',
      spiritualRoot: c.spiritual_root,
      awakened: c.awakened,
      level: c.level,
      stage: c.stage,
      stageName: STAGE_NAMES[c.stage] || c.stage,
      maxHp: c.max_hp,
      atk: c.atk,
      def: c.def,
      spd: c.spd,
      isBattling: c.is_battling,
      hasLeftHome: c.has_left_home,
      permanentBuffPct: Number(c.permanent_buff_pct || 0),
      lastVisitAt: c.last_visit_at,
      bornAt: c.born_at,
    }))

    return {
      code: 200,
      data: {
        children: list,
        battlingChildId: char.battling_child_id,
      },
    }
  } catch (error) {
    console.error('获取子女列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
