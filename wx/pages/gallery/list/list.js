// pages/gallery/list/list.js 晒图墙
const { request } = require('../../../utils/request')

Page({
  data: { posts: [] },

  onShow() {
    const now = Date.now()
    const needsFresh = wx.getStorageSync('galleryNeedsRefresh')
    // tab 页切换节流：距上次成功拉取不足 5s 不重复请求，避免来回切换卡顿
    if (!needsFresh && now - (this._lastFetchAt || 0) < 5000) return
    if (needsFresh) wx.removeStorageSync('galleryNeedsRefresh')
    this._lastFetchAt = now
    this.fetchPosts()
  },

  fetchPosts() {
    request({ url: '/api/gallery', silent: true })
      .then((data) => {
        if (data && data.list) this.setData({ posts: data.list.map((p) => this.decorate(p)) })
        this._lastFetchAt = Date.now()
      })
      .catch(() => {})
  },

  /** 后端字段装饰：cover 为图片 URL 时用图片渲染，本地占位用字符兜底 */
  decorate(p) {
    const cover = p.cover || (Array.isArray(p.images) && p.images[0]) || ''
    const isImg = !!cover && /^https?:\/\//.test(cover)
      ? true
      : !!cover && cover.indexOf('/') === 0
    return {
      ...p,
      isImg: !!isImg,
      cover
    }
  },

  goPublish() { wx.navigateTo({ url: '/pages/gallery/publish/publish' }) },

  like(e) {
    const id = e.currentTarget.dataset.id
    const posts = this.data.posts.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p))
    this.setData({ posts })
  },

  preview(e) {
    const post = this.data.posts[e.currentTarget.dataset.index]
    const urls = (post && post.images && post.images.length ? post.images : []).map((u) => {
      // 后端返回的相对路径补全
      if (typeof u === 'string' && u.indexOf('/') === 0) return require('../../../utils/config').baseUrl + u
      return u
    })
    if (!urls.length) {
      wx.showToast({ title: '该作品暂无图片', icon: 'none' })
      return
    }
    wx.previewImage({ urls, current: urls[0] })
  }
})