// 装备套装数据 — 前端共享版（与 server/engine/equipSetData.ts 内容对齐）
// 前端只用到 setKey/name/prefix/desc/tiers.desc，hooks 留空
// 服务端是单一真实源；前端这份只负责展示

export interface EquipSetTier {
  count: 3 | 5 | 7
  desc: string
}

export interface EquipSet {
  setKey: string
  name: string
  prefix: string
  desc: string
  tiers: [EquipSetTier, EquipSetTier, EquipSetTier]
}

export const EQUIP_SETS: EquipSet[] = [
  {
    setKey: 'refresh', name: '刷新套', prefix: '周天',
    desc: '神通周转流，与高 CD 红/金品神通配合最佳',
    tiers: [
      { count: 3, desc: '释放主修或神通后，5% 概率重置当前 CD 最短的神通' },
      { count: 5, desc: '上述概率提升至 12%' },
      { count: 7, desc: '上述概率提升至 22%；战斗第 1 回合所有神通 CD -1' },
    ],
  },
  {
    setKey: 'multicast', name: '多重施法套', prefix: '叠浪',
    desc: '神通爆发流，配高倍率单段神通最佳',
    tiers: [
      { count: 3, desc: '释放主动神通时，8% 概率额外释放一次（伤害 100%，每回合最多 1 次）' },
      { count: 5, desc: '概率 18%，每回合最多 2 次' },
      { count: 7, desc: '概率 30%，每回合最多 2 次；额外释放伤害降至 80%' },
    ],
  },
  {
    setKey: 'fire_god', name: '火神套', prefix: '焚天',
    desc: '灼烧爆发流，配焚天烈魂、焚体诀',
    tiers: [
      { count: 3, desc: '附加灼烧时，下一跳灼烧伤害 ×2 并立即结算 1 次' },
      { count: 5, desc: '上述 ×3' },
      { count: 7, desc: '上述 ×5；目标已灼烧时额外延长 1 回合（持续 cap 6 回合）' },
    ],
  },
  {
    setKey: 'venom', name: '万毒套', prefix: '蚀骨',
    desc: '中毒爆发流，配毒液冲击、百毒不侵',
    tiers: [
      { count: 3, desc: '附加中毒时，下一跳中毒伤害 ×2 并立即结算 1 次' },
      { count: 5, desc: '上述 ×3' },
      { count: 7, desc: '上述 ×5；中毒可叠加 2 层（每层独立结算）' },
    ],
  },
  {
    setKey: 'blood_demon', name: '血魔套', prefix: '噬魂',
    desc: '流血爆发流，配剑雨纷飞、血雨腥风、十三枪',
    tiers: [
      { count: 3, desc: '附加流血时，下一跳流血伤害 ×2 并立即结算 1 次' },
      { count: 5, desc: '上述 ×3' },
      { count: 7, desc: '上述 ×5；目标流血状态下你的吸血 +10%' },
    ],
  },
  {
    setKey: 'frost', name: '极寒套', prefix: '玄冰',
    desc: '冰冻控制流，配霜冻新星、明镜止水',
    tiers: [
      { count: 3, desc: '冰冻概率 +5%；对冰冻状态敌人伤害 +20%' },
      { count: 5, desc: '冰冻概率 +15%；对冰冻状态敌人伤害 +40%' },
      { count: 7, desc: '冰冻概率 +30%；对冰冻状态敌人伤害 +70%；冰冻敌人无法闪避' },
    ],
  },
  {
    setKey: 'thirteen_spear', name: '十三枪', prefix: '霸枪',
    desc: '武器流·枪，最终伤害堆叠流（需装备「枪」）',
    tiers: [
      { count: 3, desc: '装备「枪」时，破甲 +15、吸血 +3%；造成伤害后获得 1 层「十三枪」，每层最终伤害 +5%，最多 13 层' },
      { count: 5, desc: '装备「枪」时，破甲 +25、吸血 +5%；每层最终伤害 +7%' },
      { count: 7, desc: '装备「枪」时，破甲 +30、吸血 +5%；每次造成伤害 +2 层，每层 +8%；满 13 层时下一击必暴击' },
    ],
  },
]

export const EQUIP_SET_MAP: Record<string, EquipSet> = {}
for (const s of EQUIP_SETS) {
  EQUIP_SET_MAP[s.setKey] = s
}

/**
 * 从已穿戴装备列表统计套装件数（仅 count >= 1 都返回，方便 UI 显示进度）
 */
export function countEquippedSets(equipped: Array<{ set_id?: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const eq of equipped) {
    if (!eq?.set_id) continue
    counts[eq.set_id] = (counts[eq.set_id] || 0) + 1
  }
  return counts
}

/**
 * 给定装备件数，返回当前激活的最高档位
 */
export function getActiveTier(count: number): 0 | 3 | 5 | 7 {
  if (count >= 7) return 7
  if (count >= 5) return 5
  if (count >= 3) return 3
  return 0
}
