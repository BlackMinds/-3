import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { getActiveCd, setCd, getDailyRaidCount, incrDailyRaidCount, refreshGuardCount, isSectProtected } from '~/server/utils/spiritVein'
import { buildCharacterSnapshot, type CharacterSnapshot } from '~/server/utils/battleSnapshot'
import { runPvpBattle, simpleInputToPvp, type PvpFighterInput } from '~/server/engine/multiBattleEngine'
import { sendMail } from '~/server/utils/mail'
import { checkAchievements } from '~/server/engine/achievementData'

// 内置 NPC 守脉鬼差模板（按节点品级定强度）
function makeNpcDefender(nodeTier: string, idx: number) {
  const base = {
    low:     { maxHp: 3000, atk: 180, def: 120, spd: 80 },
    mid:     { maxHp: 6000, atk: 320, def: 220, spd: 100 },
    high:    { maxHp: 12000, atk: 500, def: 380, spd: 120 },
    supreme: { maxHp: 25000, atk: 800, def: 620, spd: 150 },
  }[nodeTier] || { maxHp: 3000, atk: 180, def: 120, spd: 80 }
  return {
    characterId: -(idx + 1),
    name: `守脉鬼差${idx + 1}`,
    maxHp: base.maxHp,
    atk: base.atk,
    def: base.def,
    spd: base.spd,
    crit_rate: 0.05,
    crit_dmg: 1.5,
    dodge: 0.03,
    lifesteal: 0,
  }
}

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const membership = await getMembership(char.id)
  if (!membership) return { code: 400, message: '未加入宗门' }
  if (!['leader', 'vice_leader', 'elder', 'inner'].includes(membership.role)) {
    return { code: 400, message: '需内门弟子及以上职位' }
  }
  if (char.realm_tier < 2) return { code: 400, message: '境界需 ≥ 筑基期' }

  const body = await readBody(event)
  const nodeId = Number(body?.nodeId)
  const attackerIds: number[] = Array.isArray(body?.attackerCharacterIds)
    ? body.attackerCharacterIds.map((x: any) => Number(x)).filter(Number.isFinite)
    : [char.id]
  if (!Number.isInteger(nodeId) || nodeId < 1 || nodeId > 6) return { code: 400, message: 'nodeId 无效' }
  if (!attackerIds.includes(char.id)) attackerIds.push(char.id)
  if (attackerIds.length < 1 || attackerIds.length > 5) return { code: 400, message: '进攻方人数超限' }

  // CD 校验
  const cdInj = await getActiveCd(char.id, 'attack_injured')
  if (cdInj.active) return { code: 400, message: '你正处于伤势未愈状态' }
  const cdNode = await getActiveCd(char.id, 'attack_node', nodeId)
  if (cdNode.active) return { code: 400, message: '对该节点的偷袭 CD 未冷却' }

  // 每日上限
  const dailyCount = await getDailyRaidCount(char.id)
  if (dailyCount >= 10) return { code: 400, message: '今日偷袭次数已达上限（10 次）' }

  const pool = getPool()

  // 节点 & 守卫信息
  const { rows: nodeRows } = await pool.query(
    `SELECT n.*, o.sect_id AS occupying_sect_id, o.current_guard_count, o.vacuum_until
       FROM spirit_vein_node n
       LEFT JOIN spirit_vein_occupation o ON o.node_id = n.id
      WHERE n.id = $1`,
    [nodeId]
  )
  if (nodeRows.length === 0) return { code: 400, message: '节点不存在' }
  const node = nodeRows[0]
  if (node.occupying_sect_id === membership.sect_id) return { code: 400, message: '不可偷袭自家宗门' }
  if (node.occupying_sect_id && await isSectProtected(node.occupying_sect_id)) {
    return { code: 400, message: '对方宗门处于保护期内' }
  }

  const { rows: guards } = await pool.query(
    `SELECT g.character_id, c.name FROM spirit_vein_guard g
       JOIN characters c ON g.character_id = c.id
      WHERE g.node_id = $1 AND g.expires_at > NOW()`,
    [nodeId]
  )
  const isNpcNode = !node.occupying_sect_id || guards.length === 0
  const actualGuardCount = isNpcNode ? node.guard_limit : guards.length

  // 进攻方人数限制：min(守卫上限, 实际在守 + 1)
  const maxAttackers = isNpcNode ? node.guard_limit : Math.min(node.guard_limit, guards.length + 1)
  if (attackerIds.length > maxAttackers) {
    return { code: 400, message: `进攻方人数最多 ${maxAttackers} 人（当前守卫 ${actualGuardCount} 人）` }
  }

  // 校验队员：全部同宗门 + 筑基 + 每人不在 defend_injured CD
  const { rows: memCheck } = await pool.query(
    `SELECT c.id, c.name, c.realm_tier, sm.role, sm.sect_id
       FROM characters c JOIN sect_members sm ON sm.character_id = c.id
      WHERE c.id = ANY($1::int[])`,
    [attackerIds]
  )
  if (memCheck.length !== attackerIds.length) return { code: 400, message: '队员不全是宗门成员' }
  for (const m of memCheck) {
    if (m.sect_id !== membership.sect_id) return { code: 400, message: `${m.name} 非本宗门` }
    if (m.realm_tier < 2) return { code: 400, message: `${m.name} 境界过低` }
  }

  // 灵石进场费
  if (Number(char.spirit_stone) < 500) return { code: 400, message: '灵石不足 500，无法进场' }

  // 构建双方 snapshot
  const aSnaps = await Promise.all(attackerIds.map(id => buildCharacterSnapshot(id)))
  const aValid = aSnaps.filter((s: CharacterSnapshot | null): s is CharacterSnapshot => !!s)
  if (aValid.length === 0) return { code: 500, message: '构建进攻方失败' }

  let defenders: PvpFighterInput[] = []
  if (isNpcNode) {
    for (let i = 0; i < node.guard_limit; i++) defenders.push(simpleInputToPvp(makeNpcDefender(node.tier, i)))
  } else {
    const dSnaps = await Promise.all(guards.map((g: any) => buildCharacterSnapshot(g.character_id)))
    defenders = dSnaps.filter((s: any) => !!s).map((s: CharacterSnapshot) => toInput(s, node.occupying_sect_id))
  }
  const attackersInput: PvpFighterInput[] = aValid.map((s: CharacterSnapshot) => toInput(s, membership.sect_id))

  const result = runPvpBattle(attackersInput, defenders, {
    maxTurns: 40,
    sideAName: `进攻方·${membership.sect_name}`,
    sideBName: isNpcNode ? '守脉鬼差' : `守方·${(await pool.query('SELECT name FROM sects WHERE id = $1', [node.occupying_sect_id])).rows[0]?.name || '敌宗'}`,
  })
  const winner = result.winnerSide === 'a' ? 'attacker' : 'defender'

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE characters SET spirit_stone = spirit_stone - 500 WHERE id = $1', [char.id])
    await client.query(
      `INSERT INTO spirit_vein_raid (node_id, attacker_sect_id, defender_sect_id, attackers, defenders, winner_side, battle_log)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb)`,
      [
        nodeId,
        membership.sect_id,
        node.occupying_sect_id || null,
        JSON.stringify(attackerIds),
        JSON.stringify(isNpcNode ? [] : guards.map((g: any) => g.character_id)),
        winner,
        JSON.stringify(result.logs),
      ]
    )
    await incrDailyRaidCount(char.id, client)

    if (winner === 'attacker') {
      // 击溃守卫：清空该节点现有守卫，设真空期 10 分钟
      if (!isNpcNode) {
        // 所有原守卫进入 defend_injured CD 2h
        for (const g of guards) {
          await setCd(g.character_id, 'defend_injured', 2 * 3600, null, client)
        }
        await client.query(`DELETE FROM spirit_vein_guard WHERE node_id = $1`, [nodeId])
        // 发送邮件通知每个守卫
        for (const g of guards) {
          await sendMail(
            {
              characterId: g.character_id,
              category: 'spirit_vein_raid',
              title: `你驻守的节点被偷袭得手`,
              content: `你驻守的【${node.name}】被【${membership.sect_name}】偷袭得手，已离岗。`,
              refType: 'raid',
              refId: nodeId,
            },
            client
          )
        }
      }
      const vacuumUntil = new Date(Date.now() + 10 * 60 * 1000)
      await client.query(
        `UPDATE spirit_vein_occupation
           SET sect_id = $1, current_guard_count = 0,
               occupied_at = NOW(), vacuum_until = $2
         WHERE node_id = $3`,
        [membership.sect_id, vacuumUntil, nodeId]
      )
      // 成就进度
      for (const aid of attackerIds) {
        await client.query(
          `INSERT INTO character_achievements (character_id, achievement_id, progress, completed)
           VALUES ($1, 'spirit_vein_raid_1', 1, TRUE)
           ON CONFLICT (character_id, achievement_id)
           DO UPDATE SET progress = character_achievements.progress + 1,
                         completed = (character_achievements.progress + 1) >= 1`,
          [aid]
        )
        await client.query(
          `INSERT INTO character_achievements (character_id, achievement_id, progress, completed)
           VALUES ($1, 'spirit_vein_raid_20', 1, FALSE)
           ON CONFLICT (character_id, achievement_id)
           DO UPDATE SET progress = character_achievements.progress + 1,
                         completed = (character_achievements.progress + 1) >= 20`,
          [aid]
        )
      }
    } else {
      // 防守胜：进攻方进 attack_injured 2h + attack_node 30min
      for (const aid of attackerIds) {
        await setCd(aid, 'attack_injured', 2 * 3600, null, client)
      }
      await setCd(char.id, 'attack_node', 30 * 60, nodeId, client)
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  await refreshGuardCount(nodeId)

  return {
    code: 200,
    message: winner === 'attacker' ? '偷袭成功' : '偷袭失败',
    data: {
      result: winner,
      battleLog: result.logs,
      vacuumUntil: winner === 'attacker' ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null,
    },
  }
})

function toInput(snap: CharacterSnapshot, sectId?: number): PvpFighterInput {
  return {
    characterId: snap.characterId,
    sectId,
    stats: snap.stats,
    equippedSkills: snap.equippedSkills,
  }
}
