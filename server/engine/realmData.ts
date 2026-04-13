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

// 按 realm_tier 索引
export const REALM_BONUSES: Record<number, RealmBonus> = {
  1: { hp: 0,     atk: 0,    def: 0,   spd: 0,   hp_pct: 0,   atk_pct: 0,   def_pct: 0,   crit_rate: 0,    crit_dmg: 0,   dodge: 0 },
  2: { hp: 200,   atk: 15,   def: 10,  spd: 8,   hp_pct: 5,   atk_pct: 5,   def_pct: 5,   crit_rate: 0.01, crit_dmg: 0.05, dodge: 0 },
  3: { hp: 600,   atk: 50,   def: 30,  spd: 25,  hp_pct: 12,  atk_pct: 12,  def_pct: 10,  crit_rate: 0.02, crit_dmg: 0.10, dodge: 0.01 },
  4: { hp: 1500,  atk: 150,  def: 80,  spd: 60,  hp_pct: 20,  atk_pct: 20,  def_pct: 18,  crit_rate: 0.04, crit_dmg: 0.20, dodge: 0.02 },
  5: { hp: 4000,  atk: 400,  def: 220, spd: 150, hp_pct: 30,  atk_pct: 30,  def_pct: 25,  crit_rate: 0.06, crit_dmg: 0.30, dodge: 0.03 },
  6: { hp: 10000, atk: 1000, def: 550, spd: 350, hp_pct: 45,  atk_pct: 45,  def_pct: 38,  crit_rate: 0.08, crit_dmg: 0.45, dodge: 0.04 },
  7: { hp: 25000, atk: 2500, def: 1400,spd: 800, hp_pct: 65,  atk_pct: 65,  def_pct: 55,  crit_rate: 0.10, crit_dmg: 0.60, dodge: 0.05 },
  8: { hp: 60000, atk: 6000, def: 3500,spd: 2000,hp_pct: 100, atk_pct: 100, def_pct: 80,  crit_rate: 0.15, crit_dmg: 0.80, dodge: 0.06 },
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
