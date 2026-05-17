// 风云阁广播文案池（cron / 系统级事件）
// - 斗法日榜 TOP3
// - 宗门战 胜负战报 / MVP / 单挑 3:0 / walkover
// - 灵脉奖池 TOP3 / 节点偷袭
//
// 与 pkBroadcastData.ts 风格一致：第三人称叙述、修仙风、多模板随机
// 占位符以 {key} 形式插入，调用方负责传值

type Rarity = 'rare' | 'epic' | 'legendary'

interface Picked {
  text: string
  rarity: Rarity
}

function fillTemplate(tmpl: string, vars: Record<string, string | number>): string {
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ============================================================
// 斗法日榜 TOP3
// 占位：{name} 道号  {score} 当前积分
// ============================================================
const ARENA_RANK1_TEMPLATES = [
  '斗法台立碑铭刻：「{name}」以 {score} 分独占榜首，授「论道魁首」称号三日，攻防血俱涨三厘',
  '万界传檄：「{name}」以 {score} 分荣登斗法榜首，论道魁首之名响彻八方',
  '今日斗法终章：「{name}」{score} 分压群雄，魁首之位无人能撼，得三日加持',
  '「{name}」以 {score} 分镇压斗法台，授「论道魁首」称号，引得无数后辈仰望',
]

const ARENA_RANK2_TEMPLATES = [
  '斗法榜次席花落「{name}」（{score} 分），授「斗法翘楚」称号三日',
  '「{name}」以 {score} 分位列斗法榜第二，翘楚之名当之无愧',
  '论道之争紧追魁首：「{name}」以 {score} 分摘得斗法榜亚位，得三日加持',
]

const ARENA_RANK3_TEMPLATES = [
  '斗法榜探花归「{name}」（{score} 分），「斗法翘楚」称号加身三日',
  '「{name}」以 {score} 分跻身斗法榜前三，翘楚之列再添一席',
  '今日斗法榜第三：「{name}」（{score} 分），三日内攻防加持萦身',
]

export function pickArenaRankBroadcast(rank: 1 | 2 | 3, name: string, score: number): Picked {
  if (rank === 1) {
    return { text: fillTemplate(pick(ARENA_RANK1_TEMPLATES), { name, score }), rarity: 'legendary' }
  }
  if (rank === 2) {
    return { text: fillTemplate(pick(ARENA_RANK2_TEMPLATES), { name, score }), rarity: 'epic' }
  }
  return { text: fillTemplate(pick(ARENA_RANK3_TEMPLATES), { name, score }), rarity: 'epic' }
}

// ============================================================
// 宗门战 胜负战报
// 占位：{winner} 胜方宗门  {loser} 败方宗门  {sa} 胜方比分  {sb} 败方比分
// 比分悬殊（>= 5 分差）→ epic，否则 rare
// ============================================================
const SECT_WAR_REPORT_CLOSE = [
  '宗门战快讯：【{winner}】以 {sa}:{sb} 险胜【{loser}】，论道江湖再添一段恩怨',
  '问道大比战报：【{winner}】{sa}:{sb} 力克【{loser}】，胜负仅悬一线',
  '【{winner}】与【{loser}】鏖战难分，终以 {sa}:{sb} 取胜，两宗弟子皆有伤亡',
  '宗门战传讯：【{winner}】{sa}:{sb} 险胜【{loser}】，赛后场上余韵未消',
]

const SECT_WAR_REPORT_BLOWOUT = [
  '宗门战震动八荒：【{winner}】以 {sa}:{sb} 横压【{loser}】，气势如虹',
  '一战定乾坤：【{winner}】{sa}:{sb} 大破【{loser}】，败方弟子尽数挂彩',
  '问道大比惊变：【{winner}】仅以 {sa}:{sb} 之差就将【{loser}】钉在耻辱柱上',
  '【{loser}】{sa}:{sb} 惨败于【{winner}】之手，长老闭关三日不见客',
]

export function pickSectWarReportBroadcast(
  winner: string, loser: string, scoreWinner: number, scoreLoser: number
): Picked {
  const diff = scoreWinner - scoreLoser
  if (diff >= 5) {
    return {
      text: fillTemplate(pick(SECT_WAR_REPORT_BLOWOUT), { winner, loser, sa: scoreWinner, sb: scoreLoser }),
      rarity: 'epic',
    }
  }
  return {
    text: fillTemplate(pick(SECT_WAR_REPORT_CLOSE), { winner, loser, sa: scoreWinner, sb: scoreLoser }),
    rarity: 'rare',
  }
}

// ============================================================
// 宗门战 MVP 论道之星
// 占位：{name} 角色道号  {sect} 所在宗门
// ============================================================
const SECT_WAR_MVP_TEMPLATES = [
  '论道大比群英会：【{sect}】「{name}」一战封神，授「论道之星」称号七日',
  '宗门战传讯：【{sect}】「{name}」三场单挑技压群雄，问道大比之星当之无愧',
  '「{name}」（{sect}）于宗门战中独挑大梁，长老亲授「论道之星」之名',
  '宗门战之星：【{sect}】「{name}」一人之力扭转战局，七日内攻防血皆涨',
]

export function pickSectWarMvpBroadcast(name: string, sect: string): Picked {
  return { text: fillTemplate(pick(SECT_WAR_MVP_TEMPLATES), { name, sect }), rarity: 'epic' }
}

// ============================================================
// 宗门战 单挑 3:0 横扫
// 占位：{winner}/{loser} 双方宗门
// ============================================================
const SECT_WAR_SWEEP_TEMPLATES = [
  '宗门战单挑场惊雷：【{winner}】3:0 横扫【{loser}】，败方台下哀鸿遍野',
  '【{winner}】单挑组三战全胜，将【{loser}】的脸面按在论道台上反复摩擦',
  '【{loser}】单挑三战连败，台前长老掩面而退，【{winner}】气势如龙',
  '问道大比单挑：【{winner}】完胜【{loser}】，三场无一败绩',
]

export function pickSectWarSweepBroadcast(winner: string, loser: string): Picked {
  return { text: fillTemplate(pick(SECT_WAR_SWEEP_TEMPLATES), { winner, loser }), rarity: 'epic' }
}

// ============================================================
// 宗门战 walkover 不战而胜
// ============================================================
const SECT_WAR_WALKOVER_TEMPLATES = [
  '宗门战奇闻：【{loser}】未派出阵容，【{winner}】不战而胜，传为笑谈',
  '【{loser}】临阵畏战，宗门战自动判负于【{winner}】，颜面尽失',
  '【{winner}】候场良久未见对手，问道大比直接判胜，【{loser}】销声匿迹',
]

export function pickSectWarWalkoverBroadcast(winner: string, loser: string): Picked {
  return { text: fillTemplate(pick(SECT_WAR_WALKOVER_TEMPLATES), { winner, loser }), rarity: 'rare' }
}

// ============================================================
// 灵脉奖池开奖 TOP3
// 占位：{sect} 宗门名  {pot} 奖池数额
// ============================================================
const VEIN_JACKPOT_TOP1 = [
  '灵脉大奖池本周开奖：【{sect}】力压群雄夺得魁首，独占 {pot} 灵石奖池四成',
  '万界灵脉震动：【{sect}】涌灵贡献位列第一，本周奖池 {pot} 灵石中四成尽归其下',
  '【{sect}】于灵脉之争中拔得头筹，独享本周奖池 {pot} 灵石之四成，宗门库藏暴涨',
]

const VEIN_JACKPOT_TOP2 = [
  '灵脉奖池次席归【{sect}】，本周奖池 {pot} 灵石中一成入库',
  '【{sect}】灵脉贡献位列第二，本周分得 {pot} 灵石奖池一成',
]

const VEIN_JACKPOT_TOP3 = [
  '灵脉奖池探花花落【{sect}】，本周奖池 {pot} 灵石中一成入库',
  '【{sect}】灵脉贡献位列第三，本周分得 {pot} 灵石奖池一成',
]

export function pickVeinJackpotBroadcast(rank: 1 | 2 | 3, sect: string, pot: number): Picked {
  if (rank === 1) {
    return { text: fillTemplate(pick(VEIN_JACKPOT_TOP1), { sect, pot }), rarity: 'legendary' }
  }
  if (rank === 2) {
    return { text: fillTemplate(pick(VEIN_JACKPOT_TOP2), { sect, pot }), rarity: 'epic' }
  }
  return { text: fillTemplate(pick(VEIN_JACKPOT_TOP3), { sect, pot }), rarity: 'epic' }
}

// ============================================================
// 灵脉节点被偷家
// 占位：{attacker} 偷袭方宗门  {defender} 被偷方宗门  {node} 节点名
// ============================================================
const VEIN_RAID_TEMPLATES = [
  '灵脉战报：【{attacker}】突袭【{node}】得手，从【{defender}】手中夺下该脉',
  '【{node}】易主：【{attacker}】偷袭成功，【{defender}】守卫尽数离岗',
  '修真界惊闻：【{attacker}】奇袭【{node}】，【{defender}】守脉之士接连溃败',
  '灵脉江湖再起波澜：【{attacker}】攻陷【{node}】，【{defender}】痛失此处灵气根基',
]

export function pickVeinRaidBroadcast(attacker: string, defender: string, node: string): Picked {
  return {
    text: fillTemplate(pick(VEIN_RAID_TEMPLATES), { attacker, defender, node }),
    rarity: 'rare',
  }
}
