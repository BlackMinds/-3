// POST /api/tower/sweep
// 通天塔每日扫荡：每日一次，按 max_floor 内的 10 倍数节点（10/20/.../min(maxFloor, 100)）
// 各发 1-2 本紫品主修功法，全日累计上限 20 本（与 challenge 接口共享 tower_purple_drops 当日额度）。
//   "今日"判定走 SQL 层 (NOW() AT TIME ZONE 'UTC')::DATE → 北京时间 8:00 重置
//   节点级幂等：(character_id, drop_date, floor) 唯一键 — 今日通过 challenge 已掉过的节点会跳过。
import { getPool } from '~/server/database/db'
import { ENTRY_REALM_TIER, ENTRY_LEVEL, IMPLEMENTED_FLOORS } from '~/server/engine/towerData'
import { ACTIVE_SKILLS } from '~/server/engine/skillData'

// v3.9 紫品主修池（与 challenge 接口同源）
const TOWER_PURPLE_ACTIVE_IDS = ['gale_blade', 'wither_bloom', 'frost_art', 'sky_inferno', 'mountain_seal']
const DAILY_PURPLE_DROP_CAP = 20

interface NodeDrop {
  floor: number
  count: number
  skills: { skill_id: string; name: string; element: string | null }[]
  skipped?: 'already_dropped_today' | 'daily_cap_reached'
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()

    const { rows: charRows } = await pool.query(
      `SELECT id, name, realm_tier, level, tower_max_floor,
              (tower_last_sweep_date = (NOW() AT TIME ZONE 'UTC')::DATE) AS sweep_done_today
         FROM characters WHERE user_id = $1`,
      [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const c = charRows[0]

    if ((c.realm_tier || 1) < ENTRY_REALM_TIER || (c.level || 1) < ENTRY_LEVEL) {
      return { code: 403, message: '通天塔需大乘境界且等级 ≥ 140' }
    }

    const maxFloor = c.tower_max_floor || 0
    if (maxFloor < 10) {
      return { code: 400, message: '请先通关第 10 层后再扫荡' }
    }
    if (c.sweep_done_today) {
      return { code: 400, message: '今日已扫荡，明日 8:00 重置' }
    }

    // 可扫的 10 倍数节点：10, 20, ..., min(maxFloor, IMPLEMENTED_FLOORS) 中所有 floor % 10 === 0 的层
    const cap = Math.min(maxFloor, IMPLEMENTED_FLOORS)
    const nodes: number[] = []
    for (let f = 10; f <= cap; f += 10) nodes.push(f)

    const client = await pool.connect()
    const nodeDrops: NodeDrop[] = []
    let totalGranted = 0
    let droppedTodayFinal = 0
    try {
      await client.query('BEGIN')

      // 当日已累计本数（含 challenge 与本次扫荡）
      const { rows: capRows } = await client.query(
        `SELECT COALESCE(SUM(count), 0) AS dropped FROM tower_purple_drops
          WHERE character_id = $1 AND drop_date = (NOW() AT TIME ZONE 'UTC')::DATE`,
        [c.id]
      )
      let droppedToday = Number(capRows[0]?.dropped || 0)

      // 拥有数（inventory + 已装备），用于权重 1/2^owned；扫荡过程中动态累加
      const { rows: invRows } = await client.query(
        'SELECT skill_id, count FROM character_skill_inventory WHERE character_id = $1 AND skill_id = ANY($2)',
        [c.id, TOWER_PURPLE_ACTIVE_IDS]
      )
      const ownedMap: Record<string, number> = {}
      for (const r of invRows) ownedMap[r.skill_id] = r.count || 0
      const { rows: equippedPurple } = await client.query(
        `SELECT skill_id FROM character_skills WHERE character_id = $1 AND skill_id = ANY($2)`,
        [c.id, TOWER_PURPLE_ACTIVE_IDS]
      )
      for (const r of equippedPurple) ownedMap[r.skill_id] = (ownedMap[r.skill_id] || 0) + 1

      // 遍历每个节点
      for (const floor of nodes) {
        if (droppedToday >= DAILY_PURPLE_DROP_CAP) {
          nodeDrops.push({ floor, count: 0, skills: [], skipped: 'daily_cap_reached' })
          continue
        }

        // 本节点 roll 1-2 本，受当日剩余额度截断
        const rolledCount = 1 + Math.floor(Math.random() * 2)
        const remaining = DAILY_PURPLE_DROP_CAP - droppedToday
        const grantCount = Math.min(rolledCount, remaining)

        const chosenList: string[] = []
        for (let i = 0; i < grantCount; i++) {
          const weights = TOWER_PURPLE_ACTIVE_IDS.map(id => {
            const owned = ownedMap[id] || 0
            return owned === 0 ? 100 : Math.max(1, Math.floor(100 / Math.pow(2, owned)))
          })
          const total = weights.reduce((a, b) => a + b, 0)
          let r = Math.random() * total
          let pick = TOWER_PURPLE_ACTIVE_IDS[TOWER_PURPLE_ACTIVE_IDS.length - 1]
          for (let j = 0; j < TOWER_PURPLE_ACTIVE_IDS.length; j++) {
            r -= weights[j]
            if (r <= 0) { pick = TOWER_PURPLE_ACTIVE_IDS[j]; break }
          }
          chosenList.push(pick)
          ownedMap[pick] = (ownedMap[pick] || 0) + 1
        }

        // 节点级幂等 INSERT — 冲突 = 该节点今日已掉过（被 challenge 抢先了），跳过
        const dropRes = await client.query(
          `INSERT INTO tower_purple_drops (character_id, drop_date, floor, skill_id, count)
           VALUES ($1, (NOW() AT TIME ZONE 'UTC')::DATE, $2, $3, $4)
           ON CONFLICT (character_id, drop_date, floor) DO NOTHING RETURNING id`,
          [c.id, floor, chosenList[0], grantCount]
        )
        if ((dropRes.rowCount ?? 0) === 0) {
          nodeDrops.push({ floor, count: 0, skills: [], skipped: 'already_dropped_today' })
          continue
        }

        // 写 inventory
        const skillsDetail: NodeDrop['skills'] = []
        for (const sid of chosenList) {
          await client.query(
            `INSERT INTO character_skill_inventory (character_id, skill_id, count) VALUES ($1, $2, 1)
             ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
            [c.id, sid]
          )
          const def = ACTIVE_SKILLS.find(s => s.id === sid)
          skillsDetail.push({ skill_id: sid, name: def?.name || sid, element: def?.element || null })
        }
        droppedToday += grantCount
        totalGranted += grantCount
        nodeDrops.push({ floor, count: grantCount, skills: skillsDetail })
      }

      droppedTodayFinal = droppedToday

      // 标记今日已扫荡
      await client.query(
        `UPDATE characters
            SET tower_last_sweep_date = (NOW() AT TIME ZONE 'UTC')::DATE
          WHERE id = $1`,
        [c.id]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    // 汇总文案
    let message: string
    if (totalGranted === 0) {
      message = '扫荡完成，但所有节点今日已通过挑战获得过紫品（或当日上限已满）'
    } else {
      // 各功法合计本数（按 skill_id 聚合）
      const summary: Record<string, { name: string; count: number }> = {}
      for (const nd of nodeDrops) {
        for (const s of nd.skills) {
          if (!summary[s.skill_id]) summary[s.skill_id] = { name: s.name, count: 0 }
          summary[s.skill_id].count++
        }
      }
      const parts = Object.values(summary).map(v => `${v.name}×${v.count}`)
      message = `扫荡完成，获得紫品主修：${parts.join('、')}（共 ${totalGranted} 本）`
    }

    return {
      code: 200,
      data: {
        max_floor: maxFloor,
        nodes: nodeDrops,
        total_granted: totalGranted,
        daily_cap: DAILY_PURPLE_DROP_CAP,
        daily_remaining: Math.max(0, DAILY_PURPLE_DROP_CAP - droppedTodayFinal),
      },
      message,
    }
  } catch (err: any) {
    console.error('通天塔 sweep 接口错误:', err)
    return { code: 500, message: '服务器错误' }
  }
})
