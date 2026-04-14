// 随机事件静态数据 - 天道造化系统
// 每 30 分钟全服抽取 1 位玩家触发其中一个事件

export type EventRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type EventCategory = 'fortune' | 'enlighten' | 'gift' | 'sect' | 'disaster'

// 事件效果描述（由 server/utils/randomEvent.ts 的 applyEventEffect 分发处理）
export type EventEffect =
  | { kind: 'stones_add_t2'; coef: number }              // 灵石 += coef × tier²
  | { kind: 'stones_add_linear'; coef: number }          // 灵石 += coef × tier
  | { kind: 'stones_sub_pct'; pct: number }              // 灵石 -= pct%（带下限保护）
  | { kind: 'stones_sub_t2'; coef: number }              // 灵石 -= coef × tier²
  | { kind: 'cult_add_pct'; pct: number }                // 修为 += 当前境界所需 × pct%
  | { kind: 'cult_sub_pct'; pct: number }                // 修为 -= 当前境界所需 × pct%
  | { kind: 'perm_hp_pct'; pct: number }                 // permanent_hp_pct += pct
  | { kind: 'material_add'; min: number; max: number }   // 随机五行灵草 +N
  | { kind: 'material_sub'; min: number; max: number }   // 随机灵草 -N
  | { kind: 'pill_add'; tier: number }                   // 给一颗 tier 对应丹药
  | { kind: 'equipment_add'; difficulty: 1 | 2 | 3; isBoss: boolean; forceWeapon?: boolean }
  | { kind: 'skill_add' }                                // 随机功法残页 ×1
  | { kind: 'equipped_skill_exp' }                       // 随机已装备功法 +1 级经验
  | { kind: 'sect_contrib_add'; coef: number }           // 宗门贡献 += coef × tier

export interface RandomEvent {
  id: string
  name: string
  rarity: EventRarity
  category: EventCategory
  isPositive: boolean
  template: string                                        // {player} / {sect} 占位
  effects: EventEffect[]
  requires?: { inSect?: boolean }
}

// ===================== 20 个事件 =====================

export const RANDOM_EVENTS: RandomEvent[] = [
  // ---------- 奇遇拾获 (7) ----------
  {
    id: 'E001',
    name: '灵玉拾遗',
    rarity: 'common',
    category: 'fortune',
    isPositive: true,
    template: '道友「{player}」路过山涧瀑布，见一枚晶莹灵玉半埋于泥中，拾起后灵石略增',
    effects: [{ kind: 'stones_add_t2', coef: 1000 }],
  },
  {
    id: 'E002',
    name: '灵田意外',
    rarity: 'common',
    category: 'fortune',
    isPositive: true,
    template: '道友「{player}」在野外发现一片野生灵田，采得上品灵草若干',
    effects: [{ kind: 'material_add', min: 3, max: 8 }],
  },
  {
    id: 'E003',
    name: '古墓风云',
    rarity: 'rare',
    category: 'fortune',
    isPositive: true,
    template: '道友「{player}」误闯古墓秘穴，破阵取宝，得装备一件与灵石若干',
    effects: [
      { kind: 'equipment_add', difficulty: 1, isBoss: false },
      { kind: 'stones_add_t2', coef: 3000 },
    ],
  },
  {
    id: 'E004',
    name: '遗落储物袋',
    rarity: 'rare',
    category: 'fortune',
    isPositive: true,
    template: '道友「{player}」于乱葬岗角落拾得一只前辈遗落的储物袋',
    effects: [
      { kind: 'stones_add_t2', coef: 500 },
      { kind: 'material_add', min: 2, max: 4 },
      { kind: 'pill_add', tier: 1 },
    ],
  },
  {
    id: 'E005',
    name: '魂灯指路',
    rarity: 'rare',
    category: 'fortune',
    isPositive: true,
    template: '道友「{player}」得到一盏引魂灯，被其引至一处洞府，获得功法玉简一卷',
    effects: [{ kind: 'skill_add' }],
  },
  {
    id: 'E006',
    name: '灵矿惊现',
    rarity: 'epic',
    category: 'fortune',
    isPositive: true,
    template: '道友「{player}」踏入废弃矿洞，竟是一处未被开采的灵石矿脉！',
    effects: [{ kind: 'stones_add_t2', coef: 20000 }],
  },
  {
    id: 'E007',
    name: '天外陨铁',
    rarity: 'legendary',
    category: 'fortune',
    isPositive: true,
    template: '夜幕深沉，道友「{player}」目睹流星坠落，掘出一块星铁炼成绝世兵器！',
    effects: [{ kind: 'equipment_add', difficulty: 3, isBoss: true, forceWeapon: true }],
  },

  // ---------- 修为顿悟 (5) ----------
  {
    id: 'E008',
    name: '禅音入耳',
    rarity: 'common',
    category: 'enlighten',
    isPositive: true,
    template: '古寺钟声飘来，道友「{player}」心神澄澈，修为小有进益',
    effects: [{ kind: 'cult_add_pct', pct: 3 }],
  },
  {
    id: 'E009',
    name: '观瀑顿悟',
    rarity: 'rare',
    category: 'enlighten',
    isPositive: true,
    template: '道友「{player}」立于百丈飞瀑前，忽有所悟，修为大进',
    effects: [{ kind: 'cult_add_pct', pct: 15 }],
  },
  {
    id: 'E010',
    name: '梦中授法',
    rarity: 'rare',
    category: 'enlighten',
    isPositive: true,
    template: '道友「{player}」昏沉入睡，梦中一白发老者为其讲解功法',
    effects: [{ kind: 'equipped_skill_exp' }],
  },
  {
    id: 'E011',
    name: '心斋入定',
    rarity: 'rare',
    category: 'enlighten',
    isPositive: true,
    template: '道友「{player}」偶遇禅师传授心斋诀，气血温养，修为精进',
    effects: [
      { kind: 'cult_add_pct', pct: 5 },
      { kind: 'perm_hp_pct', pct: 0.5 },
    ],
  },
  {
    id: 'E012',
    name: '饮灵泉',
    rarity: 'epic',
    category: 'enlighten',
    isPositive: true,
    template: '道友「{player}」饮下山间灵泉，气血脉络大开',
    effects: [{ kind: 'perm_hp_pct', pct: 1.0 }],
  },

  // ---------- 邂逅赠予 (3) ----------
  {
    id: 'E013',
    name: '同门相助',
    rarity: 'common',
    category: 'gift',
    isPositive: true,
    template: '偶遇同门师兄弟，对方赠灵石以助道友「{player}」修行',
    effects: [{ kind: 'stones_add_linear', coef: 5000 }],
  },
  {
    id: 'E014',
    name: '前辈赠丹',
    rarity: 'epic',
    category: 'gift',
    isPositive: true,
    template: '道友「{player}」搭救迷路前辈，对方赠丹相谢',
    effects: [{ kind: 'pill_add', tier: 3 }],
  },
  {
    id: 'E015',
    name: '古洞奇缘',
    rarity: 'epic',
    category: 'fortune',
    isPositive: true,
    template: '道友「{player}」游历时偶遇一座残破古洞，进入后发现前辈遗骸，修为大进并获储物戒一枚',
    effects: [
      { kind: 'cult_add_pct', pct: 10 },
      { kind: 'equipment_add', difficulty: 2, isBoss: true },
    ],
  },

  // ---------- 宗门专属 (1) ----------
  {
    id: 'E016',
    name: '长老垂青',
    rarity: 'rare',
    category: 'sect',
    isPositive: true,
    template: '「{sect}」长老召见道友「{player}」，赐下贡献度',
    effects: [{ kind: 'sect_contrib_add', coef: 100 }],
    requires: { inSect: true },
  },

  // ---------- 劫难损失 (4) ----------
  {
    id: 'E017',
    name: '山贼劫道',
    rarity: 'common',
    category: 'disaster',
    isPositive: false,
    template: '道友「{player}」夜行僻径，遭遇散修山贼围攻，损失灵石若干……天道无常',
    effects: [{ kind: 'stones_sub_pct', pct: 8 }],
  },
  {
    id: 'E018',
    name: '幻境惊魂',
    rarity: 'common',
    category: 'disaster',
    isPositive: false,
    template: '道友「{player}」误入幻阵，神魂受创，修为略有倒退',
    effects: [{ kind: 'cult_sub_pct', pct: 2 }],
  },
  {
    id: 'E019',
    name: '误采毒草',
    rarity: 'common',
    category: 'disaster',
    isPositive: false,
    template: '道友「{player}」辨识失误，采回一批毒草，反噬灵田',
    effects: [{ kind: 'material_sub', min: 5, max: 15 }],
  },
  {
    id: 'E020',
    name: '假丹之骗',
    rarity: 'common',
    category: 'disaster',
    isPositive: false,
    template: '道友「{player}」从游商处购得假丹，一时不察损失灵石若干',
    effects: [{ kind: 'stones_sub_t2', coef: 3000 }],
  },
]

export const EVENT_MAP: Record<string, RandomEvent> = {}
for (const e of RANDOM_EVENTS) EVENT_MAP[e.id] = e

// ===================== 抽奖配置 =====================

// 中奖者稀有度分档概率（整数百分比）
export const RARITY_DISTRIBUTION: Record<EventRarity, number> = {
  common: 40,
  rare: 35,
  epic: 20,
  legendary: 5,
}

// 静默时段：北京时间 00:00 ~ 08:00 不触发
export const SILENT_HOURS_START_CN = 0
export const SILENT_HOURS_END_CN = 8

// 玩家活跃判定：最后请求在 10 分钟内
export const ONLINE_THRESHOLD_MS = 10 * 60 * 1000

// 中奖后冷却
export const WINNER_COOLDOWN_MS = 6 * 60 * 60 * 1000

// 新手保护期（注册满 2 小时后才能参与抽奖）
export const NEWBIE_PROTECTION_MS = 2 * 60 * 60 * 1000

// 灵石下限保护：扣除后不低于基础保底（按 tier 缩放）
export function getStoneFloor(tier: number): number {
  const table = [0, 100, 500, 2000, 10000, 50000, 200000, 1000000, 5000000]
  return table[Math.min(tier, 8)] ?? 0
}
