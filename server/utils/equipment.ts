import { getPool } from '~/server/database/db'

export function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function consumeSpecialItem(charId: number, pillId: string): Promise<boolean> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT id, count FROM character_pills WHERE character_id = $1 AND pill_id = $2 AND count > 0 LIMIT 1',
    [charId, pillId]
  )
  if (rows.length === 0) return false
  await pool.query('UPDATE character_pills SET count = count - 1 WHERE id = $1', [rows[0].id])
  await pool.query('DELETE FROM character_pills WHERE id = $1 AND count <= 0', [rows[0].id])
  return true
}

export const SUB_STAT_POOL = [
  { stat: 'ATK', min: 5, max: 30 },
  { stat: 'DEF', min: 3, max: 20 },
  { stat: 'HP', min: 20, max: 150 },
  { stat: 'SPD', min: 2, max: 15 },
  { stat: 'CRIT_RATE', min: 1, max: 5 },
  { stat: 'CRIT_DMG', min: 5, max: 20 },
  { stat: 'LIFESTEAL', min: 1, max: 5 },
  { stat: 'DODGE', min: 1, max: 4 },
  { stat: 'ARMOR_PEN', min: 3, max: 15 },
  { stat: 'ACCURACY', min: 2, max: 10 },
]

// consumeSpecialItem is exported from server/utils/consumeSpecialItem.ts (Nuxt auto-imports it)

export async function getCharId(userId: any): Promise<{ id: number } | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT id FROM characters WHERE user_id = $1',
    [userId]
  )
  return rows.length > 0 ? rows[0] : null
}
