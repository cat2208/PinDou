/**
 * utils/util.js 通用工具函数（仅保留实际使用项）
 */

// 金额：分 -> 元字符串（保留两位小数，去掉多余的 .00 不保留，统一保留两位）
function fen2yuan(fen) {
  const n = Number(fen || 0)
  return (n / 100).toFixed(2).replace(/\.00$/, '')
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

// 安全解码 URL 参数：畸形 % 序列或非法编码时返回原值，绝不抛错（避免 onLoad 崩溃导致页面打不开）
function safeDecode(str) {
  if (!str) return ''
  try {
    return decodeURIComponent(str)
  } catch (e) {
    try {
      return decodeURIComponent(String(str).replace(/%/g, '%25'))
    } catch (e2) {
      return str
    }
  }
}

module.exports = {
  fen2yuan,
  customStatusText,
  safeDecode
}