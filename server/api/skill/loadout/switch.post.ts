import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'
import { getSkillSlotLimits } from '~/game/data'
import { ensureSkillLoadouts } from '~/server/utils/skillLoadout'

// 切换功法方案 (1/2/3)：把目标方案的 [{skill_id, skill_type, slot_index}] 应用到 character_skills
// 切换前不需要 snapshot 当前 —— save-equipped 已实时同步当前方案
// 复检条件：
//   - 功法仍在 inventory 中（卖光的会被自动跳过）
//   - slot_index 在当前境界槽位上限内（境界回退时仍能切，但超限槽位被跳过）
//   - 同一功法不重复（防数据脏）
export default defineEventHandler(async (event) => {
  const pool = getPool()
  const body = await readBody(event)
  const targetId = Number(body?.loadout_id)

  if (!Number.isInteger(targetId) || targetId < 1 || targetId > 3) {
    return { code: 400, message: '功法方案编号必须为 1/2/3' }
  }

  const char = await getCharId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const charId = char.id

  await ensureSkillLoadouts(charId)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: charRows } = await client.query(
      'SELECT realm_tier, COALESCE(active_skill_loadout, 1) AS active FROM characters WHERE id = $1 FOR UPDATE',
      [charId]
    )
    if (charRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '角色不存在' }
    }
    const realmTier: number = Number(charRows[0].realm_tier) || 1
    const currentActive: number = Number(charRows[0].active) || 1
    const limits = getSkillSlotLimits(realmTier)

    const { rows: loRows } = await client.query(
      'SELECT payload FROM character_skill_loadouts WHERE character_id = $1 AND loadout_id = $2',
      [charId, targetId]
    )
    const rawPayload = loRows[0]?.payload
    const entries: Array<{ skill_id: string; skill_type: string; slot_index: number }> =
      Array.isArray(rawPayload) ? rawPayload : []

    // 读取功法背包 + 等级
    const { rows: invRows } = await client.query(
      'SELECT skill_id, level FROM character_skill_inventory WHERE character_id = $1',
      [charId]
    )
    const invLevelMap: Record<string, number> = {}
    for (const r of invRows) invLevelMap[String(r.skill_id)] = Number(r.level) || 1

    // 校验 + 过滤
    const validEntries: Array<{ skill_id: string; skill_type: string; slot_index: number }> = []
    const skillSeen = new Set<string>()
    const slotSeen = new Set<string>()
    const skipped: Array<{ skill_id: string; reason: string }> = []
    for (const e of entries) {
      const skillId = String(e.skill_id || '')
      const type = String(e.skill_type || '')
      const slotIdx = Number(e.slot_index)
      if (!skillId || !['active', 'divine', 'passive'].includes(type) || !Number.isInteger(slotIdx)) {
        skipped.push({ skill_id: skillId, reason: 'invalid' })
        continue
      }
      if (!(skillId in invLevelMap)) {
        skipped.push({ skill_id: skillId, reason: 'not_owned' })
        continue
      }
      const max = (limits as any)[type] as number | undefined
      if (max === undefined || slotIdx < 0 || slotIdx >= max) {
        skipped.push({ skill_id: skillId, reason: 'slot_locked' })
        continue
      }
      const slotKey = `${type}_${slotIdx}`
      if (slotSeen.has(slotKey) || skillSeen.has(skillId)) {
        skipped.push({ skill_id: skillId, reason: 'duplicate' })
        continue
      }
      slotSeen.add(slotKey)
      skillSeen.add(skillId)
      validEntries.push({ skill_id: skillId, skill_type: type, slot_index: slotIdx })
    }

    // 清空旧装备
    await client.query('DELETE FROM character_skills WHERE character_id = $1', [charId])

    // 写入有效条目（等级从 inventory 读取）
    for (const e of validEntries) {
      const level = invLevelMap[e.skill_id] || 1
      await client.query(
        'INSERT INTO character_skills (character_id, skill_id, skill_type, slot_index, level) VALUES ($1, $2, $3, $4, $5)',
        [charId, e.skill_id, e.skill_type, e.slot_index, level]
      )
    }

    // 同步清掉目标方案中无效的引用，保持数据干净
    if (skipped.some(s => s.reason === 'not_owned' || s.reason === 'invalid' || s.reason === 'duplicate')) {
      await client.query(
        `UPDATE character_skill_loadouts SET payload = $3::jsonb, updated_at = NOW()
         WHERE character_id = $1 AND loadout_id = $2`,
        [charId, targetId, JSON.stringify(validEntries)]
      )
    }

    // 更新 active_skill_loadout
    await client.query(
      'UPDATE characters SET active_skill_loadout = $1 WHERE id = $2',
      [targetId, charId]
    )

    await client.query('COMMIT')

    return {
      code: 200,
      message: `已切换到功法方案 ${targetId}`,
      data: { active_skill_loadout: targetId, prev_loadout: currentActive, skipped },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('切换功法方案失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
