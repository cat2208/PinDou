// pages/custom/preview/preview.js 来图定制-预览报价（拼豆图纸/配额清单）
const { request } = require('../../../utils/request')
const { baseUrl } = require('../../../utils/config')
const { safeDecode } = require('../../../utils/util')

// 尺寸参考价（元/件），图纸生成失败时回退阶梯价
const SIZE_PRICE = {
  '25×25cm': 39,
  '25×35cm': 49,
  '35×35cm': 59,
  '45×45cm': 79,
  '75×105cm': 139
}

// 相对图片路径补全为可加载地址
function absUrl(p) {
  if (!p) return ''
  if (/^https?:\/\//.test(p) || p.indexOf('wxfile://') === 0 || p.indexOf('http://tmp') === 0) return p
  if (p.indexOf('/') === 0 && p.indexOf('//') !== 0) return baseUrl + p
  return p
}

Page({
  data: {
    baseUrl,
    image: '',
    // 拼豆图纸
    patternId: '',
    pattern: null, // { patternUrl, gridWidth, gridHeight, beadSize, totalBeans, colorCount, style }
    colors: [], // [{ code, hex, count, packs }]
    colorsExpanded: false,
    qty: 1,
    size: '25×25cm',
    remark: '',
    // 报价结果
    unitPrice: 0,
    totalPrice: 0,
    deliveryDay: 3,
    quoting: false,
    quoteSource: 'local', // 'server' | 'local'
    saving: false
  },

  onLoad(query) {
    query = query || {}
    const size = safeDecode(query.size || '25×25cm')
    const patternId = safeDecode(query.patternId)
    const pattern = {
      patternId,
      patternUrl: safeDecode(query.patternUrl),
      gridWidth: Number(query.gridWidth) || 0,
      gridHeight: Number(query.gridHeight) || 0,
      beadSize: Number(query.beadSize) || 0,
      totalBeans: Number(query.totalBeans) || 0,
      colorCount: Number(query.colorCount) || 0,
      style: safeDecode(query.style)
    }
    this.setData({
      image: absUrl(safeDecode(query.image)),
      patternId,
      pattern,
      qty: Number(query.qty) || 1,
      size,
      remark: safeDecode(query.remark),
      unitPrice: SIZE_PRICE[size] || 39
    })
    if (patternId) {
      // 优先取内存中的图纸（upload 页写入），缺失则回源接口
      const pending = getApp().globalData.pendingPattern
      const colors = (pending && pending.patternId === patternId && Array.isArray(pending.colors))
        ? pending.colors
        : []
      this.setData({ colors })
      if (!colors.length) this.fetchPatternDetail(patternId)
    }
    this.calcTotal()
    this.fetchQuote()
  },

  // 图纸详情回源（colors 清单解析）
  fetchPatternDetail(patternId) {
    request({ url: `/api/pattern/${patternId}`, method: 'GET', silent: true })
      .then((data) => {
        const p = this.data.pattern || {}
        this.setData({
          colors: Array.isArray(data.colors) ? data.colors : [],
          pattern: {
            ...p,
            patternUrl: data.patternUrl || p.patternUrl,
            gridWidth: data.gridWidth || p.gridWidth,
            gridHeight: data.gridHeight || p.gridHeight,
            beadSize: data.beadSize || p.beadSize,
            totalBeans: data.totalBeans || p.totalBeans,
            colorCount: data.colorCount || p.colorCount,
            style: data.style || p.style
          }
        })
        // 图纸字段补齐后按真实豆数重新报价
        if (data.totalBeans) this.fetchQuote()
      })
      .catch(() => {})
  },

  // 请求后端 AI 报价（带 patternId 时按图纸精确报价）
  fetchQuote() {
    this.setData({ quoting: true })
    const data = { size: this.data.size, qty: this.data.qty }
    if (this.data.patternId) data.patternId = this.data.patternId
    request({
      url: '/api/custom/quote',
      method: 'POST',
      data,
      silent: true
    }).then((res) => {
      if (res && res.unitPrice) {
        this.setData({
          unitPrice: res.unitPrice,
          deliveryDay: res.deliveryDay || 3,
          quoteSource: 'server',
          pattern: res.pattern
            ? { ...this.data.pattern, totalBeans: res.pattern.totalBeans || this.data.pattern.totalBeans }
            : this.data.pattern
        })
        this.calcTotal()
      }
    }).catch(() => {}).finally(() => this.setData({ quoting: false }))
  },

  calcTotal() {
    this.setData({ totalPrice: +(this.data.unitPrice * this.data.qty).toFixed(2) })
  },

  changeQty(e) {
    const { delta } = e.currentTarget.dataset
    const qty = this.data.qty + delta
    if (qty < 1) return
    this.setData({ qty }, () => {
      this.calcTotal()
      this.fetchQuote()
    })
  },

  onReQuote() {
    this.fetchQuote()
  },

  onToggleColors() {
    this.setData({ colorsExpanded: !this.data.colorsExpanded })
  },

  // 图片加载失败时替换为占位图
  onImgError(e) {
    this.setData({ image: '/assets/img-placeholder.png' })
  },

  // 保存拼豆图纸到相册：透明 PNG 先合成白底（直接存相册会显示黑底），再保存
  onSavePattern() {
    const { pattern, saving } = this.data
    const url = absUrl(pattern && pattern.patternUrl)
    if (!url) {
      wx.showToast({ title: '暂无图纸可保存', icon: 'none' })
      return
    }
    if (saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '正在生成图片...' })
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200) {
          this.saveFail('图纸下载失败')
          return
        }
        this.composeAndSave(res.tempFilePath)
      },
      fail: () => this.saveFail('图纸下载失败')
    })
  },

  // 下载完成后：读取图片尺寸 → 合成白底
  composeAndSave(tempFilePath) {
    wx.getImageInfo({
      src: tempFilePath,
      success: (info) => {
        let { width, height } = info
        // 超大图纸等比缩到画布上限，保证清晰且不超 canvas 限制
        const MAX = 2048
        const scale = Math.min(1, MAX / Math.max(width, height))
        width = Math.round(width * scale)
        height = Math.round(height * scale)
        this.drawWhiteCanvas(tempFilePath, width, height)
      },
      fail: () => this.saveToAlbum(tempFilePath)
    })
  },

  // 用离屏 canvas 2d 绘制白底 + 图纸
  drawWhiteCanvas(src, width, height) {
    wx.createSelectorQuery()
      .select('#patternExportCanvas')
      .fields({ node: true })
      .exec((res) => {
        const canvas = res && res[0] && res[0].node
        if (!canvas) {
          // 无 canvas 环境时降级直接保存（透明底）
          this.saveToAlbum(src)
          return
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        const img = canvas.createImage()
        img.onload = () => {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          wx.canvasToTempFilePath({
            canvas,
            x: 0, y: 0,
            width,
            height,
            destWidth: width,
            destHeight: height,
            fileType: 'png',
            success: (r) => this.saveToAlbum(r.tempFilePath),
            fail: () => this.saveToAlbum(src)
          })
        }
        img.onerror = () => this.saveToAlbum(src)
        img.src = src
      })
  },

  // 保存到相册 + 授权失败引导
  saveToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        wx.hideLoading()
        this.setData({ saving: false })
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      },
      fail: (err) => {
        wx.hideLoading()
        this.setData({ saving: false })
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('auth') > -1 || msg.indexOf('deny') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许「保存到相册」权限',
            confirmText: '去设置',
            success: (m) => { if (m.confirm) wx.openSetting() }
          })
        } else {
          wx.showToast({ title: '保存失败，请重试', icon: 'none' })
        }
      }
    })
  },

  // 失败统一处理
  saveFail(title) {
    wx.hideLoading()
    this.setData({ saving: false })
    wx.showToast({ title, icon: 'none' })
  },

  onConfirm() {
    const { image, qty, size, remark, unitPrice, totalPrice, deliveryDay, patternId, pattern } = this.data
    const query = [
      `image=${encodeURIComponent(image)}`,
      `qty=${qty}`,
      `size=${encodeURIComponent(size)}`,
      `remark=${encodeURIComponent(remark)}`,
      `unitPrice=${unitPrice}`,
      `totalPrice=${totalPrice}`,
      `deliveryDay=${deliveryDay}`
    ]
    if (patternId) {
      query.push(
        `patternId=${encodeURIComponent(patternId)}`,
        `patternUrl=${encodeURIComponent(pattern.patternUrl || '')}`,
        `gridWidth=${pattern.gridWidth || 0}`,
        `gridHeight=${pattern.gridHeight || 0}`,
        `beadSize=${pattern.beadSize || 0}`,
        `totalBeans=${pattern.totalBeans || 0}`,
        `colorCount=${pattern.colorCount || 0}`,
        `style=${encodeURIComponent(pattern.style || '')}`
      )
    }
    wx.navigateTo({ url: `/pages/custom/confirm/confirm?${query.join('&')}` })
  }
})