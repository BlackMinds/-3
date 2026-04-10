// ========== 角色相关 ==========
export interface CharacterData {
  id: number;
  user_id: number;
  name: string;
  spiritual_root: string;
  realm_tier: number;
  realm_stage: number;
  cultivation_exp: number;
  max_hp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit_rate: number;
  crit_dmg: number;
  dodge: number;
  lifesteal: number;
  spirit: number;
  resist_metal: number;
  resist_wood: number;
  resist_water: number;
  resist_fire: number;
  resist_earth: number;
  resist_ctrl: number;
  spirit_stone: number;
  immortal_jade: number;
  merit: number;
  current_map: string;
  last_online: string;
  created_at: string;
  avatar?: string | null;
  level: number;
  level_exp: number;
}

// ========== 境界 ==========
export interface RealmTier {
  tier: number;
  realm: string;
  stages: number;
  base_power: number;
  power_multiplier: number;
  breakthrough_type: string;
  exp_multiplier: number;
}

// ========== 地图 / 怪物 ==========
export interface MonsterTemplate {
  id: string;
  name: string;
  power: number;
  element: string | null;
  exp: number;
  spirit_stone_range: [number, number];
  role: string;
  drop_table: string;
}

export interface MapData {
  id: string;
  name: string;
  tier: number;
  realm_required: string;
  recommended_power: number;
  element: string | null;
  description: string;
  monsters: MonsterTemplate[];
  boss: MonsterTemplate | null;
  special_drops: string[];
  skill_drops: string[];
}

// ========== 战斗 ==========
export interface BattlerStats {
  name: string;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit_rate: number;
  crit_dmg: number;
  dodge: number;
  lifesteal: number;
  element: string | null;
  // 五行抗性 (0~0.7)
  resists?: {
    metal: number;
    wood: number;
    water: number;
    fire: number;
    earth: number;
    ctrl: number;
  };
  // 灵根 (用于功法匹配加成)
  spiritualRoot?: string | null;
  // 装备扩展属性 (百分比, 数值如 5 = 5%)
  armorPen?: number;
  accuracy?: number;
  elementDmg?: {
    metal?: number;
    wood?: number;
    water?: number;
    fire?: number;
    earth?: number;
  };
}

export interface BattleLogEntry {
  turn: number;
  text: string;
  type: 'normal' | 'crit' | 'kill' | 'loot' | 'death' | 'system' | 'dot' | 'buff';
  // 血量快照：每条日志附带当前双方血量，用于同步血条动画
  playerHp?: number;
  playerMaxHp?: number;
  monsterHp?: number;
  monsterMaxHp?: number;
}

// 当前战斗中的怪物信息（用于UI展示）
export interface MonsterBattleInfo {
  name: string;
  element: string | null;
  power: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  role: string;
  skills: string[]; // 怪物技能描述列表
}

export interface BattleResult {
  won: boolean;
  turns: number;
  expGained: number;
  spiritStoneGained: number;
  logs: BattleLogEntry[];
  drops: DropItem[];
  monsterInfo: MonsterBattleInfo;
}

export interface DropItem {
  name: string;
  type: 'material' | 'equipment' | 'skill';
  equipData?: any;
  rarity: string;
}

// ========== 功法 ==========
export interface SkillData {
  id: string;
  name: string;
  rarity: string;
  element: string | null;
  multiplier: number;
  type: 'active' | 'divine_power' | 'passive';
  cd_turns?: number;
  description: string;
  color: string;
}
