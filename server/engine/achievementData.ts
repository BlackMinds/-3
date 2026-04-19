/**
 * 成就系统数据定义 + 箱子生成逻辑
 */
import { getPool } from '~/server/database/db';
import { generateEquipName } from './equipNameData';

// ========== 类型定义 ==========
export interface AchievementReward {
  spirit_stone?: number;
  equip_box?: 'normal' | 'fine' | 'legend';
  equip_box_count?: number;
  skill_box?: 'normal' | 'fine' | 'legend';
  skill_box_count?: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  category: 'dao' | 'battle' | 'equip' | 'skill' | 'pill' | 'cave' | 'sect' | 'hidden';
  type: 'threshold' | 'counter';  // threshold=达到某值 counter=累计计数
  target: number;
  event: string;     // 触发事件名
  reward: AchievementReward;
  title?: string;    // 解锁称号
}

// ========== 成就定义 (86个) ==========
export const ACHIEVEMENTS: AchievementDef[] = [
  // ===== 道途·修炼 (15) =====
  { id: 'dao_01', name: '踏入仙途', desc: '创建角色', category: 'dao', type: 'threshold', target: 1, event: 'char_created', reward: { spirit_stone: 500 } },
  { id: 'dao_02', name: '初窥门径', desc: '达到练气九层', category: 'dao', type: 'threshold', target: 9, event: 'qi_stage', reward: { spirit_stone: 2000 } },
  { id: 'dao_03', name: '筑基成功', desc: '突破至筑基境界', category: 'dao', type: 'threshold', target: 2, event: 'realm_tier', reward: { spirit_stone: 5000, equip_box: 'normal', equip_box_count: 1 }, title: '筑基修士' },
  { id: 'dao_04', name: '金丹大道', desc: '突破至金丹境界', category: 'dao', type: 'threshold', target: 3, event: 'realm_tier', reward: { spirit_stone: 20000, equip_box: 'fine', equip_box_count: 1 }, title: '金丹真人' },
  { id: 'dao_05', name: '元婴出窍', desc: '突破至元婴境界', category: 'dao', type: 'threshold', target: 4, event: 'realm_tier', reward: { spirit_stone: 50000, equip_box: 'fine', equip_box_count: 1 }, title: '元婴老祖' },
  { id: 'dao_06', name: '化神通天', desc: '突破至化神境界', category: 'dao', type: 'threshold', target: 5, event: 'realm_tier', reward: { spirit_stone: 100000, equip_box: 'fine', equip_box_count: 2 }, title: '化神尊者' },
  { id: 'dao_07', name: '雷劫加身', desc: '突破至渡劫境界', category: 'dao', type: 'threshold', target: 6, event: 'realm_tier', reward: { spirit_stone: 200000, equip_box: 'legend', equip_box_count: 1 }, title: '渡劫真君' },
  { id: 'dao_08', name: '大乘圆满', desc: '突破至大乘境界', category: 'dao', type: 'threshold', target: 7, event: 'realm_tier', reward: { spirit_stone: 500000, equip_box: 'legend', equip_box_count: 2 }, title: '大乘至尊' },
  { id: 'dao_09', name: '飞升成仙', desc: '达到飞升境界', category: 'dao', type: 'threshold', target: 8, event: 'realm_tier', reward: { spirit_stone: 1000000, equip_box: 'legend', equip_box_count: 3 }, title: '飞升仙尊' },
  { id: 'dao_10', name: '修炼初成', desc: '等级达到50', category: 'dao', type: 'threshold', target: 50, event: 'char_level', reward: { spirit_stone: 10000, equip_box: 'normal', equip_box_count: 1 } },
  { id: 'dao_11', name: '修为精进', desc: '等级达到100', category: 'dao', type: 'threshold', target: 100, event: 'char_level', reward: { spirit_stone: 30000, equip_box: 'fine', equip_box_count: 1 } },
  { id: 'dao_12', name: '登峰造极', desc: '等级达到150', category: 'dao', type: 'threshold', target: 150, event: 'char_level', reward: { spirit_stone: 80000, equip_box: 'fine', equip_box_count: 2 } },
  { id: 'dao_13', name: '万法归一', desc: '等级达到200', category: 'dao', type: 'threshold', target: 200, event: 'char_level', reward: { spirit_stone: 500000, equip_box: 'legend', equip_box_count: 3 }, title: '万法宗师' },
  { id: 'dao_14', name: '闭关苦修', desc: '累计闭关修炼10次', category: 'dao', type: 'counter', target: 10, event: 'cultivate_count', reward: { spirit_stone: 5000 } },
  { id: 'dao_15', name: '日夜不辍', desc: '累计离线挂机100小时', category: 'dao', type: 'counter', target: 100, event: 'offline_hours', reward: { spirit_stone: 30000, skill_box: 'fine', skill_box_count: 1 }, title: '苦修者' },

  // ===== 历练·战斗 (18) =====
  { id: 'bat_01', name: '初出茅庐', desc: '完成第1场战斗', category: 'battle', type: 'counter', target: 1, event: 'battle_count', reward: { spirit_stone: 100 } },
  { id: 'bat_02', name: '百战不殆', desc: '累计战斗100场', category: 'battle', type: 'counter', target: 100, event: 'battle_count', reward: { spirit_stone: 2000 } },
  { id: 'bat_03', name: '千锤百炼', desc: '累计战斗1,000场', category: 'battle', type: 'counter', target: 1000, event: 'battle_count', reward: { spirit_stone: 10000, equip_box: 'normal', equip_box_count: 1 }, title: '百战勇士' },
  { id: 'bat_04', name: '万战归来', desc: '累计战斗10,000场', category: 'battle', type: 'counter', target: 10000, event: 'battle_count', reward: { spirit_stone: 50000, equip_box: 'fine', equip_box_count: 1 }, title: '万战老兵' },
  { id: 'bat_05', name: '十万杀伐', desc: '累计战斗100,000场', category: 'battle', type: 'counter', target: 100000, event: 'battle_count', reward: { spirit_stone: 200000, equip_box: 'legend', equip_box_count: 1 }, title: '杀伐之主' },
  { id: 'bat_06', name: '首斩妖王', desc: '击杀第1只Boss', category: 'battle', type: 'counter', target: 1, event: 'boss_kill', reward: { spirit_stone: 1000 } },
  { id: 'bat_07', name: '妖王克星', desc: '累计击杀10只Boss', category: 'battle', type: 'counter', target: 10, event: 'boss_kill', reward: { spirit_stone: 5000, skill_box: 'normal', skill_box_count: 1 } },
  { id: 'bat_08', name: '诛魔猎手', desc: '累计击杀100只Boss', category: 'battle', type: 'counter', target: 100, event: 'boss_kill', reward: { spirit_stone: 30000, skill_box: 'fine', skill_box_count: 1 }, title: '诛魔者' },
  { id: 'bat_09', name: '踏遍青山', desc: '解锁10张地图', category: 'battle', type: 'threshold', target: 10, event: 'map_unlocked', reward: { spirit_stone: 5000 } },
  { id: 'bat_10', name: '万界行者', desc: '解锁全部25张地图', category: 'battle', type: 'threshold', target: 25, event: 'map_unlocked', reward: { spirit_stone: 50000, equip_box: 'legend', equip_box_count: 1 }, title: '万界行者' },
  { id: 'bat_11', name: '灵石猎人', desc: '累计获得100万灵石', category: 'battle', type: 'counter', target: 1000000, event: 'total_stone', reward: { spirit_stone: 20000 } },
  { id: 'bat_12', name: '灵石巨富', desc: '累计获得1000万灵石', category: 'battle', type: 'counter', target: 10000000, event: 'total_stone', reward: { spirit_stone: 100000, equip_box: 'fine', equip_box_count: 1 }, title: '散财仙人' },
  { id: 'bat_13', name: '修为如山', desc: '累计获得100万修为', category: 'battle', type: 'counter', target: 1000000, event: 'total_exp', reward: { spirit_stone: 10000, skill_box: 'normal', skill_box_count: 1 } },
  { id: 'bat_14', name: '五行克敌', desc: '利用五行相克获胜100次', category: 'battle', type: 'counter', target: 100, event: 'element_win', reward: { spirit_stone: 8000 }, title: '五行道人' },
  { id: 'bat_15', name: '起死回生', desc: '战斗中吸血回满血', category: 'battle', type: 'counter', target: 1, event: 'lifesteal_full', reward: { spirit_stone: 3000 } },
  { id: 'bat_16', name: '暴击风暴', desc: '单场暴击5次以上', category: 'battle', type: 'counter', target: 1, event: 'crit_storm', reward: { spirit_stone: 2000 } },
  { id: 'bat_17', name: '不死之身', desc: '单场被击中20次不死', category: 'battle', type: 'counter', target: 1, event: 'tank_survive', reward: { spirit_stone: 5000 } },
  { id: 'bat_18', name: '速战速决', desc: '3回合内击杀Boss', category: 'battle', type: 'counter', target: 1, event: 'fast_boss_kill', reward: { spirit_stone: 5000, equip_box: 'normal', equip_box_count: 1 } },

  // ===== 锻体·装备 (12) =====
  { id: 'eqp_01', name: '披挂上阵', desc: '首次穿戴装备', category: 'equip', type: 'counter', target: 1, event: 'equip_wear', reward: { spirit_stone: 200 } },
  { id: 'eqp_02', name: '全副武装', desc: '7个槽位全部穿戴', category: 'equip', type: 'threshold', target: 7, event: 'equip_slots_filled', reward: { spirit_stone: 3000, equip_box: 'normal', equip_box_count: 1 } },
  { id: 'eqp_03', name: '强化入门', desc: '首次强化成功', category: 'equip', type: 'counter', target: 1, event: 'enhance_success', reward: { spirit_stone: 500 } },
  { id: 'eqp_04', name: '强化达人', desc: '任一装备强化到+5', category: 'equip', type: 'threshold', target: 5, event: 'enhance_max_level', reward: { spirit_stone: 5000 } },
  { id: 'eqp_05', name: '百炼成钢', desc: '任一装备强化到+10', category: 'equip', type: 'threshold', target: 10, event: 'enhance_max_level', reward: { spirit_stone: 50000, equip_box: 'legend', equip_box_count: 1 }, title: '百炼宗师' },
  { id: 'eqp_06', name: '灵器初得', desc: '获得绿色装备', category: 'equip', type: 'counter', target: 1, event: 'equip_green', reward: { spirit_stone: 500 } },
  { id: 'eqp_07', name: '法器在手', desc: '获得蓝色装备', category: 'equip', type: 'counter', target: 1, event: 'equip_blue', reward: { spirit_stone: 2000 } },
  { id: 'eqp_08', name: '灵宝降世', desc: '获得紫色装备', category: 'equip', type: 'counter', target: 1, event: 'equip_purple', reward: { spirit_stone: 5000 } },
  { id: 'eqp_09', name: '仙器临凡', desc: '获得金色装备', category: 'equip', type: 'counter', target: 1, event: 'equip_gold', reward: { spirit_stone: 20000, equip_box: 'fine', equip_box_count: 1 } },
  { id: 'eqp_10', name: '神器问世', desc: '获得红色装备', category: 'equip', type: 'counter', target: 1, event: 'equip_red', reward: { spirit_stone: 100000, equip_box: 'legend', equip_box_count: 1 }, title: '神器之主' },
  { id: 'eqp_11', name: '商贾之道', desc: '累计出售装备50件', category: 'equip', type: 'counter', target: 50, event: 'equip_sell', reward: { spirit_stone: 5000 } },
  { id: 'eqp_12', name: '强化不息', desc: '累计强化100次', category: 'equip', type: 'counter', target: 100, event: 'enhance_count', reward: { spirit_stone: 10000, skill_box: 'fine', skill_box_count: 1 }, title: '铸器狂人' },

  // ===== 悟道·功法 (10) =====
  { id: 'skl_01', name: '初学乍练', desc: '装备第1个功法', category: 'skill', type: 'counter', target: 1, event: 'skill_equip', reward: { spirit_stone: 500 } },
  { id: 'skl_02', name: '功法齐备', desc: '装满全部7个功法槽', category: 'skill', type: 'threshold', target: 7, event: 'skill_slots_filled', reward: { spirit_stone: 5000, skill_box: 'normal', skill_box_count: 1 } },
  { id: 'skl_03', name: '精修一艺', desc: '任一功法升到Lv.3', category: 'skill', type: 'threshold', target: 3, event: 'skill_max_level', reward: { spirit_stone: 3000 } },
  { id: 'skl_04', name: '大成之境', desc: '任一功法升到Lv.5', category: 'skill', type: 'threshold', target: 5, event: 'skill_max_level', reward: { spirit_stone: 20000, skill_box: 'fine', skill_box_count: 1 } },
  { id: 'skl_05', name: '博学多才', desc: '收集10种不同功法', category: 'skill', type: 'threshold', target: 10, event: 'skill_types_owned', reward: { spirit_stone: 8000 } },
  { id: 'skl_06', name: '万法皆通', desc: '收集30种不同功法', category: 'skill', type: 'threshold', target: 30, event: 'skill_types_owned', reward: { spirit_stone: 50000, skill_box: 'legend', skill_box_count: 1 }, title: '博学道人' },
  { id: 'skl_07', name: '功法全满', desc: '装备的7个功法全部Lv.5', category: 'skill', type: 'threshold', target: 1, event: 'all_skills_maxed', reward: { spirit_stone: 100000, skill_box: 'legend', skill_box_count: 2 }, title: '悟道真人' },
  { id: 'skl_08', name: '神通广大', desc: '装备3个金色/红色神通', category: 'skill', type: 'threshold', target: 3, event: 'divine_high_rarity', reward: { spirit_stone: 20000, skill_box: 'fine', skill_box_count: 1 } },
  { id: 'skl_09', name: '残页收集', desc: '累计获得100个功法残页', category: 'skill', type: 'counter', target: 100, event: 'skill_pages', reward: { spirit_stone: 10000 } },
  { id: 'skl_10', name: '传承不断', desc: '使用万能功法残页10次', category: 'skill', type: 'counter', target: 10, event: 'universal_page_use', reward: { spirit_stone: 5000 } },

  // ===== 炼丹 (10) =====
  { id: 'pil_01', name: '初涉丹道', desc: '首次炼丹成功', category: 'pill', type: 'counter', target: 1, event: 'craft_success', reward: { spirit_stone: 1000 } },
  { id: 'pil_02', name: '丹药百出', desc: '炼丹成功50次', category: 'pill', type: 'counter', target: 50, event: 'craft_success', reward: { spirit_stone: 8000 } },
  { id: 'pil_03', name: '丹道宗师', desc: '炼丹成功200次', category: 'pill', type: 'counter', target: 200, event: 'craft_success', reward: { spirit_stone: 50000, equip_box: 'fine', equip_box_count: 1 }, title: '丹道宗师' },
  { id: 'pil_04', name: '百草识尽', desc: '收集全部7种灵草', category: 'pill', type: 'threshold', target: 7, event: 'herb_types', reward: { spirit_stone: 5000, skill_box: 'normal', skill_box_count: 1 } },
  { id: 'pil_05', name: '极品灵草', desc: '获得红色品质灵草', category: 'pill', type: 'counter', target: 1, event: 'herb_red', reward: { spirit_stone: 10000 } },
  { id: 'pil_06', name: '服丹百颗', desc: '累计使用丹药100次', category: 'pill', type: 'counter', target: 100, event: 'pill_use', reward: { spirit_stone: 10000 } },
  { id: 'pil_07', name: '药不能停', desc: '同时拥有3种buff', category: 'pill', type: 'threshold', target: 3, event: 'buff_count', reward: { spirit_stone: 5000 }, title: '药罐子' },
  { id: 'pil_08', name: '绝不浪费', desc: '连续炼丹成功10次', category: 'pill', type: 'counter', target: 1, event: 'craft_streak', reward: { spirit_stone: 5000 } },
  { id: 'pil_09', name: '愈挫愈勇', desc: '炼丹失败20次', category: 'pill', type: 'counter', target: 20, event: 'craft_fail', reward: { spirit_stone: 3000 }, title: '屡败屡战' },
  { id: 'pil_10', name: '极品丹师', desc: '炼出金色品质系数丹药', category: 'pill', type: 'counter', target: 1, event: 'craft_gold_quality', reward: { spirit_stone: 20000, equip_box: 'fine', equip_box_count: 1 } },

  // ===== 洞天·洞府 (8) =====
  { id: 'cav_01', name: '开辟洞府', desc: '建造第1座建筑', category: 'cave', type: 'counter', target: 1, event: 'cave_build', reward: { spirit_stone: 1000 } },
  { id: 'cav_02', name: '初具规模', desc: '拥有3座建筑', category: 'cave', type: 'threshold', target: 3, event: 'cave_building_count', reward: { spirit_stone: 3000 } },
  { id: 'cav_03', name: '洞天福地', desc: '7座建筑全部建成', category: 'cave', type: 'threshold', target: 7, event: 'cave_building_count', reward: { spirit_stone: 20000, equip_box: 'fine', equip_box_count: 1 } },
  { id: 'cav_04', name: '精益求精', desc: '任一建筑升到10级', category: 'cave', type: 'threshold', target: 10, event: 'cave_max_level', reward: { spirit_stone: 20000, skill_box: 'fine', skill_box_count: 1 } },
  { id: 'cav_05', name: '鬼斧神工', desc: '任一建筑升到满级', category: 'cave', type: 'threshold', target: 20, event: 'cave_max_level', reward: { spirit_stone: 100000, equip_box: 'legend', equip_box_count: 1 }, title: '洞天之主' },
  { id: 'cav_06', name: '勤耕不辍', desc: '累计收获灵草100次', category: 'cave', type: 'counter', target: 100, event: 'herb_harvest', reward: { spirit_stone: 5000 } },
  { id: 'cav_07', name: '灵田满仓', desc: '所有灵田地块同时种满', category: 'cave', type: 'counter', target: 1, event: 'plots_all_planted', reward: { spirit_stone: 3000 } },
  { id: 'cav_08', name: '日进斗金', desc: '聚宝盆累计领取100万灵石', category: 'cave', type: 'counter', target: 1000000, event: 'pot_collect_total', reward: { spirit_stone: 30000, skill_box: 'fine', skill_box_count: 1 }, title: '聚宝真人' },

  // ===== 宗门 (8) =====
  { id: 'sec_01', name: '拜入山门', desc: '加入一个宗门', category: 'sect', type: 'counter', target: 1, event: 'sect_join', reward: { spirit_stone: 2000 } },
  { id: 'sec_02', name: '开宗立派', desc: '创建一个宗门', category: 'sect', type: 'counter', target: 1, event: 'sect_create', reward: { spirit_stone: 10000 }, title: '开山祖师' },
  { id: 'sec_03', name: '贡献良多', desc: '累计宗门贡献10,000', category: 'sect', type: 'counter', target: 10000, event: 'sect_contribution', reward: { spirit_stone: 10000, equip_box: 'normal', equip_box_count: 1 } },
  { id: 'sec_04', name: '宗门栋梁', desc: '累计宗门贡献100,000', category: 'sect', type: 'counter', target: 100000, event: 'sect_contribution', reward: { spirit_stone: 50000, equip_box: 'fine', equip_box_count: 1 }, title: '宗门栋梁' },
  { id: 'sec_05', name: '签到达人', desc: '累计宗门签到30天', category: 'sect', type: 'counter', target: 30, event: 'sect_sign', reward: { spirit_stone: 8000 } },
  { id: 'sec_06', name: '讨伐先锋', desc: '参与宗门Boss讨伐10次', category: 'sect', type: 'counter', target: 10, event: 'sect_boss_attack', reward: { spirit_stone: 10000, skill_box: 'normal', skill_box_count: 1 } },
  { id: 'sec_07', name: '任务狂人', desc: '完成50个宗门日常任务', category: 'sect', type: 'counter', target: 50, event: 'sect_daily_task', reward: { spirit_stone: 20000, equip_box: 'fine', equip_box_count: 1 } },
  { id: 'sec_08', name: '位极人臣', desc: '成为宗门长老及以上', category: 'sect', type: 'counter', target: 1, event: 'sect_elder', reward: { spirit_stone: 10000 } },

  // ===== 传说·隐藏 (5) =====
  { id: 'hid_01', name: '天选之人', desc: '首次登录游戏', category: 'hidden', type: 'counter', target: 1, event: 'first_login', reward: { spirit_stone: 1000 }, title: '天选之人' },
  { id: 'hid_02', name: '一夜暴富', desc: '单次离线获得超过50万灵石', category: 'hidden', type: 'counter', target: 1, event: 'offline_rich', reward: { spirit_stone: 30000, equip_box: 'fine', equip_box_count: 1 } },
  { id: 'hid_03', name: '欧皇降临', desc: '+0直接强化到+6无失败', category: 'hidden', type: 'counter', target: 1, event: 'enhance_lucky', reward: { spirit_stone: 50000, equip_box: 'legend', equip_box_count: 1 }, title: '欧皇' },
  { id: 'hid_04', name: '非酋附体', desc: '连续强化失败10次', category: 'hidden', type: 'counter', target: 1, event: 'enhance_unlucky', reward: { spirit_stone: 10000, skill_box: 'fine', skill_box_count: 1 }, title: '非酋' },
  { id: 'hid_05', name: '万界至尊', desc: '完成所有非隐藏成就', category: 'hidden', type: 'threshold', target: 81, event: 'total_completed', reward: { spirit_stone: 1000000, equip_box: 'legend', equip_box_count: 5, skill_box: 'legend', skill_box_count: 3 }, title: '万界至尊' },

  // ===== 宗门战 · 论道之星 =====
  { id: 'sect_war_mvp_1', name: '论道之星', desc: '宗门战单挑 MVP 1 次', category: 'sect', type: 'counter', target: 1, event: 'sect_war_mvp', reward: { spirit_stone: 20000 }, title: '论道之星' },
  { id: 'sect_war_mvp_3', name: '问道魁首', desc: '累计获得 3 次宗门战单挑 MVP', category: 'sect', type: 'counter', target: 3, event: 'sect_war_mvp', reward: { spirit_stone: 100000 }, title: '问道魁首' },
  { id: 'sect_war_win_1', name: '初战告捷', desc: '参与宗门战并获胜 1 次', category: 'sect', type: 'counter', target: 1, event: 'sect_war_win', reward: { spirit_stone: 10000 } },
  { id: 'sect_war_win_10', name: '百战宗师', desc: '参与宗门战并获胜 10 次', category: 'sect', type: 'counter', target: 10, event: 'sect_war_win', reward: { spirit_stone: 80000 }, title: '百战宗师' },
  { id: 'spirit_vein_raid_1', name: '灵脉行者', desc: '灵脉偷袭首胜', category: 'sect', type: 'counter', target: 1, event: 'spirit_vein_raid_win', reward: { spirit_stone: 5000 } },
  { id: 'spirit_vein_raid_20', name: '灵脉霸主', desc: '灵脉偷袭累计胜利 20 次', category: 'sect', type: 'counter', target: 20, event: 'spirit_vein_raid_win', reward: { spirit_stone: 50000 }, title: '灵脉霸主' },
];

// 按事件名索引，加速查找
export const ACHIEVEMENTS_BY_EVENT: Record<string, AchievementDef[]> = {};
for (const a of ACHIEVEMENTS) {
  if (!ACHIEVEMENTS_BY_EVENT[a.event]) ACHIEVEMENTS_BY_EVENT[a.event] = [];
  ACHIEVEMENTS_BY_EVENT[a.event].push(a);
}

export const ACHIEVEMENTS_MAP: Record<string, AchievementDef> = {};
for (const a of ACHIEVEMENTS) {
  ACHIEVEMENTS_MAP[a.id] = a;
}

// ========== 称号数据 ==========
export interface TitleDef {
  id: string;
  name: string;
  quality: 'green' | 'blue' | 'purple' | 'gold';
}

export const TITLES: Record<string, TitleDef> = {
  '筑基修士': { id: '筑基修士', name: '筑基修士', quality: 'green' },
  '金丹真人': { id: '金丹真人', name: '金丹真人', quality: 'green' },
  '元婴老祖': { id: '元婴老祖', name: '元婴老祖', quality: 'blue' },
  '化神尊者': { id: '化神尊者', name: '化神尊者', quality: 'blue' },
  '渡劫真君': { id: '渡劫真君', name: '渡劫真君', quality: 'purple' },
  '大乘至尊': { id: '大乘至尊', name: '大乘至尊', quality: 'purple' },
  '飞升仙尊': { id: '飞升仙尊', name: '飞升仙尊', quality: 'purple' },
  '万法宗师': { id: '万法宗师', name: '万法宗师', quality: 'purple' },
  '苦修者':   { id: '苦修者',   name: '苦修者',   quality: 'green' },
  '百战勇士': { id: '百战勇士', name: '百战勇士', quality: 'green' },
  '万战老兵': { id: '万战老兵', name: '万战老兵', quality: 'blue' },
  '杀伐之主': { id: '杀伐之主', name: '杀伐之主', quality: 'purple' },
  '诛魔者':   { id: '诛魔者',   name: '诛魔者',   quality: 'blue' },
  '万界行者': { id: '万界行者', name: '万界行者', quality: 'blue' },
  '散财仙人': { id: '散财仙人', name: '散财仙人', quality: 'blue' },
  '五行道人': { id: '五行道人', name: '五行道人', quality: 'green' },
  '百炼宗师': { id: '百炼宗师', name: '百炼宗师', quality: 'purple' },
  '神器之主': { id: '神器之主', name: '神器之主', quality: 'purple' },
  '铸器狂人': { id: '铸器狂人', name: '铸器狂人', quality: 'blue' },
  '博学道人': { id: '博学道人', name: '博学道人', quality: 'blue' },
  '悟道真人': { id: '悟道真人', name: '悟道真人', quality: 'purple' },
  '丹道宗师': { id: '丹道宗师', name: '丹道宗师', quality: 'blue' },
  '药罐子':   { id: '药罐子',   name: '药罐子',   quality: 'green' },
  '屡败屡战': { id: '屡败屡战', name: '屡败屡战', quality: 'green' },
  '洞天之主': { id: '洞天之主', name: '洞天之主', quality: 'purple' },
  '聚宝真人': { id: '聚宝真人', name: '聚宝真人', quality: 'blue' },
  '开山祖师': { id: '开山祖师', name: '开山祖师', quality: 'blue' },
  '宗门栋梁': { id: '宗门栋梁', name: '宗门栋梁', quality: 'blue' },
  '天选之人': { id: '天选之人', name: '天选之人', quality: 'green' },
  '欧皇':     { id: '欧皇',     name: '欧皇',     quality: 'gold' },
  '非酋':     { id: '非酋',     name: '非酋',     quality: 'gold' },
  '万界至尊': { id: '万界至尊', name: '万界至尊', quality: 'gold' },
  '论道之星': { id: '论道之星', name: '论道之星', quality: 'gold' },
  '问道魁首': { id: '问道魁首', name: '问道魁首', quality: 'gold' },
  '百战宗师': { id: '百战宗师', name: '百战宗师', quality: 'purple' },
  '灵脉霸主': { id: '灵脉霸主', name: '灵脉霸主', quality: 'purple' },
};

// ========== 等级 → Tier 映射 ==========
function levelToTier(level: number): number {
  if (level >= 195) return 10;
  if (level >= 185) return 9;
  if (level >= 170) return 8;
  if (level >= 140) return 7;
  if (level >= 110) return 6;
  if (level >= 80)  return 5;
  if (level >= 55)  return 4;
  if (level >= 35)  return 3;
  if (level >= 15)  return 2;
  return 1;
}

// ========== 装备箱生成 ==========
const EQUIP_BOX_WEIGHTS: Record<string, number[]> = {
  //                     白  绿  蓝   紫  金  红
  normal: [0, 50, 40, 10, 0, 0],
  fine:   [0,  0, 40, 40, 18, 2],
  legend: [0,  0,  0, 30, 50, 20],
};

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// 副属性生成（和 battle.ts 逻辑一致）
const DROP_SUB_POOL = [
  { stat: 'ATK', min: 5, max: 30 }, { stat: 'DEF', min: 3, max: 20 },
  { stat: 'HP', min: 20, max: 150 }, { stat: 'SPD', min: 2, max: 15 },
  { stat: 'CRIT_RATE', min: 1, max: 5 }, { stat: 'CRIT_DMG', min: 5, max: 20 },
  { stat: 'LIFESTEAL', min: 1, max: 5 }, { stat: 'DODGE', min: 1, max: 4 },
  { stat: 'ARMOR_PEN', min: 3, max: 15 }, { stat: 'ACCURACY', min: 2, max: 10 },
];

function generateSubStats(rarityIdx: number, tier: number): any[] {
  const subCountRange: [number, number][] = [[0,0],[0,1],[1,2],[2,3],[3,4],[4,5]];
  const [minSubs, maxSubs] = subCountRange[rarityIdx] || [0, 0];
  const count = rand(minSubs, maxSubs);
  if (count === 0) return [];
  const subs: any[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const available = DROP_SUB_POOL.filter(s => !used.has(s.stat));
    if (available.length === 0) break;
    const pick = available[rand(0, available.length - 1)];
    used.add(pick.stat);
    const qualityMul = 1 + rarityIdx * 0.15;
    const tierMul = 1 + (tier - 1) * 0.1;
    const value = Math.floor(rand(pick.min, pick.max) * qualityMul * tierMul);
    subs.push({ stat: pick.stat, value: Math.max(1, value) });
  }
  return subs;
}

export function generateEquipBox(boxType: 'normal' | 'fine' | 'legend', charLevel: number): any {
  const tier = levelToTier(charLevel);
  const rarities = ['white', 'green', 'blue', 'purple', 'gold', 'red'];
  const w = EQUIP_BOX_WEIGHTS[boxType];
  const total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let idx = 0;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { idx = i; break; } }

  const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant'];
  const slotIdx = rand(0, slots.length - 1);
  const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_RATE', pendant: 'SPIRIT' };
  const primaryBases: Record<string, number> = { ATK: 30, DEF: 20, HP: 200, SPD: 15, CRIT_RATE: 3, SPIRIT: 8 };
  const statMuls = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5];
  const tierReqLevels: Record<number, number> = { 1:1, 2:15, 3:35, 4:55, 5:80, 6:110, 7:140, 8:170, 9:185, 10:195 };

  const ps = primaryStats[slots[slotIdx]];
  const pv = Math.floor((primaryBases[ps] || 30) * tier * statMuls[idx]);
  const weaponType = slots[slotIdx] === 'weapon' ? ['sword','blade','spear','fan'][rand(0,3)] : null;
  const subStats = generateSubStats(idx, tier);

  return {
    name: generateEquipName(rarities[idx], slots[slotIdx], weaponType, tier, ps, null),
    rarity: rarities[idx],
    primary_stat: ps, primary_value: pv, sub_stats: JSON.stringify(subStats),
    set_id: null, tier, weapon_type: weaponType,
    base_slot: slots[slotIdx], req_level: tierReqLevels[tier] || 1, enhance_level: 0,
  };
}

// ========== 功法碎片箱生成 ==========
const SKILL_POOLS: Record<string, string[]> = {
  normal: ['wind_blade','vine_whip','ice_palm','flame_sword','quake_fist','body_refine','flame_body','water_flow','root_grip','metal_skin',
           'fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall'],
  fine:   ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall',
           'sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury','wood_heal','mirror_water','crit_master','earth_fortitude','poison_body','fire_mastery'],
  legend: ['sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury','wood_heal','mirror_water','crit_master','earth_fortitude','poison_body','fire_mastery',
           'metal_burst','quake_stomp','life_drain','inferno_burst','storm_blade','heaven_heal','water_mastery','battle_frenzy','heavenly_body','time_stop','heavenly_wrath','dao_heart','five_elements_harmony'],
};

export function generateSkillBox(boxType: 'normal' | 'fine' | 'legend'): string {
  const pool = SKILL_POOLS[boxType];
  return pool[rand(0, pool.length - 1)];
}

// ========== 核心：检查并更新成就进度 ==========
export interface AchievementCompleted {
  id: string;
  name: string;
  desc: string;
  title?: string;
}

/**
 * 检查成就进度
 * @param charId 角色ID
 * @param event 事件名
 * @param value 当前值（threshold类型传当前值，counter类型传增量）
 * @returns 新完成的成就列表
 */
export async function checkAchievements(charId: number, event: string, value: number): Promise<AchievementCompleted[]> {
  const defs = ACHIEVEMENTS_BY_EVENT[event];
  if (!defs || defs.length === 0) return [];

  const pool = getPool();
  const completed: AchievementCompleted[] = [];

  for (const def of defs) {
    // 查当前进度
    const { rows } = await pool.query(
      'SELECT progress, completed FROM character_achievements WHERE character_id = $1 AND achievement_id = $2',
      [charId, def.id]
    );

    if (rows.length > 0 && rows[0].completed) continue; // 已完成跳过

    let currentProgress = rows.length > 0 ? rows[0].progress : 0;

    if (def.type === 'threshold') {
      // 阈值类：直接用当前值
      currentProgress = value;
    } else {
      // 计数类：累加
      currentProgress += value;
    }

    const isCompleted = currentProgress >= def.target;

    // upsert 进度
    await pool.query(
      `INSERT INTO character_achievements (character_id, achievement_id, progress, completed, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (character_id, achievement_id) DO UPDATE SET
         progress = $6,
         completed = $7,
         completed_at = CASE WHEN $8::boolean AND character_achievements.completed_at IS NULL THEN NOW() ELSE character_achievements.completed_at END`,
      [charId, def.id, currentProgress, isCompleted, isCompleted ? new Date() : null,
       currentProgress, isCompleted, isCompleted]
    );

    if (isCompleted && (rows.length === 0 || !rows[0].completed)) {
      completed.push({
        id: def.id,
        name: def.name,
        desc: def.desc,
        title: def.title,
      });
    }
  }

  // 检查 "万界至尊" 终极成就
  if (event !== 'total_completed' && completed.length > 0) {
    const countResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM character_achievements WHERE character_id = $1 AND completed = true`,
      [charId]
    );
    const totalCompleted = countResult.rows[0]?.cnt || 0;
    const extra = await checkAchievements(charId, 'total_completed', totalCompleted);
    completed.push(...extra);
  }

  return completed;
}
