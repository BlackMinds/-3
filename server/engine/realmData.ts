// 境界属性加成 — 从 shared/balance.ts 读取单一数值源
// v3.0: crit_rate/crit_dmg/dodge 数值按预算压缩(T8 crit 0.15→0.10 等)
// 前端 client/src/game/data.ts 保持与此一致

export {
  REALM_BONUSES,
  getRealmStageMultiplier,
  getRealmBonusAtLevel,
  type RealmBonus,
} from '~/shared/balance';
