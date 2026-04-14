-- 万界仙途 PostgreSQL 数据库初始化脚本
-- 适用于 Neon / Vercel Postgres
-- 运行: psql $DATABASE_URL -f migration.sql

-- 自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 用户表
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(16) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  status SMALLINT DEFAULT 1,
  last_login TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 角色表
-- ========================================
CREATE TABLE IF NOT EXISTS characters (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(8) NOT NULL UNIQUE,
  spiritual_root VARCHAR(10) NOT NULL CHECK (spiritual_root IN ('metal','wood','water','fire','earth')),

  -- 境界
  realm_tier INT DEFAULT 1,
  realm_stage INT DEFAULT 1,
  cultivation_exp BIGINT DEFAULT 0,

  -- 等级
  level INT DEFAULT 1,
  level_exp BIGINT DEFAULT 0,

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
  offline_start TIMESTAMP DEFAULT NULL,
  offline_map VARCHAR(50) DEFAULT NULL,
  avatar TEXT DEFAULT NULL,

  -- 宗门
  sect_id INT DEFAULT NULL,
  sect_quit_time TIMESTAMP DEFAULT NULL,

  -- 永久属性加成
  permanent_atk_pct DECIMAL(5,2) DEFAULT 0,
  permanent_def_pct DECIMAL(5,2) DEFAULT 0,
  permanent_hp_pct DECIMAL(5,2) DEFAULT 0,

  -- 称号
  title VARCHAR(30) DEFAULT NULL,

  last_online TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_realm_rank ON characters (realm_tier DESC, realm_stage DESC, cultivation_exp DESC);
CREATE INDEX IF NOT EXISTS idx_level_rank ON characters (level DESC, level_exp DESC);
CREATE INDEX IF NOT EXISTS idx_stone_rank ON characters (spirit_stone DESC);

-- ========================================
-- 角色功法表
-- ========================================
CREATE TABLE IF NOT EXISTS character_skills (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_id VARCHAR(50) NOT NULL,
  skill_type VARCHAR(10) NOT NULL CHECK (skill_type IN ('active','divine','passive')),
  slot_index INT NOT NULL,
  level INT DEFAULT 1,
  equipped BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, skill_type, slot_index)
);

-- ========================================
-- 角色装备表
-- ========================================
CREATE TABLE IF NOT EXISTS character_equipment (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot VARCHAR(20) DEFAULT NULL,
  base_slot VARCHAR(20) DEFAULT NULL,
  weapon_type VARCHAR(20) DEFAULT NULL,
  name VARCHAR(50) NOT NULL,
  rarity VARCHAR(10) NOT NULL DEFAULT 'white' CHECK (rarity IN ('white','green','blue','purple','gold','red')),
  primary_stat VARCHAR(20) NOT NULL,
  primary_value INT NOT NULL DEFAULT 0,
  sub_stats JSONB DEFAULT NULL,
  set_id VARCHAR(50) DEFAULT NULL,
  enhance_level INT DEFAULT 0,
  req_level INT DEFAULT 1,
  tier INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 角色功法背包
-- ========================================
CREATE TABLE IF NOT EXISTS character_skill_inventory (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_id VARCHAR(50) NOT NULL,
  count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, skill_id)
);

-- ========================================
-- 丹药背包
-- ========================================
CREATE TABLE IF NOT EXISTS character_pills (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  pill_id VARCHAR(50) NOT NULL,
  count INT DEFAULT 1,
  quality_factor DECIMAL(3,1) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, pill_id, quality_factor)
);

-- ========================================
-- 激活buff
-- ========================================
CREATE TABLE IF NOT EXISTS character_buffs (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  pill_id VARCHAR(50) NOT NULL,
  quality_factor DECIMAL(3,1) DEFAULT 1.0,
  expire_time TIMESTAMP DEFAULT NULL,
  remaining_fights INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 洞府建筑
-- ========================================
CREATE TABLE IF NOT EXISTS character_cave (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  building_id VARCHAR(50) NOT NULL,
  level INT DEFAULT 0,
  upgrade_finish_time TIMESTAMP DEFAULT NULL,
  last_collect_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, building_id)
);

-- ========================================
-- 灵田地块
-- ========================================
CREATE TABLE IF NOT EXISTS character_cave_plots (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  plot_index INT NOT NULL,
  herb_id VARCHAR(50) DEFAULT NULL,
  planted_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, plot_index)
);

-- ========================================
-- 灵草背包
-- ========================================
CREATE TABLE IF NOT EXISTS character_materials (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  material_id VARCHAR(50) NOT NULL,
  quality VARCHAR(20) NOT NULL DEFAULT 'white',
  count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, material_id, quality)
);

-- ========================================
-- 宗门主表
-- ========================================
CREATE TABLE IF NOT EXISTS sects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(24) NOT NULL UNIQUE,
  announcement VARCHAR(150) DEFAULT '',
  leader_id INT NOT NULL REFERENCES characters(id),
  level INT DEFAULT 1,
  fund BIGINT DEFAULT 0,
  join_mode VARCHAR(10) DEFAULT 'approval' CHECK (join_mode IN ('approval','free')),
  member_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sect_rank ON sects (level DESC, fund DESC, member_count DESC);

CREATE TRIGGER set_sects_updated_at
  BEFORE UPDATE ON sects
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ========================================
-- 宗门成员
-- ========================================
CREATE TABLE IF NOT EXISTS sect_members (
  id SERIAL PRIMARY KEY,
  sect_id INT NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
  character_id INT NOT NULL UNIQUE REFERENCES characters(id),
  role VARCHAR(15) DEFAULT 'outer' CHECK (role IN ('leader','vice_leader','elder','inner','outer')),
  contribution BIGINT DEFAULT 0,
  weekly_contribution BIGINT DEFAULT 0,
  daily_donated BIGINT DEFAULT 0,
  last_sign_date DATE DEFAULT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sect_members_sect ON sect_members (sect_id);
CREATE INDEX IF NOT EXISTS idx_sect_members_contribution ON sect_members (sect_id, contribution DESC);

-- ========================================
-- 宗门申请
-- ========================================
CREATE TABLE IF NOT EXISTS sect_applications (
  id SERIAL PRIMARY KEY,
  sect_id INT NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id),
  status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  handled_at TIMESTAMP DEFAULT NULL,
  handled_by INT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sect_app_pending ON sect_applications (sect_id, status);

-- ========================================
-- 宗门每日任务
-- ========================================
CREATE TABLE IF NOT EXISTS sect_daily_tasks (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id),
  sect_id INT NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
  task_type VARCHAR(30) NOT NULL,
  target_count INT NOT NULL,
  current_count INT DEFAULT 0,
  reward_contribution INT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  claimed BOOLEAN DEFAULT FALSE,
  task_date DATE NOT NULL,
  UNIQUE (character_id, task_type, task_date)
);

-- ========================================
-- 宗门周常任务
-- ========================================
CREATE TABLE IF NOT EXISTS sect_weekly_tasks (
  id SERIAL PRIMARY KEY,
  sect_id INT NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
  task_type VARCHAR(30) NOT NULL,
  target_count INT NOT NULL,
  current_count INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  week_start DATE NOT NULL,
  UNIQUE (sect_id, week_start)
);

-- ========================================
-- 周常任务领取记录
-- ========================================
CREATE TABLE IF NOT EXISTS sect_weekly_claims (
  id SERIAL PRIMARY KEY,
  weekly_task_id INT NOT NULL REFERENCES sect_weekly_tasks(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id),
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (weekly_task_id, character_id)
);

-- ========================================
-- 宗门Boss
-- ========================================
CREATE TABLE IF NOT EXISTS sect_bosses (
  id SERIAL PRIMARY KEY,
  sect_id INT NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
  boss_key VARCHAR(30) NOT NULL,
  total_hp BIGINT NOT NULL,
  current_hp BIGINT NOT NULL,
  status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active','killed','expired')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sect_boss_active ON sect_bosses (sect_id, status);

-- ========================================
-- Boss伤害记录
-- ========================================
CREATE TABLE IF NOT EXISTS sect_boss_damage (
  id SERIAL PRIMARY KEY,
  boss_id INT NOT NULL REFERENCES sect_bosses(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id),
  total_damage BIGINT DEFAULT 0,
  lives_used INT DEFAULT 0,
  UNIQUE (boss_id, character_id)
);

-- ========================================
-- 宗门商店购买记录
-- ========================================
CREATE TABLE IF NOT EXISTS sect_shop_purchases (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id),
  item_key VARCHAR(50) NOT NULL,
  quantity INT DEFAULT 1,
  cost_contribution BIGINT NOT NULL,
  week_start DATE NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shop_char_week ON sect_shop_purchases (character_id, week_start, item_key);

-- ========================================
-- 宗门功法
-- ========================================
CREATE TABLE IF NOT EXISTS sect_skills (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id),
  skill_key VARCHAR(30) NOT NULL,
  level INT DEFAULT 1,
  frozen BOOLEAN DEFAULT FALSE,
  UNIQUE (character_id, skill_key)
);

-- ========================================
-- 成就系统
-- ========================================
CREATE TABLE IF NOT EXISTS character_achievements (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  achievement_id VARCHAR(30) NOT NULL,
  progress INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  claimed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP DEFAULT NULL,
  claimed_at TIMESTAMP DEFAULT NULL,
  UNIQUE (character_id, achievement_id)
);

-- ========================================
-- 秘境组队系统
-- ========================================

-- 角色增加秘境相关字段
ALTER TABLE characters ADD COLUMN IF NOT EXISTS realm_points INT DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sr_daily_count SMALLINT DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sr_daily_date DATE DEFAULT NULL;

-- 队伍房间表
CREATE TABLE IF NOT EXISTS team_rooms (
  id SERIAL PRIMARY KEY,
  leader_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  secret_realm_id VARCHAR(10) NOT NULL,
  difficulty SMALLINT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  max_members SMALLINT NOT NULL DEFAULT 4,
  current_members SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP DEFAULT NULL,
  finished_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_rooms_lobby ON team_rooms (status, secret_realm_id, difficulty, created_at DESC);

-- 队伍成员表
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL REFERENCES team_rooms(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  is_leader BOOLEAN NOT NULL DEFAULT FALSE,
  join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (room_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_char ON team_members (character_id);
CREATE INDEX IF NOT EXISTS idx_team_members_room ON team_members (room_id);

-- 秘境战斗记录表
CREATE TABLE IF NOT EXISTS secret_realm_battles (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL REFERENCES team_rooms(id) ON DELETE CASCADE,
  secret_realm_id VARCHAR(10) NOT NULL,
  difficulty SMALLINT NOT NULL,
  result VARCHAR(10) NOT NULL,
  waves_cleared SMALLINT NOT NULL DEFAULT 0,
  total_turns SMALLINT NOT NULL DEFAULT 0,
  rating VARCHAR(2) DEFAULT NULL,
  battle_log JSONB DEFAULT NULL,
  finished_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 秘境个人奖励表
CREATE TABLE IF NOT EXISTS secret_realm_rewards (
  id SERIAL PRIMARY KEY,
  battle_id INT NOT NULL REFERENCES secret_realm_battles(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  spirit_stone INT NOT NULL DEFAULT 0,
  exp_gained BIGINT NOT NULL DEFAULT 0,
  level_exp BIGINT NOT NULL DEFAULT 0,
  realm_points INT NOT NULL DEFAULT 0,
  equipment_ids JSONB DEFAULT '[]',
  extra_drops JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 秘境贡献表
CREATE TABLE IF NOT EXISTS secret_realm_contributions (
  id SERIAL PRIMARY KEY,
  battle_id INT NOT NULL REFERENCES secret_realm_battles(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  damage_dealt BIGINT NOT NULL DEFAULT 0,
  healing_done BIGINT NOT NULL DEFAULT 0,
  damage_taken BIGINT NOT NULL DEFAULT 0,
  contribution INT NOT NULL DEFAULT 0
);

-- 秘境通关记录表
CREATE TABLE IF NOT EXISTS secret_realm_clears (
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  secret_realm_id VARCHAR(10) NOT NULL,
  difficulty SMALLINT NOT NULL,
  best_rating VARCHAR(2) DEFAULT NULL,
  clear_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (character_id, secret_realm_id, difficulty)
);

-- 秘境战斗记录
CREATE TABLE IF NOT EXISTS secret_realm_battles (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL REFERENCES team_rooms(id),
  secret_realm_id VARCHAR(10) NOT NULL,
  difficulty SMALLINT NOT NULL,
  result VARCHAR(10),
  waves_cleared SMALLINT NOT NULL DEFAULT 0,
  total_turns INT NOT NULL DEFAULT 0,
  rating CHAR(1) DEFAULT NULL,
  battle_log JSONB,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_srb_room ON secret_realm_battles (room_id);

-- 秘境个人贡献
CREATE TABLE IF NOT EXISTS secret_realm_contributions (
  id SERIAL PRIMARY KEY,
  battle_id INT NOT NULL REFERENCES secret_realm_battles(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id),
  damage_dealt BIGINT NOT NULL DEFAULT 0,
  healing_done BIGINT NOT NULL DEFAULT 0,
  damage_taken BIGINT NOT NULL DEFAULT 0,
  contribution REAL NOT NULL DEFAULT 0,
  UNIQUE (battle_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_src_char ON secret_realm_contributions (character_id);

-- 秘境奖励记录
CREATE TABLE IF NOT EXISTS secret_realm_rewards (
  id SERIAL PRIMARY KEY,
  battle_id INT NOT NULL REFERENCES secret_realm_battles(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id),
  spirit_stone BIGINT NOT NULL DEFAULT 0,
  exp_gained BIGINT NOT NULL DEFAULT 0,
  level_exp BIGINT NOT NULL DEFAULT 0,
  realm_points INT NOT NULL DEFAULT 0,
  equipment_ids JSONB,
  extra_drops JSONB,
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (battle_id, character_id)
);

-- 秘境通关记录（首通判定）
CREATE TABLE IF NOT EXISTS secret_realm_clears (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  secret_realm_id VARCHAR(10) NOT NULL,
  difficulty SMALLINT NOT NULL,
  first_clear_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  best_rating CHAR(1) DEFAULT NULL,
  clear_count INT NOT NULL DEFAULT 1,
  UNIQUE (character_id, secret_realm_id, difficulty)
);

CREATE INDEX IF NOT EXISTS idx_src_clear_char ON secret_realm_clears (character_id);
