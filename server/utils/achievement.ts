import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'

/**
 * 根据角色当前状态，对"阈值类"成就做补录（每次进成就页都跑）
 * 阈值类的进度 = 当前状态值，反复 upsert 无害；counter 类（累加事件）在这里不触发
 * 兜底：修主动触发点漏掉的情况（例如历史角色从未在创建/突破时被触发）
 */
export async function backfillThresholdAchievements(charId: number) {
  const pool = getPool()
  const { rows: charRows } = await pool.query('SELECT * FROM characters WHERE id = $1', [charId])
  if (charRows.length === 0) return
  const c = charRows[0]

  if (c.realm_tier >= 1) await checkAchievements(charId, 'realm_tier', c.realm_tier)
  // 练气九层：突破到筑基后 realm_stage 重置为 1，读不到历史值；tier>=2 等价于"练气已满"
  if (c.realm_tier >= 2) await checkAchievements(charId, 'qi_stage', 9)
  else if ((c.realm_stage || 1) > 1) await checkAchievements(charId, 'qi_stage', c.realm_stage || 1)
  if ((c.level || 1) >= 1) await checkAchievements(charId, 'char_level', c.level || 1)
  await checkAchievements(charId, 'char_created', 1)
  await checkAchievements(charId, 'first_login', 1)

  // 装备槽位 / 最高强化
  const { rows: equipSlots } = await pool.query(
    'SELECT COUNT(DISTINCT slot) AS cnt FROM character_equipment WHERE character_id = $1 AND slot IS NOT NULL', [charId]
  )
  if (equipSlots[0]?.cnt > 0) {
    await checkAchievements(charId, 'equip_wear', 1)
    await checkAchievements(charId, 'equip_slots_filled', equipSlots[0].cnt)
  }
  const { rows: enhRows } = await pool.query(
    'SELECT MAX(enhance_level) AS max_lv FROM character_equipment WHERE character_id = $1', [charId]
  )
  if (enhRows[0]?.max_lv > 0) {
    await checkAchievements(charId, 'enhance_max_level', enhRows[0].max_lv)
  }
  // 已拥有的装备品质
  const { rows: rarityRows } = await pool.query(
    'SELECT DISTINCT rarity FROM character_equipment WHERE character_id = $1', [charId]
  )
  for (const r of rarityRows) {
    await checkAchievements(charId, 'equip_' + r.rarity, 1)
  }

  // 功法：已装备数量 / 最高等级 / 种类
  const { rows: skillCount } = await pool.query(
    'SELECT COUNT(*) AS cnt FROM character_skills WHERE character_id = $1', [charId]
  )
  if (skillCount[0]?.cnt > 0) {
    await checkAchievements(charId, 'skill_equip', 1)
    await checkAchievements(charId, 'skill_slots_filled', skillCount[0].cnt)
  }
  // 最高等级从 inventory 读（唯一真相源）
  const { rows: skillLvRows } = await pool.query(
    'SELECT MAX(level) AS max_lv FROM character_skill_inventory WHERE character_id = $1', [charId]
  )
  if (skillLvRows[0]?.max_lv > 0) {
    await checkAchievements(charId, 'skill_max_level', skillLvRows[0].max_lv)
  }
  const { rows: skillTypes } = await pool.query(
    'SELECT COUNT(DISTINCT skill_id) AS cnt FROM character_skill_inventory WHERE character_id = $1', [charId]
  )
  if (skillTypes[0]?.cnt > 0) {
    await checkAchievements(charId, 'skill_types_owned', skillTypes[0].cnt)
  }

  // 洞府最高等级 & 建筑数
  const { rows: caveRows } = await pool.query(
    'SELECT COUNT(*) AS cnt, MAX(level) AS max_lv FROM character_cave WHERE character_id = $1 AND level > 0', [charId]
  )
  if (caveRows[0]?.cnt > 0) {
    await checkAchievements(charId, 'cave_building_count', caveRows[0].cnt)
  }
  if (caveRows[0]?.max_lv > 0) {
    await checkAchievements(charId, 'cave_max_level', caveRows[0].max_lv)
  }

  // 宗门
  const { rows: sectRows } = await pool.query(
    'SELECT sm.role, s.leader_id FROM sect_members sm JOIN sects s ON s.id = sm.sect_id WHERE sm.character_id = $1', [charId]
  )
  if (sectRows.length > 0) {
    await checkAchievements(charId, 'sect_join', 1)
    if (sectRows[0].leader_id === charId) await checkAchievements(charId, 'sect_create', 1)
    if (['leader', 'vice_leader', 'elder'].includes(sectRows[0].role)) await checkAchievements(charId, 'sect_elder', 1)
  }
}

/**
 * 初始化补录：根据角色当前状态，补录已达成但未记录的成就
 * 只在角色第一次访问成就列表时执行一次
 */
export async function initAchievementsIfNeeded(charId: number) {
  const pool = getPool()

  const { rows: existing } = await pool.query(
    'SELECT COUNT(*) AS cnt FROM character_achievements WHERE character_id = $1', [charId]
  )
  if (existing[0].cnt > 0) return

  const { rows: charRows } = await pool.query('SELECT * FROM characters WHERE id = $1', [charId])
  if (charRows.length === 0) return
  const c = charRows[0]

  // 境界
  if (c.realm_tier >= 1) await checkAchievements(charId, 'realm_tier', c.realm_tier)
  if (c.realm_tier === 1 && (c.realm_stage || 1) > 1) await checkAchievements(charId, 'qi_stage', c.realm_stage || 1)
  // 等级
  if ((c.level || 1) > 1) await checkAchievements(charId, 'char_level', c.level || 1)
  // 角色已创建
  await checkAchievements(charId, 'char_created', 1)
  // 首次登录
  await checkAchievements(charId, 'first_login', 1)

  // 装备槽位
  const { rows: equipSlots } = await pool.query(
    'SELECT COUNT(DISTINCT slot) AS cnt FROM character_equipment WHERE character_id = $1 AND slot IS NOT NULL', [charId]
  )
  if (equipSlots[0]?.cnt > 0) {
    await checkAchievements(charId, 'equip_wear', 1)
    await checkAchievements(charId, 'equip_slots_filled', equipSlots[0].cnt)
  }

  // 装备最高强化等级
  const { rows: enhRows } = await pool.query(
    'SELECT MAX(enhance_level) AS max_lv FROM character_equipment WHERE character_id = $1', [charId]
  )
  if (enhRows[0]?.max_lv > 0) {
    await checkAchievements(charId, 'enhance_max_level', enhRows[0].max_lv)
  }

  // 装备品质检查
  const { rows: rarityRows } = await pool.query(
    'SELECT DISTINCT rarity FROM character_equipment WHERE character_id = $1', [charId]
  )
  for (const r of rarityRows) {
    const ev = 'equip_' + r.rarity
    await checkAchievements(charId, ev, 1)
  }

  // 功法数量
  const { rows: skillCount } = await pool.query(
    'SELECT COUNT(*) AS cnt FROM character_skills WHERE character_id = $1 AND equipped = TRUE', [charId]
  )
  if (skillCount[0]?.cnt > 0) {
    await checkAchievements(charId, 'skill_equip', 1)
    await checkAchievements(charId, 'skill_slots_filled', skillCount[0].cnt)
  }

  // 功法最高等级（从 inventory 读——唯一真相源）
  const { rows: skillLvRows } = await pool.query(
    'SELECT MAX(level) AS max_lv FROM character_skill_inventory WHERE character_id = $1', [charId]
  )
  if (skillLvRows[0]?.max_lv > 0) {
    await checkAchievements(charId, 'skill_max_level', skillLvRows[0].max_lv)
  }

  // 功法种类数
  const { rows: skillTypes } = await pool.query(
    'SELECT COUNT(DISTINCT skill_id) AS cnt FROM character_skill_inventory WHERE character_id = $1', [charId]
  )
  if (skillTypes[0]?.cnt > 0) {
    await checkAchievements(charId, 'skill_types_owned', skillTypes[0].cnt)
  }

  // 洞府建筑
  const { rows: caveRows } = await pool.query(
    'SELECT COUNT(*) AS cnt, MAX(level) AS max_lv FROM character_cave WHERE character_id = $1 AND level > 0', [charId]
  )
  if (caveRows[0]?.cnt > 0) {
    for (let i = 0; i < caveRows[0].cnt; i++) await checkAchievements(charId, 'cave_build', 1)
    await checkAchievements(charId, 'cave_building_count', caveRows[0].cnt)
  }
  if (caveRows[0]?.max_lv > 0) {
    await checkAchievements(charId, 'cave_max_level', caveRows[0].max_lv)
  }

  // 宗门
  const { rows: sectRows } = await pool.query(
    'SELECT sm.role, s.leader_id FROM sect_members sm JOIN sects s ON s.id = sm.sect_id WHERE sm.character_id = $1', [charId]
  )
  if (sectRows.length > 0) {
    await checkAchievements(charId, 'sect_join', 1)
    if (sectRows[0].leader_id === charId) await checkAchievements(charId, 'sect_create', 1)
    if (['leader', 'vice_leader', 'elder'].includes(sectRows[0].role)) await checkAchievements(charId, 'sect_elder', 1)
  }
}
