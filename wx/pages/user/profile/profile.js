// pages/user/profile/profile.js 个人中心
const { request } = require('../../../utils/request')

const MOCK_USER = { nickname: '豆友', avatar: '豆', phone: '138****8888', memberLevel: '银牌会员' }

Page({
  data: { user: null },

  onShow() {
    const { globalData } = getApp()
    this.setData({ user: globalData.userInfo || MOCK_USER })
    request({ url: '/api/user/info', silent: true })
      .then((data) => { if (data) this.setData({ user: data }) })
      .catch(() => {})
  },

  editProfile() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          this.setData({ user: { ...this.data.user, nickname: res.content.trim() } })
          wx.showToast({ title: '已保存', icon: 'success' })
        }
      }
    })
  },

goMember() { wx.navigateTo({ url: '/pages/member/center/center' }) },
  goOrders() { wx.switchTab({ url: '/pages/order/list/list' }) },
  goStore() { wx.navigateTo({ url: '/pages/store/scan-timing/scan-timing' }) },
  goGallery() { wx.navigateTo({ url: '/pages/gallery/list/list' }) },
  goCashier() { wx.navigateTo({ url: '/pages/owner/cashier/cashier' }) },
  goPoints() { wx.navigateTo({ url: '/pages/member/points-log/points-log' }) },

  callService() {
    wx.makePhoneCall({ phoneNumber: '400-888-0000' })
  }
})