/**
 * 独立种子脚本：npm run seed
 * schema.sql 已含 门店/店员/座位/套餐/定价/会员等级/商品/模板/库存/券/演示用户。
 * 本脚本负责：
 *  1) 若 gallery 为空则写入示例晒图
 *  2) 若 member_level_config 缺失则提示先导入 schema.sql
 * 幂等：已存在数据时跳过。
 */
import 'reflect-metadata';
import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'wx_app',
  password: process.env.DB_PASSWORD || 'wx_app_2026',
  database: process.env.DB_NAME || 'wx_shop',
  charset: 'utf8mb4',
  multipleStatements: false,
};

const GALLERIES = [
  { user: 1, images: ['https://picsum.photos/seed/gal1/400/400'], content: '第一次做的小熊挂件，超有成就感！' },
  { user: 1, images: ['https://picsum.photos/seed/gal2/400/400'], content: '给闺蜜的生日礼物，樱花配色绝了' },
  { user: 1, images: ['https://picsum.photos/seed/gal3/400/400'], content: '三小时畅玩套餐打卡，实物比图纸还好看' },
];

async function main() {
  const conn = await mysql.createConnection(cfg);
  console.log(`[seed] 已连接 ${cfg.host}:${cfg.port}/${cfg.database}`);

  const [ga] = await conn.query('SELECT COUNT(*) AS c FROM gallery');
  if (Number((ga as any)[0].c) === 0) {
    for (const g of GALLERIES) {
      await conn.query(
        'INSERT INTO gallery (user_id, images, content, source, related_type, like_count, status) VALUES (?,?,?,?,?,?,?)',
        [g.user, JSON.stringify(g.images), g.content, 'USER', 'NONE', 0, 'APPROVED'],
      );
    }
    console.log(`[seed] 写入 ${GALLERIES.length} 条晒图`);
  } else {
    console.log('[seed] gallery 已有数据，跳过');
  }

  const [mc] = await conn.query('SELECT COUNT(*) AS c FROM member_level_config');
  if (Number((mc as any)[0].c) === 0) {
    console.warn('[seed] 警告：member_level_config 为空，请先导入 db/schema.sql');
  }

  await conn.end();
  console.log('[seed] 完成');
  process.exit(0);
}

main().catch((e) => {
  console.error('[seed] 失败:', e);
  process.exit(1);
});