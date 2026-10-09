// pages/mall/detail/detail.js 成品商城-详情
const { request } = require('../../../utils/request')

// 后端未就绪时的占位商品详情
const MOCK_DETAIL = [
  { id: 1, name: '小熊拼豆挂件', price: 19.9, category: '挂件', stock: 50, sales: 128,
    coverImage: '', gallery: [], desc: '呆萌小熊拼豆挂件，手工拼制，可做钥匙扣/包包挂饰。',
    specs: [{ name: '尺寸', values: ['S码 5cm', 'M码 8cm'] }] },
  { id: 2, name: '皮卡丘拼豆摆件', price: 29.9, category: '摆件', stock: 30, sales: 96,
    coverImage: '', gallery: [], desc: '高还原皮卡丘拼豆摆件，适合桌面收藏。',
    specs: [{ name: '尺寸', values: ['标准 12cm'] }] },
  { id: 3, name: '爱心钥匙扣', price: 12.9, category: '挂件', stock: 100, sales: 210,
    coverImage: '', gallery: [], desc: '浪漫爱心钥匙扣，情侣款双色可选。',
    specs: [{ name: '颜色', values: ['红色', '粉色'] }] },
  { id: 4, name: '海绵宝宝相框', price: 45, category: '家居', stock: 20, sales: 64,
    coverImage: '', gallery: [], desc: '海绵宝宝主题相框，可放 6 寸照片。',
    specs: [{ name: '尺寸', values: ['6寸'] }] },
  { id: 5, name: '马里奥拼豆套装', price: 59, category: '套装', stock: 40, sales: 130,
    coverImage: '', gallery: [], desc: '马里奥主题拼豆自助套装，含底板与图纸。',
    specs: [{ name: '配置', values: ['标准套装'] }] },
  { id: 6, name: '迷你杯垫四件套', price: 25.9, category: '家居', stock: 60, sales: 88,
    coverImage: '', gallery: [], desc: '花朵/星星等四款图案迷你杯垫。',
    specs: [{ name: '图案', values: ['花朵', '星星', '爱心', '笑脸'] }] }
]

Page({
  data: {
    id: null,
    product: null,
    qty: 1,
    specIndex: 0,
    cartCount: 0
  },

  onLoad(query) {
    this.setData({ id: Number(query.id) || 1 })
    this.fetchDetail()
    this.refreshCartCount()
  },

  fetchDetail() {
    const { id } = this.data
    request({ url: `/api/products/${id}`, silent: true })
      .then((data) => {
        if (data) this.setData({ product: data })
      })
      .catch(() => {
        const mock = MOCK_DETAIL.find(p => p.id === id) || MOCK_DETAIL[0]
        this.setData({ product: mock })
      })
  },

  refreshCartCount() {
    const cart = wx.getStorageSync('cart') || []
    const count = cart.reduce((s, i) => s + i.qty, 0)
    this.setData({ cartCount: count })
  },

  changeQty(e) {
    const { delta } = e.currentTarget.dataset
    const qty = this.data.qty + delta
    if (qty < 1) return
    this.setData({ qty })
  },

  onSpecTap(e) {
    const { index } = e.currentTarget.dataset
    this.setData({ specIndex: index })
  },

  // 本地购物车存储（后端联调后切为 /api/cart）
  addToCart() {
    const { product, qty, specIndex } = this.data
    if (!product) return
    const spec = product.specs && product.specs.length
      ? product.specs[0].values[specIndex] : ''
    const cart = wx.getStorageSync('cart') || []
    const exist = cart.find(i => i.id === product.id && i.spec === spec)
    if (exist) exist.qty += qty
    else cart.push({ id: product.id, name: product.name, price: product.price, coverImage: product.coverImage, spec, qty })
    wx.setStorageSync('cart', cart)
    this.refreshCartCount()
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  buyNow() {
    this.addToCart()
    setTimeout(() => wx.navigateTo({ url: '/pages/mall/cart/cart' }), 500)
  },

  goCart() {
    wx.navigateTo({ url: '/pages/mall/cart/cart' })
  }
})