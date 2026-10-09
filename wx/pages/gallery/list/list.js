// pages/gallery/list/list.js 晒图墙
const { request } = require('../../../utils/request')

const MOCK_POSTS = [
  { id: 1, user: '豆豆妈', avatar: '豆', likes: 32, title: '和女儿一起完成的小熊挂件', time: '2026-10-08', color: '#C7A37C', cover: '熊' },
  { id: 2, user: '手工达人Leo', avatar: 'L', likes: 58, title: '拼了三天的大号鲸鱼', time: '2026-10-07', color: '#7FA8C9', cover: '鲸' },
  { id: 3, user: '小番茄', avatar: '番', likes: 21, title: '新手第一作冰淇淋杯', time: '2026-10-06', color: '#F2A15B', cover: '冰' },
  { id: 4, user: '阿哲', avatar: '哲', likes: 45, title: '圣诞节全家福拼豆', time: '2026-10-05', color: '#E86A33', cover: '圣' },
  { id: 5, user: '甜甜圈', avatar: '甜', likes: 19, title: '猫咪摆件完成啦', time: '2026-10-04', color: '#9A8FB5', cover: '猫' },
  { id: 6, user: 'Rainbow', avatar: 'R', likes: 37, title: '几何盘子拼出来真好看', time: '2026-10-03', color: '#8FB3A6', cover: '几' }
]

Page({
  data: { posts: [] },

  onShow() {
    this.fetchPosts()
    const mine = wx.getStorageSync('myGalleryPosts') || []
    if (mine.length) this.setData({ posts: [...mine, ...MOCK_POSTS] })
  },

  fetchPosts() {
    request({ url: '/api/gallery', silent: true })
      .then((data) => { if (data && data.list) this.setData({ posts: data.list }) })
      .catch(() => {})
  },

  goPublish() { wx.navigateTo({ url: '/pages/gallery/publish/publish' }) },

  like(e) {
    const id = e.currentTarget.dataset.id
    const posts = this.data.posts.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p))
    this.setData({ posts })
  },

  preview(e) {
    wx.previewImage({ urls: this.data.posts.map(() => ''), current: '' })
  }
})