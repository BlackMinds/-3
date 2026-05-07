import { getPool } from '~/server/database/db'
import { getCharByUserId, weekStartStr } from '~/server/utils/sect'
import { getSectBoss } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const bossId = parseInt(String(getRouterParam(event, 'bossId')))
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows: bossRows } = await pool.query(
      "SELECT * FROM sect_bosses WHERE id = $1 AND status = 'killed'", [bossId]
    )
    if (bossRows.length === 0) return { code: 400, message: 'Boss未被击杀' }

    // 检查是否参与
    const { rows: dmgRows } = await pool.query(
      'SELECT * FROM sect_boss_damage WHERE boss_id = $1 AND character_id = $2', [bossId, char.id]
    )
    if (dmgRows.length === 0) return { code: 400, message: '未参与此Boss战' }

    // 检查是否已领取
    const claimKey = `boss_claim_${bossId}`
    const { rows: claimCheck } = await pool.query(
      'SELECT id FROM sect_shop_purchases WHERE character_id = $1 AND item_key = $2', [char.id, claimKey]
    )
    if (claimCheck.length > 0) return { code: 400, message: '已领取' }

    // 计算排名
    const { rows: rankRows } = await pool.query(
      'SELECT character_id, total_damage FROM sect_boss_damage WHERE boss_id = $1 ORDER BY total_damage DESC', [bossId]
    )
    const myRank = rankRows.findIndex(r => r.character_id === char.id) + 1
    const bossCfg = getSectBoss(bossRows[0].boss_key)
    const rewardBase = bossCfg?.rewardBase || 1

    // 排名梯度奖励：仅贡献+灵石，装备产出已下线（2026-05-07）
    let contribution = 500
    let stoneReward = rewardBase * 5000

    if (myRank === 1) {
      contribution = 5000; stoneReward = rewardBase * 50000
    } else if (myRank <= 3) {
      contribution = 3000; stoneReward = rewardBase * 30000
    } else if (myRank <= 10) {
      contribution = 1500; stoneReward = rewardBase * 15000
    }

    // 记录领取
    await pool.query(
      'INSERT INTO sect_shop_purchases (character_id, item_key, cost_contribution, week_start) VALUES ($1, $2, 0, $3)',
      [char.id, claimKey, weekStartStr()]
    )

    // 发放奖励
    await pool.query(
      'UPDATE sect_members SET contribution = contribution + $1, total_contribution = total_contribution + $1, weekly_contribution = weekly_contribution + $2 WHERE character_id = $3',
      [contribution, contribution, char.id]
    )
    await pool.query('UPDATE characters SET spirit_stone = LEAST(70000000000, spirit_stone + $1) WHERE id = $2', [stoneReward, char.id])

    return {
      code: 200,
      message: `排名第${myRank}，+${contribution}贡献，+${stoneReward}灵石`,
      data: { rank: myRank, contribution, stoneReward },
    }
  } catch (error) {
    console.error('领取Boss奖励失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
