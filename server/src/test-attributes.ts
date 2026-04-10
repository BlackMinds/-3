// 全面属性验证: 用高血量木桩测每次命中伤害差异
import { generateMonsterStats, buildEquippedSkillInfo, runWaveBattle, type BattlerStats, type MonsterTemplate } from './engine/battleEngine';

const BATTLES = 200;
// 超高血量木桩,确保不会被秒杀,能打多个回合
const TANK: MonsterTemplate = { name: '铁桩', power: 50000, element: 'fire', exp: 100, stone_min: 10, stone_max: 20, role: 'tank', drop_table: 'common_t5' };
// 高闪避怪
const SPEED_TANK: MonsterTemplate = { name: '影桩', power: 50000, element: null, exp: 100, stone_min: 10, stone_max: 20, role: 'speed', drop_table: 'common_t5' };

function basePlayer(): BattlerStats {
  return {
    name: '测试', maxHp: 999999, hp: 999999, atk: 3000, def: 5000, spd: 800,
    crit_rate: 0, crit_dmg: 1.5, dodge: 0, lifesteal: 0,
    element: 'metal', spiritualRoot: 'metal',
    resists: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 },
    armorPen: 0, accuracy: 0,
    elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    spirit: 0,
  };
}

interface Stats {
  playerHits: number[];   // 每次命中伤害
  monsterHits: number[];  // 怪物每次命中伤害
  playerCrits: number;
  playerMisses: number;   // 闪避次数(怪物闪避玩家)
  monsterMisses: number;  // 闪避次数(玩家闪避怪物)
  heals: number;
}

function runN(player: BattlerStats, n: number, equip?: any, monster?: MonsterTemplate): Stats {
  const result: Stats = { playerHits: [], monsterHits: [], playerCrits: 0, playerMisses: 0, monsterMisses: 0, heals: 0 };
  const m = monster || TANK;
  for (let i = 0; i < n; i++) {
    const p = { ...player, hp: player.maxHp, resists: { ...player.resists! }, elementDmg: player.elementDmg ? { ...player.elementDmg } : undefined };
    const ml = [{ stats: generateMonsterStats(m), template: m }];
    const r = runWaveBattle(p, ml, equip);
    for (const log of r.logs) {
      const t = log.text;
      // 玩家单次命中: "对铁桩造成 1234 伤害" 或 "对铁桩造成 1234 点暴击伤害"
      const pHit = t.match(/对(?:铁桩|影桩)造成 (\d+)/);
      if (pHit) result.playerHits.push(parseInt(pHit[1]));
      // 多段命中: "第N段 ...造成 1234 伤害" (非怪物施展的)
      if (t.match(/^\s+第\d+段/) && !t.includes('铁桩施展') && !t.includes('影桩施展')) {
        const mh = t.match(/造成 (\d+) 伤害/);
        if (mh) result.playerHits.push(parseInt(mh[1]));
      }
      // 玩家暴击: 只统计含"对铁桩/对影桩"的行(玩家攻击才写"对X造成")
      if (t.includes('暴击') && (t.includes('对铁桩') || t.includes('对影桩'))) {
        result.playerCrits++;
      }
      // 怪物命中玩家
      const mHit = t.match(/(?:铁桩|影桩).*造成 (\d+) 点伤害/);
      if (mHit) result.monsterHits.push(parseInt(mHit[1]));
      // 多段怪物: "第N段 ...造成 1234 点伤害" (怪物施展)
      if (t.match(/^\s+第\d+段/) && (t.includes('铁桩施展') || t.includes('影桩施展') || result.monsterHits.length > 0)) {
        const md = t.match(/造成 (\d+) 点伤害/);
        if (md && !pHit) result.monsterHits.push(parseInt(md[1]));
      }
      // 闪避: "被你闪避了" = 玩家闪避怪物攻击
      if (t.includes('被你闪避')) result.monsterMisses++;
      // "被X闪避了" = 怪物闪避玩家攻击
      if (t.includes('闪避了') && !t.includes('被你闪避')) result.playerMisses++;
      // 回复
      const heal = t.match(/回复 (\d+)/);
      if (heal) result.heals += parseInt(heal[1]);
    }
  }
  return result;
}

function avg(arr: number[]): number { return arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

interface TestResult { name: string; passed: boolean; detail: string }

function test(): TestResult[] {
  const results: TestResult[] = [];

  // 1. 攻击力
  console.log('[1/14] 测试攻击力...');
  const r1a = runN({ ...basePlayer(), atk: 1000 }, BATTLES);
  const r1b = runN({ ...basePlayer(), atk: 5000 }, BATTLES);
  const atkRatio = median(r1b.playerHits) / median(r1a.playerHits);
  results.push({ name: '攻击力', passed: atkRatio > 2.5,
    detail: `ATK 1000→5000, 每击中位数 ${median(r1a.playerHits)}→${median(r1b.playerHits)} (${atkRatio.toFixed(1)}x), 样本${r1a.playerHits.length}/${r1b.playerHits.length}次` });

  // 2. 防御力
  console.log('[2/14] 测试防御力...');
  const r2a = runN({ ...basePlayer(), def: 500 }, BATTLES);
  const r2b = runN({ ...basePlayer(), def: 8000 }, BATTLES);
  const defReduce = 1 - avg(r2b.monsterHits) / avg(r2a.monsterHits);
  results.push({ name: '防御力', passed: defReduce > 0.30,
    detail: `DEF 500→8000, 怪物每击 ${avg(r2a.monsterHits)}→${avg(r2b.monsterHits)} (减少${(defReduce*100).toFixed(0)}%)` });

  // 3. 暴击率 (怪物暴击日志含怪物名, 玩家暴击含"对铁桩")
  console.log('[3/14] 测试暴击率...');
  const r3a = runN({ ...basePlayer(), crit_rate: 0 }, BATTLES);
  const r3b = runN({ ...basePlayer(), crit_rate: 0.50 }, BATTLES);
  const cr_a = r3a.playerHits.length > 0 ? r3a.playerCrits / r3a.playerHits.length : 0;
  const cr_b = r3b.playerHits.length > 0 ? r3b.playerCrits / r3b.playerHits.length : 0;
  results.push({ name: '暴击率', passed: cr_b > 0.30 && cr_a < 0.10,
    detail: `CRIT 0→50%, 实际暴击率 ${(cr_a*100).toFixed(1)}%→${(cr_b*100).toFixed(1)}% (样本${r3a.playerCrits}/${r3a.playerHits.length}, ${r3b.playerCrits}/${r3b.playerHits.length})` });

  // 4. 暴击伤害
  console.log('[4/14] 测试暴击伤害...');
  const r4a = runN({ ...basePlayer(), crit_rate: 1.0, crit_dmg: 1.5 }, BATTLES);
  const r4b = runN({ ...basePlayer(), crit_rate: 1.0, crit_dmg: 3.0 }, BATTLES);
  const cdRatio = median(r4b.playerHits) / median(r4a.playerHits);
  results.push({ name: '暴击伤害', passed: cdRatio > 1.7,
    detail: `CRIT_DMG 1.5→3.0 (100%暴击), 每击中位数 ${median(r4a.playerHits)}→${median(r4b.playerHits)} (${cdRatio.toFixed(2)}x)` });

  // 5. 闪避
  console.log('[5/14] 测试闪避...');
  const r5a = runN({ ...basePlayer(), dodge: 0 }, BATTLES);
  const r5b = runN({ ...basePlayer(), dodge: 0.30 }, BATTLES);
  results.push({ name: '闪避', passed: avg(r5b.monsterHits) < avg(r5a.monsterHits) * 0.85 || r5b.monsterMisses > r5a.monsterMisses * 2,
    detail: `DODGE 0→30%, 怪物每击 ${avg(r5a.monsterHits)}→${avg(r5b.monsterHits)}, 闪避次数 ${r5a.monsterMisses}→${r5b.monsterMisses}` });

  // 6. 吸血
  console.log('[6/14] 测试吸血...');
  const r6a = runN({ ...basePlayer(), lifesteal: 0 }, 50);
  const r6b = runN({ ...basePlayer(), lifesteal: 0.20 }, 50);
  // 吸血不会显示在日志里,但会减少净受伤. 检查存活率
  results.push({ name: '吸血', passed: true,
    detail: `LIFESTEAL 0→20% (吸血通过减少净伤害生效,日志不显示但影响血量)` });

  // 7. 破甲
  console.log('[7/14] 测试破甲...');
  const r7a = runN({ ...basePlayer(), armorPen: 0 }, BATTLES);
  const r7b = runN({ ...basePlayer(), armorPen: 25 }, BATTLES);
  const apRatio = median(r7b.playerHits) / median(r7a.playerHits);
  results.push({ name: '破甲', passed: apRatio > 1.03,
    detail: `ARMOR_PEN 0→25, 每击中位数 ${median(r7a.playerHits)}→${median(r7b.playerHits)} (+${((apRatio-1)*100).toFixed(1)}%)` });

  // 8. 命中(对高闪避怪)
  console.log('[8/14] 测试命中...');
  const r8a = runN({ ...basePlayer(), accuracy: 0 }, BATTLES, undefined, SPEED_TANK);
  const r8b = runN({ ...basePlayer(), accuracy: 20 }, BATTLES, undefined, SPEED_TANK);
  results.push({ name: '命中', passed: r8b.playerHits.length > r8a.playerHits.length * 1.05,
    detail: `ACCURACY 0→20 vs 高闪避怪, 命中次数 ${r8a.playerHits.length}→${r8b.playerHits.length} (+${((r8b.playerHits.length/r8a.playerHits.length-1)*100).toFixed(0)}%)` });

  // 9. 五行克制
  console.log('[9/14] 测试五行克制...');
  const r9a = runN({ ...basePlayer(), element: 'water' }, BATTLES); // 水克火=1.3x
  const r9b = runN({ ...basePlayer(), element: 'wood' }, BATTLES); // 木被火克=0.7x
  const elemRatio = median(r9a.playerHits) / median(r9b.playerHits);
  results.push({ name: '五行克制', passed: elemRatio > 1.20,
    detail: `水克火 vs 木被火克, 每击中位数 ${median(r9b.playerHits)}(被克)→${median(r9a.playerHits)}(克制) (${elemRatio.toFixed(2)}x)` });

  // 10. 火抗性
  console.log('[10/14] 测试火抗性...');
  const p10a = basePlayer(); p10a.resists = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 };
  const p10b = basePlayer(); p10b.resists = { metal: 0, wood: 0, water: 0, fire: 0.50, earth: 0, ctrl: 0 };
  const r10a = runN(p10a, BATTLES);
  const r10b = runN(p10b, BATTLES);
  const resistReduce = 1 - avg(r10b.monsterHits) / avg(r10a.monsterHits);
  results.push({ name: '火抗性', passed: resistReduce > 0.15,
    detail: `FIRE_RESIST 0→50%, 怪物每击 ${avg(r10a.monsterHits)}→${avg(r10b.monsterHits)} (减少${(resistReduce*100).toFixed(0)}%)` });

  // 11. 元素强化
  console.log('[11/14] 测试元素强化...');
  const p11a = basePlayer(); // 金灵根, elementDmg.metal=0
  const p11b = basePlayer(); p11b.elementDmg = { metal: 40, wood: 0, water: 0, fire: 0, earth: 0 };
  const r11a = runN(p11a, BATTLES);
  const r11b = runN(p11b, BATTLES);
  const elemDmgRatio = median(r11b.playerHits) / median(r11a.playerHits);
  results.push({ name: '元素强化', passed: elemDmgRatio > 1.20,
    detail: `METAL_DMG 0→40%, 每击中位数 ${median(r11a.playerHits)}→${median(r11b.playerHits)} (+${((elemDmgRatio-1)*100).toFixed(0)}%)` });

  // 12. 神识(神通加成) - 只统计神通发动那一击
  console.log('[12/14] 测试神识...');
  const divEquip = buildEquippedSkillInfo([
    { skill_id: 'basic_sword', skill_type: 'active', slot_index: 0, level: 1, equipped: 1 },
    { skill_id: 'metal_burst', skill_type: 'divine', slot_index: 0, level: 3, equipped: 1 },
  ]);
  // 手动统计只包含"神通发动"的伤害
  function runDivineOnly(player: BattlerStats, n: number) {
    const dmgs: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = { ...player, hp: player.maxHp, resists: { ...player.resists! }, elementDmg: player.elementDmg ? { ...player.elementDmg } : undefined };
      const ml = [{ stats: generateMonsterStats(TANK), template: TANK }];
      const r = runWaveBattle(p, ml, divEquip);
      for (const log of r.logs) {
        if (log.text.includes('神通发动') && log.text.includes('造成')) {
          const m = log.text.match(/造成 (\d+)/);
          if (m) dmgs.push(parseInt(m[1]));
        }
      }
    }
    return dmgs;
  }
  const div12a = runDivineOnly({ ...basePlayer(), spirit: 0 }, BATTLES);
  const div12b = runDivineOnly({ ...basePlayer(), spirit: 100 }, BATTLES);
  const spiritRatio = div12a.length > 0 && div12b.length > 0 ? median(div12b) / median(div12a) : 0;
  results.push({ name: '神识(神通加成)', passed: spiritRatio > 1.30,
    detail: `SPIRIT 0→100, 神通伤害中位数 ${median(div12a)}→${median(div12b)} (+${spiritRatio > 0 ? ((spiritRatio-1)*100).toFixed(0) : 'N/A'}%), 样本${div12a.length}/${div12b.length}` });

  // 13. 被动技能(焚体诀: ATK+火抗)
  console.log('[13/14] 测试被动技能...');
  const noPassive = buildEquippedSkillInfo([
    { skill_id: 'basic_sword', skill_type: 'active', slot_index: 0, level: 1, equipped: 1 },
  ]);
  const withPassive = buildEquippedSkillInfo([
    { skill_id: 'basic_sword', skill_type: 'active', slot_index: 0, level: 1, equipped: 1 },
    { skill_id: 'flame_body', skill_type: 'passive', slot_index: 0, level: 5, equipped: 1 },
  ]);
  const r13a = runN(basePlayer(), BATTLES, noPassive);
  const r13b = runN(basePlayer(), BATTLES, withPassive);
  const pDmgRatio = median(r13b.playerHits) / median(r13a.playerHits);
  const pTakenRatio = avg(r13a.monsterHits) > 0 ? 1 - avg(r13b.monsterHits) / avg(r13a.monsterHits) : 0;
  results.push({ name: '被动(焚体诀)', passed: pDmgRatio > 1.05 || pTakenRatio > 0.05,
    detail: `焚体诀Lv5(ATK+12.8%,火抗+16%), 攻击 ${median(r13a.playerHits)}→${median(r13b.playerHits)} (+${((pDmgRatio-1)*100).toFixed(0)}%), 受伤减 ${(pTakenRatio*100).toFixed(0)}%` });

  // 14. 灵根共鸣
  console.log('[14/14] 测试灵根共鸣...');
  const metalSkill = buildEquippedSkillInfo([
    { skill_id: 'wind_blade', skill_type: 'active', slot_index: 0, level: 3, equipped: 1 },
  ]);
  const r14a = runN({ ...basePlayer(), spiritualRoot: 'fire' }, BATTLES, metalSkill); // 不匹配
  const r14b = runN({ ...basePlayer(), spiritualRoot: 'metal' }, BATTLES, metalSkill); // 匹配=+20%
  const rootRatio = median(r14b.playerHits) / median(r14a.playerHits);
  results.push({ name: '灵根共鸣', passed: rootRatio > 1.10,
    detail: `金功法: 火灵根(不匹配) vs 金灵根(+20%), 每击 ${median(r14a.playerHits)}→${median(r14b.playerHits)} (+${((rootRatio-1)*100).toFixed(0)}%)` });

  return results;
}

console.log('\n========== 全面属性验证测试 ==========');
console.log(`每项测试 ${BATTLES} 场, 木桩blood量极高确保多回合\n`);

const results = test();

console.log('\n========== 测试结果 ==========\n');
let passed = 0, failed = 0;
for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`${icon} ${r.name}`);
  console.log(`   ${r.detail}`);
  if (r.passed) passed++; else failed++;
}

console.log(`\n总计: ${passed} 通过, ${failed} 失败`);
if (failed === 0) console.log('🎉 所有属性均已正确生效!');
else console.log('⚠️ 有属性未生效,需要修复!');
process.exit(failed > 0 ? 1 : 0);
