// pages/order/detail/detail.js 订单详情（来图定制 / 到店DIY / 商城）
const { request } = require('../../../utils/request')
const { customStatusText } = require('../../../utils/util')

const STORE_STATUS_TEXT = {
  timing: '计时中', pending_settle: '待收款', completed: '已结账', cancelled: '已取消'
}

Page({
  data: {
    id: '',
    order: null
  },

  onLoad(query) {
    this.setData({ id: query.id || '' })
    this.fetchDetail()
  },

  fetchDetail() {
    const { id } = this.data
    if (!id) return
    request({ url: `/api/orders/${id}`, silent: true })
      .then((data) => { if (data) this.render(data) })
      .catch(() => {})
  },

  render(order) {
    let statusText = order.statusText || order.status || ''
    if (order.type === 'custom') statusText = customStatusText(order.status)
    else if (order.type === 'store') statusText = STORE_STATUS_TEXT[order.status] || statusText
    const typeText = order.type === 'custom' ? '来图定制' : order.type === 'store' ? '到店DIY' : '商城'
    this.setData({ order: { ...order, statusText, typeText, typeTextClass: `type-${order.type}` } })
  },

  copyNo(e) {
    const { no } = e.currentTarget.dataset
    wx.setClipboardData({ data: no || '', success: () => wx.showToast({ title: '单号已复制' }) })
  },

  onReceived() {
    const { order } = this.data
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '确认中' })
          request({ url: `/api/orders/${order.id}/confirm`, method: 'POST', silent: true })
            .then(() => { wx.hideLoading(); this.fetchDetail() })
            .catch(() => wx.hideLoading())
        }
      }
    })
  }
})