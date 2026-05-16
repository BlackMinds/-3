import { getPool } from '~/server/database/db'

// 玩家详情：基础属性 + 货币 + 订阅到期 + 装备列表（只读）+ 功法背包（只读）
export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id) || id <= 0) {
    return { code: 400, message: '玩家 ID 非法' }
  }

  const pool = getPool()

  const charRes = await pool.query(
    `SELECT c.*, u.username AS account_name, u.status AS user_status, u.last_login
       FROM characters c JOIN users u ON u.id = c.user_id
      WHERE c.id = $1`,
    [id]
  )
  if (charRes.rows.length === 0) {
    return { code: 404, message: '玩家不存在' }
  }
  const c = charRes.rows[0]

  const [equipRes, skillInvRes, equippedRes, ordersRes] = await Promise.all([
    pool.query(
      `SELECT id, name, slot, base_slot, rarity, primary_stat, primary_value,
              sub_stats, awaken_effect, set_id, enhance_level, tier, locked
         FROM character_equipment
        WHERE character_id = $1
        ORDER BY (slot IS NOT NULL) DESC, rarity DESC, primary_value DESC, id DESC`,
      [id]
    ),
    pool.query(
      `SELECT skill_id, count, level
         FROM character_skill_inventory
        WHERE character_id = $1
        ORDER BY level DESC, count DESC`,
      [id]
    ),
    pool.query(
      `SELECT skill_id, skill_type, slot_index, level
         FROM character_skills
        WHERE character_id = $1 AND equipped = TRUE
        ORDER BY skill_type, slot_index`,
      [id]
    ),
    pool.query(
      `SELECT o.id, o.order_no, o.price_rmb, o.status,
              o.paid_at, o.delivered_at, o.created_at, o.notes,
              p.name AS package_name, p.code AS package_code
         FROM recharge_orders o
         JOIN recharge_packages p ON p.id = o.package_id
        WHERE o.character_id = $1
        ORDER BY o.created_at DESC
        LIMIT 50`,
      [id]
    ),
  ])

  return {
    code: 200,
    data: {
      character: {
        id: c.id,
        name: c.name,
        accountName: c.account_name,
        userStatus: c.user_status,
        lastLogin: c.last_login,
        lastActiveAt: c.last_active_at,
        createdAt: c.created_at,

        spiritualRoot: c.spiritual_root,
        realmTier: c.realm_tier,
        realmStage: c.realm_stage,
        cultivationExp: c.cultivation_exp,
        level: c.level,
        levelExp: c.level_exp,

        maxHp: c.max_hp,
        hp: c.hp,
        atk: c.atk,
        def: c.def,
        spd: c.spd,
        critRate: c.crit_rate,
        critDmg: c.crit_dmg,
        dodge: c.dodge,
        lifesteal: c.lifesteal,
        spirit: c.spirit,

        spiritStone: c.spirit_stone,

        title: c.title,
        sectId: c.sect_id,
        currentMap: c.current_map,
      },
      subscriptions: {
        caveOutputMul: Number(c.cave_output_mul) || 1.0,
        sponsorExpireAt: c.sponsor_expire_at,
        oneclickPlant: !!c.sponsor_oneclick_plant,
        oneclickPlantExpireAt: c.oneclick_plant_expire_at,
        bonusPlotCount: c.bonus_plot_count,
        bonusPlotExpireAt: c.bonus_plot_expire_at,
        srDailyBonus: c.sr_daily_bonus,
        srBonusExpireAt: c.sr_bonus_expire_at,
        expeditionDailyBonus: c.expedition_daily_bonus,
        expeditionBonusExpireAt: c.expedition_bonus_expire_at,
        towerDailyBonus: c.tower_daily_bonus,
        towerBonusExpireAt: c.tower_bonus_expire_at,
        towerExtraToday: c.tower_extra_today,
      },
      equipment: equipRes.rows,
      skillInventory: skillInvRes.rows,
      equippedSkills: equippedRes.rows,
      recentOrders: ordersRes.rows,
    },
  }
})
