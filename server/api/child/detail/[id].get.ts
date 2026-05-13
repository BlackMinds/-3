// 子女详情 - GET /api/child/detail/:id

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getChildById, APTITUDE_NAMES, calcChildBaseStats, calcChildTalentBonusPct, getChildVisitCap, unlockSkillSlotsIfNeeded } from '~/server/utils/child'
import { CHILD_TALENT_MAP, type ChildAptitude } from '~/server/engine/childTalentData'
import { CHILD_SKILL_MAP } from '~/server/engine/childSkillData'
import type { SpiritualRoot } from '~/server/engine/companionData'

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

    // V2 惰性 migration：
    //   - V1 老数据 learned_skills 无 slot 字段 → 按 index 补
    //   - 已超过解锁等级但还没生成的槽位 → 自动 pick + 写回 DB
    //     (因为 unlockSkillSlotsIfNeeded 原本只在 feedChild 升级时 trigger，已满级子女不会再升)
    const rawSkills = Array.isArray(c.learned_skills) ? c.learned_skills : []
    const { learnedSkills: ensuredSkills, addedSkills: lazyAdded } = unlockSkillSlotsIfNeeded(
      c.level,
      c.aptitude as ChildAptitude,
      (c.spiritual_root || 'mixed') as SpiritualRoot | 'mixed',
      rawSkills,
    )
    // 检测是否需要写回（新增槽位 或 老数据补 slot 字段）
    const needsMigration =
      lazyAdded.length > 0
      || rawSkills.length !== ensuredSkills.length
      || rawSkills.some((s: any, i: number) => Number(s?.slot) !== ensuredSkills[i]?.slot)
    if (needsMigration && !c.has_left_home) {
      await pool.query(
        'UPDATE children SET learned_skills = $1::jsonb WHERE id = $2',
        [JSON.stringify(ensuredSkills), c.id],
      )
    }

    const skills = ensuredSkills.map((s: any) => ({
      level: s.level,
      slot: s.slot,
      ...CHILD_SKILL_MAP[s.skill_id],
    }))
    // 槽位解锁等级（前端展示未解锁占位用）
    const { getSkillSlotUnlockLevels } = await import('~/server/engine/childSkillData')
    const skillSlotUnlockLevels = getSkillSlotUnlockLevels(c.aptitude as ChildAptitude)

    // 面板二级属性 + 五行抗 聚合（来源：天赋 effect + passive 类型血脉功法 effect）
    //   - 与 fight.post.ts _assistPrep 阶段公式一致
    //   - 修复嗜血狂魔/战神血脉/鬼影连斩等天赋的 crit/dodge/lifesteal 漏算到面板
    const elementResist = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }
    let critRateBonus = 0, critDmgBonus = 0, dodgeBonus = 0, lifestealBonus = 0, resistCtrlBonus = 0
    const aggregateEffect = (e: any) => {
      if (!e) return
      critRateBonus    += e.CRIT_RATE_flat || 0
      critDmgBonus     += e.CRIT_DMG_flat  || 0
      dodgeBonus       += e.DODGE_flat     || 0
      lifestealBonus   += e.LIFESTEAL_flat || 0
      resistCtrlBonus  += e.RESIST_CTRL    || 0
      elementResist.metal += e.RESIST_METAL || 0
      elementResist.wood  += e.RESIST_WOOD  || 0
      elementResist.water += e.RESIST_WATER || 0
      elementResist.fire  += e.RESIST_FIRE  || 0
      elementResist.earth += e.RESIST_EARTH || 0
    }
    for (const t of talents) aggregateEffect((t as any).effect)
    for (const s of ensuredSkills) {
      const def = CHILD_SKILL_MAP[s.skill_id]
      if (def?.type === 'passive') aggregateEffect(def.effect)
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
        critRate:   Number(c.crit_rate    || 0) + critRateBonus,
        critDmg:    Number(c.crit_dmg     || 0) + critDmgBonus,
        dodge:      Number(c.dodge        || 0) + dodgeBonus,
        lifesteal:  Number(c.lifesteal    || 0) + lifestealBonus,
        spirit: c.spirit || 0,
        resistCtrl: Number(c.resist_ctrl  || 0) + resistCtrlBonus,
        elementResist,
        // 天赋/passive 功法贡献（前端可选显示「天赋 +X%」标签）
        talentBonusFlat: {
          critRate:  critRateBonus,
          critDmg:   critDmgBonus,
          dodge:     dodgeBonus,
          lifesteal: lifestealBonus,
          resistCtrl: resistCtrlBonus,
        },
        isBattling: c.is_battling,
        hasLeftHome: c.has_left_home,
        permanentBuffPct: Number(c.permanent_buff_pct || 0),
        visitCap: getChildVisitCap(c.aptitude),
        lastVisitAt: c.last_visit_at,
        feedCountToday: c.feed_count_today,
        feedDailyMax: 5,
        talents,
        skills,
        skillSlotUnlockLevels,
        bornAt: c.born_at,
      },
    }
  } catch (error) {
    console.error('获取子女详情失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
