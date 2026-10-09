// pages/order/list/list.js 订单列表（来图定制 / 到店DIY / 商城）
const { request } = require('../../../utils/request')
const { customStatusText } = require('../../../utils/util')

// 到店订单状态中文
const STORE_STATUS_TEXT = {
  timing: '计时中', pending_settle: '待收款', completed: '已结账', cancelled: '已取消'
}

Page({
  data: {
    tabs: ['全部', '进行中', '已完成'],
    activeTab: 0,
    orders: [],
    loading: true
  },

  onLoad(query) {
    // 支持 order/detail 返回后定位 tab
    if (query && query.tab) {
      const idx = this.data.tabs.indexOf(query.tab)
      if (idx >= 0) this.setData({ activeTab: idx })
    }
  },

  onShow() { this.fetchOrders() },

  onPullDownRefresh() {
    this.fetchOrders().finally(() => wx.stopPullDownRefresh())
  },

  fetchOrders() {
    const { activeTab, tabs } = this.data
    // 后端 /api/orders 支持逗号分隔多状态；到店订单 timing/pending_settle 归"进行中"
    let status = ''
    if (activeTab === 1) status = 'pending_payment,in_production,quality_checking,shipping'
    if (activeTab === 2) status = 'completed'
    this.setData({ loading: true })
    return request({ url: '/api/orders', data: { status }, silent: true })
      .then((data) => {
        const list = (data && data.list) || []
        this.setData({ orders: list.map(o => this.decorate(o)) })
      })
      .catch(() => this.setData({ orders: [] }))
      .finally(() => this.setData({ loading: false }))
  },

  /** 统一展示字段：类型标签/状态文案/占位图 */
  decorate(o) {
    let statusText = o.statusText || o.status || ''
    if (o.type === 'store') statusText = STORE_STATUS_TEXT[o.status] || statusText
    else if (o.type === 'custom') statusText = customStatusText(o.status)
    return {
      ...o,
      typeText: o.type === 'custom' ? '来图定制' : o.type === 'store' ? '到店DIY' : '商城',
      statusText,
      imgError: false
    }
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset
    if (index === this.data.activeTab) return
    this.setData({ activeTab: index }, () => this.fetchOrders())
  },

  goDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/order/detail/detail?id=${id}` })
  },

  onImgError(e) {
    const idx = e.currentTarget.dataset.index
    this.setData({ [`orders[${idx}].imgError`]: true })
  },

  goMall() {
    wx.switchTab({ url: '/pages/mall/list/list' })
  }
})