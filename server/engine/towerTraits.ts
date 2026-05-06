// 通天塔 Trait 应用层
// 在战斗开始前修改怪物 BattlerStats，达成"特色机制"效果。
// MVP 策略：用现有引擎已支持的字段（atk/def/maxHp/crit_rate/crit_dmg/spd/resists/dodge）
// 表达 trait 效果，无需改动 battleEngine 内部逻辑。
//
// 后续 Phase 若需要更精细的"回合 hook"机制（如真正的 5 回合后狂暴、护盾叠加、
// 三阶段变身、反击、元素吸收 100%），再扩展 battleEngine 钩子并重写本文件。

import type { BattlerStats } from './battleEngine'
import type { TraitId } from './towerData'

/**
 * 在 generateMonsterStats 之后应用 trait 效果。
 * stats 会被原地修改。
 */
export function applyTraits(stats: BattlerStats, traits: TraitId[]): void {
  // 确保 resists 一定存在（即使原 stats 没填，后续 trait 也要写入）
  if (!stats.resists) {
    stats.resists = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 }
  }

  for (const t of traits) {
    switch (t) {
      // ===== 数值加成类 =====
      case 'T01': // 狂暴：MVP 全程激活，攻击 +30% / 速度 +15%
        stats.atk = Math.floor(stats.atk * 1.30)
        stats.spd = Math.floor(stats.spd * 1.15)
        break
      case 'T03': // 爆发：会心率 +50% / 会伤 +50%（cap 在引擎内部 cap 2.5 / cap 0.50）
        stats.crit_rate = Math.min(0.50, stats.crit_rate + 0.50)
        stats.crit_dmg = Math.min(2.5, stats.crit_dmg + 0.50)
        break
      case 'T05': // 再生：MVP 简化 — 最大血量 +25%（用更厚血量近似每回合 5% 回血）
        stats.maxHp = Math.floor(stats.maxHp * 1.25)
        stats.hp = stats.maxHp
        break
      case 'T07': // 减伤：防御 ×1.6（实际减伤约 30% 于玩家穿甲后）
        stats.def = Math.floor(stats.def * 1.60)
        break
      case 'T08': // 护盾叠加：最大血量 +30%（相当于初始 + 累计护盾）
        stats.maxHp = Math.floor(stats.maxHp * 1.30)
        stats.hp = stats.maxHp
        break
      case 'T09': // 圣盾期：MVP 简化 — 闪避 +40%（前期高闪避近似免伤期）
        stats.dodge = Math.min(0.80, stats.dodge + 0.40)
        break

      // ===== 元素抗性类 =====
      case 'T11': // 元素吸收·水：水抗 = 1.0（≈ 完全免疫水属性伤害）
        stats.resists!.water = 1.0
        break

      // ===== 反制类（MVP 简化为额外防御/速度）=====
      case 'T13': // 反伤：MVP 简化 — def ×1.4（玩家被打的伤害更难，近似反伤效果）
        stats.def = Math.floor(stats.def * 1.40)
        break
      case 'T15': // 反击：MVP 简化 — atk ×1.20 / spd ×1.20（更快更猛，玩家不敢普攻）
        stats.atk = Math.floor(stats.atk * 1.20)
        stats.spd = Math.floor(stats.spd * 1.20)
        break

      // ===== 控制 / DOT 附带类 =====
      // MVP 阶段：这些 trait 主要靠引擎按 element 自动配的攻击技能 debuff 体现。
      // 我们额外通过 atk +10% 强调"附带威胁感"，让玩家直观感受到这层"很烦"。
      case 'T16': // 群冻附带：水/冰元素怪物天然带 freeze；额外 atk +10%
      case 'T17': // 群眩附带：tier+ 怪物天然带 stun；额外 atk +10%
      case 'T18': // 沉默：tier+ 怪物天然带 silence；额外 atk +10%
      case 'T19': // 束缚：tier+ 怪物天然带 root；额外 atk +10%
      case 'T20': // 命中附毒：木元素怪天然 poison；额外 atk +10%
      case 'T21': // 命中附烧：火元素怪天然 burn；额外 atk +10%
      case 'T22': // 命中附流血：金元素怪天然 bleed；额外 atk +10%
        stats.atk = Math.floor(stats.atk * 1.10)
        break

      // ===== 特殊 / Boss 类 =====
      case 'B01': // 三阶段：MVP 简化 — maxHp ×1.30 / atk ×1.20 / def ×1.15（全段平均加强）
        stats.maxHp = Math.floor(stats.maxHp * 1.30)
        stats.hp = stats.maxHp
        stats.atk = Math.floor(stats.atk * 1.20)
        stats.def = Math.floor(stats.def * 1.15)
        break
      case 'B02': // 召唤：MVP 简化 — maxHp +30%（暂未实现召唤小怪）
        stats.maxHp = Math.floor(stats.maxHp * 1.30)
        stats.hp = stats.maxHp
        break
      case 'B05': // 五行轮转：MVP 简化 — 所有元素抗性 = 30%
        stats.resists!.metal = Math.max(stats.resists!.metal, 0.30)
        stats.resists!.wood = Math.max(stats.resists!.wood, 0.30)
        stats.resists!.water = Math.max(stats.resists!.water, 0.30)
        stats.resists!.fire = Math.max(stats.resists!.fire, 0.30)
        stats.resists!.earth = Math.max(stats.resists!.earth, 0.30)
        break
    }
  }
}

/** 给前端预览：返回 trait 列表的可读描述 */
export function describeTraits(traits: TraitId[]): string[] {
  // 仅列名字，详细文本由 TRAITS 字典提供
  return traits.slice()
}
