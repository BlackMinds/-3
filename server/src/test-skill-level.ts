// 测试功法升级是否有效: 比较 Lv1 vs Lv5 的战斗表现差异
import { generateMonsterStats, buildEquippedSkillInfo, runWaveBattle, type BattlerStats, type MonsterTemplate, type EquippedSkillInfo } from './engine/battleEngine';
import { ALL_SKILLS, type Skill } from './engine/skillData';

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

// 固定单只弱怪，确保必赢，方便统计伤害
const WEAK_MONSTER: MonsterTemplate = {
  name: '木桩', power: 500, element: null, exp: 100, stone_min: 10, stone_max: 20, role: 'balanced', drop_table: 'common_t1',
};

// 固定种子的怪物(超大血量，用来看回合伤害)
const TANK_MONSTER: MonsterTemplate = {
  name: '铁木桩', power: 100, element: null, exp: 100, stone_min: 10, stone_max: 20, role: 'tank', drop_table: 'common_t1',
};

function makeEquip(skill: Skill, level: number): EquippedSkillInfo {
  const rows = [{ skill_id: skill.id, skill_type: skill.type, slot_index: 0, level, equipped: 1 }];
  if (skill.type !== 'active') {
    rows.unshift({ skill_id: 'basic_sword', skill_type: 'active', slot_index: 0, level: 1, equipped: 1 });
  }
  return buildEquippedSkillInfo(rows);
}

// 统计N场战斗的平均总伤害
function avgDamageDealt(skill: Skill, level: number, battles: number): { avgDmg: number; avgHeal: number; skillInfo: EquippedSkillInfo } {
  const equipped = makeEquip(skill, level);
  let totalDmg = 0;
  let totalHeal = 0;

  for (let b = 0; b < battles; b++) {
    const player = makePlayer();
    // 用弱怪测，统计玩家造成的总伤害
    const monsterList = [{ stats: generateMonsterStats(WEAK_MONSTER), template: WEAK_MONSTER }];
    const result = runWaveBattle(player, monsterList, equipped);

    for (const log of result.logs) {
      // 提取玩家造成的伤害
      const dmgMatch = log.text.match(/(?:对木桩|对铁木桩)造成 (\d+)/);
      if (dmgMatch) totalDmg += parseInt(dmgMatch[1]);
      // 多段伤害
      const multiMatch = log.text.match(/第\d+段.*?造成 (\d+) 伤害/);
      if (multiMatch && !log.text.includes('木桩施展')) totalDmg += parseInt(multiMatch[1]);
      // 回复量
      const healMatch = log.text.match(/回复 (\d+) 点气血/);
      if (healMatch) totalHeal += parseInt(healMatch[1]);
    }
  }

  return { avgDmg: Math.round(totalDmg / battles), avgHeal: Math.round(totalHeal / battles), skillInfo: equipped };
}

function runTest() {
  const BATTLES = 50;
  console.log('\n========== 功法升级效果测试 ==========');
  console.log(`每个等级测试 ${BATTLES} 场\n`);

  const issues: string[] = [];

  // 先直接检查 buildEquippedSkillInfo 的数值
  console.log('--- 数值检查: buildEquippedSkillInfo 输出 ---\n');

  for (const skill of ALL_SKILLS) {
    const lv1 = makeEquip(skill, 1);
    const lv3 = makeEquip(skill, 3);
    const lv5 = makeEquip(skill, 5);

    if (skill.type === 'active') {
      const s1 = lv1.activeSkill!;
      const s3 = lv3.activeSkill!;
      const s5 = lv5.activeSkill!;

      console.log(`[主修] ${skill.name}:`);
      console.log(`  Lv1 倍率=${s1.multiplier.toFixed(2)} ${s1.debuff ? `debuff概率=${(s1.debuff.chance*100).toFixed(1)}%` : ''} ${s1.buff ? `buff值=${s1.buff.value?.toFixed(2) || s1.buff.valuePercent?.toFixed(3)}` : ''}`);
      console.log(`  Lv3 倍率=${s3.multiplier.toFixed(2)} ${s3.debuff ? `debuff概率=${(s3.debuff.chance*100).toFixed(1)}%` : ''} ${s3.buff ? `buff值=${s3.buff.value?.toFixed(2) || s3.buff.valuePercent?.toFixed(3)}` : ''}`);
      console.log(`  Lv5 倍率=${s5.multiplier.toFixed(2)} ${s5.debuff ? `debuff概率=${(s5.debuff.chance*100).toFixed(1)}%` : ''} ${s5.buff ? `buff值=${s5.buff.value?.toFixed(2) || s5.buff.valuePercent?.toFixed(3)}` : ''}`);

      if (s1.multiplier === s5.multiplier && skill.multiplier > 0) {
        issues.push(`❌ [主修] ${skill.name}: Lv1和Lv5倍率相同 (${s1.multiplier}), 升级无效!`);
      } else if (s5.multiplier > s1.multiplier) {
        console.log(`  ✅ 倍率提升: ${s1.multiplier.toFixed(2)} → ${s5.multiplier.toFixed(2)} (+${((s5.multiplier/s1.multiplier - 1)*100).toFixed(0)}%)`);
      }
      if (s1.debuff && s5.debuff && s1.debuff.chance === s5.debuff.chance) {
        issues.push(`❌ [主修] ${skill.name}: Lv1和Lv5 debuff概率相同 (${s1.debuff.chance}), 升级无效!`);
      }
      console.log('');

    } else if (skill.type === 'divine') {
      const d1 = lv1.divineSkills[0];
      const d5 = lv5.divineSkills[0];
      if (!d1 || !d5) { issues.push(`❌ [神通] ${skill.name}: divineSkills为空`); continue; }

      console.log(`[神通] ${skill.name}:`);
      console.log(`  Lv1 倍率=${d1.multiplier.toFixed(2)} ${d1.debuff ? `debuff=${(d1.debuff.chance*100).toFixed(1)}%` : ''} ${d1.buff ? `buff=${d1.buff.value?.toFixed(2) || ''}${d1.buff.valuePercent?.toFixed(3) || ''}` : ''} ${d1.healAtkRatio ? `治疗=${d1.healAtkRatio.toFixed(2)}x` : ''}`);
      console.log(`  Lv5 倍率=${d5.multiplier.toFixed(2)} ${d5.debuff ? `debuff=${(d5.debuff.chance*100).toFixed(1)}%` : ''} ${d5.buff ? `buff=${d5.buff.value?.toFixed(2) || ''}${d5.buff.valuePercent?.toFixed(3) || ''}` : ''} ${d5.healAtkRatio ? `治疗=${d5.healAtkRatio.toFixed(2)}x` : ''}`);

      let hasChange = false;
      if (d1.multiplier !== d5.multiplier) hasChange = true;
      if (d1.debuff && d5.debuff && d1.debuff.chance !== d5.debuff.chance) hasChange = true;
      if (d1.buff && d5.buff) {
        if (d1.buff.value !== d5.buff.value) hasChange = true;
        if (d1.buff.valuePercent !== d5.buff.valuePercent) hasChange = true;
        if (d1.buff.duration !== d5.buff.duration) hasChange = true; // 金钟罩等无value buff靠duration缩放
      }
      if (d1.healAtkRatio && d5.healAtkRatio && d1.healAtkRatio !== d5.healAtkRatio) hasChange = true;

      if (!hasChange) {
        issues.push(`❌ [神通] ${skill.name}: Lv1和Lv5完全相同, 升级无效!`);
      } else {
        console.log(`  ✅ 升级有效`);
      }
      console.log('');

    } else if (skill.type === 'passive') {
      const p1 = lv1.passiveEffects;
      const p5 = lv5.passiveEffects;

      console.log(`[被动] ${skill.name}:`);
      const fields = ['atkPercent','defPercent','hpPercent','spdPercent','critRate','critDmg','dodge','lifesteal',
        'resistMetal','resistWood','resistWater','resistFire','resistEarth','resistCtrl',
        'regenPerTurn','damageReductionFlat','reflectPercent','poisonOnHitTaken','burnOnHitTaken','reflectOnCrit'] as const;

      let hasChange = false;
      const diffs: string[] = [];
      for (const f of fields) {
        const v1 = (p1 as any)[f] || 0;
        const v5 = (p5 as any)[f] || 0;
        if (v1 !== v5) {
          hasChange = true;
          diffs.push(`${f}: ${v1.toFixed(3)} → ${v5.toFixed(3)}`);
        }
      }
      // 布尔值
      if (p1.reviveOnce !== p5.reviveOnce) hasChange = true;
      if ((p1.skillCdReduction || 0) !== (p5.skillCdReduction || 0)) {
        hasChange = true;
        diffs.push(`skillCdReduction: ${p1.skillCdReduction} → ${p5.skillCdReduction}`);
      }
      // 战意沸腾专用字段
      const akp1 = (p1 as any).atkPerKillPercent || 0;
      const akp5 = (p5 as any).atkPerKillPercent || 0;
      if (akp1 !== akp5) {
        hasChange = true;
        diffs.push(`atkPerKillPercent: ${akp1.toFixed(2)} → ${akp5.toFixed(2)}`);
      }

      if (diffs.length > 0) {
        console.log(`  Lv1→Lv5 变化: ${diffs.join(', ')}`);
        console.log(`  ✅ 升级有效`);
      }
      if (!hasChange) {
        issues.push(`❌ [被动] ${skill.name}: Lv1和Lv5效果完全相同, 升级无效!`);
      }
      console.log('');
    }
  }

  // 实战伤害对比 (主修功法)
  console.log('\n--- 实战伤害对比 (主修功法 Lv1 vs Lv5) ---\n');
  for (const skill of ALL_SKILLS.filter(s => s.type === 'active')) {
    const r1 = avgDamageDealt(skill, 1, BATTLES);
    const r5 = avgDamageDealt(skill, 5, BATTLES);
    const dmgIncrease = r1.avgDmg > 0 ? ((r5.avgDmg / r1.avgDmg - 1) * 100).toFixed(0) : 'N/A';
    console.log(`${skill.name}: Lv1 平均伤害=${r1.avgDmg}, Lv5 平均伤害=${r5.avgDmg} (+${dmgIncrease}%)`);
    if (r1.avgDmg > 0 && r5.avgDmg <= r1.avgDmg) {
      issues.push(`❌ [实战] ${skill.name}: Lv5伤害(${r5.avgDmg})不高于Lv1(${r1.avgDmg})`);
    }
  }

  // 实战伤害对比 (攻击型神通)
  console.log('\n--- 实战伤害对比 (攻击型神通 Lv1 vs Lv5) ---\n');
  for (const skill of ALL_SKILLS.filter(s => s.type === 'divine' && s.multiplier > 0)) {
    const r1 = avgDamageDealt(skill, 1, BATTLES);
    const r5 = avgDamageDealt(skill, 5, BATTLES);
    const dmgIncrease = r1.avgDmg > 0 ? ((r5.avgDmg / r1.avgDmg - 1) * 100).toFixed(0) : 'N/A';
    console.log(`${skill.name}: Lv1=${r1.avgDmg}, Lv5=${r5.avgDmg} (+${dmgIncrease}%)`);
    if (r1.avgDmg > 0 && r5.avgDmg <= r1.avgDmg) {
      issues.push(`❌ [实战] ${skill.name}: Lv5伤害(${r5.avgDmg})不高于Lv1(${r1.avgDmg})`);
    }
  }

  // 治疗型神通
  console.log('\n--- 治疗型神通 Lv1 vs Lv5 ---\n');
  for (const skill of ALL_SKILLS.filter(s => s.type === 'divine' && s.healAtkRatio)) {
    const r1 = avgDamageDealt(skill, 1, BATTLES);
    const r5 = avgDamageDealt(skill, 5, BATTLES);
    console.log(`${skill.name}: Lv1 治疗=${r1.avgHeal}, Lv5 治疗=${r5.avgHeal} (+${r1.avgHeal > 0 ? ((r5.avgHeal / r1.avgHeal - 1)*100).toFixed(0) : 'N/A'}%)`);
    if (r1.avgHeal > 0 && r5.avgHeal <= r1.avgHeal) {
      issues.push(`❌ [实战] ${skill.name}: Lv5治疗(${r5.avgHeal})不高于Lv1(${r1.avgHeal})`);
    }
  }

  // 输出问题汇总
  console.log('\n========== 问题汇总 ==========');
  if (issues.length === 0) {
    console.log('🎉 所有功法升级均有效！');
  } else {
    console.log(`发现 ${issues.length} 个问题:\n`);
    for (const i of issues) console.log(`  ${i}`);
  }

  console.log('\n测试完成。');
  return issues.length;
}

const issueCount = runTest();
process.exit(issueCount > 0 ? 1 : 0);
