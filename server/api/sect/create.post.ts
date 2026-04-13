import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import {
  getSectLevelConfig,
  SECT_CREATE_COST, SECT_CREATE_MIN_REALM_TIER, SECT_CREATE_MIN_LEVEL,
} from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
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

    if (Number(char.spirit_stone) < SECT_CREATE_COST) return { code: 400, message: `灵石不足，需${SECT_CREATE_COST}` }

    // 检查名称唯一
    const { rows: dup } = await pool.query('SELECT id FROM sects WHERE name = $1', [name])
    if (dup.length > 0) return { code: 400, message: '宗门名称已存在' }

    // 扣灵石
    await pool.query('UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2', [SECT_CREATE_COST, char.id])

    // 创建宗门
    const { rows: result } = await pool.query(
      'INSERT INTO sects (name, announcement, leader_id, level, fund, member_count) VALUES ($1, $2, $3, 1, 0, 1) RETURNING id',
      [name, (announcement || '').slice(0, 50), char.id]
    )
    const sectId = result[0].id

    // 加入成员
    await pool.query(
      'INSERT INTO sect_members (sect_id, character_id, role, contribution) VALUES ($1, $2, $3, 0)',
      [sectId, char.id, 'leader']
    )
    await pool.query('UPDATE characters SET sect_id = $1 WHERE id = $2', [sectId, char.id])

    return { code: 200, message: `宗门【${name}】创建成功`, data: { sectId } }
  } catch (error) {
    console.error('创建宗门失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
