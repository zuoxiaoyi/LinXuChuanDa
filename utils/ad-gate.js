/**
 * 广告门槛总开关（个人主体 / 未开通流量主阶段）
 *
 * 微信流量主需「累计独立访客 UV > 500」才能开通并创建广告位（腾讯客服《流量主开通流程》，
 * 以微信官方最新规则为准）。本项目处于初期，UV 未达标、rewardedVideoAdUnitId 为空。
 *
 * 此期间若保留「看广告解锁 / 看广告翻倍」的文案与入口，会出现「点一下就直接放行」的
 * 假门槛：既误导用户，也让解锁与积分形同虚设。因此整条商业化链路由此开关统一控制：
 *
 *   关闭（当前）：7 天穿搭全开放、不显示锁、隐藏广告翻倍入口、不再查询云端解锁状态；
 *   开启：恢复「后 4 天看广告解锁 + 签到翻倍 + 补签」原有链路。
 *
 * 达标后只需两步：在 app.js 填入 rewardedVideoAdUnitId、把 adGateEnabled 改为 true，
 * 其余业务代码无需改动。
 *
 * 双重判定：必须「显式开关打开」且「广告位 ID 已填写」才启用，
 * 避免只改开关却忘填 ID 时又出现假门槛。
 */
function isAdGateEnabled() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null
    const globals = app && app.globalData
    if (!globals) return false
    return !!(globals.adGateEnabled && globals.rewardedVideoAdUnitId)
  } catch (err) {
    return false
  }
}

module.exports = { isAdGateEnabled }
