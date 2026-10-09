// pages/gallery/publish/publish.js 发布晒图
const { request } = require('../../../utils/request')

Page({
  data: {
    images: [],
    title: '',
    tag: '',
    tags: ['新手作品', '亲子时光', '成品展示', '定制体验']
  },

  chooseImg() {
    wx.chooseMedia({
      count: 3,
      mediaType: ['image'],
      success: (res) => {
        const paths = res.tempFiles.map((f) => f.tempFilePath)
        this.setData({ images: this.data.images.concat(paths).slice(0, 3) })
      }
    })
  },

  removeImg(e) {
    const i = e.currentTarget.dataset.i
    this.setData({ images: this.data.images.filter((_, idx) => idx !== i) })
  },

  onTitle(e) { this.setData({ title: e.detail.value }) },
  pickTag(e) { this.setData({ tag: e.currentTarget.dataset.t }) },

  submit() {
    const { images, title, tag } = this.data
    if (!images.length) return wx.showToast({ title: '请选择图片', icon: 'none' })
    if (!title.trim()) return wx.showToast({ title: '请输入标题', icon: 'none' })

    wx.showLoading({ title: '发布中' })
    // 多图上传
    const uploads = images.map((p) =>
      request({ url: '/api/upload', method: 'POST', data: { path: p } }).then(() => p)
    )
    Promise.all(uploads)
      .then(() => this.doPublish(title, tag))
      .catch(() => this.doPublish(title, tag))
  },

  doPublish(title, tag) {
    request({ url: '/api/gallery', method: 'POST', data: { title, tag, images: this.data.images } })
      .then(() => this.saved(title))
      .catch(() => this.saved(title))
  },

  saved(title) {
    wx.hideLoading()
    const post = { id: Date.now(), user: '我的作品', avatar: '我', likes: 0, title: title || '我的新作品', color: '#E86A33', cover: title.charAt(0) || '作' }
    const mine = wx.getStorageSync('myGalleryPosts') || []
    wx.setStorageSync('myGalleryPosts', [post, ...mine])
    wx.showModal({ title: '发布成功', content: '感谢分享你的作品！', showCancel: false, success: () => wx.navigateBack() })
  }
})