// 灵戒附灵 ring 池烟雾测试
import { rollAwakenEffect, AWAKEN_POOLS, canSlotAwaken, describeAwakenEffect } from '../game/awakenData.ts';

console.log('AWAKEN_POOLS keys:', Object.keys(AWAKEN_POOLS));
console.log('ring pool size:', AWAKEN_POOLS.ring?.length);
console.log('canSlotAwaken("ring"):', canSlotAwaken('ring'));

console.log('\n=== 蓝品灵戒 5 次 roll ===');
for (let i = 0; i < 5; i++) {
  const eff = rollAwakenEffect('ring', 'blue');
  console.log(`${i+1}. ${eff?.name} | stat=${eff?.stat} | value=${eff?.value} | meta=`, eff?.meta);
  if (eff) console.log('   desc:', describeAwakenEffect(eff));
}

console.log('\n=== 红品灵戒 8 次 roll ===');
for (let i = 0; i < 8; i++) {
  const eff = rollAwakenEffect('ring', 'red');
  console.log(`${i+1}. ${eff?.name} | stat=${eff?.stat} | value=${eff?.value} | meta=`, eff?.meta);
  if (eff) console.log('   desc:', describeAwakenEffect(eff));
}

console.log('\n=== aw_main_execute 阈值检查（4 个品阶）===');
for (const r of ['blue','purple','gold','red']) {
  let found = null;
  for (let i = 0; i < 200; i++) {
    const eff = rollAwakenEffect('ring', r);
    if (eff?.id === 'aw_main_execute') { found = eff; break; }
  }
  if (found) console.log(`${r}: bonus=${found.value}, threshold=${found.meta?.threshold}`);
  else console.log(`${r}: 未抽到 (200 次)`);
}

console.log('\n=== 12 条都覆盖到吗（蓝品 1000 次）===');
const ids = new Set();
for (let i = 0; i < 1000; i++) {
  const eff = rollAwakenEffect('ring', 'blue');
  if (eff) ids.add(eff.id);
}
console.log(`covered ${ids.size}/12:`, [...ids]);
