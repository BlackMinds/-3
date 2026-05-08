// 验证洗练接口（reroll-sub-stats）走 V4 池子，且只从对应部位的词条池抽取
// 用法：npx tsx test/sim-reroll-v4.ts
import { rollSubStatsV4 } from '../server/utils/equipment'
import { EQUIP_SUB_POOL_V4 } from '../shared/balance'

const SLOTS = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant'] as const
const RARITIES_TO_TEST: { rarity: string; subCount: number }[] = [
  { rarity: 'green',  subCount: 1 },
  { rarity: 'blue',   subCount: 2 },
  { rarity: 'purple', subCount: 3 }, // 老紫装：3 条副词条（保留原数量）
  { rarity: 'gold',   subCount: 4 }, // 老金装：4 条副词条
  { rarity: 'red',    subCount: 4 },
]

const SAMPLES = 2000

let allOk = true
for (const slot of SLOTS) {
  const slotPool = EQUIP_SUB_POOL_V4[slot]
  for (const { rarity, subCount } of RARITIES_TO_TEST) {
    let leak = 0
    for (let i = 0; i < SAMPLES; i++) {
      const subs = rollSubStatsV4(slot, rarity, 5, subCount)
      if (subs.length !== subCount) {
        console.error(`[FAIL] ${slot}/${rarity}: expected ${subCount} subs, got ${subs.length}`)
        allOk = false
        break
      }
      // 第 i 条副词条必须来自 slotPool[i]
      for (let pos = 0; pos < subs.length; pos++) {
        const allowed = slotPool[pos]
        if (!allowed.includes(subs[pos].stat)) {
          leak++
          if (leak <= 3) {
            console.error(`[LEAK] ${slot}/${rarity} pos ${pos}: got "${subs[pos].stat}" not in [${allowed.join(',')}]`)
          }
        }
      }
    }
    if (leak > 0) allOk = false
    else console.log(`[OK] ${slot.padEnd(8)} / ${rarity.padEnd(7)} subCount=${subCount}  pool-confined ✓`)
  }
}

console.log(allOk ? '\n✅ 全部通过：洗练严格在部位×词条位的 V4 池内抽取' : '\n❌ 有词条溢出 V4 池')
process.exit(allOk ? 0 : 1)
