/**
 * utils/request.js 统一请求封装
 * - Promise 化
 * - 自动注入 token
 * - 401 触发重新登录
 * - 统一错误 toast（可 silent 关闭）
 * - 后端约定返回格式：{ code: 0, data: ..., message: 'ok' }
 */
const { baseUrl } = require('./config')

// 是否正在静默刷新登录态，避免并发重复登录
let refreshing = false

function showError(msg, silent) {
  if (silent) return
  wx.showToast({
    title: msg || '请求失败，请稍后重试',
    icon: 'none',
    duration: 2000
  })
}

/**
 * 发起请求
 * @param {object} options
 *  - url: 路径（如 /api/user/login，自动拼 baseUrl）
 *  - method: GET/POST/PUT/DELETE
 *  - data: 请求体
 *  - silent: 是否静默失败（不弹 toast）
 *  - noAuth: 是否不需要 token
 *  - staff: 是否使用店员端 token（staffToken，供收银台/管理端使用）
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const { url, method = 'GET', data = {}, silent = false, noAuth = false, staff = false } = options
    const token = staff ? wx.getStorageSync('staffToken') : wx.getStorageSync('token')

    wx.request({
      url: baseUrl + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token && !noAuth ? { Authorization: `Bearer ${token}` } : {})
      },
timeout: 15000,
  success: (res) => {
    const body = res.data || {}
    // HTTP 401：token 失效，清空并引导重新登录
    if (res.statusCode === 401) {
      if (staff) {
        wx.removeStorageSync('staffToken')
        wx.removeStorageSync('staffInfo')
      } else {
        wx.removeStorageSync('token')
        wx.removeStorageSync('userInfo')
      }
      if (!refreshing) {
        refreshing = true
        wx.login({
          success: () => {
            // 登录态由 app 的 silentLogin 统一处理，这里仅提示
          },
          complete: () => { refreshing = false }
        })
      }
      showError('登录已失效，请重新登录', silent)
      reject(body)
      return
    }
    // 后端业务码：0 成功；否则按业务错误处理
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (body.code === 0 || body.code === undefined) {
        const payload = normalizeImg(body.data !== undefined ? body.data : body)
        resolve(payload)
      } else {
        showError(body.message || body.msg || '操作失败', silent)
        reject(body)
      }
    } else {
      showError(body.message || body.msg || `服务异常(${res.statusCode})`, silent)
      reject(body)
    }
  },
      fail: (err) => {
        showError('网络异常，请检查网络', silent)
        reject(err)
      }
    })
  })
}

/**
 * 将后端返回的相对图片路径（如 /images/home/banner1.png）补全为绝对地址，
 * 避免小程序把相对路径解析到开发者工具本地服务器上导致加载失败。
 * 仅处理图片类字段；link 等路由字段（/pages/...）保持原样。
 */
const IMG_KEY_RE = /(image|cover|avatar|icon|img|picture|photo|pic)$/i

function normalizeImg(value) {
  if (Array.isArray(value)) return value.map(normalizeImg)
  if (value && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value)) {
      const v = value[k]
      if (
        typeof v === 'string' &&
        IMG_KEY_RE.test(k) &&
        v.startsWith('/') &&
        !v.startsWith('//') &&
        !v.startsWith('/pages/') &&
        !v.startsWith('/api/')
      ) {
        out[k] = baseUrl + v
      } else {
        out[k] = normalizeImg(v)
      }
    }
    return out
  }
  return value
}

module.exports = { request, baseUrl }