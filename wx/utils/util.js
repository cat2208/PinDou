/**
 * utils/util.js 通用工具函数
 */

// 时间格式化：Date|时间戳 -> "YYYY-MM-DD HH:mm:ss"
function formatTime(date, withSeconds = true) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base
}

// 日期字符串（仅日期）
function formatDate(date) {
  return formatTime(date, false).split(' ')[0]
}

// 金额：分 -> 元字符串（保留两位小数，去掉多余的 .00 不保留，统一保留两位）
function fen2yuan(fen) {
  const n = Number(fen || 0)
  return (n / 100).toFixed(2).replace(/\.00$/, '')
}

// 金额：元字符串/数字 -> 分（整数，四舍五入）
function yuan2fen(yuan) {
  return Math.round(Number(yuan || 0) * 100)
}

// 订单状态文案映射（与后端 ORDER_STATUS 保持一致）
const ORDER_STATUS = {
  pending_payment: '待付款',
  paid: '已支付',
  in_production: '制作中',
  quality_checking: '质检中',
  shipping: '已发货',
  completed: '已完成',
  refunding: '退款中',
  refunded: '已退款',
  cancelled: '已取消',
  closed: '已关闭'
}

function orderStatusText(status) {
  return ORDER_STATUS[status] || status || '未知'
}

// 定制订单状态文案
const CUSTOM_STATUS = {
  pending_quote: '待报价',
  quoted: '待支付',
  paid: '已支付',
  in_production: '制作中',
  quality_checking: '质检中',
  shipping: '已发货',
  completed: '已完成',
  refunding: '退款中',
  refunded: '已退款',
  rejected: '已驳回',
  cancelled: '已取消'
}

function customStatusText(status) {
  return CUSTOM_STATUS[status] || status || '未知'
}

// 笑脸/情绪词（占位风格）
function randomEmoji() {
  const list = ['🥳', '🎉', '✨', '🧩', '🎨', '🔥']
  return list[Math.floor(Math.random() * list.length)]
}

// 简单防抖
function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 节流
function throttle(fn, interval = 500) {
  let last = 0
  return function (...args) {
    const now = Date.now()
    if (now - last >= interval) {
      last = now
      fn.apply(this, args)
    }
  }
}

// 数组按字段分组
function groupBy(arr, key) {
  return (arr || []).reduce((acc, item) => {
    const k = item[key]
    ;(acc[k] = acc[k] || []).push(item)
    return acc
  }, {})
}

module.exports = {
  formatTime,
  formatDate,
  fen2yuan,
  yuan2fen,
  orderStatusText,
  customStatusText,
  debounce,
  throttle,
  groupBy,
  randomEmoji
}