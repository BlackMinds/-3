// 约会事件库 - 设计文档 3.5
// 已结侣道侣 + 亲密度 ≥ 250 后解锁，每日 3 次随机触发
// 4 类事件：dialog（剧情对话）/ battle（联手历练）/ gift（赠礼回馈）/ special（稀有事件）

export type DateEventType = 'dialog' | 'battle' | 'gift' | 'special'

export interface DateChoice {
  label: string
  intimacy: number      // 该选项亲密度收益（正确答案高 / 错误答案低）
  reward?: {
    spiritStone?: number
    redJade?: number
    cultExp?: number    // 修为奖励
    item?: { id: string; quantity: number }
  }
}

export interface DateEvent {
  id: string
  title: string
  type: DateEventType
  weight: number        // 触发权重
  scene: string
  choices: DateChoice[]
}

export const DATE_EVENTS: DateEvent[] = [
  // ---------- dialog (40%, 7 个) ----------
  {
    id: 'DT-001',
    title: '清风踏月',
    type: 'dialog',
    weight: 100,
    scene: '你与道侣共游清风月下，她忽然问：「若你为剑修，可知何为剑心？」',
    choices: [
      { label: '剑心即道心', intimacy: 15, reward: { spiritStone: 100 } },
      { label: '剑心即杀伐', intimacy: 3 },
      { label: '剑心即杀身成仁', intimacy: 15, reward: { item: { id: 'moonlight_pill', quantity: 1 } } },
    ],
  },
  {
    id: 'DT-002',
    title: '茶舍论道',
    type: 'dialog',
    weight: 100,
    scene: '小坐茶舍，道侣淡然轻笑：「修真者，何以为修？」',
    choices: [
      { label: '为长生不老', intimacy: 5 },
      { label: '为求道悟真', intimacy: 15, reward: { cultExp: 5000 } },
      { label: '为护苍生', intimacy: 15, reward: { redJade: 30 } },
    ],
  },
  {
    id: 'DT-003',
    title: '观瀑听涛',
    type: 'dialog',
    weight: 100,
    scene: '飞流瀑布下，道侣闭目沉吟：「这水声似道，你听出什么了？」',
    choices: [
      { label: '此水千载未变', intimacy: 15, reward: { cultExp: 3000 } },
      { label: '是飞瀑的回声', intimacy: 5 },
      { label: '万物归元的法则', intimacy: 15, reward: { redJade: 20 } },
    ],
  },
  {
    id: 'DT-004',
    title: '月下抚琴',
    type: 'dialog',
    weight: 100,
    scene: '月华如水，道侣纤指拨弦，回首问你：「这一曲名为？」',
    choices: [
      { label: '广陵散', intimacy: 15, reward: { item: { id: 'fruit_jam', quantity: 2 } } },
      { label: '高山流水', intimacy: 15, reward: { redJade: 25 } },
      { label: '不知曲名只觉清雅', intimacy: 8 },
    ],
  },
  {
    id: 'DT-005',
    title: '林中赏花',
    type: 'dialog',
    weight: 100,
    scene: '林中野花盛开，道侣俯身嗅花：「此花虽美，奈何无名。你说叫什么好？」',
    choices: [
      { label: '凡花，何须有名', intimacy: 5 },
      { label: '便叫"忆君"', intimacy: 15, reward: { redJade: 30 } },
      { label: '无名才美', intimacy: 12, reward: { cultExp: 2000 } },
    ],
  },
  {
    id: 'DT-006',
    title: '雨中共伞',
    type: 'dialog',
    weight: 100,
    scene: '骤雨忽至，道侣轻撑一伞与你共行。她侧首问：「此情此景，可记得是何年？」',
    choices: [
      { label: '记不清，只记得伞下的你', intimacy: 15, reward: { redJade: 30 } },
      { label: '随意捏出一个年份', intimacy: 3 },
      { label: '是你我相遇的那一年', intimacy: 15, reward: { item: { id: 'peach_wine', quantity: 1 } } },
    ],
  },
  {
    id: 'DT-007',
    title: '山巅观星',
    type: 'dialog',
    weight: 100,
    scene: '山巅之夜，道侣指向天际：「天行有常，星宿有数。你看哪颗最亮？」',
    choices: [
      { label: '北斗第七', intimacy: 12, reward: { cultExp: 3000 } },
      { label: '紫微帝星', intimacy: 15, reward: { redJade: 25 } },
      { label: '在你眼里看到的那一颗', intimacy: 15, reward: { item: { id: 'warm_jade_sachet', quantity: 1 } } },
    ],
  },

  // ---------- battle (30%, 3 个) ----------
  {
    id: 'DT-101',
    title: '联手降妖',
    type: 'battle',
    weight: 100,
    scene: '途中遇一只低阶妖兽袭击，道侣已抽剑出鞘：「相公（夫君），共战否？」',
    choices: [
      { label: '并肩作战', intimacy: 10, reward: { spiritStone: 500, redJade: 10 } },
      { label: '让我护你后撤', intimacy: 8, reward: { spiritStone: 300 } },
      { label: '由你领头我殿后', intimacy: 6, reward: { spiritStone: 200 } },
    ],
  },
  {
    id: 'DT-102',
    title: '协力破阵',
    type: 'battle',
    weight: 100,
    scene: '前路一片古阵阻挡，道侣指尖凝光：「双修之法可破此阵，可愿一试？」',
    choices: [
      { label: '愿与你共闯', intimacy: 12, reward: { cultExp: 3000, redJade: 15 } },
      { label: '你出手，我守护', intimacy: 8, reward: { cultExp: 1500 } },
      { label: '另寻他路', intimacy: 3 },
    ],
  },
  {
    id: 'DT-103',
    title: '剑术切磋',
    type: 'battle',
    weight: 100,
    scene: '空地之上，道侣戏言：「久未与你切磋，三招点到为止？」',
    choices: [
      { label: '欣然应战', intimacy: 12, reward: { redJade: 20 } },
      { label: '让你三招', intimacy: 10, reward: { item: { id: 'awaken_stone', quantity: 1 } } },
      { label: '不忍伤你，认输', intimacy: 8 },
    ],
  },

  // ---------- gift (20%, 2 个) ----------
  {
    id: 'DT-201',
    title: '红颜赠诗',
    type: 'gift',
    weight: 100,
    scene: '道侣展开一幅亲笔诗稿递与你：「闲时所作，赠君一观。」',
    choices: [
      { label: '欣然收下', intimacy: 5, reward: { item: { id: 'fruit_jam', quantity: 2 }, redJade: 10 } },
      { label: '细细品读', intimacy: 8, reward: { item: { id: 'colorful_beads', quantity: 1 }, redJade: 15 } },
    ],
  },
  {
    id: 'DT-202',
    title: '亲制糕点',
    type: 'gift',
    weight: 100,
    scene: '道侣端来亲手所制糕点：「试我手艺如何？」',
    choices: [
      { label: '果然好吃', intimacy: 5, reward: { item: { id: 'fruit_jam', quantity: 3 } } },
      { label: '甜中带咸恰到好处', intimacy: 8, reward: { spiritStone: 500, redJade: 5 } },
    ],
  },

  // ---------- special (10%, 2 个) ----------
  {
    id: 'DT-901',
    title: '前世今生',
    type: 'special',
    weight: 50,
    scene: '夜深人静，道侣忽红了眼眶：「我似想起了前世。你若身归大梦，可还认得我？」',
    choices: [
      { label: '今生既遇便不忘', intimacy: 30, reward: { redJade: 80, cultExp: 10000 } },
      { label: '前世今生皆是缘', intimacy: 25, reward: { redJade: 60 } },
      { label: '不必前世，今生足矣', intimacy: 35, reward: { redJade: 100, item: { id: 'moonlight_pill', quantity: 1 } } },
    ],
  },
  {
    id: 'DT-902',
    title: '红尘奇遇',
    type: 'special',
    weight: 50,
    scene: '一位老者悄然出现，望着你二人微笑：「这是仙缘玉露，是天道予有缘之人的造化。」',
    choices: [
      { label: '与道侣共饮', intimacy: 20, reward: { redJade: 50, cultExp: 8000 } },
      { label: '让她先饮', intimacy: 25, reward: { redJade: 60, item: { id: 'awaken_reroll', quantity: 1 } } },
    ],
  },

  // ---------- dialog 扩充 (DT-008 ~ DT-014) ----------
  {
    id: 'DT-008',
    title: '雪中执笔',
    type: 'dialog',
    weight: 100,
    scene: '初雪簌簌，道侣立于窗前执笔写字，回首问：「你说，这字写给何人最好？」',
    choices: [
      { label: '写给天地', intimacy: 8, reward: { cultExp: 2000 } },
      { label: '写给你我', intimacy: 15, reward: { redJade: 30 } },
      { label: '写给前世来生', intimacy: 12, reward: { item: { id: 'silk_flower', quantity: 5 } } },
    ],
  },
  {
    id: 'DT-009',
    title: '湖心垂钓',
    type: 'dialog',
    weight: 100,
    scene: '小舟泛于湖心，道侣慵懒倚舷：「鱼若上钩，是想被钓还是不想？」',
    choices: [
      { label: '鱼自有道', intimacy: 12, reward: { cultExp: 2500 } },
      { label: '愿者上钩', intimacy: 15, reward: { redJade: 25 } },
      { label: '不愿想这些', intimacy: 5 },
    ],
  },
  {
    id: 'DT-010',
    title: '夜读古卷',
    type: 'dialog',
    weight: 100,
    scene: '油灯昏黄，道侣翻开一卷古书：「这页的字迹斑驳，你猜写的是什么？」',
    choices: [
      { label: '是上古剑法', intimacy: 12, reward: { cultExp: 3000 } },
      { label: '是某人的家书', intimacy: 15, reward: { redJade: 25 } },
      { label: '已无从考证', intimacy: 5 },
    ],
  },
  {
    id: 'DT-011',
    title: '梅花问雪',
    type: 'dialog',
    weight: 100,
    scene: '冬日梅林，道侣折下一支腊梅：「梅花斗雪而开，你说这是逞强还是无畏？」',
    choices: [
      { label: '是无畏', intimacy: 15, reward: { redJade: 20 } },
      { label: '是逞强', intimacy: 3 },
      { label: '是任性', intimacy: 8 },
    ],
  },
  {
    id: 'DT-012',
    title: '试问归途',
    type: 'dialog',
    weight: 100,
    scene: '远行归山，道侣轻声问：「若有一日修无可修，你最想做什么？」',
    choices: [
      { label: '与你归隐山林', intimacy: 18, reward: { redJade: 40 } },
      { label: '云游四海', intimacy: 8, reward: { cultExp: 2000 } },
      { label: '继续推演大道', intimacy: 10, reward: { cultExp: 3000 } },
    ],
  },
  {
    id: 'DT-013',
    title: '茶涌灵泉',
    type: 'dialog',
    weight: 100,
    scene: '道侣亲手煮一壶灵泉水沏茶：「同样的水叶，沏在不同盏中，为何味道不同？」',
    choices: [
      { label: '盏有灵性', intimacy: 12, reward: { item: { id: 'fruit_jam', quantity: 3 } } },
      { label: '心境不同', intimacy: 15, reward: { cultExp: 3500 } },
      { label: '只是错觉', intimacy: 3 },
    ],
  },
  {
    id: 'DT-014',
    title: '残棋一局',
    type: 'dialog',
    weight: 100,
    scene: '林间石桌一盘残棋，道侣指向一处：「黑棋三十手，可救否？」',
    choices: [
      { label: '弃子求生', intimacy: 15, reward: { redJade: 30, cultExp: 2000 } },
      { label: '弃局不救', intimacy: 8 },
      { label: '另起炉灶', intimacy: 12, reward: { redJade: 15 } },
    ],
  },

  // ---------- battle 扩充 (DT-104 ~ DT-109) ----------
  {
    id: 'DT-104',
    title: '黑风寨',
    type: 'battle',
    weight: 100,
    scene: '途经山寨惊扰群匪，道侣秀眉一挑：「这些山匪不识好歹，要不要给个教训？」',
    choices: [
      { label: '联手扫匪', intimacy: 12, reward: { spiritStone: 800, redJade: 12 } },
      { label: '震慑一番便走', intimacy: 8, reward: { spiritStone: 500 } },
      { label: '绕路而行', intimacy: 3 },
    ],
  },
  {
    id: 'DT-105',
    title: '比剑选鞘',
    type: 'battle',
    weight: 100,
    scene: '坊市铸剑铺前，道侣兴致勃勃：「试剑须双修。同一柄剑，你我各试一招？」',
    choices: [
      { label: '同剑对决', intimacy: 12, reward: { item: { id: 'awaken_stone', quantity: 1 } } },
      { label: '让你先试', intimacy: 10, reward: { redJade: 20 } },
      { label: '我先试再传你', intimacy: 8, reward: { spiritStone: 300 } },
    ],
  },
  {
    id: 'DT-106',
    title: '魔修来袭',
    type: 'battle',
    weight: 100,
    scene: '一名邪修突然现身意图偷袭，道侣已抢先一步立于你身前：「敢动我夫君（道友）？」',
    choices: [
      { label: '与你并肩反击', intimacy: 15, reward: { redJade: 25, spiritStone: 1000 } },
      { label: '我护你后退', intimacy: 12, reward: { redJade: 18 } },
      { label: '让我独自上', intimacy: 8, reward: { spiritStone: 500 } },
    ],
  },
  {
    id: 'DT-107',
    title: '幻阵共破',
    type: 'battle',
    weight: 100,
    scene: '林深处忽起幻阵围困二人，道侣抽剑而立：「同心则破，你愿信我吗？」',
    choices: [
      { label: '愿与你心意相通', intimacy: 18, reward: { redJade: 30, cultExp: 4000 } },
      { label: '理性破阵更稳妥', intimacy: 8, reward: { cultExp: 2000 } },
      { label: '不必勉强', intimacy: 5 },
    ],
  },
  {
    id: 'DT-108',
    title: '雪原巨兽',
    type: 'battle',
    weight: 100,
    scene: '雪原中一头巨兽朝你冲来，道侣已掐诀凝符：「上次说的双剑合璧，可还记得？」',
    choices: [
      { label: '同步剑诀', intimacy: 15, reward: { redJade: 30, item: { id: 'butterfly_flower', quantity: 3 } } },
      { label: '强弓硬射', intimacy: 8, reward: { spiritStone: 800 } },
      { label: '诱敌深入', intimacy: 10, reward: { spiritStone: 1200 } },
    ],
  },
  {
    id: 'DT-109',
    title: '比拼速度',
    type: 'battle',
    weight: 100,
    scene: '道侣纤指点你额头：「敢与我比一比身法？输者请客灵酿一壶。」',
    choices: [
      { label: '一较高下', intimacy: 12, reward: { item: { id: 'peach_wine', quantity: 1 } } },
      { label: '故意让你三分', intimacy: 15, reward: { redJade: 25 } },
      { label: '认输请酒', intimacy: 8, reward: { spiritStone: 500 } },
    ],
  },

  // ---------- gift 扩充 (DT-203 ~ DT-207) ----------
  {
    id: 'DT-203',
    title: '采撷玉果',
    type: 'gift',
    weight: 100,
    scene: '道侣捧着一捧山间灵果走来：「特意为你摘的，尝尝？」',
    choices: [
      { label: '欣然收下', intimacy: 5, reward: { item: { id: 'fruit_jam', quantity: 2 }, redJade: 8 } },
      { label: '感激回赠灵石', intimacy: 8, reward: { redJade: 15 } },
    ],
  },
  {
    id: 'DT-204',
    title: '亲编蝶簪',
    type: 'gift',
    weight: 100,
    scene: '道侣递来一支以蝶恋花亲编的发簪：「相称否？」',
    choices: [
      { label: '甚为相称', intimacy: 8, reward: { item: { id: 'butterfly_flower', quantity: 3 } } },
      { label: '细细端详再夸', intimacy: 10, reward: { redJade: 20 } },
    ],
  },
  {
    id: 'DT-205',
    title: '回赠诗扇',
    type: 'gift',
    weight: 100,
    scene: '道侣展开一柄绘有诗的折扇赠你：「炎夏将至，先送你一份清凉。」',
    choices: [
      { label: '欣然收下', intimacy: 5, reward: { item: { id: 'colorful_beads', quantity: 1 } } },
      { label: '吟咏扇上诗赞', intimacy: 8, reward: { redJade: 12, item: { id: 'fruit_jam', quantity: 2 } } },
    ],
  },
  {
    id: 'DT-206',
    title: '亲煮灵粥',
    type: 'gift',
    weight: 100,
    scene: '道侣端来一碗冒着灵气的米粥：「修者也要按时吃饭，趁热。」',
    choices: [
      { label: '一饮而尽', intimacy: 5, reward: { spiritStone: 800 } },
      { label: '细细品味', intimacy: 8, reward: { spiritStone: 500, redJade: 10 } },
    ],
  },
  {
    id: 'DT-207',
    title: '香囊定情',
    type: 'gift',
    weight: 100,
    scene: '道侣含羞递来一只绣花香囊：「亲手所制，不知道友是否嫌弃。」',
    choices: [
      { label: '常佩身上', intimacy: 10, reward: { item: { id: 'warm_jade_sachet', quantity: 1 } } },
      { label: '珍而藏之', intimacy: 12, reward: { redJade: 25, item: { id: 'silk_flower', quantity: 3 } } },
    ],
  },

  // ---------- special 扩充 (DT-903 ~ DT-905) ----------
  {
    id: 'DT-903',
    title: '魔影现身',
    type: 'special',
    weight: 30,
    scene: '夜半惊雷，一道魔影现于二人面前，恶笑：「找了你许久。」道侣紧紧攥住你的手。',
    choices: [
      { label: '紧握她手共抗', intimacy: 30, reward: { redJade: 80, item: { id: 'fate_pill', quantity: 1 } } },
      { label: '让她退开我来挡', intimacy: 25, reward: { redJade: 60, cultExp: 10000 } },
      { label: '与她背靠背', intimacy: 35, reward: { redJade: 100, item: { id: 'parting_charm', quantity: 1 } } },
    ],
  },
  {
    id: 'DT-904',
    title: '仙缘奇梦',
    type: 'special',
    weight: 30,
    scene: '修炼时同梦一场，醒来道侣含泪：「我梦见我们前世相约今生再见，你梦见了什么？」',
    choices: [
      { label: '梦中只见你', intimacy: 30, reward: { redJade: 80, cultExp: 12000 } },
      { label: '我也梦见前世', intimacy: 28, reward: { redJade: 70, item: { id: 'moonlight_pill', quantity: 1 } } },
      { label: '一切只是梦', intimacy: 10, reward: { redJade: 20 } },
    ],
  },
  {
    id: 'DT-905',
    title: '天降天材',
    type: 'special',
    weight: 30,
    scene: '雷云聚散，一枚天材地宝从天落下。道侣神色凝重：「此物极强，但要双修一体方能炼化。」',
    choices: [
      { label: '与她双修炼化', intimacy: 30, reward: { redJade: 100, cultExp: 15000 } },
      { label: '让她独自炼化', intimacy: 20, reward: { item: { id: 'awaken_stone', quantity: 2 } } },
      { label: '献予宗门', intimacy: 5, reward: { spiritStone: 5000 } },
    ],
  },
]

export const DATE_EVENT_MAP: Record<string, DateEvent> = {}
for (const e of DATE_EVENTS) DATE_EVENT_MAP[e.id] = e

// 按权重 + 类型分布滚一个事件（30%/40%/20%/10%）
const TYPE_WEIGHTS: Record<DateEventType, number> = {
  dialog: 40,
  battle: 30,
  gift: 20,
  special: 10,
}

export function rollDateEvent(): DateEvent {
  // 先按 type 分布滚类型
  const total = Object.values(TYPE_WEIGHTS).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let chosenType: DateEventType = 'dialog'
  for (const [type, w] of Object.entries(TYPE_WEIGHTS)) {
    r -= w
    if (r <= 0) {
      chosenType = type as DateEventType
      break
    }
  }
  // 在该类型内按权重选一个
  const pool = DATE_EVENTS.filter(e => e.type === chosenType)
  const totalW = pool.reduce((a, b) => a + b.weight, 0)
  let r2 = Math.random() * totalW
  for (const e of pool) {
    r2 -= e.weight
    if (r2 <= 0) return e
  }
  return pool[0]
}
