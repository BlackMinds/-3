// 礼物配方列表 - GET /api/companion/gift-recipes
// 返回 11 个礼物配方 + 当前角色的解锁状态
// 解锁规则（design 3.3.4）:
//   low/mid: auto - 默认解锁
//   high: storyline - 道侣专属剧情线（Phase 3 实施）
//   top: finale_storyline - 最终章（Phase 3 实施）
//   immortal: qixi - 七夕活动期间
// 当前阶段（Phase 2）小夏决策：全部解锁，玩家有原料即可炼制

import { GIFT_RECIPES } from '~/server/engine/giftRecipeData'

export default defineEventHandler(async (event) => {
  try {
    const list = GIFT_RECIPES.map(r => ({
      id: r.id,
      name: r.name,
      rarity: r.rarity,
      baseIntimacy: r.baseIntimacy,
      fitPersonality: r.fitPersonality,
      ingredients: r.ingredients,
      spiritStoneCost: r.spiritStoneCost,
      unlockedBy: r.unlockedBy,
      // Phase 2 全开放，Phase 3 接入剧情线 + 七夕活动后改成动态判定
      unlocked: true,
    }))
    return { code: 200, data: { recipes: list } }
  } catch (error) {
    console.error('获取礼物配方失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
