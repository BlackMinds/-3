import request from './request';

// 获取完整角色数据
export function getGameData() {
  return request.get('/game/data');
}

// 保存战斗奖励
export function saveBattleRewards(data: {
  exp_gained: number;
  spirit_stone_gained: number;
  level_exp_gained?: number;
  current_map: string;
  skills_gained?: string[];
}) {
  return request.post('/game/save-rewards', data);
}

// 修炼闭关（消耗灵石加速获取修为）
export function cultivate(hours: number) {
  return request.post('/game/cultivate', { hours });
}

// 更新角色状态
export function updateCharacter(data: any) {
  return request.post('/game/update-character', data);
}
