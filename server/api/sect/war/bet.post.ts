import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { currentStage } from '~/server/utils/sectWarOdds'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const body = await readBody(event)
  const matchId = Number(body?.matchId)
  const betSide = body?.betSide
  const amount = Number(body?.amount)
  if (!Number.isInteger(matchId) || matchId <= 0) return { code: 400, message: 'matchId 无效' }
  if (betSide !== 'a' && betSide !== 'b') return { code: 400, message: 'betSide 必须是 a 或 b' }
  if (!Number.isInteger(amount) || amount < 1000) return { code: 400, message: '押注金额至少 1000 灵石' }
  if (amount > 50000) return { code: 400, message: '单场押注上限 50,000 灵石' }

  const stage = currentStage()
  if (stage !== 'betting') return { code: 400, message: '当前不在押注窗口期' }

  const pool = getPool()
  const { rows: matchRows } = await pool.query('SELECT * FROM sect_war_match WHERE id = $1', [matchId])
  if (matchRows.length === 0) return { code: 400, message: '对阵不存在' }
  const match = matchRows[0]
  if (match.winner_sect_id) return { code: 400, message: '该对阵已结束' }

  // 禁止押注自家宗门
  const membership = await getMembership(char.id)
  const myselfSectId = membership?.sect_id
  if (myselfSectId === match.sect_a_id && betSide === 'a') {
    return { code: 400, message: '不可押注自家宗门' }
  }
  if (myselfSectId === match.sect_b_id && betSide === 'b') {
    return { code: 400, message: '不可押注自家宗门' }
  }

  const odds = betSide === 'a' ? Number(match.odds_a) : Number(match.odds_b)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁已有押注行，避免并发重复 INSERT / 方向校验失效
    const { rows: existRows } = await client.query(
      `SELECT id, bet_amount, bet_side FROM sect_war_bet
        WHERE match_id = $1 AND character_id = $2 AND status = 'pending'
        FOR UPDATE`,
      [matchId, char.id]
    )

    let newTotal = amount
    if (existRows.length > 0) {
      const exist = existRows[0]
      if (exist.bet_side !== betSide) {
        await client.query('ROLLBACK')
        return { code: 400, message: '同场比赛不可押注不同方向（请先等原押注结算）' }
      }
      newTotal = Number(exist.bet_amount) + amount
      if (newTotal > 50000) {
        await client.query('ROLLBACK')
        return { code: 400, message: '累计押注超上限 50,000 灵石' }
      }
    }

    // 条件扣灵石：WHERE spirit_stone >= $1 防止扣负
    const { rowCount: deducted } = await client.query(
      'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2 AND spirit_stone >= $1',
      [amount, char.id]
    )
    if (!deducted) {
      await client.query('ROLLBACK')
      return { code: 400, message: '灵石不足' }
    }

    if (existRows.length > 0) {
      await client.query(
        `UPDATE sect_war_bet SET bet_amount = $1 WHERE id = $2`,
        [newTotal, existRows[0].id]
      )
    } else {
      await client.query(
        `INSERT INTO sect_war_bet (match_id, character_id, bet_side, bet_amount, odds_at_bet)
         VALUES ($1, $2, $3, $4, $5)`,
        [matchId, char.id, betSide, amount, odds]
      )
    }

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('宗门战押注失败:', e)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
  return { code: 200, message: '押注成功', data: { matchId, betSide, amount, odds } }
})
