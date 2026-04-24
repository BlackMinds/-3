// 旧功法 → 新「书+石头」迁移逻辑
// 按小夏指示：不追求 100% 等价，严重衰减的功法通过迁移红利补偿

import type { PoolClient } from 'pg'

// 旧 skill_id → 新配方
// null 表示空孔位
export interface Recipe {
  bookId: string
  stones: (string | null)[]
}

export const SKILL_TO_RECIPE: Record<string, Recipe> = {
  // ===== 主修功法 =====
  basic_sword:  { bookId: 'book_active_white_none',  stones: ['core_strike'] },
  wind_blade:   { bookId: 'book_active_green_metal', stones: ['core_bleed', 'amp_dmg_small'] },
  vine_whip:    { bookId: 'book_active_green_wood',  stones: ['core_poison', 'amp_dmg_small'] },
  ice_palm:     { bookId: 'book_active_green_water', stones: ['core_freeze_lite', 'amp_dmg_small'] },
  flame_sword:  { bookId: 'book_active_green_fire',  stones: ['core_burn', 'amp_dmg_small'] },
  quake_fist:   { bookId: 'book_active_green_earth', stones: ['core_brittle_lite', 'amp_dmg_small'] },

  // ===== 玄品神通 =====
  fire_rain:    { bookId: 'book_divine_blue_fire',  stones: ['core_burn', 'amp_dmg_mid', 'amp_target_all'] },
  frost_nova:   { bookId: 'book_divine_blue_water', stones: ['core_freeze', 'amp_target_all', 'amp_chance_mega'] },
  earth_shield: { bookId: 'book_divine_blue_earth', stones: ['core_shield', null, null] },
  quake_wave:   { bookId: 'book_divine_blue_earth', stones: ['core_brittle', 'amp_target_all', null] },
  vine_prison:  { bookId: 'book_divine_blue_wood',  stones: ['core_root', 'amp_target_all', null] },
  golden_bell:  { bookId: 'book_divine_blue_metal', stones: ['core_immune', null, null] },

  // ===== 地品神通 =====
  sword_storm:  { bookId: 'book_divine_purple_metal', stones: ['core_bleed', 'amp_dmg_large', 'amp_target_3', null] },
  twin_flame:   { bookId: 'book_divine_purple_fire',  stones: ['core_flame_slash', 'amp_dmg_mid', 'amp_target_2', null] },
  flurry_palm:  { bookId: 'book_divine_purple_wood',  stones: ['core_poison', 'amp_multi_hit_3', 'amp_dmg_small', null] },
  spring_heal:  { bookId: 'book_divine_purple_water', stones: ['core_heal_instant', null, null, null] },
  blood_fury:   { bookId: 'book_divine_purple_none',  stones: ['core_atk_up', null, null, null] },
  wood_heal:    { bookId: 'book_divine_purple_wood',  stones: ['core_regen', null, null, null] },
  mirror_water: { bookId: 'book_divine_purple_water', stones: ['core_reflect', null, null, null] },

  // ===== 天品神通 =====
  metal_burst:    { bookId: 'book_divine_gold_metal', stones: ['core_void_slash', 'amp_dmg_small', 'amp_chance_mega', null, null] },
  quake_stomp:    { bookId: 'book_divine_gold_earth', stones: ['core_stun', 'amp_dmg_large', 'amp_chance_mega', null, null] },
  life_drain:     { bookId: 'book_divine_gold_wood',  stones: ['core_atk_debuff', 'amp_dmg_mid', null, null, 'ult_lifesteal'] },
  inferno_burst:  { bookId: 'book_divine_gold_fire',  stones: ['core_burn', 'amp_target_all', 'amp_chance_mega', null, null] },
  storm_blade:    { bookId: 'book_divine_gold_metal', stones: ['core_bleed', 'amp_multi_hit_5', 'amp_chance_mega', null, 'ult_overflow_dmg'] },
  heaven_heal:    { bookId: 'book_divine_gold_wood',  stones: ['core_heal_large', null, null, null, null] },

  // ===== 仙品神通 =====
  time_stop:      { bookId: 'book_divine_red_none',  stones: ['core_timestop', 'amp_target_all', null, null, null] },
  heavenly_wrath: { bookId: 'book_divine_red_metal', stones: ['core_chaos_sword', 'amp_chance_mega', null, null, null] },

  // ===== 灵品被动 =====
  body_refine: { bookId: 'book_passive_green_earth', stones: ['core_passive_def', 'amp_resist_earth'] },
  flame_body:  { bookId: 'book_passive_green_fire',  stones: ['core_passive_atk', 'amp_resist_fire'] },
  water_flow:  { bookId: 'book_passive_green_water', stones: ['core_passive_regen', 'amp_resist_water'] },
  root_grip:   { bookId: 'book_passive_green_wood',  stones: ['core_passive_hp', 'amp_resist_wood'] },
  metal_skin:  { bookId: 'book_passive_green_metal', stones: ['core_passive_def', 'amp_resist_metal'] },

  // ===== 玄品被动 =====
  swift_step:  { bookId: 'book_passive_blue_water', stones: ['core_passive_dodge', 'amp_crit_rate', 'amp_resist_water'] },
  iron_skin:   { bookId: 'book_passive_blue_metal', stones: ['core_passive_def', 'amp_def_p', 'amp_resist_ctrl'] },
  thorn_aura:  { bookId: 'book_passive_blue_wood',  stones: ['core_passive_reflect', 'amp_resist_wood', null] },
  flame_aura:  { bookId: 'book_passive_blue_fire',  stones: ['core_passive_atk', 'amp_atk_p', 'amp_resist_fire'] },
  earth_wall:  { bookId: 'book_passive_blue_earth', stones: ['core_passive_def', 'amp_hp_p', 'amp_resist_earth'] },

  // ===== 地品被动 =====
  crit_master:     { bookId: 'book_passive_purple_metal', stones: ['core_passive_crit', null, null, null] },
  earth_fortitude: { bookId: 'book_passive_purple_earth', stones: ['core_passive_def', 'amp_hp_p', 'amp_resist_ctrl', null] },
  poison_body:     { bookId: 'book_passive_purple_wood',  stones: ['core_passive_hp', 'amp_resist_wood', 'amp_lifesteal', null] },
  fire_mastery:    { bookId: 'book_passive_purple_fire',  stones: ['core_passive_atk', 'amp_atk_p', 'amp_resist_fire', null] },
  dot_amplifier:   { bookId: 'book_passive_purple_wood',  stones: ['core_passive_dot_amp', 'amp_atk_p', 'amp_crit_rate', null] },
  phantom_step:    { bookId: 'book_passive_purple_water', stones: ['core_passive_dodge', 'amp_spd', null, 'trigger_counter'] },
  healing_spring:  { bookId: 'book_passive_purple_wood',  stones: ['core_passive_heal_amp', 'amp_resist_wood', 'amp_resist_water', null] },

  // ===== 天品被动 =====
  water_mastery:  { bookId: 'book_passive_gold_water', stones: ['core_passive_regen', 'amp_def_p', 'amp_resist_water', null, null] },
  battle_frenzy:  { bookId: 'book_passive_gold_none',  stones: ['core_passive_atk', 'amp_atk_p', 'amp_crit_rate', 'amp_crit_dmg', null] },
  heavenly_body:  { bookId: 'book_passive_gold_earth', stones: ['core_passive_def', 'amp_def_p', 'amp_resist_earth', 'trigger_last_stand', null] },

  // ===== 仙品被动 =====
  dao_heart:              { bookId: 'book_passive_red_none', stones: ['core_passive_allstat', 'amp_resist_ctrl', 'amp_cd_cut', null, null] },
  five_elements_harmony:  { bookId: 'book_passive_red_none', stones: ['core_passive_allstat', 'amp_duration', null, null, null] },
}

export interface MigrationReport {
  characterId: number
  booksCreated: number
  stonesEmbedded: number
  unmapped: string[]  // 找不到映射的旧 skill_id
  giftShardsGranted: number
  giftGoldUltStonesGranted: number
}

// 对单个角色执行迁移（事务内调用）
export async function migrateCharacterSkills(client: PoolClient, charId: number): Promise<MigrationReport> {
  const report: MigrationReport = {
    characterId: charId,
    booksCreated: 0,
    stonesEmbedded: 0,
    unmapped: [],
    giftShardsGranted: 0,
    giftGoldUltStonesGranted: 0,
  }

  // 读取旧功法库存（inventory 是唯一真相）
  const { rows: invRows } = await client.query<{ skill_id: string; count: number; level: number }>(
    `SELECT skill_id, count, level FROM character_skill_inventory WHERE character_id = $1`,
    [charId]
  )

  // 读取旧装备状态（以还原 equipped + slot_index）
  const { rows: eqRows } = await client.query<{ skill_id: string; skill_type: string; slot_index: number; level: number }>(
    `SELECT skill_id, skill_type, slot_index, level FROM character_skills WHERE character_id = $1 AND equipped = TRUE`,
    [charId]
  )
  const equippedMap = new Map<string, { slotType: string; slotIndex: number; level: number }>()
  for (const r of eqRows) {
    equippedMap.set(r.skill_id, { slotType: r.skill_type, slotIndex: r.slot_index, level: r.level })
  }

  for (const row of invRows) {
    const recipe = SKILL_TO_RECIPE[row.skill_id]
    if (!recipe) {
      report.unmapped.push(row.skill_id)
      continue
    }

    // 对同一 skill_id 的 count 数本，分别建书
    for (let i = 0; i < row.count; i++) {
      const isEquipped = equippedMap.has(row.skill_id) && i === 0
      const eq = equippedMap.get(row.skill_id)
      await client.query(
        `INSERT INTO character_skill_books
         (character_id, book_id, stones, level, equipped, equipped_slot)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
        [
          charId,
          recipe.bookId,
          JSON.stringify(recipe.stones),
          row.level,
          isEquipped,
          isEquipped ? eq!.slotIndex : null,
        ]
      )
      report.booksCreated++
      report.stonesEmbedded += recipe.stones.filter(Boolean).length
    }
  }

  // 迁移红利
  const GIFT_SHARDS = 20
  const GIFT_GOLD_ULT = 3
  await grantMaterial(client, charId, 'stone_shard', GIFT_SHARDS)
  report.giftShardsGranted = GIFT_SHARDS

  // 3 颗金品质变石（随机）
  const goldUltStones = ['ult_overflow_dmg', 'ult_overflow_heal', 'ult_chain', 'ult_dot_detonate']
  for (let i = 0; i < GIFT_GOLD_ULT; i++) {
    const sid = goldUltStones[Math.floor(Math.random() * goldUltStones.length)]
    await grantStone(client, charId, sid, 1)
  }
  report.giftGoldUltStonesGranted = GIFT_GOLD_ULT

  // 标记迁移完成
  await client.query(
    `UPDATE characters SET stone_migration_done = TRUE, stone_migration_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [charId]
  )

  return report
}

async function grantStone(client: PoolClient, charId: number, stoneId: string, count: number) {
  const { rows } = await client.query(
    `SELECT id FROM character_stone_inventory WHERE character_id = $1 AND stone_id = $2 AND level = 1`,
    [charId, stoneId]
  )
  if (rows.length > 0) {
    await client.query(`UPDATE character_stone_inventory SET count = count + $1 WHERE id = $2`, [count, rows[0].id])
  } else {
    await client.query(
      `INSERT INTO character_stone_inventory (character_id, stone_id, level, count) VALUES ($1, $2, 1, $3)`,
      [charId, stoneId, count]
    )
  }
}

async function grantMaterial(client: PoolClient, charId: number, materialId: string, count: number, quality = 'white') {
  const { rows } = await client.query(
    `SELECT id FROM character_materials WHERE character_id = $1 AND material_id = $2 AND quality = $3`,
    [charId, materialId, quality]
  )
  if (rows.length > 0) {
    await client.query(`UPDATE character_materials SET count = count + $1 WHERE id = $2`, [count, rows[0].id])
  } else {
    await client.query(
      `INSERT INTO character_materials (character_id, material_id, quality, count) VALUES ($1, $2, $3, $4)`,
      [charId, materialId, quality, count]
    )
  }
}
