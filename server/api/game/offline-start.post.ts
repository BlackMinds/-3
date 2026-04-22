// 离线挂机开启入口已临时下线：
// 原因：离线结算不检查玩家战力，低战力账号可通过切到高阶图后开始离线，
// 一次领取数百亿修为/灵石，彻底突破战力门槛。
// 保留 offline-status / offline-claim 让已开始挂机的玩家能正常结算。
// 修复方案（待做）：结算时按「玩家战力 vs 地图推荐战力」缩放胜率。
export default defineEventHandler(async () => {
  return { code: 503, message: '离线挂机功能维护中，暂时无法开启' }
})
