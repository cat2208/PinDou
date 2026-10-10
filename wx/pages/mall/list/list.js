// pages/mall/list/list.js 成品商城-列表
const { request } = require('../../../utils/request')

// 后端未就绪时的占位商品
const MOCK_PRODUCTS = [
  { id: 1, name: '小熊拼豆挂件', category: '挂件', price: 19.9, priceText: '19.9', coverImage: '', sales: 128 },
  { id: 2, name: '皮卡丘拼豆摆件', category: '摆件', price: 29.9, priceText: '29.9', coverImage: '', sales: 96 },
  { id: 3, name: '爱心钥匙扣', category: '挂件', price: 12.9, priceText: '12.9', coverImage: '', sales: 210 },
  { id: 4, name: '海绵宝宝相框', category: '家居', price: 45, priceText: '45', coverImage: '', sales: 64 },
  { id: 5, name: '马里奥拼豆套装', category: '套装', price: 59, priceText: '59', coverImage: '', sales: 130 },
  { id: 6, name: '迷你杯垫四件套', category: '家居', price: 25.9, priceText: '25.9', coverImage: '', sales: 88 }
]

Page({
  data: {
    categories: ['全部', '挂件', '摆件', '家居', '套装'],
    activeCat: 0,
    products: [],
    loading: true
  },

  onLoad() {
    this.fetchProducts()
  },

  onPullDownRefresh() {
    this.fetchProducts().finally(() => wx.stopPullDownRefresh())
  },

onShow() {
    // tab 页每次进入更新（如购物车数量变化后）；5s 内来回切换不重复请求，避免卡顿
    const now = Date.now()
    if (now - (this._lastFetchAt || 0) < 5000) return
    if (this.data.products.length) this.fetchProducts(true)
  },

  fetchProducts(silent) {
    if (!silent) this.setData({ loading: true })
    const { activeCat, categories } = this.data
    const cat = categories[activeCat]
return request({ url: '/api/products', data: { category: cat === '全部' ? '' : cat }, silent: true })
      .then((data) => {
        this._lastFetchAt = Date.now()
        this.setData({ products: data && data.list ? data.list : [] })
      })
      .catch(() => {
        // 后端未就绪：展示占位数据
        const list = cat === '全部' ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter(p => p.category === cat)
        this.setData({ products: list })
      })
      .finally(() => this.setData({ loading: false }))
  },

  onCategoryTap(e) {
    const { index } = e.currentTarget.dataset
    if (index === this.data.activeCat) return
    this.setData({ activeCat: index }, () => this.fetchProducts())
  },

  goDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/mall/detail/detail?id=${id}` })
  },

  goCart() {
    wx.navigateTo({ url: '/pages/mall/cart/cart' })
  }
})