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

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 玩家所在宗门 — 用于校验任务归属
      const { rows: memberRows } = await client.query(
        'SELECT sect_id FROM sect_members WHERE character_id = $1', [char.id]
      )
      if (memberRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '未加入宗门' }
      }
      const mySectId = memberRows[0].sect_id

      // FOR UPDATE 锁任务行，防并发重复领取
      const { rows: taskRows } = await client.query(
        'SELECT * FROM sect_weekly_tasks WHERE id = $1 FOR UPDATE', [task_id]
      )
      if (taskRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '任务不存在' }
      }
      // 防止越权领取其他宗门的周常奖励
      if (taskRows[0].sect_id !== mySectId) {
        await client.query('ROLLBACK')
        return { code: 403, message: '无权领取该任务' }
      }
      if (!taskRows[0].completed) {
        await client.query('ROLLBACK')
        return { code: 400, message: '任务未完成' }
      }

      // 幂等插入防重复（UNIQUE 约束兜底）
      const { rowCount: inserted } = await client.query(
        `INSERT INTO sect_weekly_claims (weekly_task_id, character_id) VALUES ($1, $2)
         ON CONFLICT (weekly_task_id, character_id) DO NOTHING`,
        [task_id, char.id]
      )
      if (!inserted) {
        await client.query('ROLLBACK')
        return { code: 400, message: '已领取' }
      }

      const def = WEEKLY_TASK_TYPES.find(t => t.type === taskRows[0].task_type)
      if (!def) {
        await client.query('ROLLBACK')
        return { code: 400, message: '任务定义不存在' }
      }

      // 发放贡献
      await client.query(
        'UPDATE sect_members SET contribution = contribution + $1, total_contribution = total_contribution + $1, weekly_contribution = weekly_contribution + $2 WHERE character_id = $3',
        [def.baseContribution, def.baseContribution, char.id]
      )

      // 全员奖励
      let extraMsg = ''
      if (def.allReward.type === 'spirit_stone') {
        await client.query('UPDATE characters SET spirit_stone = LEAST(70000000000, spirit_stone + $1) WHERE id = $2', [def.allReward.value, char.id])
        extraMsg = `，+${def.allReward.value}灵石`
      } else if (def.allReward.type === 'pill') {
        const pillIds = ['atk_pill_1', 'def_pill_1', 'hp_pill_1']
        for (let i = 0; i < def.allReward.value; i++) {
          const pid = pillIds[rand(0, pillIds.length - 1)]
          await client.query(
            `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.5)
             ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
            [char.id, pid]
          )
        }
        extraMsg = `，丹药x${def.allReward.value}`
      } else if (def.allReward.type === 'skill_page') {
        const pages = ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall']
        for (let i = 0; i < def.allReward.value; i++) {
          const skillId = pages[rand(0, pages.length - 1)]
          await client.query(
            `INSERT INTO character_skill_inventory (character_id, skill_id, count) VALUES ($1, $2, 1)
             ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
            [char.id, skillId]
          )
        }
        extraMsg = `，功法残页x${def.allReward.value}`
      } else if (def.allReward.type === 'enhance_protect') {
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, $3, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + EXCLUDED.count`,
          [char.id, 'enhance_protect', def.allReward.value]
        )
        extraMsg = `，强化保护符x${def.allReward.value}`
      }

      await client.query('COMMIT')

      return { code: 200, message: `领取成功，+${def.baseContribution}贡献${extraMsg}` }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('领取周常奖励失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
