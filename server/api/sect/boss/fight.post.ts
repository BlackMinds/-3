import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { getSectBoss, getSectLevelConfig, getSectSkill, calcSectSkillEffect } from '~/server/engine/sectData'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { boss_id } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    const { rows: bossRows } = await pool.query(
      "SELECT * FROM sect_bosses WHERE id = $1 AND sect_id = $2 AND status = 'active'",
      [boss_id, membership.sect_id]
    )
    if (bossRows.length === 0) return { code: 400, message: 'Boss不存在或已结束' }

    const boss = bossRows[0]
    const bossCfg = getSectBoss(boss.boss_key)
    if (!bossCfg) return { code: 400, message: 'Boss配置错误' }

    // 检查命数
    const { rows: dmgRows } = await pool.query(
      'SELECT * FROM sect_boss_damage WHERE boss_id = $1 AND character_id = $2', [boss_id, char.id]
    )
    let livesUsed = 0
    if (dmgRows.length > 0) {
      livesUsed = dmgRows[0].lives_used
      if (livesUsed >= 3) return { code: 400, message: '挑战次数已用完(3次)' }
    }

    // 读取玩家装备/技能/buff/洞府
    const { rows: equipRows } = await pool.query('SELECT * FROM character_equipment WHERE character_id = $1', [char.id])
    const { rows: skillRows } = await pool.query('SELECT * FROM character_skills WHERE character_id = $1 AND equipped = TRUE ORDER BY skill_type, slot_index', [char.id])
    const { rows: buffRows } = await pool.query('SELECT * FROM character_buffs WHERE character_id = $1 AND (expire_time > NOW() OR remaining_fights > 0)', [char.id])
    const { rows: caveRows } = await pool.query('SELECT * FROM character_cave WHERE character_id = $1', [char.id])

    // 简化战斗: 计算玩家DPS x 回合数 = 伤害
    let atk = Number(char.atk || 50)
    let def = Number(char.def || 30)
    let maxHp = Number(char.max_hp || 500)
    let critRate = Number(char.crit_rate || 0.05)
    let critDmg = Number(char.crit_dmg || 1.5)

    // 等级加成
    const lv = char.level || 1
    for (let i = 1; i < lv; i++) {
      if (i <= 50) { maxHp += 5; atk += 2; def += 1 }
      else if (i <= 100) { maxHp += 10; atk += 4; def += 2 }
      else if (i <= 150) { maxHp += 20; atk += 8; def += 4 }
      else { maxHp += 40; atk += 15; def += 8 }
    }

    // 装备加成
    for (const eq of equipRows) {
      if (!eq.slot) continue
      const enhLv = eq.enhance_level || 0
      const primary = Math.floor(eq.primary_value * (1 + enhLv * 0.10))
      if (eq.primary_stat === 'ATK') atk += primary
      else if (eq.primary_stat === 'DEF') def += primary
      else if (eq.primary_stat === 'HP') maxHp += primary
      else if (eq.primary_stat === 'CRIT_RATE') critRate += primary / 100
    }

    // 宗门加成
    const sectCfg = getSectLevelConfig(membership.sect_level)
    atk = Math.floor(atk * (1 + sectCfg.atkBonus))
    def = Math.floor(def * (1 + sectCfg.defBonus))

    // 宗门功法加成
    const { rows: sectSkillRows } = await pool.query(
      'SELECT * FROM sect_skills WHERE character_id = $1 AND frozen = FALSE', [char.id]
    )
    for (const ss of sectSkillRows) {
      const skillCfg = getSectSkill(ss.skill_key)
      if (!skillCfg) continue
      const effects = calcSectSkillEffect(skillCfg, ss.level)
      if (effects.hp_percent) maxHp = Math.floor(maxHp * (1 + effects.hp_percent / 100))
      if (effects.all_percent) { atk = Math.floor(atk * (1 + effects.all_percent / 100)); def = Math.floor(def * (1 + effects.all_percent / 100)); maxHp = Math.floor(maxHp * (1 + effects.all_percent / 100)) }
    }

    // Boss属性
    const bossAtk = bossCfg.power * 0.3
    const bossDef = bossCfg.power * 0.15

    // 计算回合
    const avgDmgPerTurn = Math.max(1, atk - bossDef * 0.5) * (1 + critRate * (critDmg - 1))
    const bossDmgPerTurn = Math.max(1, bossAtk - def * 0.3)
    const survivalTurns = Math.min(bossCfg.maxTurns, Math.ceil(maxHp / Math.max(1, bossDmgPerTurn)))
    const totalDamage = Math.floor(avgDmgPerTurn * survivalTurns)

    // 更新Boss血量
    const newHp = Math.max(0, Number(boss.current_hp) - totalDamage)
    await pool.query('UPDATE sect_bosses SET current_hp = $1 WHERE id = $2', [newHp, boss_id])

    // 记录伤害
    if (dmgRows.length === 0) {
      await pool.query(
        'INSERT INTO sect_boss_damage (boss_id, character_id, total_damage, lives_used) VALUES ($1, $2, $3, 1)',
        [boss_id, char.id, totalDamage]
      )
    } else {
      await pool.query(
        'UPDATE sect_boss_damage SET total_damage = total_damage + $1, lives_used = lives_used + 1 WHERE boss_id = $2 AND character_id = $3',
        [totalDamage, boss_id, char.id]
      )
    }

    // 成就：讨伐先锋
    checkAchievements(char.id, 'sect_boss_attack', 1).catch(() => {})

    // 生成战斗日志
    const logs = [
      `你对【${bossCfg.name}】发起挑战！`,
      `经过${survivalTurns}回合激战...`,
      `你造成了 ${totalDamage.toLocaleString()} 点伤害！`,
      survivalTurns < bossCfg.maxTurns ? `你被击败，但伤害已记录` : `回合用尽，战斗结束`,
    ]

    // 检查Boss是否被击杀
    let killed = false
    if (newHp <= 0) {
      await pool.query("UPDATE sect_bosses SET status = 'killed', finished_at = NOW(), current_hp = 0 WHERE id = $1", [boss_id])
      killed = true
      logs.push(`【${bossCfg.name}】被宗门击杀！`)
    } else {
      logs.push(`Boss剩余血量: ${newHp.toLocaleString()} / ${boss.total_hp.toLocaleString()}`)
    }

    return {
      code: 200,
      data: {
        damage: totalDamage,
        turns: survivalTurns,
        boss_hp: newHp,
        boss_total_hp: Number(boss.total_hp),
        killed,
        lives_remaining: 3 - (livesUsed + 1),
        logs,
      },
    }
  } catch (error) {
    console.error('挑战Boss失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
