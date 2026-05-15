// 求子（开始怀胎）- POST /api/companion/conceive

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getOfficialCompanion, canConceive } from '~/server/utils/companion'
import { rollPregnantCount } from '~/server/utils/child'
import { countChildren, countChildrenByCompanion } from '~/server/utils/child'
import { INTIMACY_CONFIG, QUALITY_TRAITS, type CompanionQuality } from '~/server/engine/companionData'

const MAX_CHILDREN = 5  // 总子女上限（在家 + 离家 合计），2026-05-11 小夏调整
const MAX_PER_COMPANION = 3  // 单道侣胎数上限（2026-05-15 小夏调整）
const PREGNANCY_HOURS = 24
const COST_GOLDEN_LOTUS = 1
const COST_SPIRIT_STONE = 1000000

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getOfficialCompanion(pool, char.id)
    if (!c) return { code: 400, message: '需先正式结侣' }
    if (!canConceive(c.intimacy)) {
      return { code: 400, message: `亲密度不足，需达 ${INTIMACY_CONFIG.conceiveThreshold}` }
    }
    if (c.pregnant_until) {
      return { code: 400, message: '正在怀胎中' }
    }
    const childCount = await countChildren(pool, char.id)
    if (childCount >= MAX_CHILDREN) {
      return { code: 400, message: `子女数已达 ${MAX_CHILDREN} 上限` }
    }
    // 单道侣胎数上限（统一 3 胎）
    const thisCompCount = await countChildrenByCompanion(pool, c.id)
    if (thisCompCount >= MAX_PER_COMPANION) {
      return { code: 400, message: `该道侣已生 ${thisCompCount} 胎，达到单道侣 ${MAX_PER_COMPANION} 胎上限` }
    }
    // 预扣多胎空位 — 防止上/仙品三胎突破总上限 5 或单道侣上限 3
    const traits = QUALITY_TRAITS[c.quality as CompanionQuality]
    const maxBirth = traits.tripletChance > 0 ? 3 : traits.twinChance > 0 ? 2 : 1
    const totalRemaining = MAX_CHILDREN - childCount
    const compRemaining = MAX_PER_COMPANION - thisCompCount
    const tighterRemaining = Math.min(totalRemaining, compRemaining)
    if (tighterRemaining < maxBirth) {
      const reason = compRemaining < totalRemaining
        ? `该道侣剩 ${compRemaining} 胎空位`
        : `总空位仅剩 ${totalRemaining}`
      return {
        code: 400,
        message: `${reason}，而该品质道侣最多可能一胎 ${maxBirth} 子，请改用低品质道侣或更换道侣怀胎`,
      }
    }

    // 检查灵石
    if (Number(char.spirit_stone) < COST_SPIRIT_STONE) {
      return { code: 400, message: `灵石不足，需 ${COST_SPIRIT_STONE}` }
    }
    // 检查金莲花露
    const { rows: matRows } = await pool.query(
      `SELECT count FROM character_materials WHERE character_id = $1 AND material_id = 'golden_lotus_dew'`,
      [char.id]
    )
    const lotusCount = matRows.reduce((a: number, r: any) => a + (r.count || 0), 0)
    if (lotusCount < COST_GOLDEN_LOTUS) {
      return { code: 400, message: '金莲花露不足，可在红尘玉商店购买' }
    }

    // 滚多胎
    const pregnantCount = rollPregnantCount(c.quality as any)
    const pregnantUntil = new Date(Date.now() + PREGNANCY_HOURS * 3600 * 1000)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2',
        [COST_SPIRIT_STONE, char.id]
      )
      // 扣金莲花露 (任意 quality 各扣)
      await client.query(
        `UPDATE character_materials SET count = count - 1
          WHERE character_id = $1 AND material_id = 'golden_lotus_dew'
            AND count > 0
            AND ctid = (SELECT ctid FROM character_materials
                         WHERE character_id = $1 AND material_id = 'golden_lotus_dew' AND count > 0
                         LIMIT 1)`,
        [char.id]
      )
      await client.query(
        `UPDATE companions SET pregnant_until = $1, pregnant_count = $2 WHERE id = $3`,
        [pregnantUntil, pregnantCount, c.id]
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
      data: {
        pregnantUntil,
        pregnantCount,
        message: pregnantCount === 3 ? '🎉 三胎之喜！' : pregnantCount === 2 ? '🎉 双胎之喜！' : '怀胎已开始',
      },
      message: `${PREGNANCY_HOURS} 小时后将迎来 ${pregnantCount === 3 ? '三胎' : pregnantCount === 2 ? '双胎' : '新生命'}`,
    }
  } catch (error) {
    console.error('求子失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
