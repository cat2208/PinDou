import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product, Gallery } from '../../entities/content.entity';
import { User } from '../../entities/user.entity';
import { Store } from '../../entities/store.entity';
import { JwtUser } from '../../common/auth.guard';
import { fmtTime } from '../../common/utils';

const COLOR_POOL = ['#ff7a59', '#ffb03a', '#6ec6ff', '#9b7bff', '#4ecdc4', '#ff6b81', '#8bc34a'];

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Gallery) private readonly galleryRepo: Repository<Gallery>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
  ) {}

  /** GET /api/home 首页聚合 */
  async home() {
    const bannerTags = [
      { title: '热销爆款', link: '/pages/mall/list/list?category=FINISHED' },
      { title: '新品上架', link: '/pages/mall/list/list?category=' },
      { title: 'DIY 预约专属优惠', link: '/pages/reserve/reserve' },
    ];
    const hotProducts = await this.productRepo.find({ where: { enabled: 1 }, order: { id: 'DESC' }, take: 6 });
    const store = await this.storeRepo.findOne({ where: { status: 'ACTIVE' }, order: { id: 'ASC' } });
    return {
      banners: bannerTags.map((t, i) => ({
        id: i,
        title: t.title,
        imageUrl: `/images/home/banner${i + 1}.png`,
        link: t.link || '',
      })),
      hotProducts: hotProducts.map((p) => ({
        id: p.id,
        name: p.title,
        price: Number(p.price),
        priceText: `¥${Number(p.price).toFixed(2)}`,
        coverImage: p.cover,
        sales: 0,
      })),
      store: store
        ? {
            id: store.id,
            name: store.name,
            address: store.address,
            phone: store.contact_phone,
            businessHours: store.business_hours,
            status: store.status,
          }
        : null,
    };
  }

  /** GET /api/gallery 晒图墙（审核通过） */
  async gallery() {
    const rows = await this.galleryRepo.find({ where: { status: 'APPROVED' }, order: { id: 'DESC' }, take: 50 });
    // 批量取用户，避免逐条 N+1
    const userIds = [...new Set(rows.map((g) => g.user_id).filter(Boolean))];
    const userMap = new Map<number, User>();
    if (userIds.length) {
      const users = await this.userRepo.find({ where: { id: In(userIds) } });
      for (const u of users) userMap.set(u.id, u);
    }
    const list = [];
    for (const g of rows) {
      const u = userMap.get(g.user_id);
      list.push({
        id: g.id,
        user: u?.nickname || `豆友${(g.user_id || g.id) % 1000}`,
        avatar: u?.avatar || '',
        likes: g.like_count || 0,
        title: (g.content || '').slice(0, 40) || '拼豆作品',
        time: fmtTime(g.created_at),
        color: COLOR_POOL[g.id % COLOR_POOL.length],
        cover: Array.isArray(g.images) && g.images.length ? g.images[0] : '',
        images: g.images || [],
      });
    }
    return { list };
  }

  /** POST /api/gallery 发布晒图 */
  async publishGallery(uid: number, body: { title?: string; tag?: string; images?: string[] }) {
    const images = Array.isArray(body?.images) ? body.images.filter(Boolean) : [];
    if (!images.length) throw new Error('请至少上传一张图片');
    const g = this.galleryRepo.create({
      user_id: uid,
      images,
      content: body?.title || '我的拼豆作品',
      source: 'USER',
      related_type: 'NONE',
      like_count: 0,
      status: 'APPROVED', // 演示环境直接展示；生产环境改 PENDING 走审核
    });
    const saved = await this.galleryRepo.save(g);
    return {
      id: saved.id,
      message: '发布成功，作品已展示在晒图墙',
    };
  }

  /** POST /api/gallery/:id/like 点赞 */
  async likeGallery(id: number) {
    const g = await this.galleryRepo.findOne({ where: { id } });
    if (!g) throw new Error('作品不存在');
    g.like_count = (g.like_count || 0) + 1;
    await this.galleryRepo.save(g);
    return { likes: g.like_count };
  }
}