// 斗法连胜广播文案池
// 触发档位：3 连胜 / 5 连胜 / 10 连胜，对应 rare / epic / legendary
// 占位符：{winner} 赢家道号，{loser} 输家道号
//
// 文案基调：第三人称叙述，修仙风格，对败者带强嘲讽（"沙袋"、"磨刀石"、"跪"、"摩擦"等），
// 不使用现代脏话或人身侮辱。所有连胜广播均从赢家视角发出。

export type PkStreakTier = 3 | 5 | 10

export interface PkBroadcastTier {
  rarity: 'rare' | 'epic' | 'legendary'
  templates: string[]
}

export const PK_STREAK_BROADCASTS: Record<PkStreakTier, PkBroadcastTier> = {
  3: {
    rarity: 'rare',
    templates: [
      '斗法台传出消息：「{loser}」连续三败于「{winner}」之手，颜面尽失，险些当场遁走',
      '道友「{winner}」三战三捷，将「{loser}」按在尘土中反复摩擦，围观者纷纷侧目',
      '修真界惊闻：「{loser}」三度跪在「{winner}」脚下，丹田险裂，已成笑谈',
      '「{winner}」三度力压「{loser}」，后者抱头鼠窜，连法器都顾不上收',
      '斗法台旁议论纷纷：「{loser}」三战三败，被「{winner}」打得连道号都报错',
    ],
  },
  5: {
    rarity: 'epic',
    templates: [
      '「{winner}」五度斗法尽数胜出，「{loser}」已沦为其磨刀之石',
      '斗法台血迹未干——「{loser}」五败于「{winner}」，竟仍不知收手，引人耻笑',
      '修真界茶余饭后：「{loser}」五战五败，被「{winner}」当众数落，无地自容',
      '「{winner}」笑指「{loser}」：「道友又来送修为？」 五败之后，无人作答',
      '听闻「{loser}」五败于「{winner}」，其师门长老连夜闭关，称无颜见同道',
      '斗法台奇景：「{loser}」第五次跪伏于「{winner}」剑下，竟不知再战还是认师',
    ],
  },
  10: {
    rarity: 'legendary',
    templates: [
      '万界震动！「{loser}」十败于「{winner}」之手，已沦为天地一笑、修真界共谈',
      '「{winner}」十战十捷，「{loser}」道心崩塌，险些斩道封印，自此不敢言斗法二字',
      '此人称「{loser}」？此人当称「{winner}」之沙袋——十战未尝一胜，骨头都软了',
      '斗法台立碑铭刻：「{winner}」十胜「{loser}」，碑文末书四字——「警示来人」',
      '「{loser}」十败之后下山隐居，世人皆道：「此乃{winner}手下败犬，莫与之论道」',
      '修真界新增谚语：「输得像{loser}」，意指连败十场仍执迷不悟之徒',
    ],
  },
}

export function pickPkBroadcast(
  streak: number,
  winnerName: string,
  loserName: string,
): { text: string; rarity: 'rare' | 'epic' | 'legendary' } | null {
  let tier: PkStreakTier | null = null
  if (streak >= 10) tier = 10
  else if (streak >= 5) tier = 5
  else if (streak >= 3) tier = 3
  if (!tier) return null
  // 仅在恰好命中阈值时触发，避免 4/6/7/8/9 连胜重复轰炸（10 之后也不再触发）
  if (streak !== tier) return null

  const cfg = PK_STREAK_BROADCASTS[tier]
  const tmpl = cfg.templates[Math.floor(Math.random() * cfg.templates.length)]
  const text = tmpl.replace(/\{winner\}/g, winnerName).replace(/\{loser\}/g, loserName)
  return { text, rarity: cfg.rarity }
}
