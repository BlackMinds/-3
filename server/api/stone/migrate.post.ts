// 单用户迁移：把旧功法转成新「书+石头」
// 幂等：若已迁移则直接返回；否则执行一次并落库
import { getPool } from '~/server/database/db'
import { migrateCharacterSkills } from '~/server/engine/stoneMigrate'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const { rows: charRows } = await pool.query(
      'SELECT id, stone_migration_done FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const char = charRows[0]
    if (char.stone_migration_done) {
      return { code: 200, data: { alreadyMigrated: true } }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const report = await migrateCharacterSkills(client, char.id)
      await client.query('COMMIT')
      return { code: 200, data: { alreadyMigrated: false, report } }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('迁移失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
