export const SECT_ITEM_INFO: Record<string, {
  name: string;
  description: string;
  category: 'enhance' | 'equip' | 'character' | 'skill' | 'craft';
  needsTarget?: 'equip' | 'root' | 'skill' | 'stat';
  needsConfirm?: boolean;
}> = {
  enhance_protect:    { name: '强化保护符', description: '强化失败时不退级 (强化时自动消耗)',   category: 'enhance' },
  enhance_guarantee:  { name: '强化大师符', description: '+7以下强化必成功 (强化时自动消耗)',  category: 'enhance' },
  reroll_sub_stat:    { name: '装备鉴定符', description: '重新随机一件装备的所有副属性',         category: 'equip', needsTarget: 'equip' },
  equip_upgrade:      { name: '太古精魂',   description: '装备升品 紫→金 / 金→红',                 category: 'equip', needsTarget: 'equip' },
  set_fragment:       { name: '套装碎片',   description: '收集5个合成一件金品装备',                category: 'craft' },
  permanent_stat:     { name: '道果结晶',   description: '永久属性+1% (攻/防/血三选一)',          category: 'character', needsTarget: 'stat' },
  breakthrough_boost: { name: '宗门突破丹', description: '立即获得当前境界突破所需修为的20%',     category: 'character' },
  reset_root:         { name: '天道洗髓丹', description: '重置灵根属性',                            category: 'character', needsTarget: 'root' },
  universal_skill_page: { name: '万能功法残页', description: '转化为指定功法的1张残页',           category: 'skill', needsTarget: 'skill' },
};
