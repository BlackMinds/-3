import { getPool } from '~/server/database/db'
import { ALL_MAPS, buildPlayerStats } from '~/server/api/battle/fight.post'
import { buildEquippedSkillInfo } from '~/server/engine/battleEngine'

/**
 * 离线挂机开启 v2：快照角色完整战斗输入
 *
 * 修复策略：开始离线时把当前 BattlerStats + EquippedSkillInfo 序列化存 offline_snapshot，
 * 结算时基于这份快照真打 N 场，按真实胜率算收益。
 *
 * 这样彻底消除"低战力切高图刷收益"的漏洞 —— 打不动就是真打不动，胜率 0 → 收益 0。
 */
// 灰度发布白名单：v2 新版离线挂机暂时只对开发者测试账号开放，验证稳定后放开
const OFFLINE_V2_WHITELIST = new Set<number>([1])

export default defineEventHandler(async (event) => {
  try {
    if (!OFFLINE_V2_WHITELIST.has(event.context.userId)) {
      return { code: 503, message: '离线挂机功能内测中，暂未开放' }
    }
    const pool = getPool()
    const { rows: charRows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1', [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const char = charRows[0]

    if (char.offline_start) return { code: 400, message: '已在离线挂机中' }

    const mapId = char.current_map || 'qingfeng_valley'
    if (!ALL_MAPS[mapId]) return { code: 400, message: '当前地图无效' }

    // 读取战斗所需的全部输入（与 fight.post.ts 保持一致）
    const { rows: equipRows } = await pool.query(
      'SELECT * FROM character_equipment WHERE character_id = $1', [char.id]
    )
    const { rows: skillRows } = await pool.query(
      `SELECT cs.id, cs.character_id, cs.skill_id, cs.skill_type, cs.slot_index,
              cs.equipped, cs.created_at,
              COALESCE(csi.level, cs.level, 1) AS level
         FROM character_skills cs
         LEFT JOIN character_skill_inventory csi
                ON csi.character_id = cs.character_id AND csi.skill_id = cs.skill_id
        WHERE cs.character_id = $1 AND cs.equipped = TRUE
        ORDER BY cs.skill_type, cs.slot_index`,
      [char.id]
    )
    const { rows: buffRows } = await pool.query(
      `SELECT * FROM character_buffs
        WHERE character_id = $1 AND (expire_time > NOW() OR remaining_fights > 0)`,
      [char.id]
    )
    const { rows: caveRows } = await pool.query(
      'SELECT * FROM character_cave WHERE character_id = $1', [char.id]
    )

    // 注入宗门数据
    if (char.sect_id) {
      const { rows: sectRows } = await pool.query('SELECT level FROM sects WHERE id = $1', [char.sect_id])
      if (sectRows.length > 0) char._sectLevel = sectRows[0].level
      const { rows: sectSkillRows } = await pool.query(
        'SELECT skill_key, level FROM sect_skills WHERE character_id = $1 AND frozen = FALSE',
        [char.id]
      )
      char._sectSkills = sectSkillRows
    }

    const { stats: playerStats, expBonusPercent, luckPercent } = buildPlayerStats(char, equipRows, buffRows, caveRows)
    const equippedSkills = buildEquippedSkillInfo(skillRows)

    const snapshot = {
      version: 2,
      playerStats,
      equippedSkills,
      expBonusPercent,
      luckPercent,
      charLevel: char.level,
      charRealmTier: char.realm_tier,
      charRealmStage: char.realm_stage,
    }

    await pool.query(
      `UPDATE characters
          SET offline_start = NOW(),
              offline_map = $1,
              offline_snapshot = $2
        WHERE id = $3`,
      [mapId, JSON.stringify(snapshot), char.id]
    )

    return { code: 200, message: '已进入离线挂机', data: { mapId } }
  } catch (e) {
    console.error('开始离线失败', e)
    return { code: 500, message: '服务器错误' }
  }
})
