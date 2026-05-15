import type { PoolClient } from 'pg'

/**
 * 发货引擎：根据 package.type 把权益写入 character 表 / character_pills
 *
 * 时间策略：
 * - 月卡未过期 → 在原 expire_at 上叠加 days（续期）
 * - 月卡已过期或为空 → 从 NOW() 起算 days
 * 倍率/数量策略：
 * - 倍率/数量字段直接覆盖（不取 MAX、不累加），因为档位独立
 * - 道具叠加（character_pills.count += payload.count）
 *
 * 所有 SQL 都用参数化，days/数值类参数走 $n，避免拼接。
 */

export type DeliverResult = {
  type: string
  applied: Record<string, any>
  expiresAt?: Date | null
}

// 支持批量倍乘的 type（一次性效果 + 道具堆叠）
// 月卡类按业务语义只能 1 单一发（quantity > 1 在 orders.post.ts 提前拦截）
const QUANTITY_SUPPORTED_TYPES = new Set(['one_time_expedition_count', 'item_pill'])

export function supportsQuantity(type: string): boolean {
  return QUANTITY_SUPPORTED_TYPES.has(type)
}

export async function deliverPackage(
  client: PoolClient,
  characterId: number,
  pkg: { id: number; code: string; type: string; payload: any },
  quantity: number = 1
): Promise<DeliverResult> {
  const payload = pkg.payload || {}
  const days = Number(payload.days) || 30
  const qty = Math.max(1, Math.trunc(quantity))

  switch (pkg.type) {
    case 'sub_cave_mul': {
      const multiplier = Number(payload.multiplier)
      if (!(multiplier > 1.0)) throw new Error(`sub_cave_mul: multiplier 非法 (${multiplier})`)
      const { rows } = await client.query(
        `UPDATE characters
            SET cave_output_mul = $2::numeric,
                sponsor_expire_at = CASE
                  WHEN sponsor_expire_at > NOW() THEN sponsor_expire_at + ($3 || ' days')::interval
                  ELSE NOW() + ($3 || ' days')::interval
                END
          WHERE id = $1
          RETURNING sponsor_expire_at`,
        [characterId, multiplier, String(days)]
      )
      return { type: pkg.type, applied: { multiplier, days }, expiresAt: rows[0]?.sponsor_expire_at }
    }

    case 'sub_oneclick_plant': {
      const { rows } = await client.query(
        `UPDATE characters
            SET sponsor_oneclick_plant = TRUE,
                oneclick_plant_expire_at = CASE
                  WHEN oneclick_plant_expire_at > NOW() THEN oneclick_plant_expire_at + ($2 || ' days')::interval
                  ELSE NOW() + ($2 || ' days')::interval
                END
          WHERE id = $1
          RETURNING oneclick_plant_expire_at`,
        [characterId, String(days)]
      )
      return { type: pkg.type, applied: { days }, expiresAt: rows[0]?.oneclick_plant_expire_at }
    }

    case 'sub_bonus_plot': {
      const count = Number(payload.count)
      if (!(count >= 1)) throw new Error(`sub_bonus_plot: count 非法 (${count})`)
      const { rows } = await client.query(
        `UPDATE characters
            SET bonus_plot_count = $2,
                bonus_plot_expire_at = CASE
                  WHEN bonus_plot_expire_at > NOW() THEN bonus_plot_expire_at + ($3 || ' days')::interval
                  ELSE NOW() + ($3 || ' days')::interval
                END
          WHERE id = $1
          RETURNING bonus_plot_expire_at`,
        [characterId, count, String(days)]
      )
      return { type: pkg.type, applied: { count, days }, expiresAt: rows[0]?.bonus_plot_expire_at }
    }

    case 'sub_sr_bonus': {
      const bonus = Number(payload.bonus) || 1
      const { rows } = await client.query(
        `UPDATE characters
            SET sr_daily_bonus = $2,
                sr_bonus_expire_at = CASE
                  WHEN sr_bonus_expire_at > NOW() THEN sr_bonus_expire_at + ($3 || ' days')::interval
                  ELSE NOW() + ($3 || ' days')::interval
                END
          WHERE id = $1
          RETURNING sr_bonus_expire_at`,
        [characterId, bonus, String(days)]
      )
      return { type: pkg.type, applied: { bonus, days }, expiresAt: rows[0]?.sr_bonus_expire_at }
    }

    case 'sub_expedition_bonus': {
      const bonus = Number(payload.bonus) || 1
      const { rows } = await client.query(
        `UPDATE characters
            SET expedition_daily_bonus = $2,
                expedition_bonus_expire_at = CASE
                  WHEN expedition_bonus_expire_at > NOW() THEN expedition_bonus_expire_at + ($3 || ' days')::interval
                  ELSE NOW() + ($3 || ' days')::interval
                END
          WHERE id = $1
          RETURNING expedition_bonus_expire_at`,
        [characterId, bonus, String(days)]
      )
      return { type: pkg.type, applied: { bonus, days }, expiresAt: rows[0]?.expedition_bonus_expire_at }
    }

    case 'one_time_expedition_count': {
      // 一次性加今日游历次数：写入 expedition_extra_today
      // calcDailyExpeditionLimit 会把这个值加到 limit，跨日 cron 自动归零
      const perUnit = Number(payload.count) || 1
      if (perUnit <= 0) throw new Error(`one_time_expedition_count: count 非法 (${perUnit})`)
      const totalCount = perUnit * qty
      await client.query(
        `UPDATE characters SET expedition_extra_today = expedition_extra_today + $2 WHERE id = $1`,
        [characterId, totalCount]
      )
      return { type: pkg.type, applied: { perUnit, quantity: qty, totalCount, note: '加在 expedition_extra_today，跨日 cron 自动归零' } }
    }

    case 'item_pill': {
      const pillId = String(payload.pill_id || '').trim()
      const perUnit = Number(payload.count) || 1
      if (!pillId) throw new Error(`item_pill: pill_id 为空`)
      if (perUnit <= 0) throw new Error(`item_pill: count 非法 (${perUnit})`)
      const totalCount = perUnit * qty
      await client.query(
        `INSERT INTO character_pills (character_id, pill_id, quality_factor, count)
         VALUES ($1, $2, 1.0, $3)
         ON CONFLICT (character_id, pill_id, quality_factor)
         DO UPDATE SET count = character_pills.count + EXCLUDED.count`,
        [characterId, pillId, totalCount]
      )
      return { type: pkg.type, applied: { pillId, perUnit, quantity: qty, totalCount } }
    }

    default:
      throw new Error(`未知商品类型: ${pkg.type}`)
  }
}

// 生成订单号 R{yyyymmdd}{6位随机} = 15 字
export function generateOrderNo(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')
  return `R${ymd}${rand}`
}
