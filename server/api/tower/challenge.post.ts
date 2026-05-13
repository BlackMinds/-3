// POST /api/tower/challenge
// 发起一次通天塔挑战
//   入参: { floor: number }
//   规则:
//     - 角色须达到大乘 (realm_tier ≥ 7) + Lv 140
//     - 不在离线挂机
//     - 当日 tower_daily_fail < 3（仅在挑战未通关层时校验）
//     - floor 必须 ≤ max_floor + 1（不能跳层）
//     - floor ≤ max_floor 视为"重温"，胜负不影响进度也不扣失败配额
//     - floor === max_floor + 1 视为"正式挑战"，胜利更新 max_floor，失败扣 1 次配额
import { getPool } from '~/server/database/db'
import { buildEquippedSkillInfo } from '~/server/engine/battleEngine'
import { buildPlayerStats } from '~/server/api/battle/fight.post'
import { buildFloorMonsters, runTowerBattle } from '~/server/engine/towerEngine'
import {
  IMPLEMENTED_FLOORS, DAILY_FAIL_LIMIT,
  ENTRY_REALM_TIER, ENTRY_LEVEL, getFloorDef,
} from '~/server/engine/towerData'
import { checkAchievements } from '~/server/engine/achievementData'
import { ACTIVE_SKILLS } from '~/server/engine/skillData'
import { COMPANION_SEAL_PCT } from '~/shared/balance'
// "今日"判定全部走 SQL 层 (NOW() AT TIME ZONE 'UTC')::DATE，北京时间 8:00 重置（与秘境一致）

// v3.9 紫品主修池（仅通天塔每 10 层节点掉落）
const TOWER_PURPLE_ACTIVE_IDS = ['gale_blade', 'wither_bloom', 'frost_art', 'sky_inferno', 'mountain_seal']
// 单日累计紫品上限（恰好 = 10 个节点 × 每节点上限 2 本，需打到 100 层才能触满）
const DAILY_PURPLE_DROP_CAP = 20

// 通天塔战斗锁（与主战斗锁独立，避免相互冲突）
const towerLock = new Map<number, { until: number }>()
const TOWER_COOLDOWN_MS = 1500

export default defineEventHandler(async (event) => {
  let lockedCharId: number | null = null
  try {
    const pool = getPool()
    const body = await readBody(event)
    const floor = Number(body?.floor)

    if (!Number.isFinite(floor) || floor < 1) return { code: 400, message: '层数无效' }
    if (floor > IMPLEMENTED_FLOORS) return { code: 400, message: `当前仅开放 1-${IMPLEMENTED_FLOORS} 层` }
    const floorDef = getFloorDef(floor)
    if (!floorDef) return { code: 400, message: '层数据不存在' }

    // 取角色 + 用 SQL 表达式同时算"今日是否已重置过失败次数"
    const { rows: charRows } = await pool.query(
      `SELECT *,
              (tower_daily_date = (NOW() AT TIME ZONE 'UTC')::DATE) AS fail_today
         FROM characters WHERE user_id = $1`,
      [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const char = charRows[0]

    // 离线挂机中禁止战斗
    if (char.offline_start) return { code: 400, message: '离线挂机中，请先结束离线' }

    // 大乘门槛
    if ((char.realm_tier || 1) < ENTRY_REALM_TIER || (char.level || 1) < ENTRY_LEVEL) {
      return { code: 403, message: '通天塔需大乘境界且等级 ≥ 140' }
    }

    // 跨日懒重置（必须在校验失败次数前；与秘境一致按 UTC 日期 → 北京时间每日 8:00 重置）
    let dailyFail = char.tower_daily_fail || 0
    if (!char.fail_today) {
      await pool.query(
        `UPDATE characters
            SET tower_daily_fail = 0,
                tower_daily_date = (NOW() AT TIME ZONE 'UTC')::DATE
          WHERE id = $1`,
        [char.id]
      )
      dailyFail = 0
    }

    const maxFloor = char.tower_max_floor || 0
    const isReplay = floor <= maxFloor
    const isAdvance = floor === maxFloor + 1

    if (!isReplay && !isAdvance) {
      return { code: 400, message: '不能跳层挑战，请先通关前置层' }
    }

    if (isAdvance && dailyFail >= DAILY_FAIL_LIMIT) {
      return { code: 403, message: '今日挑战次数已用尽，明日 8:00 重置' }
    }

    // 战斗锁（轻量）
    const lockEntry = towerLock.get(char.id)
    const now = Date.now()
    if (lockEntry && now < lockEntry.until) {
      return { code: 429, message: '战斗冷却中，请稍候' }
    }
    towerLock.set(char.id, { until: now + 60000 })  // 兜底锁 60s
    lockedCharId = char.id

    // 加载战斗依赖（同 fight.post.ts 模式）
    const { rows: equipRows } = await pool.query('SELECT * FROM character_equipment WHERE character_id = $1', [char.id])
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
      'SELECT * FROM character_buffs WHERE character_id = $1 AND (expire_time > NOW() OR remaining_fights > 0)',
      [char.id]
    )
    const { rows: caveRows } = await pool.query('SELECT * FROM character_cave WHERE character_id = $1', [char.id])

    if (char.sect_id) {
      const { rows: sectRows } = await pool.query('SELECT level FROM sects WHERE id = $1', [char.sect_id])
      if (sectRows.length > 0) (char as any)._sectLevel = sectRows[0].level
      const { rows: sectSkillRows } = await pool.query(
        'SELECT skill_key, level FROM sect_skills WHERE character_id = $1 AND frozen = FALSE',
        [char.id]
      )
      ;(char as any)._sectSkills = sectSkillRows
    }

    // 道侣仙缘印记 buff：已正式结侣后获得 +2%~+12% 全属性（与 fight.post.ts 同口径）
    const { rows: compRows } = await pool.query(
      'SELECT seal_level FROM companions WHERE character_id = $1 AND is_official = TRUE LIMIT 1',
      [char.id]
    )
    if (compRows[0]?.seal_level > 0) {
      const pct = COMPANION_SEAL_PCT[Math.min(compRows[0].seal_level, 5)] || 0
      if (pct > 0) (char as any)._companion_seal_pct = pct
    }

    const equippedSkills = buildEquippedSkillInfo(skillRows)
    const { stats: playerStats } = buildPlayerStats(char, equipRows, buffRows, caveRows, equippedSkills)

    // 生成怪物（应用 trait）
    const setup = buildFloorMonsters(floor)
    if (!setup) return { code: 500, message: '层配置生成失败' }

    // 跑战斗
    const outcome = runTowerBattle(playerStats, setup, equippedSkills)

    // ===== 入库与奖励 =====
    let newMaxFloor = maxFloor
    let isFirstClear = false
    let unlockedTitle: string | null = null
    let permanentBonusPct = 0
    let battleId: number | null = null
    // v3.9 紫品主修每 10 层节点掉落（每节点同日仅 1 次，每次随机 1-2 本，全日上限 20 本）
    let purpleSkillDrops: { skill_id: string; name: string; element: string | null }[] = []

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 写战斗记录
      const ins = await client.query(
        `INSERT INTO tower_battles (character_id, floor, result, total_turns, damage_dealt, damage_taken, battle_log)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          char.id, floor, outcome.won ? 'victory' : 'defeat',
          outcome.totalTurns, outcome.damageDealt, outcome.damageTaken,
          JSON.stringify(outcome.logs),
        ]
      )
      battleId = ins.rows[0].id

      if (outcome.won) {
        // v3.9 紫品主修节点掉落（首通/重温通用，仅取决于 floor 和当日额度）
        //   - 节点：floor % 10 === 0 (10/20/.../100)
        //   - 单节点同日仅 1 次（唯一键拦截）
        //   - 每节点随机 1-2 本，每日累计 20 本封顶（达到上限即截断或不发）
        if (floor > 0 && floor % 10 === 0) {
          // 当日已累计本数（SUM(count)），用于上限校验
          const { rows: capRows } = await client.query(
            `SELECT COALESCE(SUM(count), 0) AS dropped FROM tower_purple_drops
              WHERE character_id = $1 AND drop_date = (NOW() AT TIME ZONE 'UTC')::DATE`,
            [char.id]
          )
          const droppedToday = Number(capRows[0]?.dropped || 0)
          if (droppedToday < DAILY_PURPLE_DROP_CAP) {
            // 本节点 roll 1-2 本，超过当日剩余额度时截断
            const rolledCount = 1 + Math.floor(Math.random() * 2)  // 1 或 2
            const remaining = DAILY_PURPLE_DROP_CAP - droppedToday
            const grantCount = Math.min(rolledCount, remaining)

            // 拥有数（inventory + 已装备），用于权重 1/2^owned
            const { rows: invRows } = await client.query(
              'SELECT skill_id, count FROM character_skill_inventory WHERE character_id = $1 AND skill_id = ANY($2)',
              [char.id, TOWER_PURPLE_ACTIVE_IDS]
            )
            const ownedMap: Record<string, number> = {}
            for (const r of invRows) ownedMap[r.skill_id] = r.count || 0
            const { rows: equippedPurple } = await client.query(
              `SELECT skill_id FROM character_skills WHERE character_id = $1 AND skill_id = ANY($2)`,
              [char.id, TOWER_PURPLE_ACTIVE_IDS]
            )
            for (const r of equippedPurple) ownedMap[r.skill_id] = (ownedMap[r.skill_id] || 0) + 1

            // 选 grantCount 个 skill_id（每本独立 roll，已掉的会进 ownedMap 影响后续权重）
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
              ownedMap[pick] = (ownedMap[pick] || 0) + 1  // 影响下一本的权重
            }

            // 节点级幂等 INSERT：成功才发奖；冲突则该节点同日已掉过，跳过
            const dropRes = await client.query(
              `INSERT INTO tower_purple_drops (character_id, drop_date, floor, skill_id, count)
               VALUES ($1, (NOW() AT TIME ZONE 'UTC')::DATE, $2, $3, $4)
               ON CONFLICT (character_id, drop_date, floor) DO NOTHING RETURNING id`,
              [char.id, floor, chosenList[0], grantCount]
            )
            if ((dropRes.rowCount ?? 0) > 0) {
              for (const sid of chosenList) {
                await client.query(
                  `INSERT INTO character_skill_inventory (character_id, skill_id, count) VALUES ($1, $2, 1)
                   ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
                  [char.id, sid]
                )
                const def = ACTIVE_SKILLS.find(s => s.id === sid)
                purpleSkillDrops.push({ skill_id: sid, name: def?.name || sid, element: def?.element || null })
              }
            }
          }
        }

        if (isAdvance) {
          // 推进进度
          newMaxFloor = floor
          await client.query(
            'UPDATE characters SET tower_max_floor = $1 WHERE id = $2',
            [newMaxFloor, char.id]
          )
          // 首通幂等记录
          const clearRes = await client.query(
            `INSERT INTO tower_clears (character_id, floor, battle_id) VALUES ($1, $2, $3)
             ON CONFLICT (character_id, floor) DO NOTHING RETURNING id`,
            [char.id, floor, battleId]
          )
          isFirstClear = clearRes.rowCount! > 0

          if (isFirstClear) {
            // 永久属性加成
            if (floorDef.permanentStatPct && floorDef.permanentStatPct > 0) {
              permanentBonusPct = floorDef.permanentStatPct
              await client.query(
                `UPDATE characters
                    SET permanent_atk_pct = COALESCE(permanent_atk_pct, 0) + $1,
                        permanent_def_pct = COALESCE(permanent_def_pct, 0) + $1,
                        permanent_hp_pct  = COALESCE(permanent_hp_pct, 0) + $1
                  WHERE id = $2`,
                [permanentBonusPct, char.id]
              )
            }
            // 称号通过成就系统授予（让玩家在成就页可佩戴）
            if (floorDef.rewardTitle) {
              unlockedTitle = floorDef.rewardTitle
            }
          }
        }
        // isReplay = 已通关层重温胜利，不发奖、不更新 max_floor
      } else {
        // 失败：仅当挑战 > max_floor 的层（isAdvance）时扣配额
        if (isAdvance) {
          dailyFail += 1
          await client.query(
            `UPDATE characters
                SET tower_daily_fail = $1,
                    tower_daily_date = (NOW() AT TIME ZONE 'UTC')::DATE
              WHERE id = $2`,
            [dailyFail, char.id]
          )
        }
      }

      await client.query('COMMIT')
    } catch (txErr) {
      await client.query('ROLLBACK')
      throw txErr
    } finally {
      client.release()
    }

    // 触发成就 (在事务外，避免长事务)
    // 通天塔成就用 'tower_clear_floor' 事件，threshold 模式（传入当前最高层）
    if (outcome.won && isAdvance) {
      try {
        await checkAchievements(char.id, 'tower_clear_floor', newMaxFloor)
      } catch (e) {
        console.error('通天塔成就触发失败:', e)
      }
    }

    return {
      code: 200,
      data: {
        battle: {
          id: battleId,
          floor,
          result: outcome.won ? 'victory' : 'defeat',
          total_turns: outcome.totalTurns,
          damage_dealt: outcome.damageDealt,
          damage_taken: outcome.damageTaken,
          logs: outcome.logs,
          monsters_info: outcome.monstersInfo,
          is_first_clear: isFirstClear,
          unlocked_title: unlockedTitle,
          permanent_bonus_pct: permanentBonusPct,
          purple_skill_drops: purpleSkillDrops,
        },
        state_after: {
          max_floor: newMaxFloor,
          daily_fail_used: dailyFail,
          can_challenge: dailyFail < DAILY_FAIL_LIMIT && newMaxFloor < IMPLEMENTED_FLOORS,
        },
        is_replay: isReplay,
      }
    }
  } catch (err: any) {
    console.error('通天塔 challenge 错误:', err)
    return { code: 500, message: '服务器错误' }
  } finally {
    if (lockedCharId != null) {
      towerLock.set(lockedCharId, { until: Date.now() + TOWER_COOLDOWN_MS })
    }
  }
})
