// 装备命名系统 — 按品质/槽位/武器类型生成多段式名称
// 格式：[套装前缀·] [品质前缀] [元素/词缀] [本体名] [后缀]
// 示例：周天·紫微青锋·锋锐 (设套)、玄冰·赤焰法袍 (设套+元素)、绝尘屠魔刀·破灭 (无套装)

import { EQUIP_SET_MAP } from './equipSetData';

// ===== 品质前缀(按6个品质) =====
// 低品质用朴实词，高品质用华丽词
const QUALITY_PREFIXES: Record<string, string[]> = {
  white:  ['粗制', '无名', '普通', '凡俗', '简陋'],
  green:  ['灵动', '清雅', '淬炼', '初阶', '灵韵'],
  blue:   ['玄光', '凝元', '通灵', '紫霞', '寒霜', '赤焰'],
  purple: ['紫微', '九霄', '御灵', '星辰', '夺魄', '龙吟', '凤鸣'],
  gold:   ['天罡', '万象', '破天', '镇世', '斩仙', '诛神', '绝尘', '无极'],
  red:    ['混沌', '鸿蒙', '太古', '寂灭', '永恒', '无上', '道心', '天道'],
};

// ===== 槽位本体名(按武器类型区分) =====
// 武器按 weapon_type 细分，其他槽位用通用名
const WEAPON_NAMES: Record<string, string[]> = {
  sword: ['青锋', '龙泉', '承影', '湛卢', '纯钧', '鱼肠', '巨阙', '干将', '莫邪', '轩辕剑'],
  blade: ['屠魔刀', '斩魂刀', '裂空刀', '破军刀', '饮血刀', '霸王刀', '玄天刀', '斩龙刀'],
  spear: ['霸王枪', '游龙枪', '破阵枪', '穿云枪', '追魂枪', '丈八矛', '贯日枪', '九幽枪'],
  fan:   ['羽扇', '太极扇', '清风扇', '玉骨扇', '九华扇', '凌霄扇', '逍遥扇'],
};

const ARMOR_NAMES: string[]   = ['法袍', '道袍', '玄衣', '云锦袍', '紫霞衣', '九天法衣', '神圣战袍', '仙羽袍'];
const HELMET_NAMES: string[]  = ['玄冠', '紫金冠', '道冠', '灵珠冠', '九霄冠', '龙纹冠', '凤翎冠', '天罗冠'];
const BOOTS_NAMES: string[]   = ['步云靴', '踏风靴', '游龙靴', '追电靴', '九天靴', '踏雪履', '飞羽靴', '凌波靴'];
const TREASURE_NAMES: string[]= ['紫金葫', '乾坤袋', '镇魂铃', '聚灵珠', '浑天仪', '太极印', '九幽鼎', '河图洛书'];
const RING_NAMES: string[]    = ['灵戒', '龙纹戒', '九转戒', '镇魂戒', '星辰指环', '太虚戒', '轮回戒', '天道戒'];
const PENDANT_NAMES: string[] = ['灵佩', '龙纹佩', '紫玉佩', '九霄佩', '星辰佩', '太极玉佩', '乾坤玉佩', '道韵佩'];

// ===== 后缀词(按主属性偏向) =====
const STAT_SUFFIXES: Record<string, string[]> = {
  ATK: ['·锋锐', '·破灭', '·斩杀', '·戮神'],
  DEF: ['·金刚', '·守御', '·不坏', '·壁垒'],
  HP:  ['·永生', '·不朽', '·盘古', '·龟息'],
  SPD: ['·疾风', '·追影', '·流光', '·电驰'],
  CRIT_RATE: ['·洞察', '·致命', '·断罪', '·噬心'],
  SPIRIT: ['·通灵', '·明神', '·玄觉', '·冥悟'],
};

// ===== 元素词缀(武器类型装备可带) =====
const ELEMENT_PREFIXES: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
};

// 从数组中随机选一个(按tier偏好高index)
function pickWithTier<T>(arr: T[], tier: number): T {
  if (arr.length === 0) return arr[0];
  // tier越高越倾向后面的高阶名
  const bias = Math.min(arr.length - 1, Math.floor(tier * arr.length / 10));
  const idx = Math.max(0, Math.min(arr.length - 1, bias + Math.floor(Math.random() * 3) - 1));
  return arr[idx];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 获取槽位本体名
function getBodyName(slot: string, weaponType: string | null, tier: number): string {
  if (slot === 'weapon') {
    // 武器: 有 weaponType 用对应池, 否则用剑名(默认)
    const pool = WEAPON_NAMES[weaponType || 'sword'] || WEAPON_NAMES.sword;
    return pickWithTier(pool, tier);
  }
  switch (slot) {
    case 'armor':    return pickWithTier(ARMOR_NAMES, tier);
    case 'helmet':   return pickWithTier(HELMET_NAMES, tier);
    case 'boots':    return pickWithTier(BOOTS_NAMES, tier);
    case 'treasure': return pickWithTier(TREASURE_NAMES, tier);
    case 'ring':     return pickWithTier(RING_NAMES, tier);
    case 'pendant':  return pickWithTier(PENDANT_NAMES, tier);
    default: return '神器';
  }
}

/**
 * 生成装备名称
 * @param rarity - white/green/blue/purple/gold/red
 * @param slot   - weapon/armor/helmet/boots/treasure/ring/pendant
 * @param weaponType - 武器子类(sword/blade/spear/fan), 非武器为null
 * @param tier   - 装备tier 1-10
 * @param primaryStat - 主属性 (ATK/DEF/HP/SPD/CRIT_RATE/SPIRIT)
 * @param element - 元素属性(可选)
 * @param specialTag - 特殊标签(宗门/宝箱/Boss等,可选)
 * @param setKey - 套装ID(可选, 装备 set_id 字段, 命中则在最前面加套装前缀)
 */
export function generateEquipName(
  rarity: string,
  slot: string,
  weaponType: string | null,
  tier: number,
  primaryStat: string,
  element: string | null = null,
  specialTag: string = '',
  setKey: string | null = null
): string {
  const parts: string[] = [];

  // 0. 套装前缀（最显眼，放最前；命中套装时不再叠加品质前缀，避免名字过长）
  let setPrefixed = false;
  if (setKey && EQUIP_SET_MAP[setKey]) {
    parts.push(EQUIP_SET_MAP[setKey].prefix);
    setPrefixed = true;
  }

  // 1. 品质前缀 (凡器/灵器不加,从法器开始；带套装前缀时跳过避免冗长)
  if (!setPrefixed) {
    const prefixPool = QUALITY_PREFIXES[rarity] || QUALITY_PREFIXES.white;
    if (rarity !== 'white') {
      parts.push(pickRandom(prefixPool));
    }
  }

  // 2. 元素词缀 (30%概率)
  if (element && Math.random() < 0.3) {
    parts.push(ELEMENT_PREFIXES[element] || '');
  }

  // 3. 本体名
  const body = getBodyName(slot, weaponType, tier);
  parts.push(body);

  // 4. 后缀 (金品/红品必出,其他品质40%概率)
  const hasSuffix = rarity === 'gold' || rarity === 'red' || Math.random() < 0.4;
  if (hasSuffix && STAT_SUFFIXES[primaryStat]) {
    const suffix = pickRandom(STAT_SUFFIXES[primaryStat]);
    parts[parts.length - 1] = parts[parts.length - 1] + suffix;
  }

  // 5. 特殊标签
  let name = parts.filter(Boolean).join('');
  if (specialTag) name += `(${specialTag})`;
  return name;
}
