import { getPool } from '~/server/database/db'
import { buildCharacterSnapshot, type CharacterSnapshot } from '~/server/utils/battleSnapshot'
import { runPvpBattle, type PvpFighterInput } from '~/server/engine/multiBattleEngine'

const DAILY_CHALLENGE_LIMIT = 10
const DAILY_LOSS_LIMIT = 10
const CULTIVATION_LOSS_PCT = 0.01
const ARENA_SCORE_WIN = 20
const ARENA_SCORE_LOSS = 10

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
      'SELECT id, name FROM characters WHERE user_id = $1',
      [userId]
    )
    if (meRows.length === 0) return { code: 400, message: '角色不存在' }
    const me = meRows[0]

    // 2. 查对手
    const { rows: foeRows } = await pool.query(
      'SELECT id, name, cultivation_exp FROM characters WHERE name = $1',
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

    // 5. 跑战斗（1v1 模式：HP×1.3 / 伤害×0.7 / DOT×0.6 / 暴伤-15%）
    const result = runPvpBattle(
      [toInput(aSnap)],
      [toInput(bSnap)],
      { pvpMode: '1v1', sideAName: aSnap.name, sideBName: bSnap.name, maxTurns: 40 }
    )

    const winnerSide = result.winnerSide
    const winnerId = winnerSide === 'a' ? me.id : foe.id
    const loserId = winnerSide === 'a' ? foe.id : me.id
    const loserName = winnerSide === 'a' ? foe.name : me.name

    // 6. 事务：锁 loser → 检查今日被扣次数 → 扣修为/扣分 → 胜方加分 → 写记录
    const client = await pool.connect()
    let cultivationLoss = 0
    let scoreLoss = 0
    try {
      await client.query('BEGIN')
      // 锁 loser 并取当前修为
      const { rows: lockRows } = await client.query(
        'SELECT cultivation_exp FROM characters WHERE id = $1 FOR UPDATE',
        [loserId]
      )
      const curExp = Number(lockRows[0]?.cultivation_exp || 0)
      // 今日 loser 已被扣次数
      const { rows: lossCntRows } = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM pk_records
         WHERE fought_at >= CURRENT_DATE
           AND cultivation_loss > 0
           AND ((winner_side = 'a' AND defender_id = $1)
             OR (winner_side = 'b' AND attacker_id = $1))`,
        [loserId]
      )
      const todayLossCnt = lossCntRows[0].cnt
      if (todayLossCnt < DAILY_LOSS_LIMIT) {
        cultivationLoss = Math.min(curExp, Math.floor(curExp * CULTIVATION_LOSS_PCT))
        if (cultivationLoss > 0) {
          await client.query(
            'UPDATE characters SET cultivation_exp = cultivation_exp - $1 WHERE id = $2',
            [cultivationLoss, loserId]
          )
        }
        // 与修为扣减同步：超过 DAILY_LOSS_LIMIT 后败方不再掉分
        scoreLoss = ARENA_SCORE_LOSS
        await client.query(
          'UPDATE characters SET arena_score = GREATEST(0, arena_score - $1) WHERE id = $2',
          [scoreLoss, loserId]
        )
      }
      // 胜方加分（受 DAILY_CHALLENGE_LIMIT 自然限制：单日最多 +20×10=200）
      await client.query(
        'UPDATE characters SET arena_score = arena_score + $1 WHERE id = $2',
        [ARENA_SCORE_WIN, winnerId]
      )
      await client.query(
        `INSERT INTO pk_records
         (attacker_id, defender_id, attacker_name, defender_name, winner_side, cultivation_loss, battle_log)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [me.id, foe.id, me.name, foe.name, winnerSide, cultivationLoss, JSON.stringify(result.logs)]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      data: {
        winnerSide,                                  // 'a'=自己赢 / 'b'=对方赢
        winnerName: winnerSide === 'a' ? me.name : foe.name,
        loserName,
        cultivationLoss,
        scoreGain: winnerSide === 'a' ? ARENA_SCORE_WIN : -scoreLoss,
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
