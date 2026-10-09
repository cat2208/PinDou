// pages/custom/confirm/confirm.js 来图定制-确认下单（含拼豆图纸参数）
const { request } = require('../../../utils/request')
const { baseUrl } = require('../../../utils/config')

// 相对图片路径补全为可加载地址
function absUrl(p) {
  if (!p) return ''
  if (/^https?:\/\//.test(p) || p.indexOf('wxfile://') === 0) return p
  if (p.indexOf('/') === 0 && p.indexOf('//') !== 0) return baseUrl + p
  return p
}

Page({
  data: {
    order: null,
    contact: '',
    phone: '',
    remark: '',
    submitting: false
  },

  onLoad(query) {
    // 拼豆图纸参数（无 patternId 时为普通定制）
    const patternId = decodeURIComponent(query.patternId || '')
    const pattern = {
      patternId,
      patternUrl: decodeURIComponent(query.patternUrl || ''),
      gridWidth: Number(query.gridWidth) || 0,
      gridHeight: Number(query.gridHeight) || 0,
      beadSize: Number(query.beadSize) || 0,
      totalBeans: Number(query.totalBeans) || 0,
      colorCount: Number(query.colorCount) || 0,
      style: decodeURIComponent(query.style || '')
    }
    const order = {
      image: absUrl(decodeURIComponent(query.image || '')),
      qty: Number(query.qty) || 1,
      size: decodeURIComponent(query.size || ''),
      remark: decodeURIComponent(query.remark || ''),
      unitPrice: Number(query.unitPrice) || 0,
      totalPrice: Number(query.totalPrice) || 0,
      deliveryDay: Number(query.deliveryDay) || 3,
      orderNo: 'PD' + Date.now(),
      ...pattern
    }
    // 展示用绝对地址；下单入库保留原始相对路径
    if (pattern.patternUrl) {
      order.rawPatternUrl = pattern.patternUrl
      order.patternUrl = absUrl(pattern.patternUrl)
    }
    this.setData({ order })
  },

  onContactInput(e) { this.setData({ contact: e.detail.value }) },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }) },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },

  onSubmit() {
    const { order, contact, phone, remark, submitting } = this.data
    if (submitting) return
    if (!contact.trim()) {
      wx.showToast({ title: '请填写联系人', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请填写正确手机号', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const data = {
      image: order.image,
      qty: order.qty,
      size: order.size,
      remark: order.remark || remark,
      contact, phone,
      amountFen: Math.round(order.totalPrice * 100)
    }
    // 图纸参数透传（后端按 patternId 读取缓存，自动核算豆数与配豆清单）
    if (order.patternId) {
      data.patternId = order.patternId
      data.patternUrl = order.rawPatternUrl || order.patternUrl
      data.totalBeans = order.totalBeans
      data.colorCount = order.colorCount
      data.beadSize = order.beadSize
      data.gridWidth = order.gridWidth
      data.gridHeight = order.gridHeight
      data.style = order.style
    }
    request({
      url: '/api/custom/orders',
      method: 'POST',
      data,
      silent: true
    }).then(() => this.submitSuccess(false))
      .catch(() => this.submitSuccess(true))
      .finally(() => this.setData({ submitting: false }))
  },

  submitSuccess(mock) {
    // 下单成功后清除暂存图纸，避免脏数据
    const app = getApp()
    if (app.globalData) app.globalData.pendingPattern = null
    wx.showToast({ title: mock ? '下单成功（演示）' : '下单成功', icon: 'success' })
    setTimeout(() => {
      wx.switchTab({ url: '/pages/order/list/list' })
    }, 1200)
  }
})