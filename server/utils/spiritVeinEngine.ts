/**
 * 灵脉涌灵结算器 + 周度奖池 + 重置
 */
import { getPool } from '~/server/database/db'
import { sendMail, sendMailBatch } from '~/server/utils/mail'
import { refreshGuardCount, guardShareRatio } from '~/server/utils/spiritVein'

const AWAKEN_MATERIAL_IDS = ['awaken_stone', 'spirit_inscription']

function now2HourBoundary(): Date {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  // 向前对齐到最近的偶数小时
  if (d.getHours() % 2 === 1) d.setHours(d.getHours() - 1)
  return d
}

/**
 * 涌灵结算 — 每 2 小时调用
 */
export async function processSurge(): Promise<{ processed: number }> {
  const pool = getPool()
  const { rows: nodes } = await pool.query(
    `SELECT n.*, o.sect_id, o.next_surge_at
       FROM spirit_vein_node n
       JOIN spirit_vein_occupation o ON o.node_id = n.id
      WHERE o.next_surge_at <= NOW()`
  )
  let processed = 0

  for (const node of nodes) {
    const surgeAt = new Date()
    const nextSurge = new Date(Date.now() + 2 * 3600 * 1000)
    const baseStone = Number(node.stone_reward)
    const baseExp = Number(node.exp_reward)
    let sectStoneGranted = 0
    const rareDrops: any[] = []
    let guardsSnapshot: number[] = []

    if (!node.sect_id) {
      // NPC 占领 - 无产出，只刷新时间
      await pool.query('UPDATE spirit_vein_occupation SET next_surge_at = $1 WHERE node_id = $2', [nextSurge, node.id])
      continue
    }

    // 读取在守玩家
    const { rows: guards } = await pool.query(
      `SELECT g.character_id, c.last_active_at, c.name
         FROM spirit_vein_guard g JOIN characters c ON g.character_id = c.id
        WHERE g.node_id = $1 AND g.expires_at > NOW()`,
      [node.id]
    )
    guardsSnapshot = guards.map((g: any) => g.character_id)

    // 仇视机制：占领 >= 4 个节点，宗门 60% 分成减半
    const { rows: [{ cnt: occCount }] } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM spirit_vein_occupation WHERE sect_id = $1`,
      [node.sect_id]
    )
    const isNemesis = occCount >= 4
    const sectRatio = isNemesis ? 0.3 : 0.6
    const poolRatioExtra = isNemesis ? 0.3 : 0 // 减半的另一半进奖池

    // 宗门 60% (or 30% when nemesis)
    const sectStone = Math.floor(baseStone * sectRatio)
    sectStoneGranted = sectStone
    if (sectStone > 0) {
      await pool.query('UPDATE sects SET fund = fund + $1 WHERE id = $2', [sectStone, node.sect_id])
    }

    // 10% (或 40%) 进奖池
    const poolStone = Math.floor(baseStone * (0.1 + poolRatioExtra))
    const weekStart = await ensureJackpotWeek()
    await pool.query(
      `UPDATE spirit_vein_jackpot SET pool_amount = pool_amount + $1 WHERE week_start = $2`,
      [poolStone, weekStart]
    )

    // 守卫个人 30%（按登录时间权重）
    const totalPersonalBase = Math.floor(baseStone * 0.3)
    const totalExpBase = Math.floor(baseExp * 0.3)
    if (guards.length > 0 && totalPersonalBase > 0) {
      // 计算每人权重
      let weightSum = 0
      const weights: number[] = []
      for (const g of guards) {
        const w = guardShareRatio(g.last_active_at)
        weights.push(w)
        weightSum += w
      }
      if (weightSum === 0) {
        // 全离线超72h，这部分灵石回流宗门
        await pool.query('UPDATE sects SET fund = fund + $1 WHERE id = $2', [totalPersonalBase, node.sect_id])
      } else {
        const mails: any[] = []
        for (let i = 0; i < guards.length; i++) {
          const share = weights[i] / weightSum
          const stoneReward = Math.floor(totalPersonalBase * share)
          const expReward = Math.floor(totalExpBase * share)
          if (stoneReward <= 0 && expReward <= 0) continue
          const atts: any[] = []
          if (stoneReward > 0) atts.push({ type: 'spirit_stone', amount: stoneReward })
          if (expReward > 0) atts.push({ type: 'exp', amount: expReward })
          atts.push({ type: 'contribution', amount: 100 })

          // 稀有掉落
          if (node.tier === 'high' && Math.random() < 0.03) {
            atts.push({ type: 'spirit_stone', amount: 50000 }) // 简化：丹方解锁暂用等价灵石
            rareDrops.push({ characterId: guards[i].character_id, type: 'recipe_substitute', value: 50000 })
          }
          if (node.tier === 'supreme' && Math.random() < 0.05) {
            const itemId = AWAKEN_MATERIAL_IDS[Math.random() < 0.6 ? 0 : 1]
            atts.push({ type: 'material', itemId, quality: 'purple', qty: 1 })
            rareDrops.push({ characterId: guards[i].character_id, itemId })
          }

          mails.push({
            characterId: guards[i].character_id,
            category: 'spirit_vein_surge',
            title: `【${node.name}】涌灵分成`,
            content: `你驻守的灵脉【${node.name}】本次涌灵结算，已发放奖励。`,
            attachments: atts,
            refType: 'surge',
            refId: node.id,
          })
        }
        if (mails.length > 0) {
          await sendMailBatch(mails)
        }
      }
    }

    // 记日志
    await pool.query(
      `INSERT INTO spirit_vein_surge_log (node_id, sect_id, surge_at, sect_stone_granted, rare_drops, guards_snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [node.id, node.sect_id, surgeAt, sectStoneGranted, JSON.stringify(rareDrops), JSON.stringify(guardsSnapshot)]
    )
    // 更新 next_surge_at
    await pool.query('UPDATE spirit_vein_occupation SET next_surge_at = $1 WHERE node_id = $2', [nextSurge, node.id])

    processed++
  }
  return { processed }
}

/**
 * 驻守过期扫描
 */
export async function purgeExpiredGuards(): Promise<{ removed: number }> {
  const pool = getPool()
  const { rows } = await pool.query(
    `DELETE FROM spirit_vein_guard WHERE expires_at <= NOW() RETURNING node_id, character_id`
  )
  // 刷新每个节点人数
  const uniqueNodes = new Set(rows.map((r: any) => r.node_id))
  for (const nid of uniqueNodes) await refreshGuardCount(nid as number)
  for (const r of rows) {
    await sendMail({
      characterId: r.character_id,
      category: 'spirit_vein_raid',
      title: '驻守结束',
      content: '你的灵脉驻守已到期自动离岗，如需继续请前往灵脉潮汐重新驻守。',
      refType: 'guard',
      refId: r.node_id,
    })
  }
  return { removed: rows.length }
}

/**
 * 真空期结束后未占领 → 归还 NPC
 */
export async function restoreNpcNodes(): Promise<{ restored: number }> {
  const pool = getPool()
  const { rowCount } = await pool.query(
    `UPDATE spirit_vein_occupation
        SET sect_id = NULL, current_guard_count = 0, occupied_at = NULL, vacuum_until = NULL
      WHERE vacuum_until IS NOT NULL
        AND vacuum_until <= NOW()
        AND (SELECT COUNT(*) FROM spirit_vein_guard g WHERE g.node_id = spirit_vein_occupation.node_id AND g.expires_at > NOW()) = 0`
  )
  return { restored: rowCount || 0 }
}

/**
 * 每周一全图重置
 */
export async function weeklyResetMap(): Promise<{ reset: number }> {
  const pool = getPool()
  const { rowCount } = await pool.query(
    `UPDATE spirit_vein_occupation
       SET sect_id = NULL, current_guard_count = 0, occupied_at = NULL, vacuum_until = NULL,
           next_surge_at = date_trunc('hour', NOW()) + INTERVAL '2 hours'`
  )
  await pool.query(`DELETE FROM spirit_vein_guard`)
  return { reset: rowCount || 0 }
}

/**
 * 周度奖池结算
 */
export async function settleJackpot(): Promise<{ ok: boolean }> {
  const pool = getPool()
  const weekStart = await ensureJackpotWeek()
  const { rows: jackpot } = await pool.query(
    `SELECT * FROM spirit_vein_jackpot WHERE week_start = $1`,
    [weekStart]
  )
  if (jackpot.length === 0 || jackpot[0].settled) return { ok: false }
  const pot = Number(jackpot[0].pool_amount)

  // 综合贡献排行: 涌灵次数 × (1 - 占领节点数/6)
  const { rows: sectRanks } = await pool.query(
    `SELECT sl.sect_id,
            COUNT(*)::int AS surge_count,
            COALESCE((SELECT COUNT(*)::int FROM spirit_vein_occupation o WHERE o.sect_id = sl.sect_id), 0) AS occupy_count
       FROM spirit_vein_surge_log sl
      WHERE sl.surge_at >= $1 AND sl.sect_id IS NOT NULL
      GROUP BY sl.sect_id
      ORDER BY surge_count DESC`,
    [new Date(Date.now() - 7 * 24 * 3600 * 1000)]
  )
  const scored = sectRanks.map((r: any) => ({
    sectId: r.sect_id,
    score: r.surge_count * (1 - r.occupy_count / 6),
  }))
  scored.sort((a, b) => b.score - a.score)

  // 40% TOP1, 10% TOP2, 10% TOP3
  if (scored[0]) {
    await pool.query('UPDATE sects SET fund = fund + $1 WHERE id = $2', [Math.floor(pot * 0.4), scored[0].sectId])
  }
  if (scored[1]) {
    await pool.query('UPDATE sects SET fund = fund + $1 WHERE id = $2', [Math.floor(pot * 0.1), scored[1].sectId])
  }
  if (scored[2]) {
    await pool.query('UPDATE sects SET fund = fund + $1 WHERE id = $2', [Math.floor(pot * 0.1), scored[2].sectId])
  }

  // 30% 给"偷袭 ≥ 20 次的玩家"平分
  const { rows: raiders } = await pool.query(
    `SELECT char_id, count FROM (
       SELECT (jsonb_array_elements_text(attackers))::int AS char_id
         FROM spirit_vein_raid WHERE created_at >= $1
     ) t GROUP BY char_id HAVING COUNT(*) >= 20`,
    [new Date(Date.now() - 7 * 24 * 3600 * 1000)]
  )
  if (raiders.length > 0) {
    const share = Math.floor((pot * 0.3) / raiders.length)
    for (const r of raiders) {
      if (share <= 0) continue
      await sendMail({
        characterId: r.char_id,
        category: 'spirit_vein_jackpot',
        title: '灵脉大奖池 · 本周活跃奖励',
        content: `你本周偷袭次数达标，获得奖池分成 ${share} 灵石。`,
        attachments: [{ type: 'spirit_stone', amount: share }],
      })
    }
  }
  await pool.query('UPDATE spirit_vein_jackpot SET settled = TRUE, settled_at = NOW() WHERE week_start = $1', [weekStart])
  return { ok: true }
}

async function ensureJackpotWeek(): Promise<string> {
  const pool = getPool()
  // 本周一日期
  const { rows } = await pool.query(
    `SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int - 1 + 7) % 7)::date AS week_start`
  )
  const weekStart = rows[0].week_start
  await pool.query(
    `INSERT INTO spirit_vein_jackpot (week_start, pool_amount) VALUES ($1, 0)
     ON CONFLICT (week_start) DO NOTHING`,
    [weekStart]
  )
  return weekStart
}
