// 境界属性加成数据 — 与前端 client/src/game/data.ts 保持一致

export interface RealmBonus {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  hp_pct: number;
  atk_pct: number;
  def_pct: number;
  crit_rate: number;
  crit_dmg: number;
  dodge: number;
}

// 按 realm_tier 索引 (v2.0 方案 A: 固定值 ÷3, 百分比 ×0.7 — 让玩家增长跟得上怪物)
export const REALM_BONUSES: Record<number, RealmBonus> = {
  1: { hp: 0,     atk: 0,    def: 0,    spd: 0,   hp_pct: 0,   atk_pct: 0,   def_pct: 0,   crit_rate: 0,    crit_dmg: 0,   dodge: 0 },
  2: { hp: 70,    atk: 5,    def: 3,    spd: 3,   hp_pct: 3,   atk_pct: 3,   def_pct: 3,   crit_rate: 0.01, crit_dmg: 0.05, dodge: 0 },
  3: { hp: 200,   atk: 17,   def: 10,   spd: 8,   hp_pct: 8,   atk_pct: 8,   def_pct: 7,   crit_rate: 0.02, crit_dmg: 0.10, dodge: 0.01 },
  4: { hp: 500,   atk: 50,   def: 27,   spd: 20,  hp_pct: 14,  atk_pct: 14,  def_pct: 13,  crit_rate: 0.04, crit_dmg: 0.20, dodge: 0.02 },
  5: { hp: 1300,  atk: 130,  def: 75,   spd: 50,  hp_pct: 21,  atk_pct: 21,  def_pct: 18,  crit_rate: 0.06, crit_dmg: 0.30, dodge: 0.03 },
  6: { hp: 3300,  atk: 330,  def: 180,  spd: 120, hp_pct: 32,  atk_pct: 32,  def_pct: 27,  crit_rate: 0.08, crit_dmg: 0.45, dodge: 0.04 },
  7: { hp: 8300,  atk: 830,  def: 470,  spd: 270, hp_pct: 46,  atk_pct: 46,  def_pct: 39,  crit_rate: 0.10, crit_dmg: 0.60, dodge: 0.05 },
  8: { hp: 20000, atk: 2000, def: 1170, spd: 670, hp_pct: 70,  atk_pct: 70,  def_pct: 56,  crit_rate: 0.15, crit_dmg: 0.80, dodge: 0.06 },
};

export function getRealmStageMultiplier(stage: number): number {
  return 1 + (stage - 1) * 0.10;
}

export function getRealmBonusAtLevel(tier: number, stage: number): RealmBonus {
  const base = REALM_BONUSES[tier] || REALM_BONUSES[1];
  const mul = getRealmStageMultiplier(stage);
  return {
    hp: Math.floor(base.hp * mul),
    atk: Math.floor(base.atk * mul),
    def: Math.floor(base.def * mul),
    spd: Math.floor(base.spd * mul),
    hp_pct: base.hp_pct * mul,
    atk_pct: base.atk_pct * mul,
    def_pct: base.def_pct * mul,
    crit_rate: base.crit_rate * mul,
    crit_dmg: base.crit_dmg * mul,
    dodge: base.dodge * mul,
  };
}
