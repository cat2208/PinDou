// pages/custom/upload/upload.js 来图定制-上传图片（含拼豆图纸生成）
const app = getApp()
const { baseUrl } = require('../../../utils/config')

Page({
  data: {
    imagePath: '',
    remark: '',
    quantity: 1,
    sizeIndex: 0,
    sizes: ['25×25cm', '25×35cm', '35×35cm', '45×45cm', '75×105cm'],
    // 拼豆规格（图纸生成参数）
    beadSizeIndex: 1, // 默认 5mm（Midi 主推）
    beadSizes: ['2.6mm', '5mm', '10mm'],
    boardIndex: 0, // 默认小板 52×52
    boards: [
      { value: 'SMALL', label: '小板 52×52', grids: 52, tip: '约 2704 颗，适合头像/小图（推荐）' },
      { value: 'MIDDLE', label: '中板 78×78', grids: 78, tip: '约 6084 颗，适合常见中幅图' },
      { value: 'LARGE', label: '大板 104×104', grids: 104, tip: '约 10816 颗，适合高清大图/横幅，可用 4 块小板拼' },
      { value: 'CUSTOM', label: '自定义网格', grids: 0, tip: '任意尺寸向下兼容，不超过 128 格' }
    ],
    customW: 40, // 自定义网格宽（格）
    customH: 40, // 自定义网格高（格）
    maxColorsIndex: 1, // 默认 12 色
    maxColorsOptions: [8, 12, 16, 24],
    styleIndex: 0, // 默认卡通
    styles: ['CARTOON', 'REALISTIC'],
    styleLabels: ['卡通', '写实'],
    submitting: false
  },

  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        this.setData({ imagePath: res.tempFiles[0].tempFilePath })
      }
    })
  },

  onRemoveImage() {
    this.setData({ imagePath: '' })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  onSizeChange(e) {
    this.setData({ sizeIndex: Number(e.detail.value) })
  },

  onBeadSizeChange(e) { this.setData({ beadSizeIndex: Number(e.detail.value) }) },
  onBoardChange(e) { this.setData({ boardIndex: Number(e.detail.value) }) },
  onCustomWInput(e) { this.setData({ customW: Number(e.detail.value) || 0 }) },
  onCustomHInput(e) { this.setData({ customH: Number(e.detail.value) || 0 }) },
  onMaxColorsChange(e) { this.setData({ maxColorsIndex: Number(e.detail.value) }) },
  onStyleChange(e) { this.setData({ styleIndex: Number(e.detail.value) }) },

  changeQty(e) {
    const { delta } = e.currentTarget.dataset
    const q = this.data.quantity + delta
    if (q < 1) return
    this.setData({ quantity: q })
  },

  onNext() {
    const {
      imagePath, quantity, remark, sizeIndex, sizes,
      beadSizeIndex, beadSizes, boardIndex, boards,
      maxColorsIndex, maxColorsOptions, styleIndex, styles,
      customW, customH
    } = this.data
    if (!imagePath) {
      wx.showToast({ title: '请先上传图片', icon: 'none' })
      return
    }
    if (this.data.submitting) return
    this.setData({ submitting: true })

    const beadSize = Number(beadSizes[beadSizeIndex].replace('mm', '')) || 5
    const board = boards[boardIndex]
    const isCustom = board.value === 'CUSTOM'
    const gridWidth = isCustom ? customW : board.grids
    const gridHeight = isCustom ? customH : board.grids
    const maxColors = maxColorsOptions[maxColorsIndex]
    const style = styles[styleIndex]
    const token = wx.getStorageSync('token')
    if (isCustom && (gridWidth < 8 || gridWidth > 128 || gridHeight < 8 || gridHeight > 128)) {
      wx.showToast({ title: '自定义网格需在 8~128 格之间', icon: 'none' })
      this.setData({ submitting: false })
      return
    }

    wx.showLoading({ title: '生成拼豆图纸...' })
    const formData = { beadSize, gridWidth, gridHeight, maxColors, style }
    if (!isCustom) formData.boardType = board.value
    wx.uploadFile({
      url: `${baseUrl}/api/pattern/generate`,
      filePath: imagePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      formData,
      success: (res) => {
        let pattern = null
        try {
          const body = JSON.parse(res.data)
          if (body.code === 0 && body.data && body.data.patternId) pattern = body.data
        } catch (e) { /* 忽略解析失败 */ }
        if (pattern) {
          // 图纸生成成功：图纸数据暂存内存（colors 列表较长不走 URL）
          app.globalData.pendingPattern = pattern
          const cm = pattern.sizeCm || {}
          const query = [
            `image=${encodeURIComponent(pattern.origUrl || imagePath)}`,
            `patternId=${encodeURIComponent(pattern.patternId)}`,
            `patternUrl=${encodeURIComponent(pattern.patternUrl || '')}`,
            `qty=${quantity}`,
            `size=${encodeURIComponent(`${cm.w}×${cm.h}cm`)}`,
            `gridWidth=${pattern.gridWidth || gridWidth}`,
            `gridHeight=${pattern.gridHeight || gridWidth}`,
            `beadSize=${pattern.beadSize || beadSize}`,
            `totalBeans=${pattern.totalBeans || 0}`,
            `colorCount=${pattern.colorCount || 0}`,
            `style=${encodeURIComponent(pattern.style || style)}`,
            `remark=${encodeURIComponent(remark)}`
          ].join('&')
          wx.navigateTo({ url: `/pages/custom/preview/preview?${query}` })
        } else {
          // 图纸生成失败：降级为普通上传（客服按阶梯价人工核算）
          this.uploadPlain(imagePath, quantity, remark, sizes[sizeIndex])
        }
      },
      fail: () => {
        // 网络异常：降级为普通上传
        this.uploadPlain(imagePath, quantity, remark, sizes[sizeIndex])
      },
      complete: () => {
        wx.hideLoading()
        this.setData({ submitting: false })
      }
    })
  },

  // 降级路径：直接上传原图进入预览（不携带图纸）
  uploadPlain(imagePath, quantity, remark, size) {
    wx.showLoading({ title: '上传中...' })
    wx.uploadFile({
      url: `${baseUrl}/api/upload`,
      filePath: imagePath,
      name: 'file',
      formData: { scene: 'custom' },
      success: (res) => {
        let remoteUrl = imagePath
        try {
          const body = JSON.parse(res.data)
          if (body.code === 0 && body.data && body.data.url) remoteUrl = body.data.url
        } catch (e) { /* 忽略解析失败 */ }
        const query = [
          `image=${encodeURIComponent(remoteUrl)}`,
          `qty=${quantity}`,
          `size=${encodeURIComponent(size)}`,
          `remark=${encodeURIComponent(remark)}`
        ].join('&')
        wx.navigateTo({ url: `/pages/custom/preview/preview?${query}` })
      },
      fail: () => {
        const query = [
          `image=${encodeURIComponent(imagePath)}`,
          `qty=${quantity}`,
          `size=${encodeURIComponent(size)}`,
          `remark=${encodeURIComponent(remark)}`
        ].join('&')
        wx.navigateTo({ url: `/pages/custom/preview/preview?${query}` })
      },
      complete: () => wx.hideLoading()
    })
  }
})