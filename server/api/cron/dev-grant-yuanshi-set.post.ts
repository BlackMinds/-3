import { getPool } from '~/server/database/db'
import {
  rollEquipmentV5,
  v5InstanceToDbInsert,
  rollV5EnhanceAffixes,
  applyV5EnhanceMilestone,
  type V5EquipmentInstance,
  type V5StatValue,
} from '~/server/utils/equipment-v5'

/**
 * DEV ONLY — 全服发放两套元始天尊套装（T12 +9 穿身上 / T8 +9 锁包）
 *
 * 用法（dev server 起着）：
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        "http://localhost:3000/api/cron/dev-grant-yuanshi-set?apply=1"
 *
 * Query：
 *   apply=1        实际写入（默认 dry-run，仅样本返回，不动 DB）
 *   limit=N        仅处理前 N 个角色（按 id 升序，调试用）
 *   ids=1,2,3      仅处理指定 character_id（与 limit 互斥）
 *
 * 行为（每个角色，事务内）：
 *   1) 卸下旧装备 (UPDATE slot=NULL)
 *   2) 生成 T12 元始天尊 7 件 红 +9 → slot=base_slot 装上 + locked=true
 *   3) 生成 T8  元始天尊 7 件 红 +9 → slot=NULL  入背包 + locked=true
 *   4) UPSERT loadout1.slots 指向 T12 那 7 件
 *
 * 注意：
 *   - T12 req_level=240，等级不足 240 的角色「被强行穿上」；下次保存装备方案/进副本
 *     时可能触发卸下逻辑（看 API 层校验）。如要避开，请配 limit/ids 控制范围。
 *   - 强化词条按 +0 首 roll 后跑 3 次 milestone（+3/+6/+9）模拟，与正常强化路径一致。
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const apply = query.apply === '1' || query.apply === 'true'
  const limit = query.limit ? Math.max(1, Number(query.limit)) : null
  const ids = query.ids
    ? String(query.ids).split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0)
    : null

  const pool = getPool()

  // 拉角色列表
  let sql = `SELECT id, name, level FROM characters`
  const params: any[] = []
  if (ids && ids.length > 0) {
    sql += ` WHERE id = ANY($1::int[])`
    params.push(ids)
  }
  sql += ` ORDER BY id`
  if (limit) sql += ` LIMIT ${limit}`
  const { rows: characters } = await pool.query(sql, params)

  const errors: Array<{ characterId: number; name: string; error: string }> = []
  let processed = 0
  let granted = 0
  let sample: any = null

  for (const ch of characters) {
    processed++
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const t12Set = generateYuanshiSet(12)
      const t8Set = generateYuanshiSet(8)

      // dry-run 时只生成一个样本返回，不动 DB
      if (!apply) {
        if (!sample) {
          sample = {
            characterId: ch.id,
            characterName: ch.name,
            characterLevel: ch.level,
            t12: t12Set.map(inst => v5InstanceToDbInsert(inst, inst.slot_index === 1 ? 'sword' : null)),
            t8: t8Set.map(inst => v5InstanceToDbInsert(inst, inst.slot_index === 1 ? 'sword' : null)),
          }
        }
        await client.query('ROLLBACK')
        continue
      }

      // 卸下旧 7 件
      await client.query(
        `UPDATE character_equipment SET slot = NULL WHERE character_id = $1 AND slot IS NOT NULL`,
        [ch.id]
      )

      // 插 T12 → 装上 + 锁
      const t12Ids: Record<string, number> = {}
      for (const inst of t12Set) {
        const id = await insertV5Equip(client, ch.id, inst, inst.base_slot_v4, true)
        t12Ids[inst.base_slot_v4] = id
      }
      // 插 T8 → 背包 + 锁
      for (const inst of t8Set) {
        await insertV5Equip(client, ch.id, inst, null, true)
      }

      // upsert loadout1 → T12 那 7 件
      await client.query(
        `INSERT INTO character_equipment_loadouts (character_id, loadout_id, slots, updated_at)
         VALUES ($1, 1, $2::jsonb, NOW())
         ON CONFLICT (character_id, loadout_id) DO UPDATE
           SET slots = EXCLUDED.slots, updated_at = NOW()`,
        [ch.id, JSON.stringify(t12Ids)]
      )

      await client.query('COMMIT')
      granted++
    } catch (e: any) {
      try { await client.query('ROLLBACK') } catch {}
      errors.push({ characterId: ch.id, name: ch.name, error: e?.message ?? String(e) })
    } finally {
      client.release()
    }
  }

  return {
    ok: true,
    mode: apply ? 'apply' : 'dry-run',
    processed,
    granted,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
    sample: !apply ? sample : undefined,
  }
})

/** 生成元始天尊 7 件红装 +9（含 3 次 milestone 模拟） */
function generateYuanshiSet(tier: number): V5EquipmentInstance[] {
  const set: V5EquipmentInstance[] = []
  for (let slotIndex = 1; slotIndex <= 7; slotIndex++) {
    // base_stat_1 按 +9 算（含 enhance_mul=1.9）；首 roll 出 4 条强化词条
    const inst = rollEquipmentV5({
      slotIndex,
      rarity: 'red',
      tier,
      enhanceLevel: 9,
      legendary: 'yuanshi_tianzun',
    })
    // 红装 4 条已满，3 次 milestone 都走 boosted 分支（随机一条 ×1.30）
    let subs: V5StatValue[] = [...inst.enhance_affixes]
    for (const milestone of [3, 6, 9]) {
      const result = applyV5EnhanceMilestone(subs, slotIndex, 'red', milestone, tier)
      subs = result.newSubStats
    }
    set.push({ ...inst, enhance_affixes: subs })
  }
  return set
}

async function insertV5Equip(
  client: any,
  characterId: number,
  inst: V5EquipmentInstance,
  slot: string | null,
  locked: boolean,
): Promise<number> {
  const weaponType = inst.slot_index === 1 ? 'sword' : null
  const f = v5InstanceToDbInsert(inst, weaponType)
  const { rows } = await client.query(
    `INSERT INTO character_equipment
      (character_id, slot, base_slot, weapon_type, name, rarity,
       primary_stat, primary_value, sub_stats, set_id,
       enhance_level, req_level, tier, locked,
       equipment_version, wuxing_prefix, wuxing_affixes, legendary_set_id, is_boss_treasure)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NULL,
             $10, $11, $12, $13,
             $14, $15::text[], $16::jsonb, $17, $18)
     RETURNING id`,
    [
      characterId, slot, f.base_slot, f.weapon_type, f.name, f.rarity,
      f.primary_stat, f.primary_value, f.sub_stats,
      f.enhance_level, f.req_level, f.tier, locked,
      f.equipment_version, f.wuxing_prefix, f.wuxing_affixes, f.legendary_set_id, f.is_boss_treasure,
    ]
  )
  return rows[0].id
}
