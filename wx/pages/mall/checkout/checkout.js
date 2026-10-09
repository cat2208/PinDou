// pages/mall/checkout/checkout.js 结算页
const { request } = require('../../../utils/request')
const { fen2yuan } = require('../../../utils/util')

Page({
data: {
    items: [],
    // 购物方式：mall 商城 / custom 定制
    mode: 'mall',
    customOrder: null,
    address: null,
    freight: 0,
    totalPrice: 0,
    submitting: false
  },

  onLoad(query) {
    // 定制订单跳入
    if (query.custom === '1') {
      const order = {
        image: decodeURIComponent(query.image || ''),
        qty: Number(query.qty) || 1,
        size: decodeURIComponent(query.size || ''),
        remark: decodeURIComponent(query.remark || ''),
        unitPrice: Number(query.unitPrice) || 0,
        totalPrice: Number(query.totalPrice) || 0
      }
      this.setData({ mode: 'custom', customOrder: order, totalPrice: order.totalPrice })
      return
    }
    const items = wx.getStorageSync('checkoutItems') || []
    this.setData({ items })
    this.calcTotal()
    this.fetchAddress()
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

calcTotal() {
    const { items, freight } = this.data
    const sub = items.reduce((s, i) => s + i.price * i.qty, 0)
    const totalPrice = Math.max(0, sub) + freight
    this.setData({ totalPrice: +totalPrice.toFixed(2) })
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
        items: items.map(i => ({ productId: i.id, qty: i.qty, spec: i.spec })),
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