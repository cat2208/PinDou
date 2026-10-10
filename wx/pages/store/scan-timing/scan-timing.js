// pages/store/scan-timing/scan-timing.js 座位扫码开台·时间套餐·本桌计时·配件加购
const { request } = require('../../../utils/request')

const POLL_INTERVAL = 30000 // 与服务端校准的轮询间隔(ms)
const TICK_INTERVAL = 1000   // 本地秒表刷新间隔(ms)

Page({
  data: {
    step: 'pick',            // pick 选座选套餐 / timing 计时中 / ended 已结束待结账
    packages: [],            // 套餐列表
    packageIndex: 0,         // 当前选中套餐下标
    seats: [],               // 可用座位列表
    seatInput: '',           // 手动输入座位号
    seatToken: '',           // 扫码得到的座位 token
    seatDisplay: '',         // 已识别座位展示名
    loading: false,
    session: null,           // 本桌会话详情
    accessories: [],         // 可加购配件
    accessoryQty: {},        // 配件加购数量 { productId: qty }
    elapsed: '00:00',        // 正计时 mm:ss
    remainText: '',          // 剩余/超时提示文案
    remainState: 'normal',   // normal 套餐内 / warn 即将超时 / overtime 已超时
    estTimingFee: '',        // 实时预估计时费
    polling: false
  },

  onLoad(options) {
    // 支持扫码落地页携带 ?seat=token 或 ?seatNo=A01
    const q = options || {}
    const seatToken = (q.seat || q.token || q.seatToken || '').trim()
    const seatNo = (q.seatNo || '').trim()
    if (seatToken || seatNo) {
      this.setData({
        seatToken,
        seatInput: seatNo,
        seatDisplay: seatNo || '已识别座位二维码'
      })
    }
    this.loadPackages()
    this.loadSeats()
  },

  onShow() {
    // 已有会话回到页面（扫码进入开台后跳转回来）时恢复计时轮询
    if (this.data.step === 'timing' && this.data.session) {
      this.clearTimers()
      this.startLocalTick()
      this.pollSession(true)
    }
  },

  onUnload() { this.clearTimers() },
  onHide() { this.clearTimers() },

  clearTimers() {
    if (this._tick) { clearInterval(this._tick); this._tick = null }
    if (this._poll) { clearInterval(this._poll); this._poll = null }
    this.setData({ polling: false })
  },

  startLocalTick() {
    const { startAt } = this.data.session || {}
    this._startTs = startAt ? new Date(startAt.replace(/-/g, '/')).getTime() : Date.now()
    this._tick = setInterval(() => this.tickOnce(), TICK_INTERVAL)
    this._poll = setInterval(() => this.pollSession(true), POLL_INTERVAL)
    this.tickOnce()
  },

  /** 本地秒表与剩余时间推算（费用精确值以服务端轮询为准） */
  tickOnce() {
    const s = this.data.session
    if (!s || s.status !== 'TIMING') return
    const minutes = Math.max(0, Math.floor((Date.now() - this._startTs) / 60000))
    const seconds = Math.max(0, Math.floor((Date.now() - this._startTs) / 1000) % 60)
    const elapsed = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

    let remainState = 'normal'
    let remainText = ''
    if (s.packageMinutes != null) {
      const remain = Math.max(0, s.packageMinutes - minutes)
      if (remain <= 0) {
        remainState = 'overtime'
        remainText = `已超时 ${minutes - s.packageMinutes} 分钟，按超时单价计费`
      } else if (remain <= 5) {
        remainState = 'warn'
        remainText = `套餐剩余 ${remain} 分钟`
      } else {
        remainText = `套餐剩余 ${remain} 分钟`
      }
    } else {
      remainText = '按实际用时计费'
    }

    // 金额/剩余时间以分钟级变化为主，秒级只更新计时（reduce 每秒 setData 体积与渲染压力）
    const patch = { elapsed }
    if (remainText !== this.data.remainText) patch.remainText = remainText
    if (remainState !== this.data.remainState) patch.remainState = remainState
    if (Math.floor(Date.now() / 1000) % 5 === 0) {
      const fee = this.calcLocalTimingFee(minutes, s)
      const feeText = `¥${fee.toFixed(2)}`
      if (feeText !== this.data.estTimingFee) patch.estTimingFee = feeText
    }
    this.setData(patch)
  },

  /** 与后端 calcTimingFee 一致：套餐内套餐价；超时按小时单价补差价 */
  calcLocalTimingFee(minutes, s) {
    if (!s) return 0
    const base = Number(s.packageId ? (this.data.packages.find(p => p.id === s.packageId) || {}).price : 0) || 0
    const pkg = this.data.packages.find(p => p.id === s.packageId) || null
    if (!pkg) return Number(((minutes / 60) * 10).toFixed(2))
    if (pkg.type === 'ALL_DAY') return Number(base.toFixed(2))
    if (!pkg.durationMinutes) return Number(((minutes / 60) * (pkg.hourlyUnitPrice || 10)).toFixed(2))
    if (minutes <= pkg.durationMinutes) return Number(base.toFixed(2))
    const extra = minutes - pkg.durationMinutes
    return Number((base + (extra / 60) * (pkg.hourlyUnitPrice || 10)).toFixed(2))
  },

  /* ---------- 数据加载 ---------- */

  loadPackages() {
    return request({ url: '/api/store/packages', method: 'GET', silent: true, noAuth: true })
      .then((data) => {
        const list = (data && data.list) || []
        this.setData({ packages: list, packageIndex: list.length ? 0 : -1 })
      })
      .catch(() => this.setData({ packages: [] }))
  },

  loadSeats() {
    return request({ url: '/api/store/seats', method: 'GET', data: { available: 1 }, silent: true, noAuth: true })
      .then((data) => this.setData({ seats: (data && data.list) || [] }))
      .catch(() => this.setData({ seats: [] }))
  },

  loadAccessories() {
    if (this.data.accessories.length) return Promise.resolve()
    return request({ url: '/api/products', method: 'GET', data: { category: 'accessory' }, silent: true, noAuth: true })
      .then((data) => this.setData({ accessories: (data && data.list) || [] }))
      .catch(() => this.setData({ accessories: [] }))
  },

  /* ---------- 选座位 ---------- */

  onSeatInput(e) {
    this.setData({ seatInput: e.detail.value.trim().toUpperCase(), seatToken: '' })
  },

  scanSeat() {
    wx.scanCode({
      success: (res) => {
        const raw = (res.result || '').trim()
        // 二维码内容兼容：纯token / "seat=tok-A01" / 完整URL含token参数，后端 resolveSeat 统一解析
        this.setData({ seatToken: raw, seatDisplay: '已识别座位二维码' })
        wx.showToast({ title: '已识别，请选套餐', icon: 'success' })
      },
      fail: () => wx.showToast({ title: '未识别到二维码，可手动输入座位号', icon: 'none' })
    })
  },

  quickFillSeat(e) {
    const { seatno } = e.currentTarget.dataset
    this.setData({ seatInput: seatno, seatToken: '' })
  },

  /* ---------- 套餐选择 ---------- */

  onPackageTap(e) {
    this.setData({ packageIndex: Number(e.currentTarget.dataset.index) })
  },

  /* ---------- 开台 ---------- */

  start() {
    const { seatInput, seatToken, packages, packageIndex, loading } = this.data
    if (loading) return
    if (!seatInput && !seatToken) {
      wx.showToast({ title: '请扫码或输入座位号', icon: 'none' })
      return
    }
    if (!packages.length) {
      wx.showToast({ title: '套餐加载中，请稍候', icon: 'none' })
      return
    }
    const pkg = packages[packageIndex]
    const data = { seatNo: seatInput || undefined, seatToken: seatToken || undefined, packageId: pkg ? pkg.id : undefined }

    this.setData({ loading: true })
    request({ url: '/api/store/sessions', method: 'POST', data })
      .then((session) => this.enterSession(session))
      .catch(() => {})
      .finally(() => this.setData({ loading: false }))
  },

  /** 开台/续台成功 → 进入计时视图 */
  enterSession(session) {
    if (!session || !session.orderId) return
    const pkgName = session.packageName || '计时体验'
    const seatName = session.seatNo || this.data.seatDisplay || '本桌'
    wx.showToast({ title: session.message || `${seatName} 开台成功`, icon: 'none' })

    this.setData({
      step: 'timing',
      session,
      seatDisplay: seatName,
      remainState: 'normal',
      remainText: ''
    })
    this.clearTimers()
    this.startLocalTick()
    this.pollSession(true)
    if (session.occupied || session.status === 'TIMING') {
      wx.setNavigationBarTitle({ title: `${seatName} · 计时中` })
    }
  },

  /** 轮询服务端校准：金额/剩余/超时/状态 */
  pollSession(silent) {
    const s = this.data.session
    if (!s || !s.orderId || this.data.polling) return
    this.setData({ polling: true })
    request({ url: `/api/store/sessions/${s.orderId}`, method: 'GET', silent: !!silent })
      .then((fresh) => {
        if (!fresh || !fresh.orderId) return
        if (fresh.status !== 'TIMING') {
          // 服务端已结束（老板端结束等）→ 定格账单
          this.clearTimers()
          this.setData({ step: 'ended', session: fresh })
          return
        }
        // 校准 startTs：避免本地推算与服务端漂移
        if (fresh.elapsedMinutes) {
          const now = Date.now()
          this._startTs = now - fresh.elapsedMinutes * 60000
        }
        this.setData({
          session: fresh,
          estTimingFee: fresh.timingFeeText || this.data.estTimingFee
        })
        this.tickOnce()
      })
      .catch(() => {})
      .finally(() => this.setData({ polling: false }))
  },

  /* ---------- 配件加购 ---------- */

  toggleAccessoryPanel() {
    if (this.data.accessories.length) {
      this.setData({ showAccessory: !this.data.showAccessory })
      return
    }
    this.loadAccessories().then(() => this.setData({ showAccessory: true }))
  },

  qtyChange(e) {
    const { id } = e.currentTarget.dataset
    const { type } = e.currentTarget.dataset
    const cur = this.data.accessoryQty[id] || 1
    const next = type === 'inc' ? cur + 1 : Math.max(1, cur - 1)
    this.setData({ [`accessoryQty.${id}`]: next })
  },

  addAccessory(e) {
    const { id } = e.currentTarget.dataset
    const s = this.data.session
    if (!s || !s.orderId) return
    const qty = this.data.accessoryQty[id] || 1
    wx.showLoading({ title: '加入账单' })
    request({
      url: `/api/store/sessions/${s.orderId}/accessories`,
      method: 'POST',
      data: { items: [{ productId: id, qty }] }
    })
      .then((res) => {
        wx.hideLoading()
        wx.showToast({ title: res.message || '已加入本桌账单', icon: 'success' })
        this.setData({
          session: { ...this.data.session, ...res, items: res.items || this.data.session.items }
        })
        // 清掉已加购数量
        if (this.data.accessoryQty[id]) {
          this.setData({ [`accessoryQty.${id}`]: 0 })
        }
        this.pollSession(true)
      })
      .catch(() => wx.hideLoading())
  },

  /* ---------- 结束计时 ---------- */

  endTiming() {
    const s = this.data.session
    if (!s || !s.orderId) return
    wx.showModal({
      title: '结束计时',
      content: `确认结束计时并生成账单？\n当前预估：${this.data.estTimingFee || s.timingFeeText || ''}`,
      confirmText: '结束计时',
      success: (r) => {
        if (!r.confirm) return
        wx.showLoading({ title: '结算中' })
        request({ url: `/api/store/sessions/${s.orderId}/end`, method: 'POST' })
          .then((res) => {
            wx.hideLoading()
            this.clearTimers()
            const fresh = { ...(this.data.session), ...res }
            this.setData({ step: 'ended', session: fresh })
            wx.setNavigationBarTitle({ title: '本桌账单' })
            wx.showToast({ title: res.message || '已结束计时', icon: 'none' })
          })
          .catch(() => wx.hideLoading())
      }
    })
  },

  /* ---------- 再来一桌 ---------- */

  restart() {
    this.clearTimers()
    this.setData({
      step: 'pick',
      session: null,
      seatInput: '',
      seatToken: '',
      seatDisplay: '',
      elapsed: '00:00',
      remainText: '',
      remainState: 'normal',
      estTimingFee: '',
      accessoryQty: {},
      showAccessory: false
    })
    wx.setNavigationBarTitle({ title: '扫码开台' })
    this.loadSeats()
    this.loadPackages()
  }
})