/**
 * 宗门战赛季引擎 - 匹配、开赛、结算
 */

import { getPool } from '~/server/database/db'
import { buildCharacterSnapshot, type CharacterSnapshot } from '~/server/utils/battleSnapshot'
import { runPvpBattle, type PvpFighterInput } from '~/server/engine/multiBattleEngine'
import { sendMail, sendMailBatch, upsertTimedBuff } from '~/server/utils/mail'
import { computeOdds, currentSeasonNo } from '~/server/utils/sectWarOdds'

/**
 * 周三 00:00 — 生成对阵 + 赔率
 */
export async function generateMatches(seasonId: number): Promise<{ matchesCreated: number; byes: number }> {
  const pool = getPool()
  const { rows: regs } = await pool.query(
    `SELECT r.*, s.name FROM sect_war_registration r
       JOIN sects s ON r.sect_id = s.id
      WHERE r.season_id = $1
      ORDER BY r.total_power DESC`,
    [seasonId]
  )
  if (regs.length < 2) return { matchesCreated: 0, byes: regs.length }

  // 按战力 ±20% 匹配（近 3 周避免重复，简化版 v1 不查历史）
  const unpaired = [...regs]
  let matchesCreated = 0
  while (unpaired.length >= 2) {
    const a = unpaired.shift()!
    // 找战力 ±20% 的最接近对手
    let bestIdx = 0
    let bestDiff = Number.POSITIVE_INFINITY
    for (let i = 0; i < unpaired.length; i++) {
      const diff = Math.abs(Number(a.total_power) - Number(unpaired[i].total_power))
      const avg = (Number(a.total_power) + Number(unpaired[i].total_power)) / 2
      if (avg > 0 && diff / avg > 0.20) continue
      if (diff < bestDiff) {
        bestDiff = diff
        bestIdx = i
      }
    }
    const b = unpaired.splice(bestIdx, 1)[0]
    const { oddsA, oddsB } = computeOdds(Number(a.total_power), Number(b.total_power))
    await pool.query(
      `INSERT INTO sect_war_match (season_id, sect_a_id, sect_b_id, odds_a, odds_b)
       VALUES ($1, $2, $3, $4, $5)`,
      [seasonId, a.sect_id, b.sect_id, oddsA, oddsB]
    )
    matchesCreated++
  }
  // 更新赛季状态
  await pool.query(`UPDATE sect_war_season SET status = 'betting' WHERE id = $1`, [seasonId])
  return { matchesCreated, byes: unpaired.length }
}

async function runOneMatch(matchId: number) {
  const pool = getPool()
  const { rows: matchRows } = await pool.query(
    `SELECT m.*, ra.roster_duel AS a_duel, ra.roster_team_a AS a_team_a, ra.roster_team_b AS a_team_b,
            rb.roster_duel AS b_duel, rb.roster_team_a AS b_team_a, rb.roster_team_b AS b_team_b,
            sa.name AS sect_a_name, sb.name AS sect_b_name
       FROM sect_war_match m
       JOIN sect_war_registration ra ON ra.season_id = m.season_id AND ra.sect_id = m.sect_a_id
       JOIN sect_war_registration rb ON rb.season_id = m.season_id AND rb.sect_id = m.sect_b_id
       JOIN sects sa ON m.sect_a_id = sa.id
       JOIN sects sb ON m.sect_b_id = sb.id
      WHERE m.id = $1`,
    [matchId]
  )
  if (matchRows.length === 0) return
  const m = matchRows[0]

  let scoreA = 0, scoreB = 0
  const mvpStats: Record<number, { wins: number; dmg: number; taken: number; side: 'a' | 'b' }> = {}

  // 单挑 3 场
  for (let i = 0; i < 3; i++) {
    const aCid = m.a_duel[i]
    const bCid = m.b_duel[i]
    const [aSnap, bSnap] = await Promise.all([
      buildCharacterSnapshot(aCid, { forbidPills: true }),
      buildCharacterSnapshot(bCid, { forbidPills: true }),
    ])
    if (!aSnap || !bSnap) continue
    const result = runPvpBattle(
      [toInput(aSnap, m.sect_a_id)],
      [toInput(bSnap, m.sect_b_id)],
      { maxTurns: 30, sideAName: m.sect_a_name, sideBName: m.sect_b_name }
    )
    const winner = result.winnerSide
    if (winner === 'a') scoreA += 1; else scoreB += 1

    await pool.query(
      `INSERT INTO sect_war_battle (match_id, round_no, battle_type, side_a_chars, side_b_chars, winner_side, battle_log)
       VALUES ($1, $2, 'duel', $3::jsonb, $4::jsonb, $5, $6::jsonb)`,
      [matchId, i + 1, JSON.stringify([aCid]), JSON.stringify([bCid]), winner, JSON.stringify(result.logs)]
    )

    // MVP 统计
    const aF = result.sideA[0], bF = result.sideB[0]
    mvpStats[aCid] = mvpStats[aCid] || { wins: 0, dmg: 0, taken: 0, side: 'a' }
    mvpStats[bCid] = mvpStats[bCid] || { wins: 0, dmg: 0, taken: 0, side: 'b' }
    if (winner === 'a') mvpStats[aCid].wins++
    else mvpStats[bCid].wins++
    mvpStats[aCid].dmg += aF.totalDmgDealt
    mvpStats[aCid].taken += aF.totalDmgTaken
    mvpStats[bCid].dmg += bF.totalDmgDealt
    mvpStats[bCid].taken += bF.totalDmgTaken
  }

  // 检查单挑 0:3 的提前判负
  const singlesDecisive = (scoreA === 0 && scoreB === 3) || (scoreB === 0 && scoreA === 3)

  // 团战 1（权重 2）
  if (!singlesDecisive) {
    const aSnaps = await Promise.all(m.a_team_a.map((cid: number) => buildCharacterSnapshot(cid)))
    const bSnaps = await Promise.all(m.b_team_a.map((cid: number) => buildCharacterSnapshot(cid)))
    const aValid = aSnaps.filter((s: CharacterSnapshot | null): s is CharacterSnapshot => !!s).map(s => toInput(s, m.sect_a_id))
    const bValid = bSnaps.filter((s: CharacterSnapshot | null): s is CharacterSnapshot => !!s).map(s => toInput(s, m.sect_b_id))
    const result = runPvpBattle(aValid, bValid, { sideAName: m.sect_a_name, sideBName: m.sect_b_name })
    const winner = result.winnerSide
    if (winner === 'a') scoreA += 2; else scoreB += 2
    await pool.query(
      `INSERT INTO sect_war_battle (match_id, round_no, battle_type, side_a_chars, side_b_chars, winner_side, battle_log)
       VALUES ($1, 4, 'team', $2::jsonb, $3::jsonb, $4, $5::jsonb)`,
      [matchId, JSON.stringify(m.a_team_a), JSON.stringify(m.b_team_a), winner, JSON.stringify(result.logs)]
    )
  }

  // 检查是否已经分出胜负（先达 5 分）
  const needRound5 = !singlesDecisive && Math.max(scoreA, scoreB) < 5

  // 团战 2（权重 3，终局）
  if (needRound5) {
    const aSnaps = await Promise.all(m.a_team_b.map((cid: number) => buildCharacterSnapshot(cid)))
    const bSnaps = await Promise.all(m.b_team_b.map((cid: number) => buildCharacterSnapshot(cid)))
    const aValid = aSnaps.filter((s: CharacterSnapshot | null): s is CharacterSnapshot => !!s).map(s => toInput(s, m.sect_a_id))
    const bValid = bSnaps.filter((s: CharacterSnapshot | null): s is CharacterSnapshot => !!s).map(s => toInput(s, m.sect_b_id))
    const result = runPvpBattle(aValid, bValid, { sideAName: m.sect_a_name, sideBName: m.sect_b_name })
    const winner = result.winnerSide
    if (winner === 'a') scoreA += 3; else scoreB += 3
    await pool.query(
      `INSERT INTO sect_war_battle (match_id, round_no, battle_type, side_a_chars, side_b_chars, winner_side, battle_log)
       VALUES ($1, 5, 'team', $2::jsonb, $3::jsonb, $4, $5::jsonb)`,
      [matchId, JSON.stringify(m.a_team_b), JSON.stringify(m.b_team_b), winner, JSON.stringify(result.logs)]
    )
  }

  const winnerSectId = scoreA > scoreB ? m.sect_a_id : (scoreB > scoreA ? m.sect_b_id : m.sect_a_id)

  // MVP: 在全部 6 名单挑人中选 （胜场 → 伤害 → 承伤↑ / 反之承伤↓ 时低者优先）
  const mvpCandidates = Object.entries(mvpStats).map(([cid, s]) => ({ cid: Number(cid), ...s }))
  mvpCandidates.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins
    if (y.dmg !== x.dmg) return y.dmg - x.dmg
    return x.taken - y.taken
  })
  const mvpId = mvpCandidates[0]?.cid || null

  await pool.query(
    `UPDATE sect_war_match
      SET winner_sect_id = $1, score_a = $2, score_b = $3,
          mvp_character_id = $4, fought_at = NOW()
      WHERE id = $5`,
    [winnerSectId, scoreA, scoreB, mvpId, matchId]
  )
  return { matchId, winnerSectId, scoreA, scoreB, mvpId, m }
}

function toInput(snap: CharacterSnapshot, sectId?: number): PvpFighterInput {
  return {
    characterId: snap.characterId,
    sectId,
    stats: snap.stats,
    equippedSkills: snap.equippedSkills,
  }
}

/**
 * 周五 20:00 — 批量跑本赛季所有对阵 + 结算奖励/押注
 */
export async function runSeasonFights(seasonId: number) {
  const pool = getPool()
  await pool.query(`UPDATE sect_war_season SET status = 'fighting' WHERE id = $1`, [seasonId])

  const { rows: matches } = await pool.query(
    `SELECT id FROM sect_war_match WHERE season_id = $1 AND winner_sect_id IS NULL`,
    [seasonId]
  )
  let processed = 0
  for (const { id } of matches) {
    const res = await runOneMatch(id)
    if (res) {
      await settleMatchRewards(id)
      await settleMatchBets(id)
      processed++
    }
  }
  await pool.query(`UPDATE sect_war_season SET status = 'settled' WHERE id = $1`, [seasonId])
  return { processed }
}

/**
 * 单场对阵 - 发放奖励（邮件下发）
 */
export async function settleMatchRewards(matchId: number) {
  const pool = getPool()
  const { rows: matchRows } = await pool.query(
    `SELECT m.*, sa.name AS sect_a_name, sb.name AS sect_b_name,
            ra.roster_duel AS a_duel, ra.roster_team_a AS a_team_a, ra.roster_team_b AS a_team_b,
            rb.roster_duel AS b_duel, rb.roster_team_a AS b_team_a, rb.roster_team_b AS b_team_b
       FROM sect_war_match m
       JOIN sect_war_registration ra ON ra.season_id = m.season_id AND ra.sect_id = m.sect_a_id
       JOIN sect_war_registration rb ON rb.season_id = m.season_id AND rb.sect_id = m.sect_b_id
       JOIN sects sa ON m.sect_a_id = sa.id
       JOIN sects sb ON m.sect_b_id = sb.id
      WHERE m.id = $1`,
    [matchId]
  )
  if (matchRows.length === 0) return
  const m = matchRows[0]
  const winnerSectId = m.winner_sect_id
  const loserSectId = winnerSectId === m.sect_a_id ? m.sect_b_id : m.sect_a_id
  const winnerName = winnerSectId === m.sect_a_id ? m.sect_a_name : m.sect_b_name
  const loserName = winnerSectId === m.sect_a_id ? m.sect_b_name : m.sect_a_name

  // 胜方 +250000 / 败方 +80000
  await pool.query('UPDATE sects SET fund = fund + 250000 WHERE id = $1', [winnerSectId])
  await pool.query('UPDATE sects SET fund = fund + 80000 WHERE id = $1', [loserSectId])

  const winnerRoster = winnerSectId === m.sect_a_id
    ? [...m.a_duel, ...m.a_team_a, ...m.a_team_b]
    : [...m.b_duel, ...m.b_team_a, ...m.b_team_b]
  const loserRoster = winnerSectId === m.sect_a_id
    ? [...m.b_duel, ...m.b_team_a, ...m.b_team_b]
    : [...m.a_duel, ...m.a_team_a, ...m.a_team_b]

  // 胜方参战 9 人：贡献 +2000 + 灵石 +50000
  for (const cid of winnerRoster) {
    await sendMail({
      characterId: cid,
      category: 'sect_war',
      title: `宗门战捷报：${winnerName} 战胜 ${loserName}`,
      content: `你所在的宗门【${winnerName}】击败了【${loserName}】，获得参战奖励。比分 ${m.score_a}:${m.score_b}。`,
      attachments: [
        { type: 'contribution', amount: 2000 },
        { type: 'spirit_stone', amount: 50000 },
      ],
      refType: 'match',
      refId: matchId,
    })
  }
  // 败方参战 9 人：贡献 +500 + 灵石 +10000
  for (const cid of loserRoster) {
    await sendMail({
      characterId: cid,
      category: 'sect_war',
      title: `宗门战战报：${loserName} vs ${winnerName}`,
      content: `本次宗门战，你所在宗门【${loserName}】不敌【${winnerName}】，但参战仍有奖励。比分 ${m.score_a}:${m.score_b}。`,
      attachments: [
        { type: 'contribution', amount: 500 },
        { type: 'spirit_stone', amount: 10000 },
      ],
      refType: 'match',
      refId: matchId,
    })
  }

  // 胜方全宗门 Buff：atk_pct +5%, def_pct +5% 7 天
  const { rows: sectMembers } = await pool.query(
    `SELECT character_id FROM sect_members WHERE sect_id = $1`,
    [winnerSectId]
  )
  for (const mem of sectMembers) {
    await upsertTimedBuff(mem.character_id, 'sect_war_win', String(winnerSectId), 'atk_pct', 5, 7 * 24 * 3600)
    await upsertTimedBuff(mem.character_id, 'sect_war_win', String(winnerSectId), 'def_pct', 5, 7 * 24 * 3600)
  }

  // 检测单挑 3:0：胜方对应单挑组成员额外 +3000 贡献
  const { rows: duelBattles } = await pool.query(
    `SELECT winner_side FROM sect_war_battle WHERE match_id = $1 AND battle_type = 'duel'`,
    [matchId]
  )
  const winnerSide = winnerSectId === m.sect_a_id ? 'a' : 'b'
  const winnerDuelRoster = winnerSide === 'a' ? m.a_duel : m.b_duel
  const allDuelWins = duelBattles.length >= 3 && duelBattles.every((b: any) => b.winner_side === winnerSide)
  if (allDuelWins) {
    for (const cid of winnerDuelRoster) {
      await sendMail({
        characterId: cid,
        category: 'sect_war',
        title: '单挑三连胜额外奖励',
        content: '你在宗门战单挑中三战全胜，获得额外 3000 贡献！',
        attachments: [{ type: 'contribution', amount: 3000 }],
        refType: 'match',
        refId: matchId,
      })
    }
  }

  // MVP 处理（论道之星）
  if (m.mvp_character_id) {
    await sendMail({
      characterId: m.mvp_character_id,
      category: 'sect_war',
      title: '恭喜获得"论道之星"称号',
      content: '你在本届宗门战问道大比中脱颖而出，授予"论道之星"称号 7 天，并获得属性加成。',
      attachments: [
        { type: 'title', titleKey: '论道之星', duration: 7 * 24 * 3600 },
        { type: 'timed_buff', sourceType: 'sect_war_mvp', sourceId: String(matchId), statKey: 'atk_pct', statValue: 3, duration: 7 * 24 * 3600 },
        { type: 'timed_buff', sourceType: 'sect_war_mvp', sourceId: String(matchId), statKey: 'def_pct', statValue: 3, duration: 7 * 24 * 3600 },
        { type: 'timed_buff', sourceType: 'sect_war_mvp', sourceId: String(matchId), statKey: 'hp_pct', statValue: 3, duration: 7 * 24 * 3600 },
      ],
      refType: 'mvp',
      refId: matchId,
    })
    // 累加成就
    await pool.query(
      `INSERT INTO character_achievements (character_id, achievement_id, progress, completed)
       VALUES ($1, 'sect_war_mvp_1', 1, TRUE)
       ON CONFLICT (character_id, achievement_id)
       DO UPDATE SET progress = character_achievements.progress + 1,
                     completed = (character_achievements.progress + 1) >= 1`,
      [m.mvp_character_id]
    )
    await pool.query(
      `INSERT INTO character_achievements (character_id, achievement_id, progress, completed)
       VALUES ($1, 'sect_war_mvp_3', 1, FALSE)
       ON CONFLICT (character_id, achievement_id)
       DO UPDATE SET progress = character_achievements.progress + 1,
                     completed = (character_achievements.progress + 1) >= 3`,
      [m.mvp_character_id]
    )
  }
  // 胜方成就
  for (const cid of winnerRoster) {
    await pool.query(
      `INSERT INTO character_achievements (character_id, achievement_id, progress, completed)
       VALUES ($1, 'sect_war_win_1', 1, TRUE)
       ON CONFLICT (character_id, achievement_id)
       DO UPDATE SET progress = character_achievements.progress + 1,
                     completed = (character_achievements.progress + 1) >= 1`,
      [cid]
    )
    await pool.query(
      `INSERT INTO character_achievements (character_id, achievement_id, progress, completed)
       VALUES ($1, 'sect_war_win_10', 1, FALSE)
       ON CONFLICT (character_id, achievement_id)
       DO UPDATE SET progress = character_achievements.progress + 1,
                     completed = (character_achievements.progress + 1) >= 10`,
      [cid]
    )
  }

  await pool.query('UPDATE sect_war_match SET settled_at = NOW() WHERE id = $1', [matchId])
}

/**
 * 结算押注
 */
export async function settleMatchBets(matchId: number) {
  const pool = getPool()
  const { rows: matchRows } = await pool.query('SELECT * FROM sect_war_match WHERE id = $1', [matchId])
  if (matchRows.length === 0) return
  const m = matchRows[0]
  const winnerSide = m.winner_sect_id === m.sect_a_id ? 'a' : 'b'

  const { rows: bets } = await pool.query(
    `SELECT * FROM sect_war_bet WHERE match_id = $1 AND status = 'pending'`,
    [matchId]
  )
  for (const bet of bets) {
    const won = bet.bet_side === winnerSide
    const gross = won ? Math.floor(Number(bet.bet_amount) * Number(bet.odds_at_bet)) : 0
    // 5% 手续费
    const payout = won ? Math.floor(gross * 0.95) : 0
    await pool.query(
      `UPDATE sect_war_bet SET status = $1, payout = $2, settled_at = NOW() WHERE id = $3`,
      [won ? 'won' : 'lost', payout, bet.id]
    )
    if (won) {
      await sendMail({
        characterId: bet.character_id,
        category: 'sect_war_bet',
        title: `押注命中：${payout} 灵石到账`,
        content: `你的押注（${bet.bet_amount} 灵石 × ${bet.odds_at_bet}x）命中，扣除 5% 手续费后实得 ${payout} 灵石。`,
        attachments: [{ type: 'spirit_stone', amount: payout }],
        refType: 'bet',
        refId: bet.id,
      })
    } else {
      await sendMail({
        characterId: bet.character_id,
        category: 'sect_war_bet',
        title: `押注失败`,
        content: `本场押注（${bet.bet_amount} 灵石）未中。再接再厉。`,
        refType: 'bet',
        refId: bet.id,
      })
    }
  }
}
