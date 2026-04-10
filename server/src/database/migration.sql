-- 万界仙途 数据库初始化脚本
-- 运行: mysql -u root -p xiantu_game < migration.sql

CREATE DATABASE IF NOT EXISTS xiantu_game DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xiantu_game;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(16) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  status TINYINT DEFAULT 1 COMMENT '1=正常 0=封禁',
  last_login DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 角色表（完整版）
CREATE TABLE IF NOT EXISTS characters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  name VARCHAR(8) NOT NULL UNIQUE,
  spiritual_root ENUM('metal','wood','water','fire','earth') NOT NULL,

  -- 境界
  realm_tier INT DEFAULT 1,
  realm_stage INT DEFAULT 1,
  cultivation_exp BIGINT DEFAULT 0,

  -- 基础属性
  max_hp INT DEFAULT 500,
  hp INT DEFAULT 500,
  atk INT DEFAULT 50,
  def INT DEFAULT 30,
  spd INT DEFAULT 50,

  -- 二级属性
  crit_rate DECIMAL(5,4) DEFAULT 0.0500,
  crit_dmg DECIMAL(5,4) DEFAULT 1.5000,
  dodge DECIMAL(5,4) DEFAULT 0.0000,
  lifesteal DECIMAL(5,4) DEFAULT 0.0000,
  spirit INT DEFAULT 10,

  -- 五行抗性
  resist_metal DECIMAL(5,4) DEFAULT 0.0000,
  resist_wood DECIMAL(5,4) DEFAULT 0.0000,
  resist_water DECIMAL(5,4) DEFAULT 0.0000,
  resist_fire DECIMAL(5,4) DEFAULT 0.0000,
  resist_earth DECIMAL(5,4) DEFAULT 0.0000,
  resist_ctrl DECIMAL(5,4) DEFAULT 0.0000,

  -- 货币
  spirit_stone BIGINT DEFAULT 0,
  immortal_jade INT DEFAULT 0,
  merit INT DEFAULT 0,

  -- 游戏状态
  current_map VARCHAR(50) DEFAULT 'qingfeng_valley',
  last_online DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 如果角色表已存在但缺少新字段，用 ALTER TABLE 添加
-- 以下是安全的 ALTER 语句，已有字段会报错可忽略

-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS realm_tier INT DEFAULT 1 AFTER spiritual_root;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS realm_stage INT DEFAULT 1 AFTER realm_tier;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS cultivation_exp BIGINT DEFAULT 0 AFTER realm_stage;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS max_hp INT DEFAULT 500 AFTER cultivation_exp;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS crit_rate DECIMAL(5,4) DEFAULT 0.0500 AFTER spd;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS crit_dmg DECIMAL(5,4) DEFAULT 1.5000 AFTER crit_rate;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS dodge DECIMAL(5,4) DEFAULT 0.0000 AFTER crit_dmg;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS lifesteal DECIMAL(5,4) DEFAULT 0.0000 AFTER dodge;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS spirit INT DEFAULT 10 AFTER lifesteal;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS resist_ctrl DECIMAL(5,4) DEFAULT 0.0000 AFTER resist_earth;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS spirit_stone BIGINT DEFAULT 0 AFTER resist_ctrl;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS immortal_jade INT DEFAULT 0 AFTER spirit_stone;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS merit INT DEFAULT 0 AFTER immortal_jade;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS current_map VARCHAR(50) DEFAULT 'qingfeng_valley' AFTER merit;
-- ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_online DATETIME DEFAULT CURRENT_TIMESTAMP AFTER current_map;

-- 角色功法表
CREATE TABLE IF NOT EXISTS character_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  character_id INT NOT NULL,
  skill_id VARCHAR(50) NOT NULL,
  skill_type ENUM('active','divine','passive') NOT NULL,
  slot_index INT NOT NULL COMMENT '槽位索引 active=0 divine=0-2 passive=0-2',
  level INT DEFAULT 1,
  equipped TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE KEY unique_slot (character_id, skill_type, slot_index)
) ENGINE=InnoDB;

-- 角色装备表
CREATE TABLE IF NOT EXISTS character_equipment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  character_id INT NOT NULL,
  slot VARCHAR(20) DEFAULT NULL COMMENT '装备槽位 weapon/armor/helmet/boots/treasure/ring/pendant，null=在背包',
  name VARCHAR(50) NOT NULL,
  rarity ENUM('white','green','blue','purple','gold','red') NOT NULL DEFAULT 'white',
  primary_stat VARCHAR(20) NOT NULL,
  primary_value INT NOT NULL DEFAULT 0,
  sub_stats JSON DEFAULT NULL COMMENT '副属性 [{stat,value}]',
  set_id VARCHAR(50) DEFAULT NULL,
  enhance_level INT DEFAULT 0,
  tier INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 角色功法背包
CREATE TABLE IF NOT EXISTS character_skill_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  character_id INT NOT NULL,
  skill_id VARCHAR(50) NOT NULL,
  count INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE KEY unique_skill (character_id, skill_id)
) ENGINE=InnoDB;
