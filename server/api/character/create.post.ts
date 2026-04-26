import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'

const ROOT_BONUS: Record<string, {
  max_hp: number; hp: number; atk: number; def: number; spd: number;
  crit_rate: number; crit_dmg: number;
  resist_field: string;
}> = {
  metal: { max_hp: 500, hp: 500, atk: 58, def: 30, spd: 50, crit_rate: 0.05, crit_dmg: 1.00, resist_field: 'resist_metal' },
  wood:  { max_hp: 575, hp: 575, atk: 50, def: 30, spd: 50, crit_rate: 0.05, crit_dmg: 1.00, resist_field: 'resist_wood' },
  water: { max_hp: 500, hp: 500, atk: 50, def: 35, spd: 50, crit_rate: 0.05, crit_dmg: 1.00, resist_field: 'resist_water' },
  fire:  { max_hp: 500, hp: 500, atk: 50, def: 30, spd: 50, crit_rate: 0.05, crit_dmg: 1.20, resist_field: 'resist_fire' },
  earth: { max_hp: 550, hp: 550, atk: 50, def: 33, spd: 50, crit_rate: 0.05, crit_dmg: 1.00, resist_field: 'resist_earth' },
}

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const { name, spiritual_root } = await readBody(event)

  if (!name || !spiritual_root) {
    return { code: 400, message: '道号和灵根不可为空' }
  }
  if (name.length < 2 || name.length > 8) {
    return { code: 400, message: '道号长度2-8个字' }
  }

  const validRoots = ['metal', 'wood', 'water', 'fire', 'earth']
  if (!validRoots.includes(spiritual_root)) {
    return { code: 400, message: '无效的灵根类型' }
  }

  const pool = getPool()

  const { rows: existing } = await pool.query(
    'SELECT id FROM characters WHERE user_id = $1', [userId]
  )
  if (existing.length > 0) {
    return { code: 400, message: '已有角色，不可重复创建' }
  }

  const { rows: nameTaken } = await pool.query(
    'SELECT id FROM characters WHERE name = $1', [name]
  )
  if (nameTaken.length > 0) {
    return { code: 400, message: '此道号已被占用' }
  }

  const bonus = ROOT_BONUS[spiritual_root]

  const { rows: insertResult } = await pool.query(
    `INSERT INTO characters (
      user_id, name, spiritual_root,
      realm_tier, realm_stage, cultivation_exp,
      max_hp, hp, atk, def, spd,
      crit_rate, crit_dmg,
      ${bonus.resist_field},
      spirit_stone, current_map
    ) VALUES ($1, $2, $3, 1, 1, 0, $4, $5, $6, $7, $8, $9, $10, 0.15, 500, 'qingfeng_valley')
    RETURNING id`,
    [userId, name, spiritual_root, bonus.max_hp, bonus.hp, bonus.atk, bonus.def, bonus.spd, bonus.crit_rate, bonus.crit_dmg]
  )

  const charId = insertResult[0].id
  const { rows: newChar } = await pool.query(
    'SELECT * FROM characters WHERE id = $1',
    [charId]
  )

  // 触发 "踏入仙途" 成就
  checkAchievements(charId, 'char_created', 1).catch(() => {})
  checkAchievements(charId, 'first_login', 1).catch(() => {})

  return { code: 200, message: '角色创建成功', data: newChar[0] }
})
