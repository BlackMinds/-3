/**
 * v3.7 加法池数值验证脚本
 * 对比"乘法连乘"vs"加法池"两种公式下的玩家总属性，并模拟玩家 vs 怪物 TTK 守恒情况
 *
 * 运行: npx tsx test/sim-additive-pool.ts
 */

interface Sample {
  name: string
  base: number
  flat: number          // 等级+境界flat+装备flat 总和
  pcts: { source: string; pct: number }[]  // 各乘子（小数, 0.10=10%）
}

const SCENARIOS: Sample[] = [
  // 真实样本：小夏截图角色（攻击栏）
  {
    name: '截图角色 攻击',
    base: 50,
    flat: 50 + 2890 + 2800 + 3027,  // 8767
    pcts: [
      { source: '附灵',         pct: 0.10 },
      { source: '武器+装备%',   pct: 0.58 },
      { source: '丹药',         pct: 0.566 },
      { source: '境界',         pct: 0.98 },
      { source: '宗门等级',     pct: 0.13 },
      { source: '功法被动',     pct: 0.40 },
    ],
  },
  // 早期玩家（练气期，丹药未开）
  {
    name: '练气一层 攻击',
    base: 50,
    flat: 50 + 50 + 100,  // 等级 50 + 境界 100
    pcts: [
      { source: '武器+装备%', pct: 0.10 },
    ],
  },
  // 中期玩家（金丹期，部分加成）
  {
    name: '金丹三层 攻击',
    base: 50,
    flat: 50 + 800 + 1200 + 1500,  // 等级+境界+装备
    pcts: [
      { source: '附灵',        pct: 0.05 },
      { source: '武器+装备%',  pct: 0.30 },
      { source: '丹药',        pct: 0.20 },
      { source: '境界',        pct: 0.40 },
      { source: '宗门等级',    pct: 0.05 },
      { source: '功法被动',    pct: 0.20 },
    ],
  },
  // 后期玩家（大乘期，满 BD）
  {
    name: '大乘三层 攻击',
    base: 50,
    flat: 50 + 5000 + 5000 + 8000,  // 等级+境界+装备
    pcts: [
      { source: '附灵',        pct: 0.20 },
      { source: '武器+装备%',  pct: 0.80 },
      { source: '丹药',        pct: 0.40 },
      { source: '境界',        pct: 1.50 },
      { source: '道果',        pct: 0.30 },
      { source: '宗门等级',    pct: 0.20 },
      { source: '宗门技能',    pct: 0.30 },
      { source: '功法被动',    pct: 0.40 },
    ],
  },
]

function calcMultiplicative(sample: Sample): number {
  let v = sample.flat
  for (const e of sample.pcts) v = Math.floor(v * (1 + e.pct))
  return v
}

function calcAdditivePool(sample: Sample): number {
  const sumPct = sample.pcts.reduce((a, e) => a + e.pct, 0)
  return Math.floor(sample.flat * (1 + sumPct))
}

console.log('='.repeat(80))
console.log('v3.7 加法池数值验证')
console.log('='.repeat(80))

for (const s of SCENARIOS) {
  const oldV = calcMultiplicative(s)
  const newV = calcAdditivePool(s)
  const ratio = newV / oldV
  const reduction = ((1 - ratio) * 100).toFixed(1)
  const sumPct = s.pcts.reduce((a, e) => a + e.pct, 0)
  const oldMul = (oldV / s.flat).toFixed(3)
  const newMul = (1 + sumPct).toFixed(3)

  console.log(`\n[${s.name}]`)
  console.log(`  flat 段:        ${s.flat.toLocaleString()}`)
  console.log(`  各 %:           ${s.pcts.map(e => `${e.source} +${(e.pct * 100).toFixed(1)}%`).join(' / ')}`)
  console.log(`  乘法连乘 倍率: ×${oldMul}  →  ${oldV.toLocaleString()}`)
  console.log(`  加法池   倍率: ×${newMul}  →  ${newV.toLocaleString()}`)
  console.log(`  比值:           ×${ratio.toFixed(3)} (削弱 ${reduction}%)`)
}

// ===== 4 项主属性削弱比（按截图角色为基准）=====
console.log('\n' + '='.repeat(80))
console.log('4 项主属性削弱比（截图角色基准）')
console.log('='.repeat(80))

// 各项 % 加成估算（基于截图角色"攻击+防御+血量+身法"的真实组合）
// - 攻击：附灵10 + 武器+装备58 + 丹药56.6 + 境界98 + 宗门13 + 功法40
// - 防御：附灵5  + 装备10        + 丹药30   + 境界70 + 宗门13 + 功法40
// - 血量：附灵5  + 装备10        + 丹药56   + 境界80 + 宗门技能20 + 功法40
// - 身法：附灵5  + 武器10        + 丹药0    + 境界0  + 功法40
const FOUR_STATS: Sample[] = [
  SCENARIOS[0],
  {
    name: '截图角色 防御',
    base: 30,
    flat: 30 + 1500 + 1800 + 2000,  // 估算
    pcts: [
      { source: '附灵',     pct: 0.05 },
      { source: '装备%',    pct: 0.10 },
      { source: '丹药',     pct: 0.30 },
      { source: '境界',     pct: 0.70 },
      { source: '宗门等级', pct: 0.13 },
      { source: '功法被动', pct: 0.40 },
    ],
  },
  {
    name: '截图角色 血量',
    base: 500,
    flat: 500 + 25000 + 30000 + 40000,  // 估算
    pcts: [
      { source: '附灵',     pct: 0.05 },
      { source: '装备%',    pct: 0.10 },
      { source: '丹药',     pct: 0.56 },
      { source: '境界',     pct: 0.80 },
      { source: '宗门技能', pct: 0.20 },
      { source: '功法被动', pct: 0.40 },
    ],
  },
  {
    name: '截图角色 身法',
    base: 20,
    flat: 20 + 200 + 300 + 400,
    pcts: [
      { source: '附灵',     pct: 0.05 },
      { source: '武器+装备%', pct: 0.10 },
      { source: '功法被动', pct: 0.40 },
    ],
  },
]

console.log('\n属性     | 旧倍率 | 新倍率 | 比值   | 削弱')
console.log('-'.repeat(60))
const ratios: Record<string, number> = {}
for (const s of FOUR_STATS) {
  const oldV = calcMultiplicative(s)
  const newV = calcAdditivePool(s)
  const ratio = newV / oldV
  const oldMul = (oldV / s.flat).toFixed(2)
  const sumPct = s.pcts.reduce((a, e) => a + e.pct, 0)
  const newMul = (1 + sumPct).toFixed(2)
  const label = s.name.replace('截图角色 ', '').padEnd(8)
  console.log(`${label} | ×${oldMul.padStart(5)} | ×${newMul.padStart(5)} | ${ratio.toFixed(3)} | -${((1 - ratio) * 100).toFixed(1)}%`)
  ratios[s.name.replace('截图角色 ', '')] = ratio
}

// ===== 怪物倍率反推 =====
console.log('\n' + '='.repeat(80))
console.log('怪物属性削弱建议（守恒战斗节奏）')
console.log('='.repeat(80))
console.log(`
推导原则:
  - 怪物 HP  按"玩家攻击削弱比"缩 → 玩家秒怪 TTK 守恒
  - 怪物 ATK 按"玩家防御+血量"平均削弱比缩 → 怪物威胁守恒
  - 怪物 DEF 按"玩家攻击削弱比"缩 → 玩家"实际伤害" (atk - def) 守恒
  - 怪物 SPD 按"玩家身法削弱比"缩 → 出手频率守恒

按截图角色估算:
  HP_MUL  = ${ratios['攻击'].toFixed(2)}  (现设 0.55, 应改 ${ratios['攻击'].toFixed(2)})
  ATK_MUL = ${((ratios['防御'] + ratios['血量']) / 2).toFixed(2)}  (现设 0.65, 应改 ${((ratios['防御'] + ratios['血量']) / 2).toFixed(2)})
  DEF_MUL = ${ratios['攻击'].toFixed(2)}  (现设 0.55, 应改 ${ratios['攻击'].toFixed(2)})
  SPD_MUL = ${ratios['身法'].toFixed(2)}  (现设 0.75, 应改 ${ratios['身法'].toFixed(2)})
`)

// ===== TTK 验证（用建议倍率）=====
console.log('='.repeat(80))
console.log('用建议倍率验证 TTK 守恒（截图角色 vs T6 boss）')
console.log('='.repeat(80))

const HP_MUL_NEW  = ratios['攻击']
const ATK_MUL_NEW = (ratios['防御'] + ratios['血量']) / 2
const DEF_MUL_NEW = ratios['攻击']
const SPD_MUL_NEW = ratios['身法']

const playerOldAtk = calcMultiplicative(FOUR_STATS[0])
const playerNewAtk = calcAdditivePool(FOUR_STATS[0])
const playerOldDef = calcMultiplicative(FOUR_STATS[1])
const playerNewDef = calcAdditivePool(FOUR_STATS[1])
const playerOldHp  = calcMultiplicative(FOUR_STATS[2])
const playerNewHp  = calcAdditivePool(FOUR_STATS[2])

// T6 boss 估算: power 100000, role boss
const oldBossHp  = 787_500
const oldBossAtk = 100_000 * 0.30 * 0.665  // ATK_SCALE
const oldBossDef = 100_000 * 0.25 * 0.6
const newBossHp  = Math.floor(oldBossHp  * HP_MUL_NEW)
const newBossAtk = Math.floor(oldBossAtk * ATK_MUL_NEW)
const newBossDef = Math.floor(oldBossDef * DEF_MUL_NEW)

const oldDmgPlayerToBoss = Math.max(1, playerOldAtk - oldBossDef)
const newDmgPlayerToBoss = Math.max(1, playerNewAtk - newBossDef)
const oldTtkP2B = Math.ceil(oldBossHp / oldDmgPlayerToBoss)
const newTtkP2B = Math.ceil(newBossHp / newDmgPlayerToBoss)

const oldDmgBossToPlayer = Math.max(1, oldBossAtk - playerOldDef)
const newDmgBossToPlayer = Math.max(1, newBossAtk - playerNewDef)
const oldTtkB2P = Math.ceil(playerOldHp / oldDmgBossToPlayer)
const newTtkB2P = Math.ceil(playerNewHp / newDmgBossToPlayer)

console.log(`\n[玩家秒 Boss]`)
console.log(`  旧: P_atk ${playerOldAtk.toLocaleString()} - B_def ${Math.floor(oldBossDef).toLocaleString()} = ${oldDmgPlayerToBoss.toLocaleString()}/击, B_hp ${oldBossHp.toLocaleString()} → ${oldTtkP2B} 回合`)
console.log(`  新: P_atk ${playerNewAtk.toLocaleString()} - B_def ${newBossDef.toLocaleString()} = ${newDmgPlayerToBoss.toLocaleString()}/击, B_hp ${newBossHp.toLocaleString()} → ${newTtkP2B} 回合`)
console.log(`  TTK 比值 ${(newTtkP2B / oldTtkP2B).toFixed(3)}`)

console.log(`\n[Boss 秒玩家]`)
console.log(`  旧: B_atk ${Math.floor(oldBossAtk).toLocaleString()} - P_def ${playerOldDef.toLocaleString()} = ${oldDmgBossToPlayer.toLocaleString()}/击, P_hp ${playerOldHp.toLocaleString()} → ${oldTtkB2P} 回合`)
console.log(`  新: B_atk ${newBossAtk.toLocaleString()} - P_def ${playerNewDef.toLocaleString()} = ${newDmgBossToPlayer.toLocaleString()}/击, P_hp ${playerNewHp.toLocaleString()} → ${newTtkB2P} 回合`)
console.log(`  TTK 比值 ${(newTtkB2P / oldTtkB2P).toFixed(3)}`)
console.log()
