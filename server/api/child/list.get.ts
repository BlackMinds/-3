// 子女列表 - GET /api/child/list

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildrenByCharacter, APTITUDE_NAMES, calcChildBaseStats } from '~/server/utils/child'
import type { ChildAptitude } from '~/server/engine/childTalentData'

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
    // 批量计算每个子女已穿戴装备的属性加成（主属性 + 副词条）
    const childIds = children.map(c => c.id)
    const equipBonusMap = new Map<number, { atk: number; def: number; max_hp: number; spd: number }>()
    if (childIds.length > 0) {
      const { rows: eqRows } = await pool.query(
        'SELECT child_id, primary_stat, sub_stats FROM child_equipment WHERE child_id = ANY($1::int[]) AND is_equipped = TRUE',
        [childIds]
      )
      for (const er of eqRows) {
        let m = equipBonusMap.get(er.child_id)
        if (!m) { m = { atk: 0, def: 0, max_hp: 0, spd: 0 }; equipBonusMap.set(er.child_id, m) }
        const addS = (s: any) => {
          if (!s) return
          const v = Number(s.value || 0)
          if (s.stat === 'atk') m!.atk += v
          else if (s.stat === 'def') m!.def += v
          else if (s.stat === 'max_hp') m!.max_hp += v
          else if (s.stat === 'spd') m!.spd += v
        }
        addS(er.primary_stat)
        for (const s of (Array.isArray(er.sub_stats) ? er.sub_stats : [])) addS(s)
      }
    }
    const list = children.map(c => {
      const eq = equipBonusMap.get(c.id) || { atk: 0, def: 0, max_hp: 0, spd: 0 }
      // 2026-05-13 起：基础四属性即时按 calcChildBaseStats(aptitude, level) 重算，
      // 不再读 children.max_hp/atk/def/spd 字段；规避公式调整后存量子女不刷新的问题
      const base = calcChildBaseStats(c.aptitude as ChildAptitude, c.level)
      return {
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
        // 列表显示"含装备"的总值（详情页另有"裸 + 装备加成"分离显示）
        maxHp: base.maxHp + Math.floor(eq.max_hp),
        atk:   base.atk   + Math.floor(eq.atk),
        def:   base.def   + Math.floor(eq.def),
        spd:   base.spd   + Math.floor(eq.spd),
        equipBonus: { atk: Math.floor(eq.atk), def: Math.floor(eq.def), maxHp: Math.floor(eq.max_hp), spd: Math.floor(eq.spd) },
        isBattling: c.is_battling,
        hasLeftHome: c.has_left_home,
        permanentBuffPct: Number(c.permanent_buff_pct || 0),
        lastVisitAt: c.last_visit_at,
        bornAt: c.born_at,
      }
    })

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
