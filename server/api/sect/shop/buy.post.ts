import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership, weekStartStr } from '~/server/utils/sect'
import { rand } from '~/server/utils/random'
import { SHOP_ITEMS } from '~/server/engine/sectData'
import { generateEquipName } from '~/server/engine/equipNameData'
import { EQUIP_PRIMARY_BASE, RARITY_STAT_MUL, RARITY_SUB_COUNT_RANGE } from '~/shared/balance'
import { rollSubStats } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { item_key } = await readBody(event)
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }

  const membership = await getMembership(char.id)
  if (!membership) return { code: 400, message: '未加入宗门' }

  const item = SHOP_ITEMS.find(i => i.key === item_key)
  if (!item) return { code: 400, message: '商品不存在' }
  if (membership.sect_level < item.requiredSectLevel) return { code: 400, message: '宗门等级不足' }
  if (Number(membership.contribution) < item.cost) return { code: 400, message: '贡献度不足' }

  const ws = weekStartStr()

  // 前置检查: unlock_pill_recipe 提前检查是否已解锁, 避免进入事务后才回滚
  if (item.effect.type === 'unlock_pill_recipe') {
    const { rows: existing } = await pool.query(
      'SELECT id FROM character_unlocked_recipes WHERE character_id = $1 AND pill_id = $2',
      [char.id, item.effect.pill_id]
    )
    if (existing.length > 0) return { code: 400, message: '该丹方已解锁,无需重复购买' }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 事务内复查限购 (防并发超购)
    const { rows: boughtRows } = await client.query(
      'SELECT COALESCE(SUM(quantity), 0) as bought FROM sect_shop_purchases WHERE character_id = $1 AND item_key = $2 AND week_start = $3',
      [char.id, item_key, ws]
    )
    if (Number(boughtRows[0].bought) >= item.weeklyLimit) {
      await client.query('ROLLBACK')
      return { code: 400, message: '本周已达购买上限' }
    }

    // 扣贡献 (带条件避免并发下贡献变成负数)
    const { rowCount: deducted } = await client.query(
      'UPDATE sect_members SET contribution = contribution - $1 WHERE character_id = $2 AND contribution >= $1',
      [item.cost, char.id]
    )
    if (!deducted) {
      await client.query('ROLLBACK')
      return { code: 400, message: '贡献度不足' }
    }

    // 记录购买
    await client.query(
      'INSERT INTO sect_shop_purchases (character_id, item_key, quantity, cost_contribution, week_start) VALUES ($1, $2, 1, $3, $4)',
      [char.id, item_key, item.cost, ws]
    )

    // 执行效果
    let resultMsg = ''
    const eff = item.effect

    switch (eff.type) {
      case 'cultivation_exp':
        await client.query('UPDATE characters SET cultivation_exp = cultivation_exp + $1 WHERE id = $2', [eff.value, char.id])
        resultMsg = `获得${eff.value}修为`
        break

      case 'spirit_stone':
        await client.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [eff.value, char.id])
        resultMsg = `获得${eff.value}灵石`
        break

      case 'enhance_protect':
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, 'enhance_protect']
        )
        resultMsg = '获得强化保护符x1'
        break

      case 'herb_pack': {
        const qualities = ['white', 'green', 'blue', 'purple', 'gold']
        const herbIds = ['common_herb', 'metal_herb', 'wood_herb', 'water_herb', 'fire_herb', 'earth_herb', 'spirit_grass']
        const minQIdx = qualities.indexOf(eff.minQuality)
        for (let i = 0; i < eff.count; i++) {
          const hId = herbIds[rand(0, herbIds.length - 1)]
          const qIdx = Math.min(qualities.length - 1, minQIdx + rand(0, 1))
          const q = qualities[qIdx]
          await client.query(
            `INSERT INTO character_materials (character_id, material_id, quality, count) VALUES ($1, $2, $3, 1)
             ON CONFLICT (character_id, material_id, quality) DO UPDATE SET count = character_materials.count + 1`,
            [char.id, hId, q]
          )
        }
        resultMsg = `获得灵草x${eff.count}`
        break
      }

      case 'breakthrough_boost':
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, 'breakthrough_boost']
        )
        resultMsg = '获得宗门突破丹x1'
        break

      case 'reroll_sub_stat':
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, 'reroll_sub_stat']
        )
        resultMsg = '获得装备鉴定符x1'
        break

      case 'skill_page': {
        const skillPools: Record<string, string[]> = {
          purple: ['fire_rain', 'frost_nova', 'earth_shield', 'quake_wave', 'vine_prison', 'golden_bell'],
        }
        const pool_ = skillPools[eff.quality] || skillPools['purple']
        const skillId = pool_[rand(0, pool_.length - 1)]
        await client.query(
          `INSERT INTO character_skill_inventory (character_id, skill_id, count) VALUES ($1, $2, 1)
           ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
          [char.id, skillId]
        )
        resultMsg = `获得功法残页【${skillId}】`
        break
      }

      case 'enhance_guarantee':
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, 'enhance_guarantee']
        )
        resultMsg = '获得强化大师符x1'
        break

      case 'set_fragment':
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, 'set_fragment']
        )
        resultMsg = '获得宗门套装碎片x1'
        break

      case 'reset_root':
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, 'reset_root']
        )
        resultMsg = '获得天道洗髓丹x1'
        break

      case 'universal_skill_page':
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, 'universal_skill_page']
        )
        resultMsg = '获得万能功法残页x1'
        break

      case 'random_equip_box': {
        const rarity = Math.random() < 0.8 ? 'gold' : 'red'
        const rarityIdx = rarity === 'gold' ? 4 : 5
        const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
        const slotIdx = rand(0, slots.length - 1)
        const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_RATE', pendant: 'SPIRIT' }
        const tier = rand(6, 9)
        const ps = primaryStats[slots[slotIdx]]
        const pv = Math.max(1, Math.floor((EQUIP_PRIMARY_BASE[ps] || 30) * tier * RARITY_STAT_MUL[rarityIdx]))
        const tierReqLevels: Record<number, number> = { 1:1, 2:15, 3:35, 4:55, 5:80, 6:110, 7:140, 8:170, 9:185, 10:195 }
        const weaponType = slots[slotIdx] === 'weapon' ? ['sword','blade','spear','fan'][rand(0,3)] : null
        const equipName = generateEquipName(rarity, slots[slotIdx], weaponType, tier, ps, null, '宝箱')
        const [minSubs, maxSubs] = RARITY_SUB_COUNT_RANGE[rarityIdx] || [0, 0]
        const subCount = rand(minSubs, maxSubs)
        const subStats = subCount > 0 ? rollSubStats(rarityIdx, tier, subCount) : []
        await client.query(
          'INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, tier, base_slot, weapon_type, req_level, enhance_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)',
          [char.id, equipName, rarity, ps, pv, JSON.stringify(subStats), tier, slots[slotIdx], weaponType, tierReqLevels[tier] || 1]
        )
        resultMsg = `获得【${equipName}】`
        break
      }

      case 'equip_upgrade':
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, 'equip_upgrade']
        )
        resultMsg = '获得太古精魂x1'
        break

      case 'permanent_stat':
        await client.query(
          `INSERT INTO character_pills (character_id, pill_id, count, quality_factor) VALUES ($1, $2, 1, 1.0)
           ON CONFLICT (character_id, pill_id, quality_factor) DO UPDATE SET count = character_pills.count + 1`,
          [char.id, 'permanent_stat']
        )
        resultMsg = '获得道果结晶x1'
        break

      case 'unlock_pill_recipe': {
        // 事务内再复查一次(外部已初筛), 防并发两次购买
        const { rows: existing } = await client.query(
          'SELECT id FROM character_unlocked_recipes WHERE character_id = $1 AND pill_id = $2',
          [char.id, eff.pill_id]
        )
        if (existing.length > 0) {
          await client.query('ROLLBACK')
          return { code: 400, message: '该丹方已解锁,无需重复购买' }
        }
        await client.query(
          'INSERT INTO character_unlocked_recipes (character_id, pill_id) VALUES ($1, $2)',
          [char.id, eff.pill_id]
        )
        resultMsg = `成功解锁丹方:${item.name.replace('·残卷','').replace('方','')}`
        break
      }

      default:
        resultMsg = '购买成功'
    }

    await client.query('COMMIT')
    return { code: 200, message: resultMsg }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('购买商品失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
