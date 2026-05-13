// 子女详情 - GET /api/child/detail/:id

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildById, APTITUDE_NAMES, calcChildBaseStats, calcChildTalentBonusPct } from '~/server/utils/child'
import { CHILD_TALENT_MAP, type ChildAptitude } from '~/server/engine/childTalentData'
import { CHILD_SKILL_MAP } from '~/server/engine/childSkillData'

const STAGE_NAMES: Record<string, string> = {
  infant: '婴幼期', child: '童年期', youth: '少年期',
  adult_youth: '青年期', adult: '成年', grown: '已离家',
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const id = Number(event.context.params?.id)
    if (!id) return { code: 400, message: '参数错误' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getChildById(pool, id, char.id)
    if (!c) return { code: 404, message: '子女不存在' }

    // 解析天赋/功法
    const talents = (c.awakened_talents || []).map((t: any) => ({
      level: t.level,
      ...CHILD_TALENT_MAP[t.talent_id],
    }))
    const skills = (c.learned_skills || []).map((s: any) => ({
      level: s.level,
      ...CHILD_SKILL_MAP[s.skill_id],
    }))

    // 五行抗聚合（来源：天赋）
    const elementResist = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }
    for (const t of talents) {
      const e = (t as any).effect || {}
      elementResist.metal += e.RESIST_METAL || 0
      elementResist.wood  += e.RESIST_WOOD  || 0
      elementResist.water += e.RESIST_WATER || 0
      elementResist.fire  += e.RESIST_FIRE  || 0
      elementResist.earth += e.RESIST_EARTH || 0
    }

    return {
      code: 200,
      data: {
        id: c.id,
        name: c.name,
        gender: c.gender,
        avatarId: c.avatar_id,
        aptitude: c.aptitude,
        aptitudeName: APTITUDE_NAMES[c.aptitude] || '凡品',
        spiritualRoot: c.spiritual_root,
        awakened: c.awakened,
        level: c.level,
        levelExp: c.level_exp,
        nextLevelExp: c.level * 100,  // 简化升级公式
        stage: c.stage,
        stageName: STAGE_NAMES[c.stage] || c.stage,
        // 2026-05-13 起：基础四属性即时按 calcChildBaseStats 重算，与 list.get.ts 保持一致
        // 这里 maxHp/atk/def/spd 仍是「裸 base」，组件配合 talentBonusPct + equipBonus 算最终战斗值
        ...(() => {
          const b = calcChildBaseStats(c.aptitude as ChildAptitude, c.level)
          return { maxHp: b.maxHp, atk: b.atk, def: b.def, spd: b.spd }
        })(),
        // 天赋四维百分比加成（与 fight.post.ts buffedXxx 同公式）— 前端用 (base + eq) × (1 + pct/100)
        talentBonusPct: calcChildTalentBonusPct(c.awakened_talents),
        critRate: Number(c.crit_rate || 0),
        critDmg: Number(c.crit_dmg || 0),
        dodge: Number(c.dodge || 0),
        lifesteal: Number(c.lifesteal || 0),
        spirit: c.spirit || 0,
        resistCtrl: Number(c.resist_ctrl || 0),
        elementResist,
        isBattling: c.is_battling,
        hasLeftHome: c.has_left_home,
        permanentBuffPct: Number(c.permanent_buff_pct || 0),
        lastVisitAt: c.last_visit_at,
        feedCountToday: c.feed_count_today,
        feedDailyMax: 5,
        talents,
        skills,
        bornAt: c.born_at,
      },
    }
  } catch (error) {
    console.error('获取子女详情失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
