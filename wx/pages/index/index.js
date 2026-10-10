// pages/index/index.js 拼豆手工店 - 首页
const { request } = require('../../utils/request')

Page({
  data: {
    banners: [],
categories: [
      { id: 'custom', name: '来图定制', icon: '🎨', url: '/pages/custom/upload/upload', tab: true },
      { id: 'mall', name: '成品商城', icon: '🛍️', url: '/pages/mall/list/list', tab: true },
      { id: 'store', name: '扫码开台', icon: '🧩', url: '/pages/store/scan-timing/scan-timing' },
      { id: 'gallery', name: '晒图墙', icon: '📷', url: '/pages/gallery/list/list' },
      { id: 'member', name: '会员中心', icon: '👑', url: '/pages/member/center/center' }
    ],
    hotProducts: [],
    store: null,
    loading: true
  },

  onLoad() {
    this.fetchHome()
  },

  onPullDownRefresh() {
    this.fetchHome().finally(() => wx.stopPullDownRefresh())
  },

  fetchHome() {
    this.setData({ loading: true })
    // 后端就绪前静默降级为占位数据；上线后由 /api/home 返回
    return request({ url: '/api/home', silent: true })
      .then((data) => {
        if (data) {
          this.setData({
            banners: data.banners || [],
            hotProducts: data.hotProducts || [],
            store: data.store || null
          })
        }
      })
      .catch(() => {
        this.setData({ banners: [], hotProducts: [] })
      })
      .finally(() => this.setData({ loading: false }))
  },

  goCategory(e) {
    const { url, tab } = e.currentTarget.dataset
    if (!url) return
    if (tab) wx.switchTab({ url })
    else wx.navigateTo({ url })
  },

  goProduct(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/mall/detail/detail?id=${id}` })
  },

goStore() {
    wx.navigateTo({ url: '/pages/store/scan-timing/scan-timing' })
  },

  goMall() {
    wx.switchTab({ url: '/pages/mall/list/list' })
  },

// 图片加载失败降级：剔除该图（不阻断页面，避免数组中出现 null 项）
  onBannerError(e) {
    const idx = e.currentTarget.dataset.index
    const banners = this.data.banners
      .filter((b, i) => b && i !== idx)
    this.setData({ banners })
  },

  onProductImgError(e) {
    const idx = e.currentTarget.dataset.index
    const hotProducts = this.data.hotProducts.slice()
    hotProducts[idx] = { ...hotProducts[idx], imgError: true }
    this.setData({ hotProducts })
  }
})