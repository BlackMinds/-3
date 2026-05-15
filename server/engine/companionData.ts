// 道侣系统静态数据 - 设计文档 design/system-companion.md
// 包含：道侣品质 / 性格 / 喜好对照 / 游历地点 / 邂逅剧情库

// ============================================================
// 道侣品质（6 等级）
// ============================================================

export type CompanionQuality = 0 | 1 | 2 | 3 | 4 | 5
// 0=凡品 1=下品 2=中品 3=上品 4=极品 5=仙品

export const QUALITY_NAMES = ['凡品', '下品', '中品', '上品', '极品', '仙品'] as const
export const QUALITY_COLORS = ['white', 'green', 'blue', 'purple', 'gold', 'red'] as const

// 全局邂逅品质概率（凡 50% / 下 25% / 中 15% / 上 7% / 极 2.5% / 仙 0.5%）
export const QUALITY_ROLL_TABLE: Array<{ quality: CompanionQuality; weight: number }> = [
  { quality: 0, weight: 500 },
  { quality: 1, weight: 250 },
  { quality: 2, weight: 150 },
  { quality: 3, weight: 70 },
  { quality: 4, weight: 25 },
  { quality: 5, weight: 5 },
]

// 品质决定的固定属性（参考文档 2.3.2）
export interface CompanionQualityTraits {
  baseStatPct: number       // 同体阶段反哺本体属性 %
  cultBonusMaxPct: number   // 修为加成上限 %（被动）
  childAptitudeCap: number  // 子女资质上限（0=凡品 ... 5=仙品 → 子女最高同级）
  twinChance: number        // 双胎概率
  tripletChance: number     // 三胎概率
}

export const QUALITY_TRAITS: Record<CompanionQuality, CompanionQualityTraits> = {
  0: { baseStatPct: 1, cultBonusMaxPct: 3, childAptitudeCap: 0, twinChance: 0.00, tripletChance: 0.00 },
  1: { baseStatPct: 2, cultBonusMaxPct: 5, childAptitudeCap: 1, twinChance: 0.01, tripletChance: 0.00 },
  2: { baseStatPct: 3, cultBonusMaxPct: 8, childAptitudeCap: 2, twinChance: 0.03, tripletChance: 0.00 },
  3: { baseStatPct: 5, cultBonusMaxPct: 12, childAptitudeCap: 3, twinChance: 0.05, tripletChance: 0.01 },
  4: { baseStatPct: 8, cultBonusMaxPct: 18, childAptitudeCap: 4, twinChance: 0.10, tripletChance: 0.02 },
  5: { baseStatPct: 12, cultBonusMaxPct: 25, childAptitudeCap: 5, twinChance: 0.20, tripletChance: 0.05 },
}

// ============================================================
// 性格 + 喜好对照（参考文档 2.3.3）
// ============================================================

export type Personality = '冷艳' | '活泼' | '温柔' | '高傲' | '俏皮'

export const PERSONALITIES: Personality[] = ['冷艳', '活泼', '温柔', '高傲', '俏皮']

// 性格 → 喜爱礼物 / 厌恶礼物（直接引用 3.3.4 礼制丹方 ID）
export const PERSONALITY_GIFT_PREFERENCE: Record<Personality, { loved: string[]; disliked: string[] }> = {
  冷艳: { loved: ['frost_pendant', 'moonlight_pill'],         disliked: ['peach_wine'] },
  活泼: { loved: ['peach_wine', 'fruit_jam'],                  disliked: ['frost_pendant'] },
  温柔: { loved: ['warm_jade_sachet', 'fruit_jam'],            disliked: ['purple_gold_hairpin'] },
  高傲: { loved: ['purple_gold_hairpin', 'moonlight_pill'],    disliked: ['kiddy_beads', 'colorful_beads'] },
  俏皮: { loved: ['kiddy_beads', 'colorful_beads'],            disliked: ['purple_gold_hairpin'] },
}

// 万能礼物（对所有性格都触发"喜爱"）
export const UNIVERSAL_LOVED_GIFTS = ['lotus_heart', 'mandarin_pendant', 'red_dust_hairpin']

// ============================================================
// 五行灵根
// ============================================================

export type SpiritualRoot = 'metal' | 'wood' | 'water' | 'fire' | 'earth'

export const ALL_ROOTS: SpiritualRoot[] = ['metal', 'wood', 'water', 'fire', 'earth']

export const ROOT_NAMES: Record<SpiritualRoot, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
}

// ============================================================
// 游历地点（参考文档 2.2.3）
// ============================================================

export interface ExpeditionLocation {
  id: string
  name: string
  realmRequired: number      // 解锁境界 tier (3=金丹 / 4=元婴 / 5=化神 / 6=渡劫 / 7=大乘)
  rootBias: SpiritualRoot[]  // 灵根偏向（70% 概率出对应灵根，30% 随机）
  description: string
  redJadeRange: [number, number]  // 红尘玉拾获区间（用于 2.2.5.2 子表）
}

export const EXPEDITION_LOCATIONS: ExpeditionLocation[] = [
  {
    id: 'falling_dawn_town',
    name: '落霞古镇',
    realmRequired: 3,
    rootBias: ['metal', 'earth'],
    description: '烟火人间，市井小巷藏着不少散修隐居。偶遇凡间女修，机缘暗藏。',
    redJadeRange: [20, 40],
  },
  {
    id: 'myth_beast_outskirts',
    name: '万妖山外围',
    realmRequired: 4,
    rootBias: ['fire', 'wood'],
    description: '妖兽密林，杀伐之地。偶遇剑修女子，凶险中亦有红尘。',
    redJadeRange: [30, 55],
  },
  {
    id: 'ghost_sea_coast',
    name: '幽冥海岸',
    realmRequired: 5,
    rootBias: ['water'],
    description: '神秘海港，雾海连天。偶遇水系道侣，缥缈不可捉摸。',
    redJadeRange: [40, 65],
  },
  {
    id: 'thunder_wasteland',
    name: '天雷荒原',
    realmRequired: 6,
    rootBias: ['metal'],
    description: '雷劫之地，天威浩荡。偶遇雷修女子，意志如钢。',
    redJadeRange: [50, 75],
  },
  {
    id: 'void_immortal_realm',
    name: '太虚仙境',
    realmRequired: 7,
    rootBias: ['metal', 'wood', 'water', 'fire', 'earth'],
    description: '飞升之路，万灵汇聚。偶遇仙缘之人，可遇不可求。',
    redJadeRange: [60, 80],
  },
]

// ============================================================
// 游历配置（数值常量）
// ============================================================

export const EXPEDITION_CONFIG = {
  baseDailyLimit: 2,            // 基础每日次数（金丹+）
  sectBonus: 1,                 // 宗门 5 级 +1
  hardCap: 5,                   // 每日封顶（含付费）
  weeklyExtraLimit: 2,          // 仙玉"游历加次符"每周限购
  guaranteedFirstExpeditionForFreshGoldCore: false, // 保留扩展位

  // 游历产出概率（按文档 2.2.5）
  outcomeWeights: {
    encounter: 30,
    giftMaterial: 30,
    redJade: 20,
    herb: 10,
    fortune: 5,
    mishap: 5,
  },

  // 邂逅事件名册容量
  rosterMaxUnmarried: 5,

  // 灵石消耗（按境界基础灵石量，运行时根据 tier 计算）
  baseStoneCostPerExpedition: 10000,  // 金丹期参考值，其他境界等比缩放
} as const

// 道侣培养材料子表（30% 主产出展开，参考 2.2.5.1）
// 注：2026-05-11 修正 — 灵田种植机制不需要种子（按等级直接解锁），原 *_seed 后缀
// 改为发放灵草本体，玩家可直接炼礼/凡品赠送（参考 design 3.3.3）
export const GIFT_MATERIAL_DROP_TABLE = [
  // 子概率（35%）凡品/灵品情花本体（相思藤、蝶恋花）
  { weight: 350, kind: 'flower_low', items: ['silk_flower', 'butterfly_flower'], qtyMin: 1, qtyMax: 2 },
  // 25% 玄品情花本体（月光兰）
  { weight: 250, kind: 'flower_mid', items: ['moonlight_orchid'], qtyMin: 1, qtyMax: 1 },
  // 15% 凡-下品成品礼物
  { weight: 150, kind: 'gift_low', items: ['fruit_jam', 'colorful_beads'], qtyMin: 1, qtyMax: 1 },
  // 10% 中品成品礼物
  { weight: 100, kind: 'gift_mid', items: ['peach_wine', 'warm_jade_sachet', 'kiddy_beads'], qtyMin: 1, qtyMax: 1 },
  // 8% 子女喂养灵草（普通灵草，跨品质）
  { weight: 80, kind: 'feed_herb', items: ['common_herb'], qtyMin: 2, qtyMax: 5 },
  // 5% 装备洗练材料（项目已有 awaken_stone / awaken_reroll，各 50%）
  { weight: 50, kind: 'equip_awaken', items: ['awaken_stone', 'awaken_reroll'], qtyMin: 1, qtyMax: 1 },
  // 1.8% 地品/天品情花本体（并蒂莲、长情草）
  { weight: 18, kind: 'flower_high', items: ['couple_lotus', 'lifelong_grass'], qtyMin: 1, qtyMax: 1 },
  // 0.2% 红尘花本体（仅七夕活动期间触发，运行时再校验）
  { weight: 2, kind: 'flower_red_dust', items: ['red_dust_flower'], qtyMin: 1, qtyMax: 1 },
]

// ============================================================
// 邂逅剧情库（5 段占位，正式上线扩展至 30 段）
// ============================================================

export interface RomanceScript {
  id: string
  title: string
  scene: string             // 场景描述
  npcDescription: string    // NPC 登场描述（{name}/{root}/{quality} 占位）
  style: string             // 风格标签
  enabled: boolean
}

export const ROMANCE_SCRIPTS: RomanceScript[] = [
  {
    id: 'RD-001',
    title: '古琴问音',
    scene: '你来到云雾弥漫的山道，忽闻幽幽古琴声从云雾深处传来。',
    npcDescription: '循声而去，只见一袭白衣女子立于古松之下，纤指拨弄琴弦。见你前来，她回眸一笑，声若清泉：「道友请坐，听我一曲如何？」',
    style: '婉约清冷',
    enabled: true,
  },
  {
    id: 'RD-002',
    title: '剑光惊鸿',
    scene: '你不慎闯入一处幽静的练剑场。',
    npcDescription: '只见剑光如雪，一位红衣女剑修身姿矫健，剑势凌厉。见你前来，她收剑入鞘，挑眉道：「道友也是同道？敢问可要切磋一二？」',
    style: '飒爽英气',
    enabled: true,
  },
  {
    id: 'RD-003',
    title: '药庐相遇',
    scene: '你来到山间一座古朴药庐求医解惑。',
    npcDescription: '一位青衫女子正在炉火旁炼药，神情专注。见你前来，她温柔一笑：「道友是要寻药还是问诊？且坐，茶水自取。」',
    style: '温柔贤淑',
    enabled: true,
  },
  {
    id: 'RD-004',
    title: '竹林论道',
    scene: '你来到一片清幽竹林，竹叶沙沙作响。',
    npcDescription: '林中石桌旁，一位淡雅女子正独自抚琴。见你前来，她颔首致意：「道友若有闲暇，可愿与我论道一番？」',
    style: '知性博学',
    enabled: true,
  },
  {
    id: 'RD-005',
    title: '月下浣纱',
    scene: '你夜行至山溪畔，月华如水。',
    npcDescription: '溪边一位素衣女子正在浣纱，发丝披散，身影朦胧。见你前来，她浅笑道：「夜深露重，道友为何独行至此？」',
    style: '素净纯真',
    enabled: true,
  },
  {
    id: 'RD-006',
    title: '雪山救人',
    scene: '你途经一处雪山隘口，忽闻有人受伤呼救。',
    npcDescription: '雪堆中卧着一位青衣女子，气息微弱。你出手扶起，她艰难睁眼：「多谢道友相救……此恩，无以为报。」',
    style: '婉约清冷',
    enabled: true,
  },
  {
    id: 'RD-007',
    title: '集市买花',
    scene: '你信步走进一处坊市，灯火喧嚣。',
    npcDescription: '一位扎着双髻的少女正在花摊前比划，见你过来，眼睛一亮：「道友！来得正好，帮我看看哪朵更好看？」',
    style: '飒爽英气',
    enabled: true,
  },
  {
    id: 'RD-008',
    title: '断崖之困',
    scene: '你被妖兽追逐至悬崖，前无去路。',
    npcDescription: '危急之时，一道剑光从天而降，一位红裙女剑修横剑而立挡在你身前：「道友且歇，我为你拦住这畜生。」',
    style: '飒爽英气',
    enabled: true,
  },
  {
    id: 'RD-009',
    title: '茶楼听书',
    scene: '你坐在山下镇上的茶楼听书，闲适惬意。',
    npcDescription: '邻桌一位绿衣姑娘忽然开口：「这先生说的我也知道，要不我说给道友听？保管比他精彩。」眼眸狡黠。',
    style: '素净纯真',
    enabled: true,
  },
  {
    id: 'RD-010',
    title: '小镇问路',
    scene: '你在山下小镇迷了路，转角处撞上一位姑娘。',
    npcDescription: '她怀里几册书简散落一地。你正欲赔罪，她已笑着摆手：「无妨无妨，道友这般急切，是要去哪？」',
    style: '温柔贤淑',
    enabled: true,
  },
  {
    id: 'RD-011',
    title: '飞剑试招',
    scene: '你在荒野上空御剑，忽觉身后剑气逼近。',
    npcDescription: '回头一看，是一位金衣女子神色冷峻地立于剑上：「道友的剑势有趣，可愿与我对上一招？」',
    style: '婉约清冷',
    enabled: true,
  },
  {
    id: 'RD-012',
    title: '酒馆斗诗',
    scene: '你走入一间临江小酒馆，正逢一群修士斗诗。',
    npcDescription: '台上一位红衣女子才思敏捷连胜数人，挥袖间气度非凡：「下一个，谁来？」目光扫过你，唇角微扬。',
    style: '飒爽英气',
    enabled: true,
  },
  {
    id: 'RD-013',
    title: '古墓奇缘',
    scene: '你误入一座千年古墓，机关重重。',
    npcDescription: '深处石室中一位青纱女子正在抄录古卷，见你闯入既不惊也不怒：「道友能闯到此处，倒是有些缘分。可愿协助我一同破解此墓？」',
    style: '知性博学',
    enabled: true,
  },
  {
    id: 'RD-014',
    title: '雨夜投宿',
    scene: '你在大雨中赶路，借宿一户山间农舍。',
    npcDescription: '开门的是一位披着粗布外衣的女子，眉目如画：「这般大雨，道友进来烤烤火吧。我刚煮了热汤。」',
    style: '温柔贤淑',
    enabled: true,
  },
  {
    id: 'RD-015',
    title: '海岛遇险',
    scene: '你乘舟出海采药，遭遇风浪漂流至无名小岛。',
    npcDescription: '岛上洞府中走出一位淡蓝衣裙的女修，神色淡然：「凡来此岛者皆是有缘人，道友可愿与我同观海上日出？」',
    style: '婉约清冷',
    enabled: true,
  },
  {
    id: 'RD-016',
    title: '炼丹之约',
    scene: '你来到一处偏远炼丹房想兑换丹药。',
    npcDescription: '炉前一位青衫女丹师正全神炼丹，丹炉忽然震鸣。她回头惊喜：「道友来得正好，借你灵气一用，可分你三成丹药！」',
    style: '知性博学',
    enabled: true,
  },
  {
    id: 'RD-017',
    title: '荒原追剑',
    scene: '你在荒原修行，忽见前方一位女子骑着灵兽飞驰而过。',
    npcDescription: '她追逐着一柄逃逸的飞剑，气喘吁吁回头朝你呼喊：「道友帮个忙！截住那柄剑！」',
    style: '飒爽英气',
    enabled: true,
  },
  {
    id: 'RD-018',
    title: '废墟拾遗',
    scene: '你在一处战后废墟中搜寻遗宝，遇见另一位修士。',
    npcDescription: '她身着素衣，正小心翼翼擦拭一块残碑。见你来，淡淡道：「这碑上有古字，道友若识得，可一起参详。」',
    style: '素净纯真',
    enabled: true,
  },
  {
    id: 'RD-019',
    title: '宴席斗法',
    scene: '你被邀参加一位前辈的寿宴，宴上修士斗法娱乐。',
    npcDescription: '场中一位金色长裙的女子凌厉非凡，扫视全场：「在座诸位，可有人接我三招？」目光最后落在你身上。',
    style: '飒爽英气',
    enabled: true,
  },
  {
    id: 'RD-020',
    title: '幻境共游',
    scene: '你进入一处秘境，刚踏入便被卷入幻境。',
    npcDescription: '幻境内一位浅紫衣裙的女子也正在四处张望，与你目光相对，浅浅一笑：「看来咱们是同道中人。要不要一起破局？」',
    style: '温柔贤淑',
    enabled: true,
  },
]

// ============================================================
// 亲密度阶段（参考文档 3.2）
// ============================================================

export interface IntimacyStage {
  threshold: number
  stageName: string
  description: string
}

export const INTIMACY_STAGES: IntimacyStage[] = [
  { threshold: 0,    stageName: '萍水相逢', description: '基础对话、赠礼界面' },
  { threshold: 100,  stageName: '知己',     description: '解锁修为加成（被动 +3%~+25%，按品质）' },
  { threshold: 250,  stageName: '心动',     description: '解锁约会事件（每日 3 次随机）' },
  { threshold: 600,  stageName: '结侣',     description: '正式结为道侣，永久仙缘印记 + 每日陪伴亲密度 +20' },
  { threshold: 800,  stageName: '结发',     description: '解锁怀胎/生育系统' },
  { threshold: 1200, stageName: '心心相印', description: '修为加成翻倍' },
  { threshold: 4000, stageName: '同体',     description: '道侣属性 30% 反哺本体' },
  { threshold: 8000, stageName: '道心',     description: '完美道侣终态，专属称号「比翼连理」' },
]

// 亲密度配置
export const INTIMACY_CONFIG = {
  dailyGiftLimit: 50,            // 礼物每日上限
  dailyDateLimit: 30,            // 约会事件每日上限
  dailyChildBattleLimit: 30,     // 子女出战秘境每日上限
  companionshipDaily: 20,        // 已结侣每日陪伴 +20
  companionshipOfflineCapDays: 7,// 离线累计上限 7 天
  preferredGiftMultiplier: 1.5,  // 喜爱礼物 +50%
  dislikedGiftPenalty: -3,       // 厌恶礼物固定扣分

  // 结侣阈值
  marryThreshold: 600,
  conceiveThreshold: 800,
}

// ============================================================
// 仙缘印记升级表（参考 3.6）
// ============================================================

export const SEAL_LEVEL_CONFIG = [
  { level: 1, allStatPct: 2,  costRedJade: 0 },     // 结侣赠送
  { level: 2, allStatPct: 4,  costRedJade: 500 },
  { level: 3, allStatPct: 6,  costRedJade: 2000 },
  { level: 4, allStatPct: 9,  costRedJade: 8000 },
  { level: 5, allStatPct: 12, costRedJade: 30000 },
]

// ============================================================
// 工具函数
// ============================================================

export function rollQuality(): CompanionQuality {
  const total = QUALITY_ROLL_TABLE.reduce((a, b) => a + b.weight, 0)
  let r = Math.random() * total
  for (const row of QUALITY_ROLL_TABLE) {
    r -= row.weight
    if (r <= 0) return row.quality
  }
  return 0
}

export function rollPersonality(): Personality {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)]
}

// 按地点 rootBias 滚灵根（70% 偏向 / 30% 全随机）
export function rollSpiritualRoot(location: ExpeditionLocation): SpiritualRoot {
  if (Math.random() < 0.7 && location.rootBias.length > 0) {
    return location.rootBias[Math.floor(Math.random() * location.rootBias.length)]
  }
  return ALL_ROOTS[Math.floor(Math.random() * ALL_ROOTS.length)]
}

// 计算亲密度对应阶段
export function getIntimacyStage(intimacy: number): IntimacyStage {
  let current = INTIMACY_STAGES[0]
  for (const stage of INTIMACY_STAGES) {
    if (intimacy >= stage.threshold) current = stage
    else break
  }
  return current
}

// 性格匹配反应：love / dislike / normal
export type GiftReaction = 'love' | 'dislike' | 'normal'

export function checkGiftReaction(personality: Personality, giftId: string): GiftReaction {
  const pref = PERSONALITY_GIFT_PREFERENCE[personality]
  if (UNIVERSAL_LOVED_GIFTS.includes(giftId)) return 'love'
  if (pref.loved.includes(giftId)) return 'love'
  if (pref.disliked.includes(giftId)) return 'dislike'
  return 'normal'
}

// 邂逅地点匹配：境界过滤
export function listEligibleLocations(realmTier: number): ExpeditionLocation[] {
  return EXPEDITION_LOCATIONS.filter(l => l.realmRequired <= realmTier)
}

// 每日游历上限计算
// 分两段：
// 1) 自然次数 = base + 宗门 + 节日，受 hardCap=5 封顶（游戏经济保护）
// 2) 付费次数 = GM 一次性发的 + 月卡每日加成，叠加在自然次数之上不受 hardCap 限制
//    （expedition_extra_today 字段目前只被 GM 后台/cron 写入，玩家无自助途径刷它）
// 总上限保险 100（防极端 GM 误操作）
const ABSOLUTE_DAILY_CAP = 100
export function calcDailyExpeditionLimit(opts: {
  sectLevel: number
  expeditionExtraToday: number
  paidBonus?: number          // 道侣游历月卡每日加成（未过期才传入）
  isFestival?: boolean
}): number {
  let natural = EXPEDITION_CONFIG.baseDailyLimit
  if (opts.sectLevel >= 5) natural += EXPEDITION_CONFIG.sectBonus
  if (opts.isFestival) natural += 2
  natural = Math.min(natural, EXPEDITION_CONFIG.hardCap)

  let limit = natural + opts.expeditionExtraToday
  if (opts.paidBonus && opts.paidBonus > 0) limit += opts.paidBonus
  return Math.min(limit, ABSOLUTE_DAILY_CAP)
}
