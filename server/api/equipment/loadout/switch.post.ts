import { getPool } from '~/server/database/db'
import { getCharId, ensureLoadouts } from '~/server/utils/equipment'

// 切换装备方案 (1/2/3)：把目标方案的 {slot: equip_id} 应用到 character_equipment.slot
// 切换前不需要 snapshot 当前——equip/unequip 已实时同步当前激活方案到 loadouts
// 装备等级校验在切换时复检（防止：低等级装备穿在方案 2，玩家降级或换号后切回触发不一致）
export default defineEventHandler(async (event) => {
  const pool = getPool()
  const body = await readBody(event)
  const targetId = Number(body?.loadout_id)

  if (!Number.isInteger(targetId) || targetId < 1 || targetId > 3) {
    return { code: 400, message: '方案编号必须为 1/2/3' }
  }

  const char = await getCharId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const charId = char.id

  await ensureLoadouts(charId)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 读取角色等级（用于装备等级门槛校验）
    const { rows: charRows } = await client.query(
      'SELECT level, COALESCE(active_loadout, 1) AS active FROM characters WHERE id = $1 FOR UPDATE',
      [charId]
    )
    if (charRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '角色不存在' }
    }
    const charLv: number = charRows[0].level || 1
    const currentActive: number = charRows[0].active

    // 即使已经在目标方案上，也允许"重置"——把 character_equipment.slot 与 loadout slots 对齐
    // 防御场景：装备被外部改动 / 卖了某件装备但 slot 字段未及时清空

    const { rows: loRows } = await client.query(
      'SELECT slots FROM character_equipment_loadouts WHERE character_id = $1 AND loadout_id = $2',
      [charId, targetId]
    )
    const slots: Record<string, number> = (loRows[0]?.slots && typeof loRows[0].slots === 'object') ? loRows[0].slots : {}

    // 把目标方案中已不存在的装备 id 自动剔除（卖装备已清理过，此处兜底）
    const equipIds = Object.values(slots).map(v => Number(v)).filter(v => Number.isInteger(v))
    let validIds = new Set<number>()
    if (equipIds.length > 0) {
      const { rows: validRows } = await client.query(
        `SELECT id, base_slot, req_level FROM character_equipment
         WHERE character_id = $1 AND id = ANY($2::int[])`,
        [charId, equipIds]
      )
      for (const r of validRows) {
        // 等级不够 / base_slot 不匹配 slot 的装备：忽略（视为该槽位空）
        const requestedSlot = Object.entries(slots).find(([, v]) => Number(v) === r.id)?.[0]
        if (!requestedSlot) continue
        if (r.base_slot && r.base_slot !== requestedSlot) continue
        if (r.req_level && charLv < r.req_level) continue
        validIds.add(r.id)
      }
    }

    // 重置：先把当前角色所有 slot 清空
    await client.query(
      'UPDATE character_equipment SET slot = NULL WHERE character_id = $1',
      [charId]
    )

    // 把目标方案的有效装备应用到 slot
    const skipped: string[] = []
    for (const [slot, rawId] of Object.entries(slots)) {
      const id = Number(rawId)
      if (!validIds.has(id)) {
        skipped.push(slot)
        continue
      }
      await client.query(
        'UPDATE character_equipment SET slot = $1 WHERE id = $2 AND character_id = $3',
        [slot, id, charId]
      )
    }

    // 同步清掉目标方案中不再有效的引用，保持数据干净
    if (skipped.length > 0) {
      // 用每个无效槽位的 key 减掉
      for (const s of skipped) {
        await client.query(
          `UPDATE character_equipment_loadouts SET slots = slots - $3::text, updated_at = NOW()
           WHERE character_id = $1 AND loadout_id = $2`,
          [charId, targetId, s]
        )
      }
    }

    // 更新 active_loadout
    await client.query(
      'UPDATE characters SET active_loadout = $1 WHERE id = $2',
      [targetId, charId]
    )

    await client.query('COMMIT')

    return {
      code: 200,
      message: `已切换至方案 ${targetId}`,
      data: { active_loadout: targetId, prev_loadout: currentActive, skipped },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('切换装备方案失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
