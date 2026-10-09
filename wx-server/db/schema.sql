-- ============================================================
-- 拼豆手工店小程序 数据库 Schema v1.3
-- MySQL 8.0 / utf8mb4
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS wx_shop DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wx_shop;

DROP TABLE IF EXISTS finance_check_diff;
DROP TABLE IF EXISTS store_order_escape_record;
DROP TABLE IF EXISTS staff_shift;
DROP TABLE IF EXISTS iot_seat_device;
DROP TABLE IF EXISTS point_log;
DROP TABLE IF EXISTS member_level_config;
DROP TABLE IF EXISTS custom_order_qc;
DROP TABLE IF EXISTS order_message;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS payment_record;
DROP TABLE IF EXISTS review_sync;
DROP TABLE IF EXISTS gallery;
DROP TABLE IF EXISTS inventory_log;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS product;
DROP TABLE IF EXISTS accessory_order;
DROP TABLE IF EXISTS store_order_item;
DROP TABLE IF EXISTS store_order;
DROP TABLE IF EXISTS custom_order;
DROP TABLE IF EXISTS pricing_config;
DROP TABLE IF EXISTS coupon_redeem_log;
DROP TABLE IF EXISTS coupon;
DROP TABLE IF EXISTS package;
DROP TABLE IF EXISTS seat;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS store;
DROP TABLE IF EXISTS `user`;

-- ============================================================
-- 用户
-- ============================================================
CREATE TABLE `user` (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) NOT NULL UNIQUE,
  unionid VARCHAR(64) DEFAULT NULL,
  nickname VARCHAR(64) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  avatar VARCHAR(512) DEFAULT '',
  member_level TINYINT DEFAULT 0 COMMENT '会员等级 0-3',
  points INT DEFAULT 0 COMMENT '当前可用积分',
  cumulative_points INT DEFAULT 0 COMMENT '累计积分（用于等级判定，只增不减）',
  level_updated_at DATETIME DEFAULT NULL COMMENT '等级最后计算时间',
  balance DECIMAL(10,2) DEFAULT 0.00,
  birthday DATE DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL
);

-- ============================================================
-- 门店
-- ============================================================
CREATE TABLE store (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  address VARCHAR(512) DEFAULT '',
  contact_phone VARCHAR(20) DEFAULT '',
  latitude DECIMAL(10,7) DEFAULT NULL,
  longitude DECIMAL(10,7) DEFAULT NULL,
  business_hours VARCHAR(128) DEFAULT '',
  status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 员工账号
-- ============================================================
CREATE TABLE staff (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(64) DEFAULT '',
  role ENUM('STAFF','MANAGER','OWNER') NOT NULL DEFAULT 'STAFF',
  store_id BIGINT DEFAULT NULL,
  enabled TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 座位
-- ============================================================
CREATE TABLE seat (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT DEFAULT NULL,
  seat_no VARCHAR(16) NOT NULL,
  area VARCHAR(32) DEFAULT '',
  status ENUM('IDLE','RESERVED','TIMING','PENDING_SETTLE') DEFAULT 'IDLE',
  qrcode_token VARCHAR(64) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_store_seat (store_id, seat_no),
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 套餐
-- ============================================================
CREATE TABLE package (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT DEFAULT NULL,
  name VARCHAR(64) NOT NULL,
  type ENUM('HOURLY','THREE_HOUR','ALL_DAY') NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INT DEFAULT NULL,
  hourly_unit_price DECIMAL(10,2) DEFAULT NULL,
  deposit DECIMAL(10,2) DEFAULT 1.00,
  description VARCHAR(255) DEFAULT '',
  enabled TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 券
-- ============================================================
CREATE TABLE coupon (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,
  user_id BIGINT DEFAULT NULL,
  package_id BIGINT DEFAULT NULL,
  coupon_type ENUM('DURATION','ACCESSORY','MATERIAL','DISCOUNT') NOT NULL,
  source ENUM('BUY','GIFT','MEITUAN','DOUYIN','SYSTEM') NOT NULL,
  face_value DECIMAL(10,2) DEFAULT NULL,
  discount_rate DECIMAL(5,2) DEFAULT NULL,
  accessory_ref VARCHAR(64) DEFAULT NULL,
  status ENUM('UNUSED','USED','EXPIRED','REVOKED') DEFAULT 'UNUSED',
  used_count INT DEFAULT 0,
  total_count INT DEFAULT 1,
  expire_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 券核销流水
-- ============================================================
CREATE TABLE coupon_redeem_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  coupon_id BIGINT NOT NULL,
  order_id BIGINT DEFAULT NULL,
  store_order_id BIGINT DEFAULT NULL,
  admin_id BIGINT NOT NULL,
  action ENUM('USE','REVOKE') NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0.00,
  remark VARCHAR(255) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 定价配置（按门店差异化 + 会员积分配置）
-- ============================================================
CREATE TABLE pricing_config (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT DEFAULT NULL COMMENT 'NULL 表示全局默认',
  bean_unit_price DECIMAL(10,4) NOT NULL DEFAULT 0.0015,
  labor_price_normal DECIMAL(10,4) NOT NULL DEFAULT 0.014,
  labor_price_complex DECIMAL(10,4) NOT NULL DEFAULT 0.020,
  color_threshold INT NOT NULL DEFAULT 12,
  iron_glitter_min DECIMAL(10,2) DEFAULT 2.00,
  iron_glitter_max DECIMAL(10,2) DEFAULT 5.00,
  accessory_keychain DECIMAL(10,2) DEFAULT 1.00,
  accessory_fridge_magnet DECIMAL(10,2) DEFAULT 0.50,
  accessory_frame DECIMAL(10,2) DEFAULT 0.00,
  accessory_no_hole_double DECIMAL(10,2) DEFAULT 1.00,
  shipping_fee DECIMAL(10,2) DEFAULT 6.00,
  free_shipping_threshold DECIMAL(10,2) DEFAULT 60.00,
  cancel_free_hours INT DEFAULT 2 COMMENT '预约开始前 N 小时取消可退定金',
  deposit_ratio DECIMAL(5,2) DEFAULT 0.50,
  inventory_deduct_strategy ENUM('ON_ORDER_CONFIRM','ON_PRODUCE_START') DEFAULT 'ON_ORDER_CONFIRM',
  points_per_yuan INT DEFAULT 1,
  points_to_yuan_rate INT DEFAULT 100,
  points_deduct_max_ratio DECIMAL(3,2) DEFAULT 0.30,
  birthday_double_points TINYINT DEFAULT 1,
  points_expire_months INT DEFAULT 12,
  auto_confirm_days INT DEFAULT 7,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_store_pricing (store_id),
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 定制订单（含质检、物流、消息字段）
-- ============================================================
CREATE TABLE custom_order (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  store_id BIGINT DEFAULT NULL,
  image_url VARCHAR(512) NOT NULL,
  pattern_url VARCHAR(512) DEFAULT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  total_beans INT NOT NULL,
  color_count INT NOT NULL,
  colors_json JSON,
  style ENUM('CARTOON','REALISTIC') DEFAULT 'CARTOON',
  difficulty ENUM('EASY','NORMAL','HARD') DEFAULT 'NORMAL',
  iron_type ENUM('NORMAL','GLITTER','OTHER') DEFAULT 'NORMAL',
  price_bean DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_labor DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_iron DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_accessory DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_shipping DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit_paid TINYINT DEFAULT 0,
  points_deduct DECIMAL(10,2) DEFAULT 0.00,
  points_used INT DEFAULT 0,
  member_discount DECIMAL(10,2) DEFAULT 0.00,
  accessories_json JSON,
  nickname VARCHAR(64) DEFAULT '',
  contact VARCHAR(64) DEFAULT '',
  expected_time DATETIME DEFAULT NULL,
  address VARCHAR(512) DEFAULT '',
  remark VARCHAR(512) DEFAULT '',
  assigned_staff_id BIGINT DEFAULT NULL,
  last_message_at DATETIME DEFAULT NULL,
  status ENUM('PENDING','ACCEPTED','COLORING','ASSEMBLING','IRONING','QC_PENDING','QC_PASSED','DONE','SHIPPED','DELIVERED','CONFIRMED','CANCELLED') DEFAULT 'PENDING',
  reject_reason VARCHAR(512) DEFAULT NULL,
  reject_at DATETIME DEFAULT NULL,
  tracking_company VARCHAR(64) DEFAULT NULL,
  tracking_no VARCHAR(64) DEFAULT NULL,
  shipped_at DATETIME DEFAULT NULL,
  delivered_at DATETIME DEFAULT NULL,
  confirmed_at DATETIME DEFAULT NULL,
  auto_confirmed TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_assigned (assigned_staff_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 到店订单
-- ============================================================
CREATE TABLE store_order (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  seat_id BIGINT NOT NULL,
  store_id BIGINT DEFAULT NULL,
  package_id BIGINT NOT NULL,
  coupon_id BIGINT DEFAULT NULL,
  booking_time DATETIME DEFAULT NULL,
  book_start_time DATETIME DEFAULT NULL,
  book_end_time DATETIME DEFAULT NULL,
  start_time DATETIME DEFAULT NULL,
  end_time DATETIME DEFAULT NULL,
  pause_seconds INT DEFAULT 0,
  timing_type ENUM('HOURLY','THREE_HOUR','ALL_DAY') NOT NULL,
  coupon_countdown_end DATETIME DEFAULT NULL,
  overtime_minutes INT DEFAULT 0,
  timing_fee DECIMAL(10,2) DEFAULT 0.00,
  extra_fee DECIMAL(10,2) DEFAULT 0.00,
  accessory_fee DECIMAL(10,2) DEFAULT 0.00,
  coupon_deduction DECIMAL(10,2) DEFAULT 0.00,
  thirdparty_deduction DECIMAL(10,2) DEFAULT 0.00,
  deposit DECIMAL(10,2) DEFAULT 0.00,
  points_deduct DECIMAL(10,2) DEFAULT 0.00,
  points_used INT DEFAULT 0,
  member_discount DECIMAL(10,2) DEFAULT 0.00,
  total_fee DECIMAL(10,2) DEFAULT 0.00,
  settled_fee DECIMAL(10,2) DEFAULT 0.00,
  is_escape TINYINT DEFAULT 0,
  status ENUM('RESERVED','CHECKED_IN','TIMING','PAUSED','COMPLETED','SETTLED','CANCELLED') DEFAULT 'RESERVED',
  settled_at DATETIME DEFAULT NULL,
  settled_by_staff_id BIGINT DEFAULT NULL,
  last_message_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  FOREIGN KEY (seat_id) REFERENCES seat(id),
  FOREIGN KEY (store_id) REFERENCES store(id),
  FOREIGN KEY (settled_by_staff_id) REFERENCES staff(id)
);

-- ============================================================
-- 到店结算明细
-- ============================================================
CREATE TABLE store_order_item (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_order_id BIGINT NOT NULL,
  item_type ENUM('TIMING','IRON','ACCESSORY','MATERIAL','COUPON','THIRDPARTY','DEPOSIT','MEMBER_DISCOUNT','POINTS_DEDUCT') NOT NULL,
  ref_id BIGINT DEFAULT NULL,
  name VARCHAR(64) NOT NULL,
  quantity INT DEFAULT 1,
  amount DECIMAL(10,2) NOT NULL,
  direction ENUM('CHARGE','DEDUCT') DEFAULT 'CHARGE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_order_id) REFERENCES store_order(id)
);

-- ============================================================
-- 配件 / 材料包订单
-- ============================================================
CREATE TABLE accessory_order (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  store_id BIGINT DEFAULT NULL,
  scene ENUM('MALL','STORE_ADD','REDEEM') NOT NULL,
  related_store_order_id BIGINT DEFAULT NULL,
  items_json JSON NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  points_deduct DECIMAL(10,2) DEFAULT 0.00,
  points_used INT DEFAULT 0,
  member_discount DECIMAL(10,2) DEFAULT 0.00,
  pay_status ENUM('UNPAID','PAID','REFUND') DEFAULT 'UNPAID',
  status ENUM('CREATED','PAID','DONE','CANCELLED') DEFAULT 'CREATED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 商品（成品 / 材料包 / 配件 SKU）
-- ============================================================
CREATE TABLE product (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(64) NOT NULL UNIQUE,
  store_id BIGINT DEFAULT NULL,
  category ENUM('FINISHED','MATERIAL','ACCESSORY') NOT NULL,
  title VARCHAR(128) NOT NULL,
  cover VARCHAR(512) DEFAULT '',
  images JSON,
  tags VARCHAR(255) DEFAULT '',
  price DECIMAL(10,2) NOT NULL,
  stock INT DEFAULT 0,
  bean_count INT DEFAULT NULL,
  description TEXT,
  enabled TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 库存表
-- ============================================================
CREATE TABLE inventory (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT NOT NULL,
  item_type ENUM('BEAN','ACCESSORY','PACKAGING','OTHER') NOT NULL,
  item_name VARCHAR(128) NOT NULL,
  item_code VARCHAR(64) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  unit VARCHAR(16) DEFAULT '个',
  alert_threshold INT NOT NULL DEFAULT 50,
  last_restock_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_store_item (store_id, item_code),
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 库存变动流水
-- ============================================================
CREATE TABLE inventory_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT NOT NULL,
  inventory_id BIGINT NOT NULL,
  change_type ENUM('IN','OUT','ADJUST','RETURN') NOT NULL,
  quantity INT NOT NULL,
  direction TINYINT NOT NULL,
  before_quantity INT NOT NULL,
  after_quantity INT NOT NULL,
  ref_order_no VARCHAR(32) DEFAULT NULL,
  operator_id BIGINT NOT NULL,
  remark VARCHAR(255) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES store(id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id),
  FOREIGN KEY (operator_id) REFERENCES staff(id)
);

-- ============================================================
-- 晒图
-- ============================================================
CREATE TABLE gallery (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT DEFAULT NULL,
  store_id BIGINT DEFAULT NULL,
  images JSON NOT NULL,
  content VARCHAR(1024) DEFAULT '',
  source ENUM('USER','MEITUAN','DOUYIN','ADMIN') DEFAULT 'USER',
  related_type ENUM('TEMPLATE','PRODUCT','NONE') DEFAULT 'NONE',
  related_id BIGINT DEFAULT NULL,
  like_count INT DEFAULT 0,
  status ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 第三方评论同步
-- ============================================================
CREATE TABLE review_sync (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT DEFAULT NULL,
  platform ENUM('MEITUAN','DOUYIN','MANUAL') NOT NULL,
  platform_id VARCHAR(128) DEFAULT NULL,
  nickname VARCHAR(64) DEFAULT '',
  avatar VARCHAR(512) DEFAULT '',
  content VARCHAR(2048) DEFAULT '',
  rating INT DEFAULT NULL,
  raw JSON,
  synced TINYINT DEFAULT 0,
  audit_status ENUM('PENDING','APPROVED','HIDDEN') DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_platform_id (platform, platform_id)
);

-- ============================================================
-- 交易流水
-- ============================================================
CREATE TABLE payment_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  out_trade_no VARCHAR(64) NOT NULL UNIQUE,
  transaction_id VARCHAR(64) DEFAULT NULL,
  biz_type ENUM('CUSTOM_DEPOSIT','CUSTOM_BALANCE','STORE_SETTLE','ACCESSORY','MALL','COUPON_BUY','REFUND') NOT NULL,
  biz_id BIGINT NOT NULL,
  user_id BIGINT DEFAULT NULL,
  store_id BIGINT DEFAULT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('UNPAID','PAID','REFUND','CLOSED') DEFAULT 'UNPAID',
  paid_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 操作审计日志
-- ============================================================
CREATE TABLE audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT DEFAULT NULL,
  operator_type ENUM('STAFF','ADMIN','SYSTEM') NOT NULL,
  operator_id BIGINT NOT NULL,
  operator_name VARCHAR(64) DEFAULT '',
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) DEFAULT '',
  target_id BIGINT DEFAULT NULL,
  before_value JSON DEFAULT NULL,
  after_value JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT '',
  user_agent VARCHAR(512) DEFAULT '',
  remark VARCHAR(512) DEFAULT '',
  is_wx_alert_sent TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operator (operator_type, operator_id),
  INDEX idx_action (action),
  INDEX idx_target (target_type, target_id),
  INDEX idx_created (created_at),
  INDEX idx_store (store_id)
);

-- ============================================================
-- 【v1.3】订单内消息表
-- ============================================================
CREATE TABLE `order_message` (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  biz_type ENUM('CUSTOM_ORDER','STORE_ORDER') NOT NULL,
  order_id BIGINT NOT NULL,
  store_id BIGINT DEFAULT NULL,
  sender_type ENUM('USER','STAFF') NOT NULL,
  sender_id BIGINT NOT NULL,
  sender_name VARCHAR(64) DEFAULT '',
  message_type ENUM('TEXT','IMAGE','SYSTEM') NOT NULL DEFAULT 'TEXT',
  content TEXT NOT NULL,
  images_json JSON DEFAULT NULL,
  is_read_by_user TINYINT DEFAULT 0,
  is_read_by_staff TINYINT DEFAULT 0,
  is_deleted TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (biz_type, order_id),
  INDEX idx_sender (sender_type, sender_id),
  INDEX idx_store (store_id),
  INDEX idx_created (created_at)
) COMMENT='订单内消息表';

-- ============================================================
-- 【v1.3】质检记录表
-- ============================================================
CREATE TABLE `custom_order_qc` (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  custom_order_id BIGINT NOT NULL,
  store_id BIGINT DEFAULT NULL,
  qc_staff_id BIGINT NOT NULL,
  qc_staff_name VARCHAR(64) DEFAULT '',
  result ENUM('PASS','FAIL') NOT NULL,
  fail_reason VARCHAR(512) DEFAULT NULL,
  rework_target ENUM('COLORING','ASSEMBLING','IRONING') DEFAULT NULL,
  qc_images JSON NOT NULL,
  remark VARCHAR(512) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (custom_order_id),
  INDEX idx_staff (qc_staff_id),
  FOREIGN KEY (custom_order_id) REFERENCES custom_order(id),
  FOREIGN KEY (store_id) REFERENCES store(id),
  FOREIGN KEY (qc_staff_id) REFERENCES staff(id)
) COMMENT='定制订单质检记录';

-- ============================================================
-- 【v1.3】会员等级配置表
-- ============================================================
CREATE TABLE `member_level_config` (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  level TINYINT NOT NULL UNIQUE,
  name VARCHAR(32) NOT NULL,
  min_cumulative_points INT NOT NULL,
  discount_rate DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  benefits_json JSON DEFAULT NULL,
  enabled TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) COMMENT='会员等级配置';

-- ============================================================
-- 【v1.3】积分流水表
-- ============================================================
CREATE TABLE `point_log` (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  store_id BIGINT DEFAULT NULL,
  change_type ENUM('EARN','SPEND','EXPIRE','ADJUST') NOT NULL,
  points INT NOT NULL,
  direction TINYINT NOT NULL,
  before_points INT NOT NULL,
  after_points INT NOT NULL,
  ref_biz_type VARCHAR(32) DEFAULT NULL,
  ref_order_no VARCHAR(32) DEFAULT NULL,
  expire_at DATETIME DEFAULT NULL,
  remark VARCHAR(255) DEFAULT '',
  operator_id BIGINT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_expire (expire_at),
  INDEX idx_change_type (change_type),
  FOREIGN KEY (user_id) REFERENCES `user`(id),
  FOREIGN KEY (store_id) REFERENCES store(id)
) COMMENT='积分变动流水';

-- ============================================================
-- IoT 座位指示灯设备绑定表（二期可选）
-- ============================================================
CREATE TABLE iot_seat_device (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT NOT NULL,
  seat_id BIGINT NOT NULL,
  device_sn VARCHAR(64) NOT NULL UNIQUE,
  device_name VARCHAR(64) DEFAULT '',
  status ENUM('ONLINE','OFFLINE','FAULT') DEFAULT 'OFFLINE',
  last_online_at DATETIME DEFAULT NULL,
  last_light_command JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_seat_device (seat_id),
  UNIQUE KEY uk_device_sn (device_sn),
  FOREIGN KEY (seat_id) REFERENCES seat(id),
  FOREIGN KEY (store_id) REFERENCES store(id)
);

-- ============================================================
-- 门店交接班记录表
-- ============================================================
CREATE TABLE staff_shift (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT NOT NULL,
  shift_staff_id BIGINT NOT NULL,
  receive_staff_id BIGINT DEFAULT NULL,
  shift_start DATETIME NOT NULL,
  shift_end DATETIME DEFAULT NULL,
  cash_amount DECIMAL(10,2) DEFAULT 0.00,
  wx_amount DECIMAL(10,2) DEFAULT 0.00,
  un_settle_count INT DEFAULT 0,
  remark VARCHAR(1024) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES store(id),
  FOREIGN KEY (shift_staff_id) REFERENCES staff(id),
  FOREIGN KEY (receive_staff_id) REFERENCES staff(id)
);

-- ============================================================
-- 逃单记录
-- ============================================================
CREATE TABLE store_order_escape_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_order_id BIGINT NOT NULL UNIQUE,
  store_id BIGINT NOT NULL,
  staff_id BIGINT NOT NULL,
  escape_time DATETIME NOT NULL,
  escape_fee DECIMAL(10,2) NOT NULL,
  remark VARCHAR(512) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_order_id) REFERENCES store_order(id),
  FOREIGN KEY (store_id) REFERENCES store(id),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- ============================================================
-- 财务对账差异记录表
-- ============================================================
CREATE TABLE finance_check_diff (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT DEFAULT NULL,
  check_date DATE NOT NULL,
  out_trade_no VARCHAR(64) DEFAULT NULL,
  transaction_id VARCHAR(64) DEFAULT NULL,
  diff_type ENUM('ONLY_WX','ONLY_SYS','AMOUNT_MISMATCH','STATUS_MISMATCH') NOT NULL,
  wx_amount DECIMAL(10,2) DEFAULT NULL,
  sys_amount DECIMAL(10,2) DEFAULT NULL,
  wx_status VARCHAR(32) DEFAULT NULL,
  sys_status VARCHAR(32) DEFAULT NULL,
  handle_status ENUM('UNHANDLED','HANDLED','IGNORE') DEFAULT 'UNHANDLED',
  handle_remark VARCHAR(512) DEFAULT '',
  handle_staff_id BIGINT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 种子数据
-- ============================================================

-- 默认门店（2 家）
INSERT INTO store (id, name, address, contact_phone, latitude, longitude, business_hours) VALUES
(1, '拼豆手工店（旗舰店）', '上海市徐汇区漕溪北路 88 号 3 楼 301', '021-88886666', 31.1944680, 121.4371060, '10:00-22:00'),
(2, '拼豆手工店（大学城店）', '上海市杨浦区淞沪路 199 号 B1 层 08 铺', '021-66668888', 31.3074490, 121.5136600, '10:00-21:30');

-- 员工账号（密码 demo123456，bcrypt hash 占位，启动时由代码确保）
INSERT INTO staff (id, username, password_hash, real_name, role, store_id) VALUES
(1, 'manager', '$2b$10$placeholder', '张店长', 'MANAGER', 1),
(2, 'staff01', '$2b$10$placeholder', '李店员', 'STAFF', 1),
(3, 'owner',   '$2b$10$placeholder', '王老板', 'OWNER', 1);

-- 座位（旗舰店 12 个，大学城店 8 个）
INSERT INTO seat (store_id, seat_no, area, status, qrcode_token) VALUES
(1, 'A01', 'A区', 'IDLE', 'tok-A01'), (1, 'A02', 'A区', 'IDLE', 'tok-A02'),
(1, 'A03', 'A区', 'IDLE', 'tok-A03'), (1, 'A04', 'A区', 'IDLE', 'tok-A04'),
(1, 'B01', 'B区', 'IDLE', 'tok-B01'), (1, 'B02', 'B区', 'IDLE', 'tok-B02'),
(1, 'B03', 'B区', 'IDLE', 'tok-B03'), (1, 'B04', 'B区', 'IDLE', 'tok-B04'),
(1, 'C01', 'C区', 'IDLE', 'tok-C01'), (1, 'C02', 'C区', 'IDLE', 'tok-C02'),
(1, 'C03', 'C区', 'IDLE', 'tok-C03'), (1, 'C04', 'C区', 'IDLE', 'tok-C04'),
(2, 'A01', 'A区', 'IDLE', 'tok2-A01'), (2, 'A02', 'A区', 'IDLE', 'tok2-A02'),
(2, 'A03', 'A区', 'IDLE', 'tok2-A03'), (2, 'A04', 'A区', 'IDLE', 'tok2-A04'),
(2, 'B01', 'B区', 'IDLE', 'tok2-B01'), (2, 'B02', 'B区', 'IDLE', 'tok2-B02'),
(2, 'B03', 'B区', 'IDLE', 'tok2-B03'), (2, 'B04', 'B区', 'IDLE', 'tok2-B04');

-- 套餐
INSERT INTO package (store_id, name, type, price, duration_minutes, hourly_unit_price, deposit, description) VALUES
(1, '按小时计费', 'HOURLY', 10.00, NULL, 10.00, 1.00, '基础体验，1 元/分钟起'),
(2, '按小时计费', 'HOURLY', 10.00, NULL, 10.00, 1.00, '基础体验，1 元/分钟起'),
(1, '三小时畅玩套餐', 'THREE_HOUR', 39.00, 180, 10.00, 1.00, '含 3 小时手工时间，超时按分钟计费'),
(2, '三小时畅玩套餐', 'THREE_HOUR', 39.00, 180, 10.00, 1.00, '含 3 小时手工时间，超时按分钟计费'),
(1, '全天畅玩套餐', 'ALL_DAY', 88.00, NULL, NULL, 1.00, '全天不限时，仅记录停留时长'),
(2, '全天畅玩套餐', 'ALL_DAY', 88.00, NULL, NULL, 1.00, '全天不限时，仅记录停留时长');

-- 定价配置（旗舰店 + 全局默认）
INSERT INTO pricing_config (store_id) VALUES (NULL);
INSERT INTO pricing_config (store_id) VALUES (1);
INSERT INTO pricing_config (store_id) VALUES (2);

-- 会员等级配置
INSERT INTO member_level_config (level, name, min_cumulative_points, discount_rate, benefits_json) VALUES
(0, '普通会员', 0, 1.00, '[]'),
(1, '银卡会员', 500, 0.95, '["95折优惠"]'),
(2, '金卡会员', 2000, 0.90, '["9折优惠","生日月双倍积分"]'),
(3, '钻石会员', 5000, 0.85, '["85折优惠","生日月双倍积分","免费熨烫一次"]');

-- 商品（商城成品 / 材料包 / 配件）
INSERT INTO product (sku, store_id, category, title, cover, images, tags, price, stock, bean_count, description, enabled) VALUES
('FS-0001', NULL, 'FINISHED', '樱花小熊拼豆挂件', 'https://picsum.photos/seed/pd1/400/400', JSON_ARRAY('https://picsum.photos/seed/pd1a/400/400','https://picsum.photos/seed/pd1b/400/400'), '可爱,樱花,新品', 29.90, 50, 1200, '成品拼豆挂件，约 25×25cm 图纸大小，含钥匙扣。', 1),
('FS-0002', NULL, 'FINISHED', '柴犬头像立体拼豆', 'https://picsum.photos/seed/pd2/400/400', JSON_ARRAY('https://picsum.photos/seed/pd2a/400/400'), '柴犬,立体,热销', 45.00, 30, 1800, '立体拼豆柴犬摆件，高约 10cm。', 1),
('FS-0003', NULL, 'FINISHED', '草莓甜品杯拼豆杯垫', 'https://picsum.photos/seed/pd3/400/400', JSON_ARRAY('https://picsum.photos/seed/pd3a/400/400'), '杯垫,甜品,实用', 19.90, 80, 800, '拼豆杯垫四件套之一，隔热耐用。', 1),
('MT-0001', NULL, 'MATERIAL', '48色拼豆材料包', 'https://picsum.photos/seed/mt1/400/400', JSON_ARRAY('https://picsum.photos/seed/mt1a/400/400'), '材料包,48色,入门', 59.00, 100, NULL, '48 色 × 500 粒拼豆 + 拼板 + 图纸册。', 1),
('MT-0002', NULL, 'MATERIAL', '基础单色补豆包（白色）', 'https://picsum.photos/seed/mt2/400/400', JSON_ARRAY('https://picsum.photos/seed/mt2a/400/400'), '补豆,白色', 9.90, 500, NULL, '单色白拼豆 1000 粒补充装。', 1),
('AC-0001', NULL, 'ACCESSORY', '钥匙扣配件', 'https://picsum.photos/seed/ac1/400/400', JSON_ARRAY('https://picsum.photos/seed/ac1a/400/400'), '配件,钥匙扣', 1.00, 1000, NULL, '单个钥匙扣挂环配件。', 1),
('AC-0002', NULL, 'ACCESSORY', '冰箱贴磁片', 'https://picsum.photos/seed/ac2/400/400', JSON_ARRAY('https://picsum.photos/seed/ac2a/400/400'), '配件,冰箱贴', 0.50, 2000, NULL, '圆形磁片，直径 3cm。', 1);

-- 库存（旗舰店参考）
INSERT INTO inventory (store_id, item_type, item_name, item_code, quantity, unit, alert_threshold) VALUES
(1, 'BEAN', '白色拼豆', 'BEAN-WHITE', 50000, '粒', 5000),
(1, 'BEAN', '黑色拼豆', 'BEAN-BLACK', 30000, '粒', 3000),
(1, 'ACCESSORY', '钥匙扣配件', 'AC-KEYCHAIN', 800, '个', 100),
(1, 'ACCESSORY', '冰箱贴磁片', 'AC-FRIDGE', 1500, '个', 200);

-- 系统演示券
INSERT INTO coupon (code, coupon_type, source, face_value, status, total_count, used_count) VALUES
('PD8888', 'DISCOUNT', 'SYSTEM', 10.00, 'UNUSED', 999, 0);

-- 演示用户（openid=mock-openid-001）
INSERT INTO `user` (id, openid, nickname, phone, member_level, points, cumulative_points, balance, birthday) VALUES
(1, 'mock-openid-001', '拼豆新手', '13800000001', 1, 1280, 1280, 68.50, '1995-10-15');