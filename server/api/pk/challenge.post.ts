import { getPool } from '~/server/database/db'
import { buildCharacterSnapshot, type CharacterSnapshot } from '~/server/utils/battleSnapshot'
import { runPvpBattle, type PvpFighterInput } from '~/server/engine/multiBattleEngine'
import { arenaScoreOnWin, arenaScoreOnLoss } from '~/shared/arenaRanks'
import { pickPkBroadcast } from '~/server/engine/pkBroadcastData'

const DAILY_CHALLENGE_LIMIT = 10
const DAILY_LOSS_LIMIT = 10

function toInput(snap: CharacterSnapshot): PvpFighterInput {
  return {
    characterId: snap.characterId,
    stats: snap.stats,
    equippedSkills: snap.equippedSkills,
  }
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const body = await readBody(event)
    const targetName = String(body?.targetName || '').trim()
    if (!targetName) return { code: 400, message: '请输入对手名' }

    // 1. 取自己角色
    const { rows: meRows } = await pool.query(
      'SELECT id, name, realm_tier, sect_id FROM characters WHERE user_id = $1',
      [userId]
    )
    if (meRows.length === 0) return { code: 400, message: '角色不存在' }
    const me = meRows[0]

    // 2. 查对手
    const { rows: foeRows } = await pool.query(
      'SELECT id, name, cultivation_exp, realm_tier, sect_id FROM characters WHERE name = $1',
      [targetName]
    )
    if (foeRows.length === 0) return { code: 404, message: '查无此人' }
    const foe = foeRows[0]
    if (foe.id === me.id) return { code: 400, message: '不可挑战自己' }

    // 3. 限流：今日挑战次数 ≥ 10 拒绝
    const { rows: cntRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM pk_records
       WHERE attacker_id = $1 AND fought_at >= CURRENT_DATE`,
      [me.id]
    )
    const todayCount = cntRows[0].cnt
    if (todayCount >= DAILY_CHALLENGE_LIMIT) {
      return { code: 429, message: `今日挑战已用尽（${DAILY_CHALLENGE_LIMIT}/${DAILY_CHALLENGE_LIMIT}）` }
    }

    // 4. 双方快照
    const [aSnap, bSnap] = await Promise.all([
      buildCharacterSnapshot(me.id, { forbidPills: true }),
      buildCharacterSnapshot(foe.id, { forbidPills: true }),
    ])
    if (!aSnap || !bSnap) return { code: 500, message: '快照失败' }

    // 5. 跑战斗（1v1 模式：HP×1.3 / 伤害×0.7 / DOT×0.6 / 会伤-15%）
    const result = runPvpBattle(
      [toInput(aSnap)],
      [toInput(bSnap)],
      { pvpMode: '1v1', sideAName: aSnap.name, sideBName: bSnap.name, maxTurns: 40 }
    )

    const winnerSide = result.winnerSide
    const winnerId = winnerSide === 'a' ? me.id : foe.id
    const loserId = winnerSide === 'a' ? foe.id : me.id
    const loserName = winnerSide === 'a' ? foe.name : me.name
    const winnerTier = Number(winnerSide === 'a' ? me.realm_tier : foe.realm_tier) || 1
    const loserTier  = Number(winnerSide === 'a' ? foe.realm_tier : me.realm_tier) || 1

    // 跨境界积分加权: 低境界打赢高境界 +多, 高境界欺负低境界 +少
    const scoreGain = arenaScoreOnWin(winnerTier, loserTier)
    const scoreLossMax = arenaScoreOnLoss(loserTier, winnerTier)

    // 6. 事务：锁 loser → 检查今日败场数 → 扣败方分 → 胜方加分 → 写记录
    const client = await pool.connect()
    let scoreLoss = 0
    try {
      await client.query('BEGIN')
      // 锁 loser（仅占行锁，避免并发同时扣分越界）
      await client.query(
        'SELECT id FROM characters WHERE id = $1 FOR UPDATE',
        [loserId]
      )
      // 今日 loser 已败场次（用来判断是否超出免扣保护）
      const { rows: lossCntRows } = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM pk_records
         WHERE fought_at >= CURRENT_DATE
           AND ((winner_side = 'a' AND defender_id = $1)
             OR (winner_side = 'b' AND attacker_id = $1))`,
        [loserId]
      )
      const todayLossCnt = lossCntRows[0].cnt
      if (todayLossCnt < DAILY_LOSS_LIMIT) {
        // 单日败场超过 DAILY_LOSS_LIMIT 后不再掉分
        scoreLoss = scoreLossMax
        await client.query(
          'UPDATE characters SET arena_score = GREATEST(0, arena_score - $1) WHERE id = $2',
          [scoreLoss, loserId]
        )
      }
      // 仅主动挑战获胜才加分；防守反杀不加分（避免被刷分）
      if (winnerSide === 'a') {
        await client.query(
          'UPDATE characters SET arena_score = arena_score + $1 WHERE id = $2',
          [scoreGain, winnerId]
        )
      }
      await client.query(
        `INSERT INTO pk_records
         (attacker_id, defender_id, attacker_name, defender_name, winner_side, cultivation_loss, battle_log)
         VALUES ($1, $2, $3, $4, $5, 0, $6::jsonb)`,
        [me.id, foe.id, me.name, foe.name, winnerSide, JSON.stringify(result.logs)]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    // 7. 连胜检测 → 风云阁广播（commit 之后，失败不影响主流程）
    // 从最新一条往前数同方向（同一赢家）的连续场次，命中 3/5/10 阈值时发广播
    try {
      const { rows: streakRows } = await pool.query(
        `SELECT winner_side, attacker_id FROM pk_records
          WHERE (attacker_id = $1 AND defender_id = $2)
             OR (attacker_id = $2 AND defender_id = $1)
          ORDER BY fought_at DESC, id DESC
          LIMIT 30`,
        [me.id, foe.id]
      )
      let streak = 0
      for (const r of streakRows) {
        const rowWinnerId = r.winner_side === 'a' ? r.attacker_id : (r.attacker_id === me.id ? foe.id : me.id)
        if (rowWinnerId === winnerId) streak++
        else break
      }
      const winnerName = winnerSide === 'a' ? me.name : foe.name
      const winnerSectId = winnerSide === 'a' ? me.sect_id : foe.sect_id
      const broadcast = pickPkBroadcast(streak, winnerName, loserName)
      if (broadcast) {
        await pool.query(
          `INSERT INTO world_broadcast
             (log_id, character_id, character_name, sect_id, event_id, rarity, is_positive, rendered_text)
           VALUES (NULL, $1, $2, $3, 'PK_STREAK', $4, TRUE, $5)`,
          [winnerId, winnerName, winnerSectId, broadcast.rarity, broadcast.text]
        )
      }
    } catch (broadcastErr) {
      console.error('斗法连胜广播失败（已忽略）:', broadcastErr)
    }

    return {
      code: 200,
      data: {
        winnerSide,                                  // 'a'=自己赢 / 'b'=对方赢
        winnerName: winnerSide === 'a' ? me.name : foe.name,
        loserName,
        // 自己赢: +scoreGain; 自己输: -scoreLoss (受 DAILY_LOSS_LIMIT 影响, 0 = 今日已被打满次)
        scoreGain: winnerSide === 'a' ? scoreGain : -scoreLoss,
        battleLog: result.logs,
        sideAName: me.name,
        sideBName: foe.name,
        remaining: DAILY_CHALLENGE_LIMIT - todayCount - 1,
      },
    }
  } catch (error: any) {
    console.error('斗法挑战失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
