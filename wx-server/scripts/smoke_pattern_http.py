# -*- coding: utf-8 -*-
"""拼豆图纸 HTTP 全链路冒烟测试（登录→生成→查详情→按图纸报价→下单→查订单）"""
import json, requests

BASE = 'http://127.0.0.1:3100/api'
S = requests.Session()

def show(name, r):
    print(f'===== {name} ===== status={r.status_code}')
    try:
        d = r.json()
        print(json.dumps(d, ensure_ascii=False, indent=1)[:600])
    except Exception:
        print(r.text[:300])
    return r

# 1. 登录
r = show('login', S.post(f'{BASE}/user/login', json={'code': 'smoke1'}))
token = r.json()['data']['token']
H = {'Authorization': f'Bearer {token}'}

# 2. 生成拼豆图纸（multipart）
with open(r'C:\tmp\test_pattern.png', 'rb') as f:
    r = show('pattern/generate', S.post(f'{BASE}/pattern/generate',
        headers=H,
        files={'file': ('test.png', f, 'image/png')},
        data={'beadSize': '5', 'gridWidth': '32', 'maxColors': '8', 'style': 'CARTOON'}))
if r.status_code == 200:
    pid = r.json()['data']['patternId']
    total_beans = r.json()['data']['totalBeans']
    colors = r.json()['data']['colors']
    assert pid and total_beans == 32 * 32, 'patternId/totalBeans 校验失败'
    print(f'>>> PATTERN_ID={pid} beans={total_beans} colors={len(colors)}')
    print(f'>>> colors head: {json.dumps(colors[:3], ensure_ascii=False)}')

    # 3. 按 patternId 精确报价
    show('quote-by-patternId', S.post(f'{BASE}/custom/quote',
        json={'size': '25x25cm', 'qty': 1, 'patternId': pid}))

    # 4. 创建定制订单（携带图纸）
    show('create-order', S.post(f'{BASE}/custom/orders', headers=H,
        json={'image': '/uploads/test.png', 'size': '25x25cm', 'qty': 1,
              'contact': '冒烟测试', 'phone': '13800138000',
              'patternId': pid, 'remark': 'http-smoke-v2'}))

    # 5. 查询我的定制订单（验证图纸字段入库）
    show('my-custom-orders', S.get(f'{BASE}/custom/orders', headers=H))
else:
    print('generate 失败，中止后续步骤')