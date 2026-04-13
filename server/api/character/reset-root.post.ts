import { getPool } from '~/server/database/db'

const ROOT_BONUS: Record<string, { resist_field: string }> = {
  metal: { resist_field: 'resist_metal' },
  wood:  { resist_field: 'resist_wood' },
  water: { resist_field: 'resist_water' },
  fire:  { resist_field: 'resist_fire' },
  earth: { resist_field: 'resist_earth' },
}

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const { spiritual_root } = await readBody(event)

  const validRoots = ['metal', 'wood', 'water', 'fire', 'earth']
  if (!validRoots.includes(spiritual_root)) {
    return { code: 400, message: '无效的灵根类型' }
  }

  const pool = getPool()

  const { rows: charRows } = await pool.query(
    'SELECT * FROM characters WHERE user_id = $1', [userId]
  )
  if (charRows.length === 0) return { code: 400, message: '角色不存在' }
  const char = charRows[0]

  if (char.spiritual_root === spiritual_root) {
    return { code: 400, message: '已经是该灵根，无需重置' }
  }

  const { rows: pillRows } = await pool.query(
    "SELECT id, count FROM character_pills WHERE character_id = $1 AND pill_id = 'reset_root' AND count > 0 LIMIT 1",
    [char.id]
  )
  if (pillRows.length === 0) return { code: 400, message: '没有天道洗髓丹' }

  await pool.query('UPDATE character_pills SET count = count - 1 WHERE id = $1', [pillRows[0].id])
  await pool.query('DELETE FROM character_pills WHERE id = $1 AND count <= 0', [pillRows[0].id])

  const bonus = ROOT_BONUS[spiritual_root]
  await pool.query(
    `UPDATE characters SET spiritual_root = $1,
     resist_metal = 0, resist_wood = 0, resist_water = 0, resist_fire = 0, resist_earth = 0,
     ${bonus.resist_field} = 0.15
     WHERE id = $2`,
    [spiritual_root, char.id]
  )

  return { code: 200, message: `灵根已重置为${spiritual_root}` }
})
