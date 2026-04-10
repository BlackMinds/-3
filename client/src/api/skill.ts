import request from './request';

export function getSkillInventory() {
  return request.get('/skill/inventory');
}

export function getEquippedSkills() {
  return request.get('/skill/equipped');
}
