import { getPool } from '~/server/database/db'

// 后台概览：玩家总数 / 今日新增 / 7日活跃 / 订单数 + 总额 / 当前在效月卡数
export default defineEventHandler(async () => {
  const pool = getPool()

  const [
    totalChars,
    newToday,
    activeWeek,
    ordersToday,
    revenueAll,
    activeSubs,
  ] = await Promise.all([
    pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM characters`),
    pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM characters WHERE created_at >= CURRENT_DATE`),
    pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM characters WHERE last_active_at > NOW() - INTERVAL '7 days'`),
    pool.query<{ c: string; sum: string }>(`
      SELECT COUNT(*)::text AS c, COALESCE(SUM(price_rmb), 0)::text AS sum
      FROM recharge_orders
      WHERE status = 'delivered' AND delivered_at >= CURRENT_DATE
    `),
    pool.query<{ c: string; sum: string }>(`
      SELECT COUNT(*)::text AS c, COALESCE(SUM(price_rmb), 0)::text AS sum
      FROM recharge_orders WHERE status = 'delivered'
    `),
    pool.query<{ c: string }>(`
      SELECT COUNT(*)::text AS c FROM characters
      WHERE sponsor_expire_at > NOW()
         OR oneclick_plant_expire_at > NOW()
         OR bonus_plot_expire_at > NOW()
         OR sr_bonus_expire_at > NOW()
         OR expedition_bonus_expire_at > NOW()
    `),
  ])

  return {
    code: 200,
    data: {
      totalCharacters: Number(totalChars.rows[0].c),
      newToday: Number(newToday.rows[0].c),
      activeWeek: Number(activeWeek.rows[0].c),
      ordersToday: Number(ordersToday.rows[0].c),
      revenueToday: Number(ordersToday.rows[0].sum),
      revenueAll: Number(revenueAll.rows[0].sum),
      ordersAll: Number(revenueAll.rows[0].c),
      activeSubscribers: Number(activeSubs.rows[0].c),
    },
  }
})
