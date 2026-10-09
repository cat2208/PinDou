// pages/member/points-log/points-log.js 积分明细
const { request } = require('../../../utils/request')

const MOCK_LOGS = [
  { id: 1, desc: '订单消费 +128 积分', change: '+128', time: '2026-10-05 16:20', type: 'in' },
  { id: 2, desc: '签到奖励', change: '+5', time: '2026-10-04 09:00', type: 'in' },
  { id: 3, desc: '兑换 5 元优惠券', change: '-200', time: '2026-10-01 12:30', type: 'out' },
  { id: 4, desc: '晒图获得点赞奖励', change: '+50', time: '2026-09-28 20:11', type: 'in' }
]

Page({
  data: { logs: [], loading: true },

  onLoad() { this.fetchLogs() },

  fetchLogs() {
    request({ url: '/api/member/points', silent: true })
      .then((data) => this.setData({ logs: (data && data.list) || MOCK_LOGS, loading: false }))
      .catch(() => this.setData({ logs: MOCK_LOGS, loading: false }))
  }
})