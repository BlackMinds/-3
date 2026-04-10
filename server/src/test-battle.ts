// 战斗引擎测试: 每个技能100场战斗,检查日志异常
import { generateMonsterStats, buildEquippedSkillInfo, runWaveBattle, type BattlerStats, type MonsterTemplate, type EquippedSkillInfo } from './engine/battleEngine';
import { ALL_SKILLS, ACTIVE_SKILLS, DIVINE_SKILLS, PASSIVE_SKILLS, type Skill } from './engine/skillData';

// 模拟玩家基础属性 (中等强度,确保能打能死)
function makePlayer(): BattlerStats {
  return {
    name: '测试角色', maxHp: 50000, hp: 50000, atk: 5000, def: 2000, spd: 800,
    crit_rate: 0.20, crit_dmg: 2.0, dodge: 0.08, lifesteal: 0.03,
    element: 'fire', spiritualRoot: 'fire',
    resists: { metal: 0.05, wood: 0.05, water: 0.05, fire: 0.15, earth: 0.05, ctrl: 0.10 },
    armorPen: 5, accuracy: 5,
    elementDmg: { metal: 0, wood: 0, water: 0, fire: 10, earth: 0 },
  };
}

// T3 地图怪物 (有一定难度)
const TEST_MONSTERS: MonsterTemplate[] = [
  { name: '树妖', power: 4000, element: 'wood', exp: 400, stone_min: 80, stone_max: 200, role: 'balanced', drop_table: 'common_t3' },
  { name: '熊妖', power: 5500, element: 'earth', exp: 550, stone_min: 80, stone_max: 200, role: 'balanced', drop_table: 'common_t3' },
  { name: '花妖', power: 7000, element: 'wood', exp: 700, stone_min: 150, stone_max: 400, role: 'dps', drop_table: 'uncommon_t3' },
];

// 构建只装备某个技能的 EquippedSkillInfo
function makeEquipForSkill(skill: Skill): EquippedSkillInfo {
  // 模拟DB行
  const rows = [{ skill_id: skill.id, skill_type: skill.type, slot_index: 0, level: 3, equipped: 1 }];
  // 如果是神通/被动,还需要一个主动技能
  if (skill.type !== 'active') {
    rows.unshift({ skill_id: 'basic_sword', skill_type: 'active', slot_index: 0, level: 1, equipped: 1 });
  }
  return buildEquippedSkillInfo(rows);
}

interface BugReport {
  skillId: string;
  skillName: string;
  battleIndex: number;
  issue: string;
  logSnippet: string;
}

function runTest() {
  const bugs: BugReport[] = [];
  const stats: { skillId: string; skillName: string; type: string; wins: number; losses: number; avgTurns: number; errors: string[] }[] = [];
  const BATTLES = 100;

  console.log(`\n========== 战斗引擎测试 ==========`);
  console.log(`测试技能数: ${ALL_SKILLS.length}`);
  console.log(`每个技能战斗场次: ${BATTLES}`);
  console.log(`怪物: T3 万妖山 (1-3只)\n`);

  for (let si = 0; si < ALL_SKILLS.length; si++) {
    const skill = ALL_SKILLS[si];
    const equipped = makeEquipForSkill(skill);
    let wins = 0, losses = 0, totalTurns = 0;
    const errors: string[] = [];

    for (let b = 0; b < BATTLES; b++) {
      try {
        const player = makePlayer();
        const waveSize = 1 + Math.floor(Math.random() * 3);
        const monsterList = [];
        for (let i = 0; i < waveSize; i++) {
          const tmpl = TEST_MONSTERS[Math.floor(Math.random() * TEST_MONSTERS.length)];
          monsterList.push({ stats: generateMonsterStats(tmpl), template: tmpl });
        }

        const result = runWaveBattle(player, monsterList, equipped);

        if (result.won) wins++;
        else losses++;
        totalTurns += result.logs.length;

        // 检查日志异常
        for (const log of result.logs) {
          // 1. NaN 检查
          if (log.text.includes('NaN') || log.text.includes('undefined') || log.text.includes('null点')) {
            bugs.push({ skillId: skill.id, skillName: skill.name, battleIndex: b, issue: 'NaN/undefined in log', logSnippet: log.text });
          }
          // 2. 负血量检查 (不应显示负数)
          if (log.playerHp !== undefined && log.playerHp < 0) {
            bugs.push({ skillId: skill.id, skillName: skill.name, battleIndex: b, issue: `负血量 playerHp=${log.playerHp}`, logSnippet: log.text });
          }
          if (log.monsterHp !== undefined && log.monsterHp < -1000) {
            // 允许小范围负数(最后一击溢出),但不应超过-1000
            bugs.push({ skillId: skill.id, skillName: skill.name, battleIndex: b, issue: `严重负血量 monsterHp=${log.monsterHp}`, logSnippet: log.text });
          }
          // 3. 伤害为0但不是闪避
          if (log.text.includes('造成 0 伤害') || log.text.includes('造成 0 点伤害')) {
            bugs.push({ skillId: skill.id, skillName: skill.name, battleIndex: b, issue: '0伤害(非闪避)', logSnippet: log.text });
          }
          // 4. 空文本
          if (!log.text || log.text.trim() === '') {
            bugs.push({ skillId: skill.id, skillName: skill.name, battleIndex: b, issue: '空日志文本', logSnippet: '<empty>' });
          }
          // 5. Infinity
          if (log.text.includes('Infinity')) {
            bugs.push({ skillId: skill.id, skillName: skill.name, battleIndex: b, issue: 'Infinity in log', logSnippet: log.text });
          }
        }

        // 6. 胜利但0经验
        if (result.won && result.totalExp === 0) {
          bugs.push({ skillId: skill.id, skillName: skill.name, battleIndex: b, issue: '胜利但0经验', logSnippet: '' });
        }

        // 7. 日志为空
        if (result.logs.length === 0) {
          bugs.push({ skillId: skill.id, skillName: skill.name, battleIndex: b, issue: '战斗日志为空', logSnippet: '' });
        }

        // 8. 检查技能是否实际触发 (对有倍率的主动/神通)
        if (skill.type !== 'passive' && skill.multiplier > 0 && skill.id !== 'basic_sword') {
          const skillUsed = result.logs.some(l => l.text.includes(skill.name));
          if (!skillUsed && b === 0) {
            errors.push(`技能【${skill.name}】在100场中第1场未触发`);
          }
        }

      } catch (err: any) {
        bugs.push({ skillId: skill.id, skillName: skill.name, battleIndex: b, issue: `运行时崩溃: ${err.message}`, logSnippet: err.stack?.slice(0, 200) || '' });
        break; // 崩溃则跳过该技能后续测试
      }
    }

    const avgTurns = BATTLES > 0 ? Math.round(totalTurns / BATTLES) : 0;
    stats.push({ skillId: skill.id, skillName: skill.name, type: skill.type, wins, losses, avgTurns, errors });

    const status = bugs.filter(b => b.skillId === skill.id).length > 0 ? '❌' : '✅';
    console.log(`[${si + 1}/${ALL_SKILLS.length}] ${status} ${skill.type.padEnd(7)} ${skill.name.padEnd(8)} 胜${String(wins).padStart(3)}/负${String(losses).padStart(3)} 平均${avgTurns}条日志`);
  }

  // 输出 bug 报告
  console.log(`\n========== BUG 报告 ==========`);
  if (bugs.length === 0) {
    console.log('🎉 未发现任何异常！所有技能运行正常。');
  } else {
    // 去重
    const uniqueBugs = new Map<string, BugReport & { count: number }>();
    for (const b of bugs) {
      const key = `${b.skillId}_${b.issue}`;
      if (uniqueBugs.has(key)) {
        uniqueBugs.get(key)!.count++;
      } else {
        uniqueBugs.set(key, { ...b, count: 1 });
      }
    }
    console.log(`共发现 ${bugs.length} 个问题 (${uniqueBugs.size} 种):\n`);
    for (const [, b] of uniqueBugs) {
      console.log(`  [${b.skillName}] ${b.issue} (出现${b.count}次)`);
      if (b.logSnippet) console.log(`    日志: ${b.logSnippet.slice(0, 120)}`);
    }
  }

  // 统计摘要
  console.log(`\n========== 统计摘要 ==========`);
  const totalWins = stats.reduce((a, s) => a + s.wins, 0);
  const totalLosses = stats.reduce((a, s) => a + s.losses, 0);
  console.log(`总场次: ${totalWins + totalLosses}, 胜: ${totalWins}, 负: ${totalLosses}, 胜率: ${(totalWins / (totalWins + totalLosses) * 100).toFixed(1)}%`);

  // 胜率过低或过高的技能
  console.log('\n胜率异常的技能 (<20% 或 >95%):');
  for (const s of stats) {
    const total = s.wins + s.losses;
    const wr = total > 0 ? s.wins / total : 0;
    if (wr < 0.20 || wr > 0.95) {
      console.log(`  ${s.skillName} (${s.type}): 胜率 ${(wr * 100).toFixed(0)}% (${s.wins}/${total})`);
    }
  }

  // 运行时错误
  const allErrors = stats.filter(s => s.errors.length > 0);
  if (allErrors.length > 0) {
    console.log('\n技能触发警告:');
    for (const s of allErrors) {
      for (const e of s.errors) console.log(`  ${e}`);
    }
  }

  console.log('\n测试完成。');
  return bugs.length;
}

const bugCount = runTest();
process.exit(bugCount > 0 ? 1 : 0);
