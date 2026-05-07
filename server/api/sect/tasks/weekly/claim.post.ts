import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'
import { rand } from '~/server/utils/random'
import { WEEKLY_TASK_TYPES } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { task_id } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows: taskRows } = await pool.query(
      'SELECT * FROM sect_weekly_tasks WHERE id = $1', [task_id]
    )
    if (taskRows.length === 0) return { code: 400, message: '任务不存在' }
    if (!taskRows[0].completed) return { code: 400, message: '任务未完成' }

    // 检查是否已领取
    const { rows: claimed } = await pool.query(
      'SELECT id FROM sect_weekly_claims WHERE weekly_task_id = $1 AND character_id = $2', [task_id, char.id]
    )
    if (claimed.length > 0) return { code: 400, message: '已领取' }

    const def = WEEKLY_TASK_TYPES.find(t => t.type === taskRows[0].task_type)
    if (!def) return { code: 400, message: '任务定义不存在' }

    // 插入领取记录
    await pool.query('INSERT INTO sect_weekly_claims (weekly_task_id, character_id) VALUES ($1, $2)', [task_id, char.id])

    // 发放贡献
    await pool.query(
      'UPDATE sect_members SET contribution = contribution + $1, total_contribution = total_contribution + $1, weekly_contribution = weekly_contribution + $2 WHERE character_id = $3',
      [def.baseContribution, def.baseContribution, char.id]
    )

    // 全员奖励
    let extraMsg = ''
    if (def.allReward.type === 'spirit_stone') {
      await pool.query('UPDATE characters SET spirit_stone = LEAST(70000000000, spirit_stone + $1) WHERE id = $2', [def.allReward.value, char.id])
      extraMsg = `，+${def.allReward.value}灵石`
    } else if (def.allReward.type === 'pill') {
      const pillIds = ['atk_pill_1', 'def_pill_1', 'hp_pill_1']
      for (let i = 0; i < def.allReward.value; i++) {
        const pid = pillIds[rand(0, pillIds.length - 1)]
        await pool.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.5)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, pid]
        )
      }
      extraMsg = `，丹药x${def.allReward.value}`
    } else if (def.allReward.type === 'skill_page') {
      // 周任务全员奖励固定发蓝色残页（与主掉落 T3 池一致：6 神通蓝 + 5 被动蓝）
      const pages = ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall']
      for (let i = 0; i < def.allReward.value; i++) {
        const skillId = pages[rand(0, pages.length - 1)]
        await pool.query(
          `INSERT INTO character_skill_inventory (character_id, skill_id, count) VALUES ($1, $2, 1)
           ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
          [char.id, skillId]
        )
      }
      extraMsg = `，功法残页x${def.allReward.value}`
    } else if (def.allReward.type === 'enhance_protect') {
      // 2026-05-07：原 gold_equip 改为「强化保护符 x3」，宗门不再产出装备
      await pool.query(
        `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, $3, 1.0)
         ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + EXCLUDED.count`,
        [char.id, 'enhance_protect', def.allReward.value]
      )
      extraMsg = `，强化保护符x${def.allReward.value}`
    }

    return { code: 200, message: `领取成功，+${def.baseContribution}贡献${extraMsg}` }
  } catch (error) {
    console.error('领取周常奖励失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
