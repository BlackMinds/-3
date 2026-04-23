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

-- 战斗并发守卫：存"上场战斗预期结束时间"，跨请求/跨刷新持久化
ALTER TABLE characters ADD COLUMN IF NOT EXISTS battle_end_at TIMESTAMP DEFAULT NULL;

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
  awaken_effect JSONB DEFAULT NULL,
  set_id VARCHAR(50) DEFAULT NULL,
  enhance_level INT DEFAULT 0,
  req_level INT DEFAULT 1,
  tier INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 增量迁移（兼容已有 character_equipment 表）
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS awaken_effect JSONB DEFAULT NULL;

-- ========================================
-- 角色功法背包
-- ========================================
CREATE TABLE IF NOT EXISTS character_skill_inventory (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_id VARCHAR(50) NOT NULL,
  count INT DEFAULT 1,
  level INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, skill_id)
);

-- 增量迁移：功法等级字段（脱离已装备表，卸下不丢等级）
ALTER TABLE character_skill_inventory ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;

-- 一次性回填：把 character_skills 里可能更高的 level 先抬到 inventory（防降级）
UPDATE character_skill_inventory csi
SET level = sub.max_lv
FROM (
  SELECT character_id, skill_id, MAX(level) AS max_lv
  FROM character_skills
  GROUP BY character_id, skill_id
) sub
WHERE csi.character_id = sub.character_id
  AND csi.skill_id = sub.skill_id
  AND csi.level < sub.max_lv;

-- 根治脏数据：以 inventory 为唯一真相，把所有 character_skills 镜像行的 level 同步过去
-- （修复历史上出现的"同 skill_id 多行等级不一致"问题 —— 升级接口命中错行导致显示 Lv.1 却提示已满级）
UPDATE character_skills cs
SET level = csi.level
FROM character_skill_inventory csi
WHERE cs.character_id = csi.character_id
  AND cs.skill_id = csi.skill_id
  AND cs.level <> csi.level;

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
-- 已解锁高级丹方(通过宗门商店购买解锁)
-- ========================================
CREATE TABLE IF NOT EXISTS character_unlocked_recipes (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  pill_id VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, pill_id)
);
CREATE INDEX IF NOT EXISTS idx_unlocked_recipes_char ON character_unlocked_recipes(character_id);

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
  herb_quality VARCHAR(20) DEFAULT NULL,
  plant_time TIMESTAMP DEFAULT NULL,
  mature_time TIMESTAMP DEFAULT NULL,
  yield_count SMALLINT DEFAULT 0,
  planted_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, plot_index)
);
-- 旧库兼容字段
ALTER TABLE character_cave_plots ADD COLUMN IF NOT EXISTS herb_quality VARCHAR(20) DEFAULT NULL;
ALTER TABLE character_cave_plots ADD COLUMN IF NOT EXISTS plant_time TIMESTAMP DEFAULT NULL;
ALTER TABLE character_cave_plots ADD COLUMN IF NOT EXISTS mature_time TIMESTAMP DEFAULT NULL;
ALTER TABLE character_cave_plots ADD COLUMN IF NOT EXISTS yield_count SMALLINT DEFAULT 0;

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

DROP TRIGGER IF EXISTS set_sects_updated_at ON sects;
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

-- ========================================
-- 随机事件系统（天道造化 / 风云阁）
-- ========================================

-- characters 扩展字段（用于抽奖候选池与中奖待领取）
ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS event_last_won_at TIMESTAMP DEFAULT NULL;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS event_pending_id INT DEFAULT NULL;

-- v3.3 突破丹改为 "+20% 下次突破成功率"：嗑丹后置位，突破时消耗
ALTER TABLE characters ADD COLUMN IF NOT EXISTS breakthrough_boost_pending BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_char_active ON characters (last_active_at);

-- 事件日志（个人流水）
CREATE TABLE IF NOT EXISTS character_event_log (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  event_id VARCHAR(10) NOT NULL,          -- E001 ~ E020
  rarity VARCHAR(20) NOT NULL,            -- common/rare/epic/legendary
  is_positive BOOLEAN NOT NULL DEFAULT TRUE,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  reward JSONB NOT NULL                   -- 实际生效的奖励/损失详情
);

CREATE INDEX IF NOT EXISTS idx_event_log_char ON character_event_log (character_id, triggered_at DESC);

-- 风云阁广播（全服热榜，冗余表加速查询）
CREATE TABLE IF NOT EXISTS world_broadcast (
  id SERIAL PRIMARY KEY,
  log_id INT NOT NULL REFERENCES character_event_log(id) ON DELETE CASCADE,
  character_id INT NOT NULL,
  character_name VARCHAR(8) NOT NULL,     -- 冗余
  sect_id INT DEFAULT NULL,               -- 冗余
  event_id VARCHAR(10) NOT NULL,
  rarity VARCHAR(20) NOT NULL,
  is_positive BOOLEAN NOT NULL DEFAULT TRUE,
  rendered_text TEXT NOT NULL,            -- 预渲染广播文案
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_broadcast_recent ON world_broadcast (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_rarity ON world_broadcast (rarity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_sect ON world_broadcast (sect_id, created_at DESC);

-- ========================================
-- 站内邮件系统（共用基础设施）
-- ========================================
CREATE TABLE IF NOT EXISTS mails (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL,
  title VARCHAR(80) NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  ref_type VARCHAR(30),
  ref_id VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  is_claimed BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP DEFAULT NULL,
  claimed_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_mail_char_unread ON mails (character_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_char_unclaimed ON mails (character_id, is_claimed) WHERE is_claimed = FALSE;
CREATE INDEX IF NOT EXISTS idx_mail_expires ON mails (expires_at);

-- ========================================
-- 通用限时 Buff 表（玩法奖励专用，非丹药）
-- ========================================
CREATE TABLE IF NOT EXISTS timed_buffs (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  source_type VARCHAR(30) NOT NULL,
  source_id VARCHAR(50) NOT NULL DEFAULT '',
  stat_key VARCHAR(20) NOT NULL,
  stat_value DECIMAL(6,2) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, source_type, source_id, stat_key)
);

CREATE INDEX IF NOT EXISTS idx_timed_buff_char ON timed_buffs (character_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_timed_buff_source ON timed_buffs (source_type, source_id);

-- ========================================
-- 宗门战专用表
-- ========================================
CREATE TABLE IF NOT EXISTS sect_war_season (
  id SERIAL PRIMARY KEY,
  season_no INT NOT NULL UNIQUE,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status VARCHAR(15) NOT NULL CHECK (status IN ('registering','betting','fighting','settled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sect_war_registration (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES sect_war_season(id) ON DELETE CASCADE,
  sect_id INT NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
  roster_duel JSONB NOT NULL,
  roster_team_a JSONB NOT NULL,
  roster_team_b JSONB NOT NULL,
  total_power BIGINT NOT NULL,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (season_id, sect_id)
);

CREATE TABLE IF NOT EXISTS sect_war_match (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES sect_war_season(id) ON DELETE CASCADE,
  round_no SMALLINT NOT NULL DEFAULT 1,
  sect_a_id INT NOT NULL REFERENCES sects(id),
  sect_b_id INT NOT NULL REFERENCES sects(id),
  odds_a DECIMAL(5,2) NOT NULL,
  odds_b DECIMAL(5,2) NOT NULL,
  winner_sect_id INT DEFAULT NULL,
  score_a INT DEFAULT 0,
  score_b INT DEFAULT 0,
  mvp_character_id INT DEFAULT NULL,
  fought_at TIMESTAMP DEFAULT NULL,
  settled_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS sect_war_battle (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL REFERENCES sect_war_match(id) ON DELETE CASCADE,
  round_no SMALLINT NOT NULL,
  battle_type VARCHAR(10) NOT NULL CHECK (battle_type IN ('duel','team')),
  side_a_chars JSONB NOT NULL,
  side_b_chars JSONB NOT NULL,
  winner_side VARCHAR(1) NOT NULL CHECK (winner_side IN ('a','b')),
  battle_log JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sect_war_bet (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL REFERENCES sect_war_match(id) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  bet_side VARCHAR(1) NOT NULL CHECK (bet_side IN ('a','b')),
  bet_amount BIGINT NOT NULL,
  odds_at_bet DECIMAL(5,2) NOT NULL,
  payout BIGINT DEFAULT 0,
  status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','refunded')),
  placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_bet_match_char ON sect_war_bet (match_id, character_id);
CREATE INDEX IF NOT EXISTS idx_match_season ON sect_war_match (season_id, winner_sect_id);
CREATE INDEX IF NOT EXISTS idx_registration_season ON sect_war_registration (season_id);
CREATE INDEX IF NOT EXISTS idx_battle_match_round ON sect_war_battle (match_id, round_no);

-- ========================================
-- 灵脉潮汐专用表
-- ========================================
CREATE TABLE IF NOT EXISTS spirit_vein_node (
  id SMALLINT PRIMARY KEY,
  name VARCHAR(20) NOT NULL,
  tier VARCHAR(10) NOT NULL CHECK (tier IN ('low','mid','high','supreme')),
  stone_reward INT NOT NULL,
  exp_reward INT NOT NULL,
  guard_limit SMALLINT NOT NULL,
  min_sect_level SMALLINT NOT NULL
);

-- 初始化 6 个节点（静态配置）
INSERT INTO spirit_vein_node (id, name, tier, stone_reward, exp_reward, guard_limit, min_sect_level) VALUES
  (1, '青木灵脉', 'low',     2000,  500, 2, 1),
  (2, '赤焰灵脉', 'low',     2000,  500, 2, 1),
  (3, '玄水灵脉', 'mid',     5000, 1200, 3, 3),
  (4, '黄土灵脉', 'mid',     5000, 1200, 3, 3),
  (5, '白金灵脉', 'high',   12000, 3000, 4, 5),
  (6, '九天灵脉', 'supreme',25000, 6000, 5, 7)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS spirit_vein_occupation (
  node_id SMALLINT PRIMARY KEY REFERENCES spirit_vein_node(id),
  sect_id INT DEFAULT NULL REFERENCES sects(id) ON DELETE SET NULL,
  current_guard_count SMALLINT DEFAULT 0,
  occupied_at TIMESTAMP DEFAULT NULL,
  next_surge_at TIMESTAMP NOT NULL,
  vacuum_until TIMESTAMP DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化 occupation 行（每个节点一行）
INSERT INTO spirit_vein_occupation (node_id, next_surge_at) VALUES
  (1, date_trunc('hour', NOW()) + INTERVAL '2 hours'),
  (2, date_trunc('hour', NOW()) + INTERVAL '2 hours'),
  (3, date_trunc('hour', NOW()) + INTERVAL '2 hours'),
  (4, date_trunc('hour', NOW()) + INTERVAL '2 hours'),
  (5, date_trunc('hour', NOW()) + INTERVAL '2 hours'),
  (6, date_trunc('hour', NOW()) + INTERVAL '2 hours')
ON CONFLICT (node_id) DO NOTHING;

DROP TRIGGER IF EXISTS set_sv_occupation_updated_at ON spirit_vein_occupation;
CREATE TRIGGER set_sv_occupation_updated_at
  BEFORE UPDATE ON spirit_vein_occupation
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TABLE IF NOT EXISTS spirit_vein_guard (
  id SERIAL PRIMARY KEY,
  node_id SMALLINT NOT NULL REFERENCES spirit_vein_node(id),
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  sect_id INT NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE (node_id, character_id)
);

CREATE TABLE IF NOT EXISTS spirit_vein_cooldown (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  cd_type VARCHAR(20) NOT NULL CHECK (cd_type IN ('defend_injured','attack_injured','attack_node')),
  target_node_id SMALLINT DEFAULT NULL REFERENCES spirit_vein_node(id),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spirit_vein_surge_log (
  id SERIAL PRIMARY KEY,
  node_id SMALLINT NOT NULL REFERENCES spirit_vein_node(id),
  sect_id INT DEFAULT NULL REFERENCES sects(id) ON DELETE SET NULL,
  surge_at TIMESTAMP NOT NULL,
  sect_stone_granted INT DEFAULT 0,
  rare_drops JSONB DEFAULT '[]'::jsonb,
  guards_snapshot JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spirit_vein_raid (
  id SERIAL PRIMARY KEY,
  node_id SMALLINT NOT NULL REFERENCES spirit_vein_node(id),
  attacker_sect_id INT NOT NULL REFERENCES sects(id),
  defender_sect_id INT DEFAULT NULL REFERENCES sects(id),
  attackers JSONB NOT NULL,
  defenders JSONB NOT NULL,
  winner_side VARCHAR(10) NOT NULL CHECK (winner_side IN ('attacker','defender')),
  battle_log JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spirit_vein_daily_raid_count (
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  raid_date DATE NOT NULL,
  count SMALLINT DEFAULT 0,
  PRIMARY KEY (character_id, raid_date)
);

CREATE TABLE IF NOT EXISTS spirit_vein_jackpot (
  week_start DATE PRIMARY KEY,
  pool_amount BIGINT DEFAULT 0,
  raid_count_total INT DEFAULT 0,
  settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sv_guard_node ON spirit_vein_guard (node_id);
CREATE INDEX IF NOT EXISTS idx_sv_guard_char ON spirit_vein_guard (character_id);
CREATE INDEX IF NOT EXISTS idx_sv_guard_expires ON spirit_vein_guard (expires_at);
CREATE INDEX IF NOT EXISTS idx_sv_cd_char_type ON spirit_vein_cooldown (character_id, cd_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_sv_surge_node_time ON spirit_vein_surge_log (node_id, surge_at DESC);
CREATE INDEX IF NOT EXISTS idx_sv_raid_node ON spirit_vein_raid (node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sv_occ_sect ON spirit_vein_occupation (sect_id);

-- ========================================
-- 成就追踪字段（欧皇降临 / 非酋附体）
-- 装备维度：本件装备强化路径是否"不干净"——失败过或用过强化保护符 / 大师符都置 TRUE
-- 角色维度：连续强化失败次数，成功归零
-- ========================================
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS enhance_ever_failed BOOLEAN DEFAULT FALSE;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS enhance_fail_streak INT DEFAULT 0;

-- 炼丹连续成功计数（绝不浪费成就）：成功 +1，失败归零，达到 10 触发一次
ALTER TABLE characters ADD COLUMN IF NOT EXISTS pill_craft_streak INT DEFAULT 0;

-- 地图访问记录（踏遍青山 / 万界行者 成就）
CREATE TABLE IF NOT EXISTS character_map_visits (
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  map_id VARCHAR(50) NOT NULL,
  first_visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (character_id, map_id)
);

-- ========================================
-- 赞助特权（联系群主手动开通，SQL 发放）
-- ========================================
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sponsor_oneclick_plant BOOLEAN DEFAULT FALSE;
-- 洞府产出倍率（聚灵阵修为 / 聚宝盆灵石），默认 1.0，发放 2.0 或 3.0
ALTER TABLE characters ADD COLUMN IF NOT EXISTS cave_output_mul DECIMAL(3,1) DEFAULT 1.0;
-- 赞助到期时间；为 NULL 表示永久；过期后产出倍率按 1.0 处理
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sponsor_expire_at TIMESTAMP DEFAULT NULL;
-- 秘境每日次数加成（叠加到 getDailyCountByRealm 之上），过期时间独立
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sr_daily_bonus SMALLINT DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sr_bonus_expire_at TIMESTAMP DEFAULT NULL;
-- 发放示例：
--   UPDATE characters SET sponsor_oneclick_plant = TRUE WHERE name = '玩家名';
--   UPDATE characters SET cave_output_mul = 1.5 WHERE name = '玩家名';  -- 永久 1.5 倍
--   UPDATE characters SET cave_output_mul = 2.0, sponsor_expire_at = NOW() + INTERVAL '30 days' WHERE name = '玩家名';
--   UPDATE characters SET sr_daily_bonus = 1, sr_bonus_expire_at = NOW() + INTERVAL '30 days' WHERE name = '玩家名';

-- ========================================
-- 斗法台 PvP 战斗记录
-- ========================================
-- 玩家 vs 玩家 1v1 异步对战，每日 10 次主动挑战 / 10 次被扣修为上限
-- 失败方扣 1% 境界修为；战报存 JSONB
CREATE TABLE IF NOT EXISTS pk_records (
  id BIGSERIAL PRIMARY KEY,
  attacker_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  defender_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  attacker_name VARCHAR(50) NOT NULL,
  defender_name VARCHAR(50) NOT NULL,
  winner_side CHAR(1) NOT NULL CHECK (winner_side IN ('a','b')),
  cultivation_loss BIGINT NOT NULL DEFAULT 0,
  battle_log JSONB NOT NULL,
  fought_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pk_attacker_day ON pk_records (attacker_id, fought_at);
CREATE INDEX IF NOT EXISTS idx_pk_defender_day ON pk_records (defender_id, fought_at);
