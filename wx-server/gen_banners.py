# -*- coding: utf-8 -*-
"""生成拼豆手工店 banner 占位图（750x300，微软雅黑中文）"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = r"C:\Users\21929\Desktop\wx-server\public\images\home"
os.makedirs(OUT, exist_ok=True)
FONT = r"C:\Windows\Fonts\msyh.ttc"

BANNERS = [
    {"name": "banner1.png", "title": "热销爆款", "sub": "拼出你的专属作品", "c1": (255, 122, 89), "c2": (255, 176, 58)},
    {"name": "banner2.png", "title": "新品上架", "sub": "新色系 · 新模板", "c1": (110, 198, 255), "c2": (155, 123, 255)},
    {"name": "banner3.png", "title": "DIY 预约", "sub": "到店体验专属优惠", "c1": (78, 205, 196), "c2": (255, 107, 129)},
]

W, H = 750, 300


def vertical_gradient(w, h, c1, c2):
    base = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / (h - 1)
        base.putpixel((0, y), tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)))
    return base.resize((w, h))


for b in BANNERS:
    img = vertical_gradient(W, H, b["c1"], b["c2"])
    d = ImageDraw.Draw(img)
    title_font = ImageFont.truetype(FONT, 72)
    sub_font = ImageFont.truetype(FONT, 34)
    # 标题文字（左侧留白 60）
    d.text((60, 92), b["title"], font=title_font, fill=(255, 255, 255))
    d.text((62, 200), b["sub"], font=sub_font, fill=(255, 255, 255))
    # 右下角装饰五角星/圆点
    d.ellipse((640, 60, 700, 120), fill=(255, 255, 255))
    d.ellipse((690, 200, 740, 250), fill=(255, 255, 255), outline=(255, 255, 255))
    img.save(os.path.join(OUT, b["name"]), "PNG")
    print("saved", os.path.join(OUT, b["name"]))