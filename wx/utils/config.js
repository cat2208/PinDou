/**
 * utils/config.js 全局配置
 * 本地开发指向本机后端（微信开发者工具需勾选"不校验合法域名"）；
 * 上线前将 ENV 切为 'prod' 或留空自动判断，即可走阿里云 HTTPS 域名。
 */
const ENV = {
  // 本地开发：WSL 内跑 NestJS，宿主机从 WSL 访问的地址参见 WSL 网关（172.x 或 localhost）
  dev: 'http://127.0.0.1:3100',
  // 生产：阿里云 ECS + Nginx + HTTPS，替换为已备案并配置 SSL 的域名（与部署文档 DOMAIN 保持一致）
  prod: 'https://api.yourdomain.com'
}

// 决定当前环境：可在开发者工具中通过 编译模式/自定义变量 覆盖
// 注意：__wxConfig 是开发者工具注入的非标准全局，个别基础库/真机环境下可能不存在，
// 必须防御式探测，否则顶层 ReferenceError 会导致 config 加载失败、整个小程序打不开。
function detectEnv() {
  try {
    const info = wx.getAccountInfoSync()
    if (info && info.miniProgram && info.miniProgram.envVersion === 'release') return 'prod'
  } catch (e) { /* 忽略 */ }
  if (typeof __wxConfig !== 'undefined' && __wxConfig.envVersion === 'release') return 'prod'
  if (wx.getStorageSync('env') === 'prod') return 'prod'
  return 'dev'
}
const envKey = detectEnv()

module.exports = {
  baseUrl: ENV[envKey] || ENV.dev,
  env: envKey,
  // 微信支付相关占位，后端统一下单后返回参数
  payTimeout: 10000,
  // 默认门店 ID（就近门店由后端返回）
  defaultStoreId: ''
}