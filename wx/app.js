// app.js 拼豆手工店小程序 - 用户端
const { request } = require('./utils/request')

App({
  onLaunch() {
    // 读取本地登录态
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    if (token) {
      this.globalData.token = token
      this.globalData.userInfo = userInfo || null
    }
    // 静默登录（换取 openid / token）
    this.silentLogin()
    // 拉取全局配置（定价参数等）
    this.fetchGlobalConfig()
  },

  // 静默登录：wx.login -> 后端换取 token
  silentLogin() {
    if (this.globalData.logging) return
    this.globalData.logging = true
    wx.login({
      success: async (res) => {
        if (!res.code) return
        try {
          const data = await request({
            url: '/api/user/login',
            method: 'POST',
            data: { code: res.code },
            silent: true,
            noAuth: true
          })
          if (data && data.token) {
            this.globalData.token = data.token
            wx.setStorageSync('token', data.token)
            if (data.userInfo) {
              this.globalData.userInfo = data.userInfo
              wx.setStorageSync('userInfo', data.userInfo)
            }
          }
        } catch (e) {
          // 后端未就绪时静默失败，不阻塞浏览
          console.warn('[silentLogin]', e)
        }
      },
      fail: () => {}
    })
  },

  // 拉取运营配置（pricing_config 默认值等），失败静默
  fetchGlobalConfig() {
    request({
      url: '/api/config/public',
      method: 'GET',
      silent: true,
      noAuth: true
    }).then((cfg) => {
      if (cfg) this.globalData.config = cfg
    }).catch(() => {})
  },

  // 刷新用户信息（登录后/支付后调用）
  refreshUser() {
    if (!this.globalData.token) return Promise.resolve(null)
    return request({ url: '/api/user/info', method: 'GET', silent: true })
      .then((info) => {
        if (info) {
          this.globalData.userInfo = info
          wx.setStorageSync('userInfo', info)
        }
        return info
      })
      .catch(() => null)
  },

  // 统一跳转登录后回调（预留）
  ensureLogin() {
    if (this.globalData.token) return Promise.resolve(true)
    return new Promise((resolve) => {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/user/profile' })
        resolve(false)
      }, 600)
    })
  },

  globalData: {
    token: '',
    userInfo: null,
    config: null,
    logging: false,
    // 就近门店（后端按定位返回）
    nearestStore: null
  }
})