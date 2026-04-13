// 宗门前端静态数据

export const SECT_LEVEL_NAMES: Record<number, string> = {
  1: '初立', 2: '小有名气', 3: '远近闻名', 4: '一方势力',
  5: '名门大派', 6: '仙门正宗', 7: '顶级宗门', 8: '圣地',
  9: '超级圣地', 10: '天下第一',
};

export const ROLE_NAMES: Record<string, string> = {
  leader: '宗主',
  vice_leader: '副宗主',
  elder: '长老',
  inner: '内门弟子',
  outer: '外门弟子',
};

export const ROLE_COLORS: Record<string, string> = {
  leader: '#ffd700',
  vice_leader: '#ff8c00',
  elder: '#9b59b6',
  inner: '#3498db',
  outer: '#95a5a6',
};

export const BOSS_NAMES: Record<string, string> = {
  tiger: '妖兽·裂天虎',
  blood: '魔修·血煞尊者',
  dragon: '古妖·九幽蛟龙',
  demon: '天魔·灭世魔君',
  chaos: '远古·混沌兽',
};

export const SHOP_CATEGORY_NAMES: Record<string, string> = {
  basic: '基础',
  advanced: '进阶',
  rare: '稀有',
  set: '套装',
  legend: '传说',
  supreme: '至尊',
};

export const SHOP_CATEGORY_COLORS: Record<string, string> = {
  basic: '#a0a0a0',
  advanced: '#4caf50',
  rare: '#2196f3',
  set: '#9c27b0',
  legend: '#ff9800',
  supreme: '#f44336',
};

export function formatContribution(value: number): string {
  if (value >= 100000) return (value / 10000).toFixed(1) + '万';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
  return String(value);
}

export function formatFund(value: number): string {
  if (value >= 100000000) return (value / 100000000).toFixed(2) + '亿';
  if (value >= 10000) return (value / 10000).toFixed(1) + '万';
  return String(value);
}
