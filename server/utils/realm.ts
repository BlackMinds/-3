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
 * 累加后自动扣除并升级境界，保证 cultivation_exp 永远表示"当前境界剩余"。
 * 不会突破到顶（飞升 tier=8 的最后阶段会停住，多余经验保留）。
 */
export function applyCultivationExp(
  cultivationExp: number,
  realmTier: number,
  realmStage: number,
): { cultivation_exp: number; realm_tier: number; realm_stage: number; breakthroughs: number } {
  let tier = Math.max(1, realmTier || 1)
  let stage = Math.max(1, realmStage || 1)
  let exp = Math.max(0, cultivationExp)
  let breakthroughs = 0

  while (true) {
    const t = REALM_TIERS.find(r => r.tier === tier)
    if (!t) break
    const req = getExpRequired(tier, stage)
    if (exp < req) break
    // 已到顶：飞升末阶，不再扣除
    if (tier === 8 && stage >= t.stages) break

    exp -= req
    breakthroughs++
    if (stage >= t.stages) {
      if (tier < 8) { tier++; stage = 1 } else break
    } else {
      stage++
    }
  }

  return { cultivation_exp: exp, realm_tier: tier, realm_stage: stage, breakthroughs }
}
