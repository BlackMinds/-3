// 和离 - POST /api/companion/divorce
// 消耗 红尘解(parting_charm) ×1 + 当前境界灵石 (金丹期 50万)
// 流程: 删 companion / 写 divorce_history / 子女 parent_companion_id 置 NULL /
//      设 divorce_cooldown +1 天 / 写 world_broadcast

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getOfficialCompanion } from '~/server/utils/companion'

const PARTING_CHARM_ID = 'parting_charm'
const DIVORCE_COOLDOWN_HOURS = 24

// 境界基础灵石 ×100 (design 4.2): 金丹期 5000 base → 50万
function calcDivorceStoneCost(realmTier: number): number {
  const base = 5000
  const tierMul = Math.max(1, realmTier - 2)
  return base * 100 * tierMul   // tier3=50万 / tier4=100万 / tier5=150万
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getOfficialCompanion(pool, char.id)
    if (!c) return { code: 400, message: '尚无正式道侣' }

    // 怀胎中不可和离
    if (c.pregnant_until && new Date(c.pregnant_until).getTime() > Date.now()) {
      return { code: 400, message: '怀胎中不可和离' }
    }

    // 红尘解检查
    const { rows: pillRows } = await pool.query(
      `SELECT COALESCE(SUM(count), 0)::int AS total FROM character_pills
        WHERE character_id = $1 AND pill_id = $2`,
      [char.id, PARTING_CHARM_ID]
    )
    const pillCount = pillRows[0]?.total || 0
    if (pillCount < 1) return { code: 400, message: '红尘解不足（需 1 个）' }

    // 灵石检查
    const stoneCost = calcDivorceStoneCost(char.realm_tier)
    if (Number(char.spirit_stone) < stoneCost) {
      return { code: 400, message: `灵石不足，需 ${stoneCost.toLocaleString()}` }
    }

    // 统计子女数（用于 divorce_history）
    const { rows: kidRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM children WHERE parent_companion_id = $1',
      [c.id]
    )
    const childrenCount = kidRows[0]?.cnt || 0

    const broadcastText = `${char.name} 与 ${c.name} 和离，山高水长，再见已是陌路。`

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. 扣红尘解（取首个有库存的行）
      await client.query(
        `UPDATE character_pills SET count = count - 1
          WHERE character_id = $1 AND pill_id = $2 AND count > 0
            AND ctid = (SELECT ctid FROM character_pills
                         WHERE character_id = $1 AND pill_id = $2 AND count > 0
                         LIMIT 1)`,
        [char.id, PARTING_CHARM_ID]
      )

      // 2. 扣灵石
      await client.query(
        'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2',
        [stoneCost, char.id]
      )

      // 3. 子女与该道侣的关系切断
      await client.query(
        'UPDATE children SET parent_companion_id = NULL WHERE parent_companion_id = $1',
        [c.id]
      )

      // 4. 写历史
      await client.query(
        `INSERT INTO divorce_history (character_id, companion_name, quality, intimacy_at_divorce, children_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [char.id, c.name, c.quality, c.intimacy, childrenCount]
      )

      // 5. 删道侣
      await client.query('DELETE FROM companions WHERE id = $1', [c.id])

      // 6. 设和离冷却
      await client.query(
        `UPDATE characters SET divorce_cooldown = NOW() + INTERVAL '${DIVORCE_COOLDOWN_HOURS} hours' WHERE id = $1`,
        [char.id]
      )

      // 7. 风云阁广播
      await client.query(
        `INSERT INTO world_broadcast
           (log_id, character_id, character_name, sect_id, event_id, rarity, is_positive, rendered_text)
         VALUES (NULL, $1, $2, $3, 'DIVORCE', 'rare', FALSE, $4)`,
        [char.id, char.name, char.sect_id || null, broadcastText]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    // 成就触发 — 累计和离次数
    const { rows: dvRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM divorce_history WHERE character_id = $1', [char.id])
    const { checkAchievements } = await import('~/server/engine/achievementData')
    checkAchievements(char.id, 'divorce_count', dvRows[0]?.cnt || 0).catch(() => {})

    return {
      code: 200,
      message: `已与「${c.name}」和离，红尘梦碎`,
      data: {
        stoneCost,
        cooldownHours: DIVORCE_COOLDOWN_HOURS,
        broadcastText,
      },
    }
  } catch (error) {
    console.error('和离失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
