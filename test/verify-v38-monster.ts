/**
 * v3.8 落地实测：直接调用引擎的 generateMonsterStats，
 * 对比 v3.7 (HP=0.44, ATK=0.62) 与 v3.8 (HP=0.88, ATK=0.372) 生成的怪物属性。
 *
 * 用法: npx tsx test/verify-v38-monster.ts
 */

import { generateMonsterStats } from '../server/engine/battleEngine'

interface MT {
  name: string; power: number; element: string | null; role: any;
  drop_table: string; exp: number; spirit_stone_range: [number, number];
}

function fmt(n: number): string { return n.toLocaleString('en-US') }

function probe(name: string, tier: number, role: string, power: number) {
  const tpl: MT = {
    name, power, element: 'metal', role: role as any,
    drop_table: `T${tier}`, exp: 100, spirit_stone_range: [10, 20],
  }
  // 跑 5 次取均值（power 有 0.85~1.15 随机）
  const N = 200
  let sumHp = 0, sumAtk = 0, sumDef = 0, sumSpd = 0
  for (let i = 0; i < N; i++) {
    const s = generateMonsterStats(tpl as any)
    sumHp += s.maxHp; sumAtk += s.atk; sumDef += s.def; sumSpd += s.spd
  }
  const avgHp = Math.round(sumHp / N)
  const avgAtk = Math.round(sumAtk / N)
  const avgDef = Math.round(sumDef / N)
  const avgSpd = Math.round(sumSpd / N)

  // v3.7 期望（计算公式回推：旧 HP_MUL=0.44, ATK_MUL=0.62, T5+ 攻×0.80 血×1.10）
  const ratios: Record<string, any> = {
    boss: { hp: 0.35, atk: 0.30, def: 0.25 },
    balanced: { hp: 0.30, atk: 0.30, def: 0.25 },
    dps: { hp: 0.20, atk: 0.45, def: 0.15 },
  }
  const r = ratios[role] || ratios.balanced
  const HP_SCALE: Record<number, number> = { 1: 1.55, 2: 1.55, 3: 1.55, 4: 1.55, 5: 2.00, 6: 2.25, 7: 2.43, 8: 2.56 }
  const hpScale = HP_SCALE[tier] ?? 0.86
  const atkScale = 0.665
  let v37hpMul = 0.44, v37atkMul = 0.62, v38hpMul = 0.88, v38atkMul = 0.372
  if (tier >= 5) { v37atkMul *= 0.80; v37hpMul *= 1.10; v38atkMul *= 0.80; v38hpMul *= 1.10 }
  const expHpV37 = Math.round(power * r.hp * 10 * hpScale * v37hpMul)
  const expAtkV37 = Math.round(power * r.atk * atkScale * v37atkMul)
  const expHpV38 = Math.round(power * r.hp * 10 * hpScale * v38hpMul)
  const expAtkV38 = Math.round(power * r.atk * atkScale * v38atkMul)

  console.log(`\n${name}  T${tier} ${role}  power=${fmt(power)}`)
  console.log(`  实测 HP:  ${fmt(avgHp).padStart(12)}  | v3.7预期 ${fmt(expHpV37).padStart(12)} | v3.8预期 ${fmt(expHpV38).padStart(12)} | 实测/v3.7 = ${(avgHp / expHpV37).toFixed(2)}x | 实测/v3.8 = ${(avgHp / expHpV38).toFixed(2)}x`)
  console.log(`  实测 ATK: ${fmt(avgAtk).padStart(12)}  | v3.7预期 ${fmt(expAtkV37).padStart(12)} | v3.8预期 ${fmt(expAtkV38).padStart(12)} | 实测/v3.7 = ${(avgAtk / expAtkV37).toFixed(2)}x | 实测/v3.8 = ${(avgAtk / expAtkV38).toFixed(2)}x`)
  console.log(`  实测 DEF: ${fmt(avgDef).padStart(12)}  | (DEF 不变)`)
  console.log(`  实测 SPD: ${fmt(avgSpd).padStart(12)}  | (SPD 不变)`)
}

console.log('=== v3.8 怪物属性落地验证（实测 = 当前引擎输出，预期 = 公式回推）===')
console.log('期望: 实测/v3.7 ≈ HP×2 (=2.00), ATK×0.6 (=0.60); 实测/v3.8 ≈ 1.00')

probe('T1 狼王',     1, 'boss',     450)
probe('T3 普通怪',   3, 'balanced', 5500)
probe('T5 化神 BOSS', 5, 'boss',    39000)
probe('T7 大乘 BOSS', 7, 'boss',    150000)
probe('T10 末端 BOSS', 10, 'boss',  975000)
console.log('')
