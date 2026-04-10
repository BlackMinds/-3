import request from './request';

export function getCharacterInfo() {
  return request.get('/character/info');
}

export function createCharacter(name: string, spiritual_root: string) {
  return request.post('/character/create', { name, spiritual_root });
}
