// pages/mall/checkout/checkout.js 结算页
const { request } = require('../../../utils/request')
const { fen2yuan, safeDecode } = require('../../../utils/util')

Page({
  data: {
    items: [],
    // 购物方式：mall 商城 / custom 定制
    mode: 'mall',
    customOrder: null,
    address: null,
    // 运费配置：按商品业务品类定价（后端 /api/config/public 下发）
    shipMap: {},
    freeShippingThreshold: 0,
    fallbackFee: 0,
    freight: 0,
    subtotal: 0,
    totalPrice: 0,
    submitting: false
  },

  onLoad(query) {
    // 定制订单跳入
    if (query.custom === '1') {
      const order = {
        image: safeDecode(query.image || ''),
        qty: Number(query.qty) || 1,
        size: safeDecode(query.size || ''),
        remark: safeDecode(query.remark || ''),
        unitPrice: Number(query.unitPrice) || 0,
        totalPrice: Number(query.totalPrice) || 0
      }
      this.setData({ mode: 'custom', customOrder: order, totalPrice: order.totalPrice })
      return
    }
    const items = wx.getStorageSync('checkoutItems') || []
    this.setData({ items })
    this.fetchShipConfig()
    this.fetchAddress()
  },

  // 拉取运费配置（含按品类运费表）
  fetchShipConfig() {
    request({ url: '/api/config/public', silent: true })
      .then((cfg) => {
        if (!cfg) return
        this.setData({
          shipMap: cfg.shippingByCategory || {},
          freeShippingThreshold: Number(cfg.freeShippingThreshold) || 0,
          fallbackFee: Number(cfg.shippingFee) || 0
        }, () => this.calcTotal())
      })
      .catch(() => this.calcTotal())
  },

  fetchAddress() {
    request({ url: '/api/user/address/default', silent: true })
      .then((addr) => { if (addr) this.setData({ address: addr }) })
      .catch(() => {
        // 本地演示地址
        this.setData({
          address: { name: '张三', phone: '13800000000', detail: '请填写收货地址（演示数据）' }
        })
      })
  },

  // 运费与后端同口径：按订单商品业务品类取最高档运费；订单金额达到免运费门槛则包邮
  calcTotal() {
    const { items, shipMap, freeShippingThreshold, fallbackFee } = this.data
    const subtotal = +items.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)
    let freight = 0
    if (!(freeShippingThreshold > 0 && subtotal >= freeShippingThreshold)) {
      const fees = items.map(i => Number(shipMap[i.category] ?? fallbackFee) || 0)
      freight = fees.length ? Math.max(...fees) : 0
    }
    const totalPrice = +((subtotal + freight).toFixed(2))
    this.setData({ subtotal, freight, totalPrice })
  },

  onShow() {},

  editAddress() {
    wx.showToast({ title: '演示环境暂缓地址编辑', icon: 'none' })
  },

  onSubmit() {
    const { mode, items, address, totalPrice, submitting } = this.data
    if (submitting) return
    if (!address) {
      wx.showToast({ title: '请填写收货地址', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    request({
      url: '/api/orders',
      method: 'POST',
      data: {
        mode,
        items: items.map(i => ({ productId: i.id, qty: i.qty })),
        amountFen: Math.round(totalPrice * 100)
      },
      silent: true
    }).then(() => this.submitSuccess())
      .catch(() => this.submitSuccess(true))
      .finally(() => this.setData({ submitting: false }))
  },

  submitSuccess(mock) {
    wx.removeStorageSync('checkoutItems')
    wx.removeStorageSync('cart')
    wx.showToast({ title: mock ? '订单已提交（演示）' : '订单已提交', icon: 'success' })
    setTimeout(() => {
      wx.switchTab({ url: '/pages/order/list/list' })
    }, 1200)
  }
})