import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Inventory } from '../../entities/content.entity';
import { AccessoryOrder, PaymentRecord } from '../../entities/system.entity';
import { User } from '../../entities/user.entity';
import { JwtUser } from '../../common/auth.guard';
import { genNo, fmtTime } from '../../common/utils';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Inventory) private readonly invRepo: Repository<Inventory>,
    @InjectRepository(AccessoryOrder) private readonly aoRepo: Repository<AccessoryOrder>,
    @InjectRepository(PaymentRecord) private readonly payRepo: Repository<PaymentRecord>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /** GET /api/products?category= 成品/材料/配件列表 */
  async products(category?: string) {
    const where: any = { enabled: 1 };
    if (category && category !== 'ALL') {
      const map: Record<string, string> = { finished: 'FINISHED', material: 'MATERIAL', accessory: 'ACCESSORY' };
      where.category = map[category.toLowerCase()] || category.toUpperCase();
    }
    const rows = await this.productRepo.find({ where, order: { id: 'DESC' } });
    return {
      list: rows.map((p) => this.toProductListItem(p)),
    };
  }

  /** GET /api/products/:id 商品详情 */
  async productDetail(id: number) {
    const p = await this.productRepo.findOne({ where: { id } });
    if (!p || !p.enabled) throw new Error('商品不存在');
    return {
      id: p.id,
      sku: p.sku,
      name: p.title,
      category: p.category,
      categoryText: { FINISHED: '成品', MATERIAL: '材料包', ACCESSORY: '配件' }[p.category] || p.category,
      price: Number(p.price),
      priceText: `¥${Number(p.price).toFixed(2)}`,
      stock: p.stock,
      sales: 0,
      beanCount: p.bean_count ?? null,
      coverImage: p.cover,
      gallery: p.images || [],
      desc: p.description || '',
      specs: p.tags
        ? p.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .map((v) => ({ name: '规格', values: [v] }))
        : [],
    };
  }

  /**
   * POST /api/orders 商城下单 { mode:'mall'|'custom', items:[{productId,qty}], amountFen }
   * 沙箱模式：直接创建 accessory_order(scene=MALL) 并标记已支付。
   */
  async createOrder(uid: number, body: { mode?: string; items?: Array<{ productId: number; qty?: number }>; amountFen?: number }) {
    const items = (body?.items || []).filter((i) => i && i.productId);
    if (!items.length) throw new Error('购物车不能为空');

    // 逐项校验商品与库存
    const detailItems: any[] = [];
    let total = 0;
    for (const it of items) {
      const p = await this.productRepo.findOne({ where: { id: Number(it.productId) } });
      if (!p || !p.enabled) throw new Error('部分商品已下架，请刷新后再试');
      const qty = Math.max(1, Number(it.qty) || 1);
      if (p.stock < qty) throw new Error(`「${p.title}」库存不足`);
      total += Number(p.price) * qty;
      detailItems.push({ productId: p.id, sku: p.sku, name: p.title, cover: p.cover, price: Number(p.price), priceText: `¥${Number(p.price).toFixed(2)}`, qty, amount: Number((Number(p.price) * qty).toFixed(2)) });
    }
    const totalAmount = Math.round(total * 100) / 100;

    // 扣减库存
    for (const it of items) {
      const p = await this.productRepo.findOne({ where: { id: Number(it.productId) } });
      if (p) {
        p.stock = Math.max(0, p.stock - (Number(it.qty) || 1));
        await this.productRepo.save(p);
      }
    }

    const order = this.aoRepo.create({
      order_no: genNo('MM'), // mall
      user_id: uid,
      scene: 'MALL',
      items_json: detailItems,
      total_price: String(totalAmount),
      points_deduct: '0',
      member_discount: '0',
      pay_status: 'PAID',
      status: 'PAID',
    });
    const saved = await this.aoRepo.save(order);

    await this.payRepo.save(
      this.payRepo.create({
        out_trade_no: 'PAY' + saved.order_no,
        biz_type: 'MALL',
        biz_id: saved.id,
        user_id: uid,
        amount: String(totalAmount),
        status: 'PAID',
        paid_at: new Date(),
      }),
    );

    return {
      id: saved.id,
      orderNo: saved.order_no,
      status: 'PAID',
      amount: totalAmount,
      amountText: `¥${totalAmount.toFixed(2)}`,
      items: detailItems.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
      message: '下单成功（演示环境已自动支付）',
    };
  }

  private toProductListItem(p: Product): any {
    return {
      id: p.id,
      sku: p.sku,
      name: p.title,
      category: p.category,
      categoryText: { FINISHED: '成品', MATERIAL: '材料包', ACCESSORY: '配件' }[p.category] || p.category,
      price: Number(p.price),
      priceText: `¥${Number(p.price).toFixed(2)}`,
      stock: p.stock,
      sales: 0,
      coverImage: p.cover,
      beanCount: p.bean_count ?? null,
      tags: p.tags || '',
    };
  }
}