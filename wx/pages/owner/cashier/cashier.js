// pages/owner/cashier/cashier.js 收银台（老板/店员端）：待收款列表、完成收款、改价、收入统计
const { request } = require('../../../utils/request')

Page({
  data: {
    logged: false,          // 是否已用店员账号登录
    logging: false,
    username: '',
    password: '',
    staffInfo: null,
    roleText: '',
    tab: 'pending',         // pending 待收款 / timing 计时中 / income 收入统计
    orders: [],             // 订单列表（pending/timing 共用）
    income: { today: { timing: 0, goods: 0, custom: 0, total: 0, orderCount: 0 }, month: {}, total: {} },
    trend: [],              // 近 7 日趋势（带 pct 条宽）
    /* 收款弹层 */
    showPay: false,
    paying: false,
    payOrder: null,
    coupons: [],
    payCouponId: 0,
    discountAmount: '',
    payMethod: 'WECHAT',
    /* 改价弹层 */
    showPrice: false,
    pricing: false,
    priceOrder: null,
    priceInput: ''
  },

  onLoad() {
    // 已有店员登录态则直接进入
    const staffToken = wx.getStorageSync('staffToken')
    const staffInfo = wx.getStorageSync('staffInfo')
    if (staffToken && staffInfo) {
      this.setData({ logged: true, staffInfo, roleText: this.roleText(staffInfo.role) })
      this.loadOrders()
    }
  },

  onPullDownRefresh() {
    this.loadOrders(() => wx.stopPullDownRefresh())
  },

  roleText(role) {
    return ({ OWNER: '老板', MANAGER: '店长', STAFF: '店员' })[role] || role || ''
  },

  /* ---------- 登录 / 退出 ---------- */

  onUsername(e) { this.setData({ username: e.detail.value }) },
  onPassword(e) { this.setData({ password: e.detail.value }) },

  doLogin() {
    const { username, password, logging } = this.data
    if (logging) return
    if (!username.trim() || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' })
      return
    }
    this.setData({ logging: true })
    request({
      url: '/api/staff/login',
      method: 'POST',
      data: { username: username.trim(), password },
      noAuth: true
    })
      .then((data) => {
        if (!data || !data.token) throw new Error('登录失败')
        const staffInfo = data.staffInfo || {}
        wx.setStorageSync('staffToken', data.token)
        wx.setStorageSync('staffInfo', staffInfo)
        this.setData({ logged: true, staffInfo, roleText: this.roleText(staffInfo.role) })
        this.loadOrders()
      })
      .catch(() => {})
      .finally(() => this.setData({ logging: false, password: '' }))
  },

  logout() {
    wx.removeStorageSync('staffToken')
    wx.removeStorageSync('staffInfo')
    this.setData({ logged: false, staffInfo: null, orders: [], tab: 'pending' })
    wx.showToast({ title: '已退出登录', icon: 'none' })
  },

  /* ---------- Tab 切换 ---------- */

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    if (tab === 'income') this.loadIncome()
    else this.loadOrders()
  },

  /* ---------- 数据加载 ---------- */

  loadOrders(done) {
    const status = this.data.tab === 'pending' ? 'PENDING' : 'TIMING'
    request({ url: '/api/admin/ops/cashier/orders', data: { status }, silent: true, staff: true })
      .then((data) => {
        this.setData({ orders: (data && data.list) || [] })
        if (done) done()
      })
      .catch(() => { if (done) done() })
  },

  loadIncome() {
    request({ url: '/api/admin/ops/cashier/income', silent: true, staff: true })
      .then((data) => {
        if (!data) return
        const def = { timing: 0, goods: 0, custom: 0, total: 0, orderCount: 0 }
        const income = {
          today: { ...def, ...(data.today || {}) },
          month: { ...def, ...(data.month || {}) },
          total: { ...def, ...(data.total || {}) }
        }
        const rawTrend = data.trend || []
        let max = 0
        rawTrend.forEach((t) => { if (t.amount > max) max = t.amount })
        const trend = rawTrend.map((t) => ({ ...t, pct: max > 0 ? Math.max(4, Math.round((t.amount / max) * 100)) : 0 }))
        this.setData({ income, trend })
      })
      .catch(() => {})
  },

  /* ---------- 收款 ---------- */

  openPay(e) {
    const order = this.data.orders.find((o) => o.orderId === Number(e.currentTarget.dataset.id))
    if (!order) return
    this.setData({ showPay: true, payOrder: order, payCouponId: 0, discountAmount: '', payMethod: 'WECHAT', coupons: [] })
    request({ url: '/api/admin/ops/cashier/coupons', silent: true, staff: true })
      .then((data) => this.setData({ coupons: (data && data.list) || [] }))
      .catch(() => {})
  },

  closePay() {
    if (this.data.paying) return
    this.setData({ showPay: false })
  },

  selectCoupon(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ payCouponId: this.data.payCouponId === id ? 0 : id })
  },

  onDiscount(e) { this.setData({ discountAmount: e.detail.value }) },

  selectMethod(e) { this.setData({ payMethod: e.currentTarget.dataset.m }) },

  confirmPay() {
    const { payOrder, payCouponId, discountAmount, payMethod, paying } = this.data
    if (!payOrder || paying) return
    const discount = parseFloat(discountAmount) || 0
    if (!payCouponId && discount < 0) {
      wx.showToast({ title: '优惠金额不能为负', icon: 'none' })
      return
    }
    if (!payCouponId && discount > payOrder.totalFee) {
      wx.showToast({ title: '优惠金额不能超过订单金额', icon: 'none' })
      return
    }
    this.setData({ paying: true })
    request({
      url: `/api/admin/ops/cashier/${payOrder.orderId}/pay`,
      method: 'POST',
      data: {
        couponId: payCouponId || undefined,
        discountAmount: payCouponId ? 0 : discount,
        payMethod
      },
      staff: true
    })
      .then((data) => {
        wx.showToast({ title: (data && data.message) || '收款完成', icon: 'success' })
        this.setData({ showPay: false })
        this.loadOrders()
      })
      .catch(() => {})
      .finally(() => this.setData({ paying: false }))
  },

  /* ---------- 改价 ---------- */

  openPrice(e) {
    const order = this.data.orders.find((o) => o.orderId === Number(e.currentTarget.dataset.id))
    if (!order) return
    this.setData({ showPrice: true, priceOrder: order, priceInput: String(order.totalFee) })
  },

  closePrice() {
    if (this.data.pricing) return
    this.setData({ showPrice: false })
  },

  onPriceInput(e) { this.setData({ priceInput: e.detail.value }) },

  confirmPrice() {
    const { priceOrder, priceInput, pricing } = this.data
    if (!priceOrder || pricing) return
    const fee = parseFloat(priceInput)
    if (isNaN(fee) || fee < 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    this.setData({ pricing: true })
    request({
      url: `/api/admin/ops/cashier/${priceOrder.orderId}/price`,
      method: 'PUT',
      data: { totalFee: fee },
      staff: true
    })
      .then((data) => {
        wx.showToast({ title: (data && data.message) || '价格已更新', icon: 'success' })
        this.setData({ showPrice: false })
        this.loadOrders()
      })
      .catch(() => {})
      .finally(() => this.setData({ pricing: false }))
  },

  noop() {}
})