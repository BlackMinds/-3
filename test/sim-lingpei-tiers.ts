import { getV5TierWeight, getV5EnhanceMul, V5_LEGENDARY_SET_YUANSHI } from '../shared/balance-v5'
import { RARITY_STAT_MUL } from '../shared/balance'
import { RARITY_IDX_MAP } from '../server/utils/equipment'

const rMul = RARITY_STAT_MUL[RARITY_IDX_MAP.red]
const eMul = getV5EnhanceMul(9)
const minYuanshi = V5_LEGENDARY_SET_YUANSHI.min_tier
console.log(`red mul=${rMul}, enhance +9 mul=${eMul}, 元始最低 T${minYuanshi}`)
console.log('T   | tw | 普通 各拿值 | 元始 各拿值')
console.log('----|----|-------------|------------')
for (let t = 1; t <= 18; t++) {
  const tw = getV5TierWeight(t)
  const base = 0.80 * tw * rMul * eMul
  const normal = Math.max(1, Math.floor(base))
  const ys = t >= minYuanshi ? Math.max(1, Math.floor(base * 1.5)) : null
  console.log(`T${String(t).padEnd(3)}| ${String(tw).padEnd(2)} | +${String(normal).padEnd(10)} | ${ys === null ? '—' : '+' + ys}`)
}
