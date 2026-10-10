import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Inventory } from '../../entities/content.entity';
import { PricingConfig } from '../../entities/shop.entity';
import { AccessoryOrder, PaymentRecord } from '../../entities/system.entity';
import { User } from '../../entities/user.entity';
import { JwtUser } from '../../common/auth.guard';
import { genNo, fmtTime } from '../../common/utils';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Inventory) private readonly invRepo: Repository<Inventory>,
    @InjectRepository(PricingConfig) private readonly pricingRepo: Repository<PricingConfig>,
    @InjectRepository(AccessoryOrder) private readonly aoRepo: Repository<AccessoryOrder>,
    @InjectRepository(PaymentRecord) private readonly payRepo: Repository<PaymentRecord>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /** GET /api/products?category= 商城商品列表：category 直接按中文业务品类（subcategory）过滤 */
  async products(category?: string) {
    const where: any = { enabled: 1 };
    if (category && category !== '全部' && category !== 'ALL') {
      where.subcategory = category;
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
    const cat = p.subcategory || { FINISHED: '成品', MATERIAL: '材料包', ACCESSORY: '配件' }[p.category] || '其他';
    return {
      id: p.id,
      name: p.title,
      category: cat,
      categoryText: cat,
      price: Number(p.price),
      priceText: `¥${Number(p.price).toFixed(2)}`,
      stock: p.stock,
      sales: 0,
      beanCount: p.bean_count ?? null,
      coverImage: p.cover,
      gallery: p.images || [],
      desc: p.description || '',
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
      const cat = p.subcategory || { FINISHED: '成品', MATERIAL: '材料包', ACCESSORY: '配件' }[p.category] || '其他';
      detailItems.push({ productId: p.id, sku: p.sku, name: p.title, cover: p.cover, price: Number(p.price), priceText: `¥${Number(p.price).toFixed(2)}`, category: cat, qty, amount: Number((Number(p.price) * qty).toFixed(2)) });
    }
    const subtotal = Math.round(total * 100) / 100;

    // 运费：按订单商品业务品类取最高档运费；订单金额达到免运费门槛则包邮
    const shipPlan = await this.pricingRepo.findOne({ where: {} });
    const shipMap: Record<string, number> =
      shipPlan && shipPlan.shipping_by_category && typeof shipPlan.shipping_by_category === 'object'
        ? shipPlan.shipping_by_category
        : {};
    const freeLimit = Number(shipPlan?.free_shipping_threshold ?? 0);
    const fallbackFee = Number(shipPlan?.shipping_fee ?? 0);
    let freight = 0;
    if (!(freeLimit > 0 && subtotal >= freeLimit)) {
      const fees = detailItems.map((i) => shipMap[i.category] ?? fallbackFee);
      freight = fees.length ? Math.max(...fees) : 0;
    }

    // 扣减库存
    for (const it of items) {
      const p = await this.productRepo.findOne({ where: { id: Number(it.productId) } });
      if (p) {
        p.stock = Math.max(0, p.stock - (Number(it.qty) || 1));
        await this.productRepo.save(p);
      }
    }

    const totalAmount = Math.round((subtotal + freight) * 100) / 100;

    const order = this.aoRepo.create({
      order_no: genNo('MM'), // mall
      user_id: uid,
      scene: 'MALL',
      items_json: detailItems,
      total_price: String(totalAmount),
      price_shipping: String(freight),
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
      subtotal: subtotal,
      freight: freight,
      amount: totalAmount,
      amountText: `¥${totalAmount.toFixed(2)}`,
      items: detailItems.map((i) => ({ name: i.name, qty: i.qty, price: i.price, category: i.category })),
      message: '下单成功（演示环境已自动支付）',
    };
  }

  private toProductListItem(p: Product): any {
    const cat = p.subcategory || { FINISHED: '成品', MATERIAL: '材料包', ACCESSORY: '配件' }[p.category] || '其他';
    return {
      id: p.id,
      name: p.title,
      category: cat,
      categoryText: cat,
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