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
