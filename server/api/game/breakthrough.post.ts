/**
 * 境界突破 API (v3.3)
 *
 * 规则:
 * - 修为 >= 当前阶段所需,才能尝试突破
 * - 成功率查 shared/balance.ts 的 BREAKTHROUGH_BIG_RATES / STAGE_RATES
 *   (练气/筑基 100%;金丹起小境界也有失败概率,大境界整体偏低)
 * - 成功: 扣除本阶段所需修为,升级 stage 或 tier+1
 * - 失败: 扣除当前修为一定比例(BREAKTHROUGH_PENALTIES),境界不变
 * - 飞升末阶不能再突破
 */

import { getPool } from '~/server/database/db'
import {
  REALM_TIERS,
  getExpRequired,
  getBreakthroughRate,
  getBreakthroughFailPenalty,
} from '~/server/utils/realm'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId

    // 查角色
    const { rows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [userId])
    if (rows.length === 0) return { code: 400, message: '角色不存在' }
    const char = rows[0]

    const tier = Math.max(1, char.realm_tier || 1)
    const stage = Math.max(1, char.realm_stage || 1)
    const exp = Math.max(0, Number(char.cultivation_exp || 0))

    // 飞升末阶不能突
    const t = REALM_TIERS.find(r => r.tier === tier)
    if (!t) return { code: 400, message: '境界数据异常' }
    if (tier === 8 && stage >= t.stages) {
      return { code: 400, message: '已达巅峰,无法再突破' }
    }

    // 修为是否足够
    const req = getExpRequired(tier, stage)
    if (exp < req) {
      return { code: 400, message: '修为不足,继续修炼' }
    }

    // 判定成功率 (突破丹激活 +N%, 上限 100%)
    const baseRate = getBreakthroughRate(tier, stage)
    const boostPct = Number(char.breakthrough_boost_pct || 0)
    const usedBoost = boostPct > 0
    const rate = usedBoost ? Math.min(1, baseRate + boostPct / 100) : baseRate
    const isCrossBigRealm = stage >= t.stages  // 跨大境界
    const rolled = Math.random()
    const success = rolled < rate

    if (!success) {
      // 失败: 扣除当前修为的一定比例(境界越高扣得越多)
      const penalty = getBreakthroughFailPenalty(tier)
      const lost = Math.floor(exp * penalty)
      const newExpAfterFail = exp - lost

      // 事务更新(防并发)
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const { rows: fresh } = await client.query(
          'SELECT cultivation_exp, realm_tier, realm_stage FROM characters WHERE id = $1 FOR UPDATE',
          [char.id]
        )
        if (fresh.length === 0) {
          await client.query('ROLLBACK')
          return { code: 400, message: '角色状态异常' }
        }
        if (Number(fresh[0].realm_tier) !== tier || Number(fresh[0].realm_stage) !== stage) {
          await client.query('ROLLBACK')
          return { code: 400, message: '境界已变化,请刷新后重试' }
        }
        // 用 FOR UPDATE 读出的最新 exp 计算损失 (防止中途被战斗加经验)
        const curExp = Math.max(0, Number(fresh[0].cultivation_exp || 0))
        const realLost = Math.floor(curExp * penalty)
        const realNewExp = curExp - realLost
        await client.query(
          'UPDATE characters SET cultivation_exp = $1, breakthrough_boost_pct = 0 WHERE id = $2',
          [realNewExp, char.id]
        )
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }

      const { rows: updated } = await pool.query('SELECT * FROM characters WHERE id = $1', [char.id])
      return {
        code: 200,
        data: {
          success: false,
          rate,
          baseRate,
          usedBoost,
          boostPct,
          rolled,
          penalty,
          lost,
          message: `突破失败! 成功率 ${Math.round(rate * 100)}%${usedBoost ? ` (含突破丹 +${boostPct}%)` : ''}, 走火入魔损失 ${Math.round(penalty * 100)}% 修为`,
          character: updated[0],
        },
      }
    }

    // 成功: 扣经验 + 升级
    const newExp = exp - req
    let newTier = tier
    let newStage = stage + 1
    if (isCrossBigRealm) {
      newTier = tier + 1
      newStage = 1
    }

    // 原子更新
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // FOR UPDATE 防并发
      const { rows: fresh } = await client.query(
        'SELECT cultivation_exp, realm_tier, realm_stage FROM characters WHERE id = $1 FOR UPDATE',
        [char.id]
      )
      if (fresh.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '角色状态异常' }
      }
      // 并发校验: 别处已经升级过了
      const curTier = Number(fresh[0].realm_tier || 1)
      const curStage = Number(fresh[0].realm_stage || 1)
      const curExp = Number(fresh[0].cultivation_exp || 0)
      if (curTier !== tier || curStage !== stage) {
        await client.query('ROLLBACK')
        return { code: 400, message: '境界已变化,请刷新后重试' }
      }
      if (curExp < req) {
        await client.query('ROLLBACK')
        return { code: 400, message: '修为已变化,请刷新后重试' }
      }

      await client.query(
        'UPDATE characters SET cultivation_exp = $1, realm_tier = $2, realm_stage = $3, breakthrough_boost_pct = 0 WHERE id = $4',
        [newExp, newTier, newStage, char.id]
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }

    // 触发成就：境界 tier 提升（筑基/金丹/元婴/化神/渡劫/大乘/飞升）+ 练气阶段
    checkAchievements(char.id, 'realm_tier', newTier).catch(() => {})
    if (newTier === 1) {
      checkAchievements(char.id, 'qi_stage', newStage).catch(() => {})
    }

    // 返回最新角色
    const { rows: updated } = await pool.query('SELECT * FROM characters WHERE id = $1', [char.id])
    return {
      code: 200,
      data: {
        success: true,
        rate,
        baseRate,
        usedBoost,
        boostPct,
        rolled,
        crossBigRealm: isCrossBigRealm,
        newTier,
        newStage,
        message: isCrossBigRealm ? `突破成功! 跨入新境界!` : `突破成功! 小境界提升`,
        character: updated[0],
      },
    }
  } catch (error: any) {
    console.error('突破失败:', error)
    return { code: 500, message: '服务器错误: ' + (error.message || error) }
  }
})
