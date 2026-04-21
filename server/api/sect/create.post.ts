import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import {
  SECT_CREATE_COST, SECT_CREATE_MIN_REALM_TIER, SECT_CREATE_MIN_LEVEL,
} from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { name, announcement } = await readBody(event)
  if (!name || name.length < 2 || name.length > 8) return { code: 400, message: '宗门名称2-8个字' }
  if (/[<>"';&]/.test(name)) return { code: 400, message: '名称含非法字符' }

  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  if ((char.realm_tier || 1) < SECT_CREATE_MIN_REALM_TIER) return { code: 400, message: '境界不足，需金丹以上' }
  if ((char.level || 1) < SECT_CREATE_MIN_LEVEL) return { code: 400, message: `等级不足，需Lv.${SECT_CREATE_MIN_LEVEL}` }

  const existing = await getMembership(char.id)
  if (existing) return { code: 400, message: '已有宗门，请先退出' }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 事务内复查（防并发重复创建/并发加入其他宗门）
    const { rows: dup } = await client.query(
      `SELECT id FROM sects WHERE name = $1 FOR UPDATE`, [name]
    )
    if (dup.length > 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '宗门名称已存在' }
    }

    const { rows: existRows } = await client.query(
      'SELECT sect_id FROM sect_members WHERE character_id = $1 FOR UPDATE', [char.id]
    )
    if (existRows.length > 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '已有宗门，请先退出' }
    }

    // 条件扣灵石：WHERE spirit_stone >= $1 防止扣负
    const { rowCount: deducted } = await client.query(
      'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2 AND spirit_stone >= $1',
      [SECT_CREATE_COST, char.id]
    )
    if (!deducted) {
      await client.query('ROLLBACK')
      return { code: 400, message: `灵石不足，需${SECT_CREATE_COST}` }
    }

    // 创建宗门
    const { rows: result } = await client.query(
      'INSERT INTO sects (name, announcement, leader_id, level, fund, member_count) VALUES ($1, $2, $3, 1, 0, 1) RETURNING id',
      [name, (announcement || '').slice(0, 50), char.id]
    )
    const sectId = result[0].id

    // 加入成员 + 角色 sect_id
    await client.query(
      'INSERT INTO sect_members (sect_id, character_id, role, contribution) VALUES ($1, $2, $3, 0)',
      [sectId, char.id, 'leader']
    )
    await client.query('UPDATE characters SET sect_id = $1 WHERE id = $2', [sectId, char.id])

    await client.query('COMMIT')
    return { code: 200, message: `宗门【${name}】创建成功`, data: { sectId } }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('创建宗门失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
