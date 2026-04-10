-- 万界仙途 数据库初始化
CREATE DATABASE IF NOT EXISTS xiantu_game DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE xiantu_game;

-- 用户账号表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL UNIQUE COMMENT '用户名',
  password VARCHAR(128) NOT NULL COMMENT '密码(bcrypt)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL COMMENT '最后登录时间',
  status TINYINT DEFAULT 1 COMMENT '1正常 0封禁'
) COMMENT '用户账号表';

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '关联用户',
  name VARCHAR(32) NOT NULL COMMENT '角色名',
  spiritual_root ENUM('metal','wood','water','fire','earth') NOT NULL COMMENT '主灵根',
  second_root ENUM('heaven','chaos') NULL COMMENT '觉醒灵根',
  realm_tier TINYINT DEFAULT 1 COMMENT '境界大阶(1练气 2筑基...)',
  realm_stage TINYINT DEFAULT 1 COMMENT '境界小阶',
  cultivation_exp BIGINT DEFAULT 0 COMMENT '当前修为',
  hp INT DEFAULT 500 COMMENT '气血',
  atk INT DEFAULT 50 COMMENT '灵力攻击',
  def INT DEFAULT 30 COMMENT '灵力防御',
  spd INT DEFAULT 50 COMMENT '身法',
  crit_rate DECIMAL(5,4) DEFAULT 0.0500 COMMENT '会心率',
  crit_dmg DECIMAL(5,4) DEFAULT 1.5000 COMMENT '会心伤害',
  dodge DECIMAL(5,4) DEFAULT 0.0000 COMMENT '闪避率',
  lifesteal DECIMAL(5,4) DEFAULT 0.0000 COMMENT '吸血',
  spirit INT DEFAULT 10 COMMENT '神识',
  resist_metal DECIMAL(5,4) DEFAULT 0.0000 COMMENT '金抗',
  resist_wood DECIMAL(5,4) DEFAULT 0.0000 COMMENT '木抗',
  resist_water DECIMAL(5,4) DEFAULT 0.0000 COMMENT '水抗',
  resist_fire DECIMAL(5,4) DEFAULT 0.0000 COMMENT '火抗',
  resist_earth DECIMAL(5,4) DEFAULT 0.0000 COMMENT '土抗',
  resist_ctrl DECIMAL(5,4) DEFAULT 0.0000 COMMENT '控制抗性',
  current_map VARCHAR(64) DEFAULT 'qingfeng_valley' COMMENT '当前所在地图',
  spirit_stone BIGINT DEFAULT 0 COMMENT '灵石',
  immortal_jade INT DEFAULT 0 COMMENT '仙玉',
  merit INT DEFAULT 0 COMMENT '功德',
  last_offline_time TIMESTAMP NULL COMMENT '最后离线时间(算离线收益)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) COMMENT '角色表';
