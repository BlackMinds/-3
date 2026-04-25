import { getPool } from '~/server/database/db'
import { getCharByUserId, weekStartStr } from '~/server/utils/sect'
import { rand } from '~/server/utils/random'
import { getSectBoss } from '~/server/engine/sectData'
import { generateEquipName } from '~/server/engine/equipNameData'
import { EQUIP_PRIMARY_BASE, RARITY_STAT_MUL } from '~/shared/balance'

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

    let contribution = 500
    let stoneReward = rewardBase * 5000
    let equipRarity = ''

    if (myRank === 1) {
      contribution = 5000; stoneReward = rewardBase * 50000; equipRarity = 'gold'
    } else if (myRank <= 3) {
      contribution = 3000; stoneReward = rewardBase * 30000; equipRarity = Math.random() < 0.5 ? 'gold' : 'purple'
    } else if (myRank <= 10) {
      contribution = 1500; stoneReward = rewardBase * 15000; equipRarity = Math.random() < 0.3 ? 'gold' : ''
    }

    // 记录领取
    await pool.query(
      'INSERT INTO sect_shop_purchases (character_id, item_key, cost_contribution, week_start) VALUES ($1, $2, 0, $3)',
      [char.id, claimKey, weekStartStr()]
    )

    // 发放奖励
    await pool.query(
      'UPDATE sect_members SET contribution = contribution + $1, weekly_contribution = weekly_contribution + $2 WHERE character_id = $3',
      [contribution, contribution, char.id]
    )
    await pool.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [stoneReward, char.id])

    // 装备奖励
    let equipName = ''
    if (equipRarity) {
      const rarities = ['white', 'green', 'blue', 'purple', 'gold', 'red']
      const rarityIdx = rarities.indexOf(equipRarity)
      const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
      const slotIdx = rand(0, slots.length - 1)
      const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_DMG', pendant: 'SPIRIT' }
      const tier = Math.min(10, Math.max(1, rewardBase + 2))
      const ps = primaryStats[slots[slotIdx]]
      const pv = Math.max(1, Math.floor((EQUIP_PRIMARY_BASE[ps] || 30) * tier * RARITY_STAT_MUL[rarityIdx] * 1.10))

      // 宗门专属: 自带2-4条随机副属性
      const subStatPool = [
        { stat: 'ATK', min: 5, max: 30 }, { stat: 'DEF', min: 3, max: 20 },
        { stat: 'HP', min: 20, max: 150 }, { stat: 'SPD', min: 2, max: 15 },
        { stat: 'CRIT_RATE', min: 1, max: 5 }, { stat: 'CRIT_DMG', min: 5, max: 20 },
        { stat: 'LIFESTEAL', min: 1, max: 5 }, { stat: 'DODGE', min: 1, max: 4 },
        { stat: 'ARMOR_PEN', min: 3, max: 15 }, { stat: 'ACCURACY', min: 2, max: 10 },
      ]
      const subCount = rand(2, 4)
      const shuffled = [...subStatPool].sort(() => Math.random() - 0.5)
      const subStats = shuffled.slice(0, subCount).map(s => ({
        stat: s.stat,
        value: Math.floor(rand(s.min, s.max) * tier * 0.5 * (1 + rarityIdx * 0.15)),
      }))

      const tierReqLevels: Record<number, number> = { 1:1, 2:15, 3:35, 4:55, 5:80, 6:110, 7:140, 8:170, 9:185, 10:195 }
      const weaponType = slots[slotIdx] === 'weapon' ? ['sword','blade','spear','fan'][rand(0,3)] : null
      equipName = generateEquipName(equipRarity, slots[slotIdx], weaponType, tier, ps, null, '宗门')
      await pool.query(
        'INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, tier, base_slot, weapon_type, req_level, enhance_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)',
        [char.id, equipName, equipRarity, ps, pv, JSON.stringify(subStats), tier, slots[slotIdx], weaponType, tierReqLevels[tier] || 1]
      )
    }

    return {
      code: 200,
      message: `排名第${myRank}，+${contribution}贡献，+${stoneReward}灵石${equipName ? `，获得【${equipName}】` : ''}`,
      data: { rank: myRank, contribution, stoneReward, equipName },
    }
  } catch (error) {
    console.error('领取Boss奖励失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
