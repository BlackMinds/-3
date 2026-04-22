// 通用道具定义（原 sectItems.ts）
// 所有消耗型道具（强化符 / 鉴定符 / 精魂 / 碎片 / 丹药 / 附灵石 / 灵枢玉 等）统一登记

export type ItemCategory = 'enhance' | 'equip' | 'awaken' | 'character' | 'skill' | 'craft';

export interface ItemInfo {
  name: string;
  description: string;
  category: ItemCategory;
  needsTarget?: 'equip' | 'root' | 'skill' | 'stat';
  needsConfirm?: boolean;
  /** 仅用于 awaken 分类的精细过滤 */
  awakenMode?: 'add' | 'reroll';
}

export const ITEM_INFO: Record<string, ItemInfo> = {
  // —— 强化类 ——
  enhance_protect:    { name: '强化保护符', description: '强化失败时不退级（强化时自动消耗）',   category: 'enhance' },
  enhance_guarantee:  { name: '强化大师符', description: '+7 以下强化必成功（强化时自动消耗）',  category: 'enhance' },
  // —— 装备类 ——
  reroll_sub_stat:    { name: '装备鉴定符', description: '重新随机一件装备的所有副属性',         category: 'equip', needsTarget: 'equip' },
  equip_upgrade:      { name: '太古精魂',   description: '装备升品 紫→金 / 金→红',                 category: 'equip', needsTarget: 'equip' },
  // —— 附灵类（新增）——
  awaken_stone:       { name: '附灵石',     description: '为一件蓝+品装备附加一条随机附灵（组队副本掉落）', category: 'awaken', needsTarget: 'equip', awakenMode: 'add' },
  awaken_reroll:      { name: '灵枢玉',     description: '重新随机一件装备的附灵（保证与原附灵不同）',     category: 'awaken', needsTarget: 'equip', awakenMode: 'reroll' },
  // —— 合成类 ——
  set_fragment:       { name: '套装碎片',   description: '收集 5 个合成一件金品装备',              category: 'craft' },
  // —— 修为类 ——
  permanent_stat:     { name: '道果结晶',   description: '永久属性 +1%（攻/防/血 三选一）',       category: 'character', needsTarget: 'stat' },
  breakthrough_boost: { name: '宗门突破丹', description: '下次突破成功率 +20%（上限 100%，不论成败消耗一次）', category: 'character' },
  reset_root:         { name: '天道洗髓丹', description: '重置灵根属性',                           category: 'character', needsTarget: 'root' },
  // —— 功法类 ——
  universal_skill_page: { name: '万能功法残页', description: '转化为指定功法的 1 张残页',         category: 'skill', needsTarget: 'skill' },
};

// Tab 分类定义（UI 使用）
export const ITEM_CATEGORIES: Array<{ id: ItemCategory; name: string }> = [
  { id: 'enhance',   name: '强化' },
  { id: 'equip',     name: '装备' },
  { id: 'awaken',    name: '附灵' },
  { id: 'character', name: '修为' },
  { id: 'skill',     name: '功法' },
  { id: 'craft',     name: '合成' },
];

// 向后兼容别名（原 sectItems.ts 导出）
export const SECT_ITEM_INFO = ITEM_INFO;
