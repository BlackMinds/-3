// 查询秘境列表（含当前玩家解锁状态、每日剩余次数、积分）
import { getPool } from '~/server/database/db'
import { SECRET_REALMS } from '~/server/engine/secretRealmData'
import { getCharacterByUserId, ensureDailyReset, getSrDailyMax, SR_DAILY_FAIL_PROTECT } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    let char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    char = await ensureDailyReset(char.id, char)

    // 查询通关记录
    const { rows: clearRows } = await pool.query(
      `SELECT secret_realm_id, difficulty, best_rating, clear_count
       FROM secret_realm_clears WHERE character_id = $1`,
      [char.id]
    )
    const clearMap: Record<string, any> = {}
    for (const r of clearRows) {
      clearMap[`${r.secret_realm_id}_${r.difficulty}`] = {
        best_rating: r.best_rating,
        clear_count: r.clear_count,
      }
    }

    const realms = Object.values(SECRET_REALMS).map(r => ({
      id: r.id,
      name: r.name,
      req_realm_tier: r.reqRealmTier,
      req_level: r.reqLevel,
      element: r.element,
      description: r.description,
      drop_tier: r.dropTier,
      is_unlocked: (char.realm_tier || 1) >= r.reqRealmTier && (char.level || 1) >= r.reqLevel,
      difficulties: Object.entries(r.difficulties).map(([k, v]) => ({
        level: Number(k),
        name: v.name,
        waves: v.waves.length,
        reward_mul: v.rewardMul,
        base_points: v.basePoints,
        best_rating: clearMap[`${r.id}_${k}`]?.best_rating || null,
        clear_count: clearMap[`${r.id}_${k}`]?.clear_count || 0,
      })),
    }))

    return {
      code: 200,
      data: {
        realms,
        player: {
          realm_tier: char.realm_tier || 1,
          realm_stage: char.realm_stage || 1,
          level: char.level || 1,
          realm_points: char.realm_points || 0,
          sr_daily_count: char.sr_daily_count || 0,
          sr_daily_max: getSrDailyMax(char),
          sr_daily_fail: char.sr_daily_fail || 0,
          sr_daily_fail_protect: SR_DAILY_FAIL_PROTECT,
        },
      },
    }
  } catch (e: any) {
    console.error('查询秘境列表失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
