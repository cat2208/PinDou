// pages/member/center/center.js 会员中心
const { request } = require('../../../utils/request')

// 演示会员信息
const MOCK_MEMBER = {
  level: 2,
  levelName: '银牌会员',
  points: 1280,
  balance: 68.5,
  coupons: 3,
  growth: { current: 1280, next: 2000, rate: 0.64 }
}

Page({
  data: { member: null },

  onShow() { this.fetchMember() },

  fetchMember() {
    request({ url: '/api/member/info', silent: true })
      .then((data) => this.setData({ member: data || MOCK_MEMBER }))
      .catch(() => this.setData({ member: MOCK_MEMBER }))
  },

goPoints() { wx.navigateTo({ url: '/pages/member/points-log/points-log' }) },
  goOrders() { wx.switchTab({ url: '/pages/order/list/list' }) }
})