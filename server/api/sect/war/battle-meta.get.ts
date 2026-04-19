import { getPool } from '~/server/database/db'

/**
 * 批量拉取一场战斗相关角色的元信息（名字/境界/等级/灵根）
 * 供战报回放组件渲染阵容头像 + 名字
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const ids = String(query.ids || '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0)
  if (ids.length === 0) return { code: 200, message: 'ok', data: [] }
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT id, name, level, realm_tier, realm_stage, spiritual_root, title, max_hp
       FROM characters WHERE id = ANY($1::int[])`,
    [ids]
  )
  return { code: 200, message: 'ok', data: rows }
})
