// v3.9 紫品主修烟雾测试：验证数据 + 透传 + 注入链路
import { ACTIVE_SKILLS, ALL_SKILLS } from '../server/engine/skillData.ts'
import { buildEquippedSkillInfo, applyInnateMainToAwaken } from '../server/engine/battleEngine.ts'

console.log('=== ACTIVE_SKILLS 数量与紫品 ===')
console.log('总数:', ACTIVE_SKILLS.length)
const purples = ACTIVE_SKILLS.filter(s => s.rarity === 'purple')
console.log('紫品数:', purples.length)
for (const s of purples) {
  console.log(`  ${s.id}  ${s.name}  ${s.element}  mul=${s.multiplier}  innate=`, s.innateMain)
}

console.log('\n=== buildEquippedSkillInfo 透传 innateMain ===')
const skillRows = [
  { skill_id: 'frost_art', level: 1, slot_idx: 0 },
]
const eq = buildEquippedSkillInfo(skillRows)
console.log('activeSkill:', eq.activeSkill)

console.log('\n=== applyInnateMainToAwaken 注入 ===')
const awaken = {}
applyInnateMainToAwaken(awaken, eq.activeSkill)
console.log('注入后 awaken:', awaken)

console.log('\n=== 5 个紫品分别注入验证 ===')
for (const s of purples) {
  const eq2 = buildEquippedSkillInfo([{ skill_id: s.id, level: 1, slot_idx: 0 }])
  const aw = {}
  applyInnateMainToAwaken(aw, eq2.activeSkill)
  console.log(`${s.name}:`, aw)
}

console.log('\n=== ALL_SKILLS 中 5 个紫品 ID 是否可索引 ===')
for (const id of ['gale_blade','wither_bloom','frost_art','sky_inferno','mountain_seal']) {
  const found = ALL_SKILLS.find(s => s.id === id)
  console.log(`${id}: ${found ? '✓ ' + found.name : '✗ 缺失'}`)
}
