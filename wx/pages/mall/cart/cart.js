// pages/mall/cart/cart.js 购物车
Page({
  data: {
    items: [],
    allChecked: false,
    selectedCount: 0,
    totalPrice: 0
  },

  onShow() {
    this.loadCart()
  },

  loadCart() {
    const items = (wx.getStorageSync('cart') || []).map(i => ({ ...i, checked: true }))
    this.setData({ items })
    this.calc()
  },

  calc() {
    const { items } = this.data
    const checked = items.filter(i => i.checked)
    const totalPrice = checked.reduce((s, i) => s + i.price * i.qty, 0)
    this.setData({
      allChecked: items.length > 0 && checked.length === items.length,
      selectedCount: checked.length,
      totalPrice: +totalPrice.toFixed(2)
    })
  },

  toggleItem(e) {
    const { index } = e.currentTarget.dataset
    const key = `items[${index}].checked`
    this.setData({ [key]: !this.data.items[index].checked }, () => this.calc())
  },

  toggleAll() {
    const all = !this.data.allChecked
    this.setData({
      items: this.data.items.map(i => ({ ...i, checked: all })),
      allChecked: all
    }, () => this.calc())
  },

  changeQty(e) {
    const { index, delta } = e.currentTarget.dataset
    const items = this.data.items
    const qty = items[index].qty + delta
    if (qty < 1) return
    items[index].qty = qty
    this.setData({ items }, () => this.calc())
    this.save()
  },

  removeItem(e) {
    const { index } = e.currentTarget.dataset
    const { items } = this.data
    wx.showModal({
      title: '移除商品',
      content: '确定将该商品移出购物车吗？',
      success: (res) => {
        if (res.confirm) {
          items.splice(index, 1)
          this.setData({ items }, () => this.calc())
          this.save()
        }
      }
    })
  },

  save() {
    wx.setStorageSync('cart', this.data.items.map(({ checked, ...rest }) => rest))
  },

  goMall() {
    wx.switchTab({ url: '/pages/mall/list/list' })
  },

  checkout() {
    const { items } = this.data
    const checked = items.filter(i => i.checked)
    if (!checked.length) {
      wx.showToast({ title: '请先选择商品', icon: 'none' })
      return
    }
    // 将勾选商品写入结算会话存储
    wx.setStorageSync('checkoutItems', checked)
    wx.navigateTo({ url: '/pages/mall/checkout/checkout' })
  }
})