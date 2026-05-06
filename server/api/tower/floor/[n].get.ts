// GET /api/tower/floor/:n
// 查询某一层的怪物配置（战前预览：name + element + power + traits）
import { getPool } from '~/server/database/db'
import { getFloorDef, IMPLEMENTED_FLOORS, TRAITS } from '~/server/engine/towerData'

export default defineEventHandler(async (event) => {
  try {
    const n = parseInt(getRouterParam(event, 'n') || '0', 10)
    if (!Number.isFinite(n) || n < 1 || n > IMPLEMENTED_FLOORS) {
      return { code: 400, message: '层数超出范围' }
    }
    const def = getFloorDef(n)
    if (!def) return { code: 404, message: '该层数据不存在' }

    // 取角色（用于判断是否已通关该层）
    const pool = getPool()
    const { rows: charRows } = await pool.query(
      'SELECT id, tower_max_floor FROM characters WHERE user_id = $1',
      [event.context.userId]
    )
    const maxFloor = charRows[0]?.tower_max_floor || 0
    const isCleared = n <= maxFloor

    return {
      code: 200,
      data: {
        floor: n,
        name: def.name,
        is_layer_lord: !!def.isLayerLord,
        is_mid_boss: !!def.isMidBoss,
        is_final_boss: !!def.isFinalBoss,
        is_cleared: isCleared,
        reward_title: def.rewardTitle || null,
        permanent_stat_pct: def.permanentStatPct || 0,
        design_note: def.designNote || '',
        monsters: def.monsters.map(m => ({
          name: m.template.name,
          element: m.template.element,
          role: m.template.role,
          power: m.template.power,
          traits: m.traits.map(t => ({
            id: t,
            name: TRAITS[t]?.name || t,
            desc: TRAITS[t]?.desc || '',
            category: TRAITS[t]?.category || '',
          })),
        })),
      }
    }
  } catch (err: any) {
    console.error('通天塔 floor 接口错误:', err)
    return { code: 500, message: '服务器错误' }
  }
})
