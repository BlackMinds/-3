// 境界数据与修为计算 —— 与 game/data.ts 保持一致
export const REALM_TIERS = [
  { tier: 1, stages: 9,  exp_multiplier: 1 },
  { tier: 2, stages: 3,  exp_multiplier: 10 },
  { tier: 3, stages: 3,  exp_multiplier: 50 },
  { tier: 4, stages: 3,  exp_multiplier: 200 },
  { tier: 5, stages: 3,  exp_multiplier: 800 },
  { tier: 6, stages: 3,  exp_multiplier: 3000 },
  { tier: 7, stages: 3,  exp_multiplier: 8000 },
  { tier: 8, stages: 5,  exp_multiplier: 15000 },
] as const

export function getExpRequired(tier: number, stage: number): number {
  const t = REALM_TIERS.find(r => r.tier === tier)
  if (!t) return Infinity
  if (tier === 1) return Math.floor(50 * Math.pow(stage, 1.2))
  return Math.floor(100 * t.exp_multiplier * Math.pow(stage + 1, 1.4))
}

/**
 * 累加修为,不自动突破(v3.2 改为手动突破)。
 * 修为可以累积超过当前境界所需,等待玩家点击"突破"按钮手动升级。
 * 飞升末阶(tier=8 stage=5)的修为软封顶,避免无限累加显示难看。
 */
// 等级所需经验（与前端 stores/game.ts levelExpRequired 保持一致）
export function getLevelExpRequired(lv: number): number {
  if (lv >= 200) return Infinity
  if (lv <= 30) return Math.floor(60 * Math.pow(lv, 1.25))
  if (lv <= 80) return Math.floor(100 * Math.pow(lv, 1.35))
  if (lv <= 150) return Math.floor(180 * Math.pow(lv, 1.42))
  return Math.floor(320 * Math.pow(lv, 1.48))
}

/**
 * 累加 levelExp 后自动扣除升级，保证 level_exp 始终小于当前等级所需。
 */
export function applyLevelExp(
  levelExp: number,
  level: number,
): { level: number; level_exp: number; levelUps: number } {
  let lv = Math.max(1, level || 1)
  let exp = Math.max(0, levelExp)
  let ups = 0
  while (lv < 200) {
    const req = getLevelExpRequired(lv)
    if (exp < req) break
    exp -= req
    lv++
    ups++
  }
  return { level: lv, level_exp: exp, levelUps: ups }
}

export function applyCultivationExp(
  cultivationExp: number,
  realmTier: number,
  realmStage: number,
): { cultivation_exp: number; realm_tier: number; realm_stage: number; breakthroughs: number } {
  const tier = Math.max(1, realmTier || 1)
  const stage = Math.max(1, realmStage || 1)
  let exp = Math.max(0, cultivationExp)

  // 飞升末阶软封顶: 修为不再超过当前阶段所需 (避免无限累加)
  if (tier === 8) {
    const t = REALM_TIERS.find(r => r.tier === 8)
    if (t && stage >= t.stages) {
      const req = getExpRequired(8, t.stages)
      exp = Math.min(exp, req)
    }
  }

  return { cultivation_exp: exp, realm_tier: tier, realm_stage: stage, breakthroughs: 0 }
}

/**
 * 手动突破成功率(v3.2 新增)
 * 规则:
 * - 跨大境界(stage 满需要升 tier)才有概率,跨小境界(仅升 stage)100% 成功
 * - 境界越高成功率越低,练气 100% / 大乘 55%
 * - 失败扣当前修为一定比例(见 getBreakthroughFailPenalty)
 */
export function getBreakthroughRate(fromTier: number, fromStage: number): number {
  const t = REALM_TIERS.find(r => r.tier === fromTier)
  if (!t) return 0
  // 飞升顶不能再突
  if (fromTier === 8 && fromStage >= t.stages) return 0
  // 跨小境界 100%
  if (fromStage < t.stages) return 1.0
  // 跨大境界按 tier 递减
  const rates: Record<number, number> = {
    1: 1.00,  // 练气 → 筑基
    2: 0.95,  // 筑基 → 金丹
    3: 0.90,  // 金丹 → 元婴
    4: 0.85,  // 元婴 → 化神
    5: 0.75,  // 化神 → 渡劫
    6: 0.65,  // 渡劫 → 大乘
    7: 0.55,  // 大乘 → 飞升
  }
  return rates[fromTier] ?? 0
}

/**
 * 突破失败修为损失比例(v3.2 新增)
 * 返回 [0, 1) 的比例,失败时扣除当前 cultivation_exp × 比例
 * 境界越高惩罚越重(10% → 80%),前期友好,后期高风险
 * 仅在跨大境界失败时适用(小境界 100% 成功不会失败)
 */
export function getBreakthroughFailPenalty(fromTier: number): number {
  const penalties: Record<number, number> = {
    1: 0.10,  // 练气(100% 成功,不会触发)
    2: 0.15,  // 筑基
    3: 0.20,  // 金丹
    4: 0.30,  // 元婴
    5: 0.40,  // 化神
    6: 0.50,  // 渡劫
    7: 0.65,  // 大乘
    8: 0.80,  // 飞升(已顶,不会触发)
  }
  return penalties[fromTier] ?? 0
}
