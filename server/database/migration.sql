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
  crit_dmg DECIMAL(5,4) DEFAULT 1.0000,
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
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 增量迁移（兼容已有 character_equipment 表）
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS awaken_effect JSONB DEFAULT NULL;
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

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
  total_contribution BIGINT DEFAULT 0,
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
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sr_daily_fail SMALLINT DEFAULT 0;

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

-- 秘境商店购买记录（秘境积分商店，周限购）
CREATE TABLE IF NOT EXISTS realm_shop_purchases (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_key VARCHAR(50) NOT NULL,
  quantity INT DEFAULT 1,
  cost_points INT NOT NULL,
  week_start DATE NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_realm_shop_char_week ON realm_shop_purchases (character_id, week_start, item_key);

-- ========================================
-- 随机事件系统（天道造化 / 风云阁）
-- ========================================

-- characters 扩展字段（用于抽奖候选池与中奖待领取）
ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS event_last_won_at TIMESTAMP DEFAULT NULL;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS event_pending_id INT DEFAULT NULL;

-- v3.3 突破丹改为 "+20% 下次突破成功率"：嗑丹后置位，突破时消耗
ALTER TABLE characters ADD COLUMN IF NOT EXISTS breakthrough_boost_pending BOOLEAN DEFAULT FALSE;

-- v3.7 突破丹改为分档数值（小突破丹 +10% / 宗门突破丹 +20% / 突破丹 +25%），高覆盖低、不叠加
-- 0 表示未激活，>0 表示已激活的 buff 百分比
ALTER TABLE characters ADD COLUMN IF NOT EXISTS breakthrough_boost_pct SMALLINT NOT NULL DEFAULT 0;
-- 兼容老字段：之前已 pending=TRUE 的回填到 pct=20
UPDATE characters SET breakthrough_boost_pct = 20
  WHERE breakthrough_boost_pending = TRUE AND breakthrough_boost_pct = 0;

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
-- log_id 在 v4.1 后允许为空：斗法连胜等非"个人随机事件"来源也复用此表
CREATE TABLE IF NOT EXISTS world_broadcast (
  id SERIAL PRIMARY KEY,
  log_id INT REFERENCES character_event_log(id) ON DELETE CASCADE,
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

-- 初始化 9 个节点（静态配置）
-- v3.7 灵石奖励 -60%（低档 2000→800 / 中档 5000→2000 / 上档 12000→4800 / 极品 25000→10000），修为不变
-- v3.x 节点 6→9：低/中/上各 +1（低×3 / 中×3 / 上×2 / 极×1），仅产出灵石+修为，不再有稀有掉落
INSERT INTO spirit_vein_node (id, name, tier, stone_reward, exp_reward, guard_limit, min_sect_level) VALUES
  (1, '青木灵脉', 'low',      800,  500, 2, 1),
  (2, '赤焰灵脉', 'low',      800,  500, 2, 1),
  (3, '玄水灵脉', 'mid',     2000, 1200, 3, 3),
  (4, '黄土灵脉', 'mid',     2000, 1200, 3, 3),
  (5, '白金灵脉', 'high',    4800, 3000, 4, 5),
  (6, '九天灵脉', 'supreme',10000, 6000, 5, 7),
  (7, '岚风灵脉', 'low',      800,  500, 2, 1),
  (8, '玄霜灵脉', 'mid',     2000, 1200, 3, 3),
  (9, '紫电灵脉', 'high',    4800, 3000, 4, 5)
ON CONFLICT (id) DO NOTHING;

-- 老库回填：灵石奖励 -60%（幂等，只改值匹配旧档的行）
UPDATE spirit_vein_node SET stone_reward =   800 WHERE id IN (1, 2) AND stone_reward =  2000;
UPDATE spirit_vein_node SET stone_reward =  2000 WHERE id IN (3, 4) AND stone_reward =  5000;
UPDATE spirit_vein_node SET stone_reward =  4800 WHERE id =  5      AND stone_reward = 12000;
UPDATE spirit_vein_node SET stone_reward = 10000 WHERE id =  6      AND stone_reward = 25000;

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
  (6, date_trunc('hour', NOW()) + INTERVAL '2 hours'),
  (7, date_trunc('hour', NOW()) + INTERVAL '2 hours'),
  (8, date_trunc('hour', NOW()) + INTERVAL '2 hours'),
  (9, date_trunc('hour', NOW()) + INTERVAL '2 hours')
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
-- 玩家 vs 玩家 1v1 异步对战，每日 10 次主动挑战 / 10 次败场扣分上限
-- 胜负计入斗法积分，败方按境界差扣分；战报存 JSONB
-- cultivation_loss 字段保留向后兼容（历史记录），新数据始终写 0
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

-- ========================================
-- 兑换码（CDKEY）系统
-- ========================================
-- code 直接做主键；attachments 复用邮件附件 JSON 格式（{type, itemId, quality, qty} 等）
-- claims 表 UNIQUE(code, character_id) 保证每码每人只能领一次
CREATE TABLE IF NOT EXISTS redeem_codes (
  code VARCHAR(32) PRIMARY KEY,
  attachments JSONB NOT NULL,
  description VARCHAR(100) DEFAULT '',
  expires_at TIMESTAMP DEFAULT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS redeem_code_claims (
  id SERIAL PRIMARY KEY,
  code VARCHAR(32) NOT NULL REFERENCES redeem_codes(code) ON DELETE CASCADE,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (code, character_id)
);
CREATE INDEX IF NOT EXISTS idx_redeem_claims_char ON redeem_code_claims (character_id);

-- 内置兑换码：附灵道具大礼包
-- 附灵石/灵枢玉权威表是 character_pills（不是 character_materials），用 pill 类型附件
-- 已存在则覆盖更新 attachments，方便修订奖励内容
INSERT INTO redeem_codes (code, attachments, description) VALUES
('XIANTU2026', '[
  {"type":"pill","pillId":"awaken_stone","qty":10},
  {"type":"pill","pillId":"awaken_reroll","qty":20}
]'::jsonb, '附灵道具大礼包：附灵石×10 + 灵枢玉×20')
ON CONFLICT (code) DO UPDATE SET
  attachments = EXCLUDED.attachments,
  description = EXCLUDED.description;

-- 5.1 劳动节兑换码（2026-05-01）
INSERT INTO redeem_codes (code, attachments, description) VALUES
('LABOR2026', '[
  {"type":"pill","pillId":"awaken_reroll","qty":30},
  {"type":"pill","pillId":"awaken_stone","qty":20},
  {"type":"pill","pillId":"reroll_sub_stat","qty":20}
]'::jsonb, '5.1 劳动节大礼：灵枢玉×30 + 附灵石×20 + 装备鉴定符×20')
ON CONFLICT (code) DO UPDATE SET
  attachments = EXCLUDED.attachments,
  description = EXCLUDED.description;

-- ========================================
-- 破妄丹（crit_pill_1）下线 - 数据清理与玩家补偿（2026-04-25）
-- ========================================
-- 退还策略：
--   1) 已解锁配方：邮件返还 3000 宗门贡献（按购买原价）
--   2) 背包内剩余瓶数：邮件返还 3000 × count 灵石（按炼制基础成本）
--   3) 在生效的 buff：静默清除（数值微小，不补偿）
-- 幂等：用 ref_type 唯一标记，已发过补偿邮件的玩家不会重复发
-- 顺序：先发邮件 → 再删源数据；任意中断都能再次安全执行

-- 1) 已解锁配方退贡献
INSERT INTO mails (character_id, category, title, content, attachments, ref_type, ref_id, expires_at)
SELECT
  ur.character_id,
  'system',
  '【破妄丹】下线补偿',
  '尊敬的道友：破妄丹已从仙途退场。系统返还您当初购买丹方的 3000 宗门贡献。',
  jsonb_build_array(jsonb_build_object('type','contribution','amount',3000)),
  'cleanup_crit_pill_1_recipe',
  ur.character_id::text,
  NOW() + INTERVAL '30 days'
FROM character_unlocked_recipes ur
WHERE ur.pill_id = 'crit_pill_1'
  AND NOT EXISTS (
    SELECT 1 FROM mails m
    WHERE m.character_id = ur.character_id
      AND m.ref_type = 'cleanup_crit_pill_1_recipe'
  );

-- 2) 背包瓶数按 3000×count 退灵石（聚合多 quality_factor 行）
WITH pill_holders AS (
  SELECT character_id, SUM(count)::int AS total_count
  FROM character_pills
  WHERE pill_id = 'crit_pill_1'
  GROUP BY character_id
)
INSERT INTO mails (character_id, category, title, content, attachments, ref_type, ref_id, expires_at)
SELECT
  ph.character_id,
  'system',
  '【破妄丹】回收返还',
  format('尊敬的道友：破妄丹已从仙途退场。背包中 %s 瓶破妄丹按炼制基础成本返还 %s 灵石。', ph.total_count, ph.total_count * 3000),
  jsonb_build_array(jsonb_build_object('type','spirit_stone','amount', ph.total_count * 3000)),
  'cleanup_crit_pill_1_pills',
  ph.character_id::text,
  NOW() + INTERVAL '30 days'
FROM pill_holders ph
WHERE NOT EXISTS (
  SELECT 1 FROM mails m
  WHERE m.character_id = ph.character_id
    AND m.ref_type = 'cleanup_crit_pill_1_pills'
);

-- 3) 删除残留数据（邮件已发，可安全删除）
DELETE FROM character_buffs           WHERE pill_id = 'crit_pill_1';
DELETE FROM character_pills           WHERE pill_id = 'crit_pill_1';
DELETE FROM character_unlocked_recipes WHERE pill_id = 'crit_pill_1';

-- ========================================
-- 戒指主属性 CRIT_RATE → CRIT_DMG（2026-04-25）
-- ========================================
-- 因戒指主属性改为会心伤害（base 0.8 → 2.0），按 ×2.5 缩放原 primary_value
-- WHERE 仅匹配旧 CRIT_RATE 行，幂等：跑过一次后不会重复匹配
UPDATE character_equipment
SET primary_stat = 'CRIT_DMG',
    primary_value = GREATEST(1, ROUND(primary_value * 2.5)::int)
WHERE base_slot = 'ring' AND primary_stat = 'CRIT_RATE';

-- ========================================
-- 玄冥附灵削弱 (aw_doom): tiers 整体 ×0.7（2026-04-25）
-- ========================================
-- 戒指改 CRIT_DMG 主属性后，玄冥 red 50% 占 cap 余量 38% 偏强；
-- 按比例下调 blue 12→8 / purple 22→15 / gold 34→24 / red 50→35。
-- 已发出的玄冥附灵按映射缩，幂等（新值不在旧值列表里，二次跑不会再缩）。
UPDATE character_equipment
SET awaken_effect = jsonb_set(
  awaken_effect,
  '{value}',
  CASE (awaken_effect->>'value')::numeric
    WHEN 0.12 THEN '0.08'::jsonb
    WHEN 0.22 THEN '0.15'::jsonb
    WHEN 0.34 THEN '0.24'::jsonb
    WHEN 0.50 THEN '0.35'::jsonb
    ELSE awaken_effect->'value'
  END
)
WHERE awaken_effect->>'id' = 'aw_doom'
  AND (awaken_effect->>'value')::numeric IN (0.12, 0.22, 0.34, 0.50);

-- ============================================
-- 离线挂机 v2: 开始离线时快照角色完整战斗输入
-- 结算时基于快照真打 N 场，按胜率算收益（防止低战力切高图刷收益）
-- ============================================
ALTER TABLE characters ADD COLUMN IF NOT EXISTS offline_snapshot JSONB DEFAULT NULL;

-- ============================================
-- 斗法积分（2026-04-25）
-- 斗法台 1v1 PvP 胜负积分，用于风云榜·斗法榜排序
-- 起始 1000；胜 +20 / 败 -10（floor 0，跨境界加权）；同一玩家单日败场超过 DAILY_LOSS_LIMIT 后不再扣分
-- ============================================
ALTER TABLE characters ADD COLUMN IF NOT EXISTS arena_score INT NOT NULL DEFAULT 1000;
CREATE INDEX IF NOT EXISTS idx_arena_rank ON characters (arena_score DESC);

-- ============================================
-- 数据修复（2026-04-27）：兑换码 XIANTU2026 早期版本误把 awaken_stone/awaken_reroll
-- 写到 character_materials（dd08027 → c9f3893 之间），那段窗口领过的玩家因为 claims
-- 已记录无法重领，前端只读 character_pills 导致道具看不见。把孤儿数据迁回 pills 表。
-- 幂等：DELETE 完后下次跑 INSERT SELECT 选不到行。
-- character_materials 不会有任何合法的 awaken_stone/awaken_reroll 来源（仅灵草入库）。
-- ============================================
INSERT INTO character_pills (character_id, pill_id, quality_factor, count)
SELECT character_id, 'awaken_stone', 1.0, count
FROM character_materials
WHERE material_id = 'awaken_stone'
ON CONFLICT (character_id, pill_id, quality_factor)
DO UPDATE SET count = character_pills.count + EXCLUDED.count;

INSERT INTO character_pills (character_id, pill_id, quality_factor, count)
SELECT character_id, 'awaken_reroll', 1.0, count
FROM character_materials
WHERE material_id = 'awaken_reroll'
ON CONFLICT (character_id, pill_id, quality_factor)
DO UPDATE SET count = character_pills.count + EXCLUDED.count;

DELETE FROM character_materials WHERE material_id IN ('awaken_stone', 'awaken_reroll');

-- ============================================
-- 宗门解散外键修复（2026-04-27）
-- sect_war_match / spirit_vein_raid 中引用 sects(id) 的字段早期未配 ON DELETE，
-- 导致宗主点【解散宗门】时若有任何宗战或灵脉对战记录就会因外键约束 500。
-- 全部改为 ON DELETE SET NULL：保留历史记录，宗门字段在解散后置空，
-- 配合查询的 LEFT JOIN 显示「已解散宗门」占位。
-- 幂等：DROP CONSTRAINT IF EXISTS + ALTER COLUMN DROP NOT NULL 都可重复执行。
-- ============================================
ALTER TABLE sect_war_match ALTER COLUMN sect_a_id DROP NOT NULL;
ALTER TABLE sect_war_match ALTER COLUMN sect_b_id DROP NOT NULL;
ALTER TABLE sect_war_match DROP CONSTRAINT IF EXISTS sect_war_match_sect_a_id_fkey;
ALTER TABLE sect_war_match DROP CONSTRAINT IF EXISTS sect_war_match_sect_b_id_fkey;
ALTER TABLE sect_war_match DROP CONSTRAINT IF EXISTS sect_war_match_winner_sect_id_fkey;
ALTER TABLE sect_war_match
  ADD CONSTRAINT sect_war_match_sect_a_id_fkey
  FOREIGN KEY (sect_a_id) REFERENCES sects(id) ON DELETE SET NULL;
ALTER TABLE sect_war_match
  ADD CONSTRAINT sect_war_match_sect_b_id_fkey
  FOREIGN KEY (sect_b_id) REFERENCES sects(id) ON DELETE SET NULL;
ALTER TABLE sect_war_match
  ADD CONSTRAINT sect_war_match_winner_sect_id_fkey
  FOREIGN KEY (winner_sect_id) REFERENCES sects(id) ON DELETE SET NULL;

ALTER TABLE spirit_vein_raid ALTER COLUMN attacker_sect_id DROP NOT NULL;
ALTER TABLE spirit_vein_raid DROP CONSTRAINT IF EXISTS spirit_vein_raid_attacker_sect_id_fkey;
ALTER TABLE spirit_vein_raid DROP CONSTRAINT IF EXISTS spirit_vein_raid_defender_sect_id_fkey;
ALTER TABLE spirit_vein_raid
  ADD CONSTRAINT spirit_vein_raid_attacker_sect_id_fkey
  FOREIGN KEY (attacker_sect_id) REFERENCES sects(id) ON DELETE SET NULL;
ALTER TABLE spirit_vein_raid
  ADD CONSTRAINT spirit_vein_raid_defender_sect_id_fkey
  FOREIGN KEY (defender_sect_id) REFERENCES sects(id) ON DELETE SET NULL;

-- 总贡献（累计获得，不会被消耗，用于职位任命资格判断）
ALTER TABLE sect_members ADD COLUMN IF NOT EXISTS total_contribution BIGINT DEFAULT 0;
UPDATE sect_members SET total_contribution = contribution WHERE total_contribution = 0 AND contribution > 0;

-- 境界突破保底（2026-04-28）：连续突破失败次数，每次 +5% 成功率，成功后清零
ALTER TABLE characters ADD COLUMN IF NOT EXISTS breakthrough_fail_streak SMALLINT NOT NULL DEFAULT 0;

-- ============================================
-- 装备方案 / Loadout（2026-05-04，2026-05-07 扩容到 5 套）
-- 玩家可保存 5 套装备方案（PvE/PvP/秘境/团战等），随时一键切换
-- character_equipment.slot 仍代表"当前激活方案下穿戴的槽位"
-- character_equipment_loadouts 存每套方案的 {slot: equip_id} 快照
-- equip/unequip 同步写当前激活方案；切换 = 把目标方案的 slots 应用到 character_equipment.slot
-- 卖装备时清掉所有方案中的引用，避免方案指向已删除装备
-- ============================================
ALTER TABLE characters ADD COLUMN IF NOT EXISTS active_loadout SMALLINT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS character_equipment_loadouts (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  loadout_id SMALLINT NOT NULL CHECK (loadout_id BETWEEN 1 AND 5),
  slots JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, loadout_id)
);

CREATE INDEX IF NOT EXISTS idx_loadout_char ON character_equipment_loadouts (character_id);

-- 2026-05-07：装备方案 3 → 5 套扩容；老库迁移 CHECK 约束
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'character_equipment_loadouts_loadout_id_check'
  ) THEN
    ALTER TABLE character_equipment_loadouts DROP CONSTRAINT character_equipment_loadouts_loadout_id_check;
  END IF;
  ALTER TABLE character_equipment_loadouts
    ADD CONSTRAINT character_equipment_loadouts_loadout_id_check
    CHECK (loadout_id BETWEEN 1 AND 5);
END $$;

-- 回填：所有玩家初始化方案 1（含当前装备快照）+ 空方案 2~5
INSERT INTO character_equipment_loadouts (character_id, loadout_id, slots)
SELECT c.id, 1,
       COALESCE(
         (SELECT jsonb_object_agg(ce.slot, ce.id)
          FROM character_equipment ce
          WHERE ce.character_id = c.id AND ce.slot IS NOT NULL),
         '{}'::jsonb
       )
FROM characters c
ON CONFLICT (character_id, loadout_id) DO NOTHING;

INSERT INTO character_equipment_loadouts (character_id, loadout_id, slots)
SELECT c.id, 2, '{}'::jsonb FROM characters c
ON CONFLICT (character_id, loadout_id) DO NOTHING;

INSERT INTO character_equipment_loadouts (character_id, loadout_id, slots)
SELECT c.id, 3, '{}'::jsonb FROM characters c
ON CONFLICT (character_id, loadout_id) DO NOTHING;

INSERT INTO character_equipment_loadouts (character_id, loadout_id, slots)
SELECT c.id, 4, '{}'::jsonb FROM characters c
ON CONFLICT (character_id, loadout_id) DO NOTHING;

INSERT INTO character_equipment_loadouts (character_id, loadout_id, slots)
SELECT c.id, 5, '{}'::jsonb FROM characters c
ON CONFLICT (character_id, loadout_id) DO NOTHING;

-- ============================================
-- 功法方案 / Skill Loadout（2026-05-07）
-- 玩家可保存 3 套功法方案，随时一键切换（主修/神通/被动整套切）
-- character_skills 仍代表"当前激活方案下装备的功法"
-- character_skill_loadouts 存每套方案的 [{skill_id, skill_type, slot_index}] 快照
-- save-equipped 同步写当前激活方案；卖功法时清掉所有方案中的引用
-- 切换 = 把目标方案的 payload 应用到 character_skills（清空再插入）
-- 槽位上限按当前境界复检，不在限制内的功法切换时跳过
-- ============================================
ALTER TABLE characters ADD COLUMN IF NOT EXISTS active_skill_loadout SMALLINT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS character_skill_loadouts (
  id SERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  loadout_id SMALLINT NOT NULL CHECK (loadout_id BETWEEN 1 AND 3),
  payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, loadout_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_loadout_char ON character_skill_loadouts (character_id);

-- 回填：方案 1 = 当前装备的功法快照；方案 2/3 默认空
INSERT INTO character_skill_loadouts (character_id, loadout_id, payload)
SELECT c.id, 1,
       COALESCE(
         (SELECT jsonb_agg(jsonb_build_object(
                  'skill_id', cs.skill_id,
                  'skill_type', cs.skill_type,
                  'slot_index', cs.slot_index))
          FROM character_skills cs
          WHERE cs.character_id = c.id AND cs.equipped = TRUE),
         '[]'::jsonb
       )
FROM characters c
ON CONFLICT (character_id, loadout_id) DO NOTHING;

INSERT INTO character_skill_loadouts (character_id, loadout_id, payload)
SELECT c.id, 2, '[]'::jsonb FROM characters c
ON CONFLICT (character_id, loadout_id) DO NOTHING;

INSERT INTO character_skill_loadouts (character_id, loadout_id, payload)
SELECT c.id, 3, '[]'::jsonb FROM characters c
ON CONFLICT (character_id, loadout_id) DO NOTHING;

-- ============================================
-- 坊市系统（v1.0, 2026-05-05）
-- 仅交易装备实例；门槛 紫色 + tier ≥ 3；每日成交 ≤ 10 件
-- 详见 design/system-market.md
-- ============================================

-- 装备绑定标记（默认 FALSE = 可流通；任务/宗门奖励等可置 TRUE）
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS is_bound BOOLEAN NOT NULL DEFAULT FALSE;

-- 挂单表
CREATE TABLE IF NOT EXISTS market_listings (
  id BIGSERIAL PRIMARY KEY,
  seller_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  category VARCHAR(16) NOT NULL DEFAULT 'equipment' CHECK (category IN ('equipment')),
  category_key VARCHAR(80) NOT NULL,
  item_snapshot JSONB NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity = 1),
  unit_price BIGINT NOT NULL CHECK (unit_price > 0),
  total_price BIGINT GENERATED ALWAYS AS (unit_price * quantity) STORED,
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','sold','cancelled','expired','risk_blocked')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP DEFAULT NULL,
  buyer_id INT DEFAULT NULL REFERENCES characters(id),
  tax_amount BIGINT DEFAULT 0,
  seller_received BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_market_active_category
  ON market_listings (category, category_key, unit_price)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_market_active_expires
  ON market_listings (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_market_seller
  ON market_listings (seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_buyer
  ON market_listings (buyer_id, closed_at DESC) WHERE buyer_id IS NOT NULL;

-- 成交流水表
CREATE TABLE IF NOT EXISTS market_transactions (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES market_listings(id),
  seller_id INT NOT NULL REFERENCES characters(id),
  buyer_id INT NOT NULL REFERENCES characters(id),
  category VARCHAR(16) NOT NULL DEFAULT 'equipment',
  category_key VARCHAR(80) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price BIGINT NOT NULL,
  total_price BIGINT NOT NULL,
  tax_amount BIGINT NOT NULL,
  seller_received BIGINT NOT NULL,
  risk_score SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_tx_category_time
  ON market_transactions (category_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_tx_seller_day
  ON market_transactions (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_tx_buyer_day
  ON market_transactions (buyer_id, created_at DESC);

-- 实时参考价
CREATE TABLE IF NOT EXISTS market_reference_price (
  category_key VARCHAR(80) PRIMARY KEY,
  ref_price BIGINT NOT NULL,
  sample_count INT NOT NULL,
  calc_method VARCHAR(16) NOT NULL CHECK (calc_method IN ('base','historical')),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 基础参考价（策划兜底；实际值在代码常量里维护，启动时回写此表，方便 SQL 直查）
CREATE TABLE IF NOT EXISTS market_base_price (
  category_key VARCHAR(80) PRIMARY KEY,
  base_price BIGINT NOT NULL,
  notes VARCHAR(200) DEFAULT ''
);

-- 每日限额缓存
CREATE TABLE IF NOT EXISTS market_daily_quota (
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quota_date DATE NOT NULL,
  listing_count INT DEFAULT 0,
  buy_count INT DEFAULT 0,
  sell_count INT DEFAULT 0,
  buy_amount BIGINT DEFAULT 0,
  sell_amount BIGINT DEFAULT 0,
  PRIMARY KEY (character_id, quota_date)
);

-- 风控日志（MVP 阶段先建表，后续阶段再接入实际规则）
CREATE TABLE IF NOT EXISTS market_risk_log (
  id BIGSERIAL PRIMARY KEY,
  character_id INT NOT NULL REFERENCES characters(id),
  listing_id BIGINT REFERENCES market_listings(id),
  rule_hit VARCHAR(30) NOT NULL,
  extra_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_risk_char
  ON market_risk_log (character_id, created_at DESC);

-- 天道洗髓丹兑换码（2026-05-05）
-- 灵根定向转换道具 ×5
INSERT INTO redeem_codes (code, attachments, description) VALUES
('XISUI2026', '[
  {"type":"pill","pillId":"reset_root","qty":5}
]'::jsonb, '天道洗髓丹×5（灵根定向转换）')
ON CONFLICT (code) DO UPDATE SET
  attachments = EXCLUDED.attachments,
  description = EXCLUDED.description;

-- ========================================
-- 一次性数据迁移记账表（避免重复执行 UPDATE 类迁移）
-- ========================================
CREATE TABLE IF NOT EXISTS _schema_migrations (
  id VARCHAR(80) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- v3.8.3 (2026-05-06): T11+ 装备主属性 tier 权重重算
-- ========================================
-- 配合 shared/balance.ts:getEquipTierWeight 改动 (tier <= 10 ? tier : 10 + (tier-10)*2):
--   T11 ×12/11 / T12 ×14/12 / T13 ×16/13 / T14 ×18/14 / T15 ×20/15
-- 涉及三处持久化数据：
--   1. character_equipment           — 玩家持有的装备
--   2. market_listings.item_snapshot — 市场挂单中的装备快照（status='active'）
--   3. mails.attachments[].snapshot  — 邮件附件中的装备快照（市场退回/系统奖励等）
-- 用 _schema_migrations 表保证幂等，跑过一次后再次执行不会再缩。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _schema_migrations WHERE id = 'v3_8_3_equip_tier_weight') THEN

    -- 1. character_equipment
    UPDATE character_equipment
       SET primary_value = GREATEST(
             1,
             FLOOR(primary_value::numeric * (10 + (tier - 10) * 2) / tier)::int
           )
     WHERE tier >= 11;

    -- 2. market_listings 挂单中的装备快照
    UPDATE market_listings
       SET item_snapshot = jsonb_set(
             item_snapshot,
             '{primary_value}',
             to_jsonb(GREATEST(
               1,
               FLOOR((item_snapshot->>'primary_value')::numeric
                     * (10 + ((item_snapshot->>'tier')::int - 10) * 2)
                     / (item_snapshot->>'tier')::int)::int
             ))
           )
     WHERE category = 'equipment'
       AND status = 'active'
       AND (item_snapshot ? 'tier')
       AND (item_snapshot->>'tier')::int >= 11;

    -- 3. mails.attachments 数组里 type='equipment' 且 tier>=11 的快照
    UPDATE mails m
       SET attachments = sub.new_atts
      FROM (
        SELECT m2.id,
               jsonb_agg(
                 CASE
                   WHEN att->>'type' = 'equipment'
                    AND (att->'snapshot' ? 'tier')
                    AND (att->'snapshot'->>'tier')::int >= 11
                   THEN jsonb_set(
                          att,
                          '{snapshot,primary_value}',
                          to_jsonb(GREATEST(
                            1,
                            FLOOR((att->'snapshot'->>'primary_value')::numeric
                                  * (10 + ((att->'snapshot'->>'tier')::int - 10) * 2)
                                  / (att->'snapshot'->>'tier')::int)::int
                          ))
                        )
                   ELSE att
                 END
                 ORDER BY ord
               ) AS new_atts
          FROM mails m2
          CROSS JOIN LATERAL jsonb_array_elements(m2.attachments)
                     WITH ORDINALITY AS x(att, ord)
         WHERE jsonb_typeof(m2.attachments) = 'array'
           AND jsonb_array_length(m2.attachments) > 0
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(m2.attachments) a
              WHERE a->>'type' = 'equipment'
                AND (a->'snapshot' ? 'tier')
                AND (a->'snapshot'->>'tier')::int >= 11
           )
         GROUP BY m2.id
      ) sub
     WHERE m.id = sub.id;

    INSERT INTO _schema_migrations (id) VALUES ('v3_8_3_equip_tier_weight');
  END IF;
END $$;

-- ========================================
-- 通天塔系统 (2026-05-06)
-- ========================================
-- 单人 PvE 阶梯挑战，100 层固定塔（MVP 阶段先做 1-25 层）。
-- 大乘起步（realm_tier ≥ 7 + Lv 140），每层独立战斗（重置满血+CD），
-- 每日失败 3 次锁，跨日重置。MVP 仅发"称号 + 一次性永久属性"（不发循环物品）。

ALTER TABLE characters ADD COLUMN IF NOT EXISTS tower_max_floor       SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS tower_daily_fail      SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS tower_daily_date      DATE     DEFAULT NULL;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS tower_last_sweep_date DATE     DEFAULT NULL;  -- 上次领取每日扫荡的日期

-- 战斗记录（保留所有场次，可用于战斗历史/复盘）
CREATE TABLE IF NOT EXISTS tower_battles (
  id            SERIAL PRIMARY KEY,
  character_id  INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  floor         SMALLINT NOT NULL,
  result        VARCHAR(10) NOT NULL,                     -- victory / defeat
  total_turns   INT NOT NULL DEFAULT 0,
  damage_dealt  BIGINT NOT NULL DEFAULT 0,
  damage_taken  BIGINT NOT NULL DEFAULT 0,
  battle_log    JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tower_battles_char ON tower_battles(character_id, created_at DESC);

-- 首通记录（幂等控制：每个角色每层最多一条；用于发奖判定）
CREATE TABLE IF NOT EXISTS tower_clears (
  id            SERIAL PRIMARY KEY,
  character_id  INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  floor         SMALLINT NOT NULL,
  cleared_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  battle_id     INT REFERENCES tower_battles(id),
  UNIQUE(character_id, floor)
);
CREATE INDEX IF NOT EXISTS idx_tower_clears_char ON tower_clears(character_id, floor);

-- v3.9 紫品主修每日掉落记录（每 10 层一个节点，每节点同日仅触发 1 次，每次随机 1-2 本，全日上限 20 本）
-- 唯一键 (character_id, drop_date, floor) 保证同节点同日幂等；count 记录该节点本次掉的本数（用于查"当日累积"）
CREATE TABLE IF NOT EXISTS tower_purple_drops (
  id            SERIAL PRIMARY KEY,
  character_id  INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  drop_date     DATE NOT NULL,
  floor         SMALLINT NOT NULL,
  skill_id      VARCHAR(64) NOT NULL,    -- 该节点首本紫品 ID（仅审计用，多本时其余仅写入 inventory）
  count         SMALLINT NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(character_id, drop_date, floor)
);
ALTER TABLE tower_purple_drops ADD COLUMN IF NOT EXISTS count SMALLINT NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_tower_purple_drops_char ON tower_purple_drops(character_id, drop_date);

-- ========================================
-- 炼丹会话凭证 (2026-05-07)
-- ========================================
-- 一次性 token，绑定 character_id + pill_id，60 秒过期；
-- 防客户端伪造 fire_position / 重放炼丹请求。Vercel serverless 多实例必须落库。
CREATE TABLE IF NOT EXISTS craft_sessions (
  token         VARCHAR(64) PRIMARY KEY,
  character_id  INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  pill_id       VARCHAR(64) NOT NULL,
  expires_at    TIMESTAMP NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_craft_sessions_expires ON craft_sessions(expires_at);

-- ========================================
-- 套装碎片下线 (2026-05-07)
-- ========================================
-- 宗门套装碎片体系整体废弃：宗门商店「set_fragment」/「premium_equip_box」、
-- 周常「强化竞赛」金装、Boss 排名装备奖励、craft-set-fragment 合成接口全部移除。
-- 玩家手上残留的 set_fragment 道具直接清掉（避免 UI 显示无入口的死道具）。
DELETE FROM character_pills WHERE pill_id = 'set_fragment';

-- ========================================
-- v4.0 装备双主属性 (2026-05-07) — 神兵锻造总纲
-- ========================================
-- 设计：装备主属性拆为属性1（受强化）+ 属性2（不受强化），都受 T 级 + 稀有度影响
-- 老装备 primary_stat_2/primary_value_2 = NULL，行为不变；只对新生成装备生效
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS primary_stat_2 VARCHAR(20) DEFAULT NULL;
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS primary_value_2 INT DEFAULT NULL;

-- ========================================
-- 死亡惩罚连击 (2026-05-08)
-- ========================================
-- 死亡一次：损失 1-5% 修为 + 1-5% 等级经验（随机）
-- 连续死亡 3 次：随机掉落一件已穿戴的「未锁定」装备，触发后清零
-- 战斗胜利时清零
ALTER TABLE characters ADD COLUMN IF NOT EXISTS death_streak SMALLINT NOT NULL DEFAULT 0;

-- ========================================
-- 强化石大礼包兑换码（2026-05-10）
-- T9/T10/T11/T12 强化石各 50 个
-- ========================================
INSERT INTO redeem_codes (code, attachments, description) VALUES
('STONE2026', '[
  {"type":"pill","pillId":"enhance_stone_t9","qty":50},
  {"type":"pill","pillId":"enhance_stone_t10","qty":50},
  {"type":"pill","pillId":"enhance_stone_t11","qty":50},
  {"type":"pill","pillId":"enhance_stone_t12","qty":50}
]'::jsonb, '强化石大礼包：T9/T10/T11/T12 强化石各 ×50')
ON CONFLICT (code) DO UPDATE SET
  attachments = EXCLUDED.attachments,
  description = EXCLUDED.description;

-- ========================================
-- 斗法连胜入风云阁 (2026-05-09)
-- ========================================
-- world_broadcast.log_id 不再强制 NOT NULL，斗法连胜（PK_STREAK）等无个人事件流的广播复用此表
ALTER TABLE world_broadcast ALTER COLUMN log_id DROP NOT NULL;

-- ========================================
-- 道侣系统 (2026-05-09) — design/system-companion.md
-- ========================================
-- Phase 1 MVP 落地：道侣花名册 + 子女系统骨架 + 游历入口 + 礼物链 v1。
-- 表清单：companions / children / child_equipment / companion_gifts /
--         companion_dates / divorce_history / romance_scripts / date_events
-- characters 表扩展：红尘玉、和离冷却、助战子女、本体资质、5 个游历追踪字段、陪伴亲密度结算日。

-- 1. 道侣花名册（含未结侣和已结侣对象）
CREATE TABLE IF NOT EXISTS companions (
  id                    SERIAL PRIMARY KEY,
  character_id          INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

  -- 基础信息
  name                  VARCHAR(8) NOT NULL,
  quality               SMALLINT NOT NULL,                   -- 0=凡品 ... 5=仙品
  spiritual_root        VARCHAR(10) NOT NULL,                -- metal/wood/water/fire/earth
  personality           VARCHAR(10) NOT NULL,                -- 冷艳/活泼/温柔/高傲/俏皮
  avatar_id             VARCHAR(20) NOT NULL,
  background_story      TEXT,

  -- 喜好（JSONB 存物品 ID 数组，对照 3.3.4 礼制丹方）
  preferred_gifts       JSONB NOT NULL DEFAULT '[]'::jsonb,
  disliked_gifts        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- 状态
  intimacy              INT NOT NULL DEFAULT 0,
  is_official           BOOLEAN NOT NULL DEFAULT FALSE,

  -- 陪伴亲密度累积（替代旧"双修主动"）
  last_companion_settle DATE DEFAULT NULL,

  -- 怀胎
  pregnant_until        TIMESTAMP DEFAULT NULL,
  pregnant_count        SMALLINT NOT NULL DEFAULT 0,        -- 1=单胎 / 2=双胎 / 3=三胎

  -- 仙缘印记 0-5
  seal_level            SMALLINT NOT NULL DEFAULT 0,

  -- 元数据
  encounter_story       VARCHAR(50),
  encountered_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  married_at            TIMESTAMP DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_companions_char ON companions(character_id);
-- 一个角色只能有一个正式道侣（部分唯一索引）
CREATE UNIQUE INDEX IF NOT EXISTS idx_companions_official_unique
  ON companions(character_id) WHERE is_official = TRUE;

-- 2. 子女表
CREATE TABLE IF NOT EXISTS children (
  id                    SERIAL PRIMARY KEY,
  character_id          INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  parent_companion_id   INT REFERENCES companions(id) ON DELETE SET NULL,

  -- 基础
  name                  VARCHAR(8) NOT NULL,
  gender                VARCHAR(8) NOT NULL CHECK (gender IN ('male','female')),
  avatar_id             VARCHAR(20) NOT NULL,

  -- 资质（出生时确定，可重铸）
  aptitude              SMALLINT NOT NULL,                  -- 0=凡品 ... 6=圣品
  spiritual_root        VARCHAR(20) NOT NULL,               -- 单灵根/双灵根/五行混灵
  awakened              BOOLEAN NOT NULL DEFAULT FALSE,

  -- 等级
  level                 INT NOT NULL DEFAULT 1,
  level_exp             BIGINT NOT NULL DEFAULT 0,
  realm_tier            SMALLINT NOT NULL DEFAULT 1,
  realm_stage           SMALLINT NOT NULL DEFAULT 1,

  -- 阶段
  stage                 VARCHAR(10) NOT NULL DEFAULT 'infant',  -- infant/child/youth/adult/grown

  -- 战斗属性缓存（动态计算后写入加速读取）
  max_hp                INT NOT NULL DEFAULT 200,
  atk                   INT NOT NULL DEFAULT 20,
  def                   INT NOT NULL DEFAULT 15,
  spd                   INT NOT NULL DEFAULT 30,

  -- 状态
  is_battling           BOOLEAN NOT NULL DEFAULT FALSE,
  has_left_home         BOOLEAN NOT NULL DEFAULT FALSE,
  last_visit_at         TIMESTAMP DEFAULT NULL,
  permanent_buff_pct    DECIMAL(5,4) NOT NULL DEFAULT 0,

  -- 喂养限制
  feed_count_today      SMALLINT NOT NULL DEFAULT 0,
  feed_date             DATE,

  -- 天赋（最多 7 个）+ 学习功法（仅 1 个血脉觉醒功法）
  awakened_talents      JSONB NOT NULL DEFAULT '[]'::jsonb,
  learned_skills        JSONB NOT NULL DEFAULT '[]'::jsonb,

  born_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_children_char ON children(character_id);
CREATE INDEX IF NOT EXISTS idx_children_companion ON children(parent_companion_id);

-- 3. 子女装备（与玩家本体 character_equipment 完全分离）
CREATE TABLE IF NOT EXISTS child_equipment (
  id                    SERIAL PRIMARY KEY,
  child_id              INT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  slot                  VARCHAR(20) NOT NULL,               -- weapon / robe / amulet1 / amulet2
  name                  VARCHAR(30) NOT NULL,
  rarity                VARCHAR(10) NOT NULL,               -- white/green/blue/purple/gold/red
  tier                  SMALLINT NOT NULL DEFAULT 1,
  primary_stat          JSONB NOT NULL,                     -- {atk: 50, ...}
  sub_stats             JSONB,
  is_equipped           BOOLEAN NOT NULL DEFAULT FALSE,
  obtained_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_child_equip_child ON child_equipment(child_id, is_equipped);

-- 4. 道侣礼物赠送日志（用于喜好提示和每日上限校验）
CREATE TABLE IF NOT EXISTS companion_gifts (
  id                    SERIAL PRIMARY KEY,
  companion_id          INT NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  gift_type             VARCHAR(30) NOT NULL,
  intimacy_gained       INT NOT NULL,
  reaction              VARCHAR(20) NOT NULL,               -- love / normal / dislike
  gifted_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_companion_gifts_date ON companion_gifts(companion_id, gifted_at DESC);

-- 5. 约会事件记录
CREATE TABLE IF NOT EXISTS companion_dates (
  id                    SERIAL PRIMARY KEY,
  companion_id          INT NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  event_id              VARCHAR(20) NOT NULL,
  choice                VARCHAR(10),
  intimacy_gained       INT NOT NULL DEFAULT 0,
  reward                JSONB,
  occurred_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_companion_dates_date ON companion_dates(companion_id, occurred_at DESC);

-- 6. 和离历史（保留全量历史用于 FAQ "曾有 N 位红尘伴侣"）
CREATE TABLE IF NOT EXISTS divorce_history (
  id                    SERIAL PRIMARY KEY,
  character_id          INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  companion_name        VARCHAR(8) NOT NULL,
  quality               SMALLINT NOT NULL,
  intimacy_at_divorce   INT NOT NULL,
  children_count        SMALLINT NOT NULL DEFAULT 0,
  divorced_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_divorce_char ON divorce_history(character_id);

-- 7. 邂逅剧情库（静态数据可放代码 server/data，此表仅做"已经历"追踪 — 暂不强制使用）
CREATE TABLE IF NOT EXISTS romance_scripts (
  id                    VARCHAR(20) PRIMARY KEY,            -- RD-001 等
  title                 VARCHAR(30) NOT NULL,
  scene                 TEXT NOT NULL,
  style                 VARCHAR(20) NOT NULL,
  base_intimacy         SMALLINT NOT NULL DEFAULT 0,
  enabled               BOOLEAN NOT NULL DEFAULT TRUE
);

-- 8. 约会事件库（同上，作为静态配置可选项）
CREATE TABLE IF NOT EXISTS date_events (
  id                    VARCHAR(20) PRIMARY KEY,            -- DT-001 等
  title                 VARCHAR(30) NOT NULL,
  event_type            VARCHAR(20) NOT NULL,               -- dialog/battle/gift/special
  scene_text            TEXT NOT NULL,
  choices               JSONB NOT NULL,
  weight                SMALLINT NOT NULL DEFAULT 100,
  enabled               BOOLEAN NOT NULL DEFAULT TRUE
);

-- 9. characters 表扩展（11 字段）
ALTER TABLE characters ADD COLUMN IF NOT EXISTS red_jade               INT NOT NULL DEFAULT 0;            -- 红尘玉余额
ALTER TABLE characters ADD COLUMN IF NOT EXISTS divorce_cooldown       TIMESTAMP DEFAULT NULL;            -- 和离冷却结束时间（4.2 节为 1 天）
ALTER TABLE characters ADD COLUMN IF NOT EXISTS battling_child_id      INT REFERENCES children(id) ON DELETE SET NULL; -- 当前出战子女
ALTER TABLE characters ADD COLUMN IF NOT EXISTS aptitude               SMALLINT NOT NULL DEFAULT 1;       -- 玩家本体资质（用于子女继承计算）
ALTER TABLE characters ADD COLUMN IF NOT EXISTS expedition_count_today SMALLINT NOT NULL DEFAULT 0;       -- 今日已用游历次数
ALTER TABLE characters ADD COLUMN IF NOT EXISTS expedition_date        DATE DEFAULT NULL;                 -- 游历次数所属日期（跨日重置）
ALTER TABLE characters ADD COLUMN IF NOT EXISTS expedition_extra_today SMALLINT NOT NULL DEFAULT 0;       -- 今日付费扩展次数
ALTER TABLE characters ADD COLUMN IF NOT EXISTS expedition_extra_week  SMALLINT NOT NULL DEFAULT 0;       -- 本周已购"游历加次符"次数
ALTER TABLE characters ADD COLUMN IF NOT EXISTS expedition_week_number INT NOT NULL DEFAULT 0;            -- 周编号（与 realm_shop_purchases 一致）
-- last_companion_settle 已在 companions 表，不在 characters

-- ========================================
-- 道侣自定义立绘 (2026-05-11)
-- ========================================
-- 玩家把图发给作者，作者用 SQL UPDATE 直接赋值到该字段。
-- 支持外链 URL 或 base64 data URL；前端按"有 custom 用 custom，否则用 SVG 占位"渲染。
ALTER TABLE companions ADD COLUMN IF NOT EXISTS custom_avatar_url TEXT DEFAULT NULL;

-- ========================================
-- 子女二级属性 (2026-05-12)
-- 让子女有完整的会心/闪避/吸血/神识/控抗，与玩家本体属性体系对齐
-- 助战时作为独立单位上场（duoBattleEngine），属性按阶段倍率缩水，无 cap（2026-05-13 起去除 70% cap）
-- ========================================
ALTER TABLE children ADD COLUMN IF NOT EXISTS crit_rate   DECIMAL(5,4) NOT NULL DEFAULT 0.0300;
ALTER TABLE children ADD COLUMN IF NOT EXISTS crit_dmg    DECIMAL(5,4) NOT NULL DEFAULT 1.0000;
ALTER TABLE children ADD COLUMN IF NOT EXISTS dodge       DECIMAL(5,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE children ADD COLUMN IF NOT EXISTS lifesteal   DECIMAL(5,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE children ADD COLUMN IF NOT EXISTS spirit      INT          NOT NULL DEFAULT 5;
ALTER TABLE children ADD COLUMN IF NOT EXISTS resist_ctrl DECIMAL(5,4) NOT NULL DEFAULT 0.0500;

-- ========================================
-- 红尘玉商店限购计数 (2026-05-12, design 3.7.2)
-- ========================================
-- 周/月限购通过 (period_type, period_key) 隐式隔离，跨周/月自动新计数行
-- period_key: week=YYYYWW (ISO 周) / month=YYYYMM
CREATE TABLE IF NOT EXISTS character_red_jade_purchases (
  id            SERIAL PRIMARY KEY,
  character_id  INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id       VARCHAR(40) NOT NULL,
  period_type   VARCHAR(8) NOT NULL,
  period_key    INT NOT NULL,
  count         INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (character_id, item_id, period_type, period_key)
);
CREATE INDEX IF NOT EXISTS idx_red_jade_purchases_char
  ON character_red_jade_purchases(character_id, period_type, period_key);

-- ========================================
-- 装备 V5.0.2 schema 扩展 (2026-05-12, design/system-equipment-v5-0-2.json)
-- ========================================
-- 与 V4 装备并存：equipment_version 区分版本，老装备默认 4，新 V5 装备写 5。
-- 业务层未挂载（生成器走 V4），仅落 schema 做前置；feature flag 控制后续灰度。
-- 详细字段说明见 design/migration-v5-equipment-draft.sql

ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS equipment_version SMALLINT NOT NULL DEFAULT 4;
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS wuxing_prefix     TEXT[]   DEFAULT NULL;
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS wuxing_affixes    JSONB    DEFAULT NULL;
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS legendary_set_id  VARCHAR(50) DEFAULT NULL;
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS is_boss_treasure  BOOLEAN  NOT NULL DEFAULT FALSE;

-- 幂等约束：DROP IF EXISTS + ADD（每次跑 migrate 都重建一次）
ALTER TABLE character_equipment DROP CONSTRAINT IF EXISTS character_equipment_version_chk;
ALTER TABLE character_equipment ADD  CONSTRAINT character_equipment_version_chk
  CHECK (equipment_version IN (4, 5));

ALTER TABLE character_equipment DROP CONSTRAINT IF EXISTS character_equipment_wuxing_prefix_chk;
ALTER TABLE character_equipment ADD  CONSTRAINT character_equipment_wuxing_prefix_chk
  CHECK (
    wuxing_prefix IS NULL OR (
      array_length(wuxing_prefix, 1) BETWEEN 1 AND 5
      AND wuxing_prefix <@ ARRAY['metal','wood','water','fire','earth']::TEXT[]
    )
  );

ALTER TABLE character_equipment DROP CONSTRAINT IF EXISTS character_equipment_wuxing_affixes_chk;
ALTER TABLE character_equipment ADD  CONSTRAINT character_equipment_wuxing_affixes_chk
  CHECK (
    wuxing_affixes IS NULL OR (
      jsonb_typeof(wuxing_affixes) = 'array'
      AND jsonb_array_length(wuxing_affixes) = 3
    )
  );

ALTER TABLE character_equipment DROP CONSTRAINT IF EXISTS character_equipment_v5_required_chk;
ALTER TABLE character_equipment ADD  CONSTRAINT character_equipment_v5_required_chk
  CHECK (
    equipment_version <> 5 OR (
      wuxing_prefix IS NOT NULL AND wuxing_affixes IS NOT NULL
    )
  );

-- ========================================
-- 放弃子女历史 (2026-05-13, design/system-companion.md 5.9)
-- ========================================
-- 玩家可消耗 断缘符 + 灵石 放弃任一子女（DELETE FROM children）。
-- 离家子女被放弃后 permanent_buff_pct 一并消失，buff 不转存。
-- 用本表保留历史用于 FAQ / 成就追踪 "曾放弃 N 位子女"。
CREATE TABLE IF NOT EXISTS child_abandon_history (
  id                    SERIAL PRIMARY KEY,
  character_id          INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  child_name            VARCHAR(8) NOT NULL,
  aptitude              SMALLINT NOT NULL,
  level                 INT NOT NULL,
  stage                 VARCHAR(10) NOT NULL,
  permanent_buff_pct    DECIMAL(5,4) NOT NULL DEFAULT 0,  -- 被放弃前累计的永久 buff（仅做记录）
  had_left_home         BOOLEAN NOT NULL DEFAULT FALSE,
  abandoned_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_child_abandon_char ON child_abandon_history(character_id);

-- ================================================================================
-- 充值/后台管理系统 (2026-05-15)
-- 4 张新表 (admins / recharge_packages / recharge_orders / admin_audit_log)
-- + characters 新增订阅过期字段 (oneclick_plant / bonus_plot / expedition_daily_bonus)
-- 已有字段复用：cave_output_mul + sponsor_expire_at（洞府倍率月卡）
--             sponsor_oneclick_plant（一键种植 BOOLEAN 镜像，由 expire_at 驱动）
--             sr_daily_bonus + sr_bonus_expire_at（秘境次数月卡）
--             immortal_jade（仙玉，已预留）
-- ================================================================================

-- 1. 管理员账号（与玩家 users 表完全隔离，独立登录）
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(32) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,                -- bcrypt
  role          VARCHAR(16) NOT NULL DEFAULT 'admin', -- admin / super_admin
  status        SMALLINT NOT NULL DEFAULT 1,          -- 1=启用 0=禁用
  last_login    TIMESTAMP DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. 商品配置（9 个商品由 seed 脚本写入）
CREATE TABLE IF NOT EXISTS recharge_packages (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(40) NOT NULL UNIQUE,          -- cave_1_5x_30d 等
  name          VARCHAR(40) NOT NULL,
  price_rmb     DECIMAL(8,2) NOT NULL,
  type          VARCHAR(30) NOT NULL,                 -- sub_cave_mul / sub_oneclick_plant / sub_bonus_plot / sub_sr_bonus / sub_expedition_bonus / item_pill
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recharge_packages_enabled ON recharge_packages(enabled, sort_order);

-- 3. 充值订单（每次发货一条记录，预留真实支付字段）
CREATE TABLE IF NOT EXISTS recharge_orders (
  id              SERIAL PRIMARY KEY,
  order_no        VARCHAR(32) NOT NULL UNIQUE,
  character_id    INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  package_id      INT NOT NULL REFERENCES recharge_packages(id) ON DELETE RESTRICT,
  package_snapshot JSONB NOT NULL,                    -- 发货时 package 快照（防改价丢失审计）
  price_rmb       DECIMAL(8,2) NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending / paid / delivered / refunded / cancelled
  pay_channel     VARCHAR(16) DEFAULT NULL,           -- manual / wechat / alipay（预留）
  pay_external_id VARCHAR(64) DEFAULT NULL,           -- 第三方交易号（预留）
  paid_at         TIMESTAMP DEFAULT NULL,
  delivered_at    TIMESTAMP DEFAULT NULL,
  delivered_by    INT DEFAULT NULL REFERENCES admins(id) ON DELETE SET NULL,
  notes           TEXT DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recharge_orders_char ON recharge_orders(character_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recharge_orders_status ON recharge_orders(status, created_at DESC);

-- 4. GM 操作审计（所有写操作落账）
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id              SERIAL PRIMARY KEY,
  admin_id        INT NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
  action          VARCHAR(40) NOT NULL,               -- deliver_order / grant_jade / grant_stone / send_mail / ban / unban / edit_package
  target_character_id INT DEFAULT NULL REFERENCES characters(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip              VARCHAR(45) DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_character_id, created_at DESC);

-- 5. characters 新增订阅过期字段
-- 一键种植：BOOLEAN 镜像保留（已有业务在读），新增 expire_at 由 cron 在过期时把 BOOLEAN 归位
ALTER TABLE characters ADD COLUMN IF NOT EXISTS oneclick_plant_expire_at TIMESTAMP DEFAULT NULL;
-- 灵田扩容：count 表示当前生效的额外地块数，expire_at 过期时归零（作物收一茬再冻结由业务层处理）
ALTER TABLE characters ADD COLUMN IF NOT EXISTS bonus_plot_count SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS bonus_plot_expire_at TIMESTAMP DEFAULT NULL;
-- 道侣游历每日次数加成
ALTER TABLE characters ADD COLUMN IF NOT EXISTS expedition_daily_bonus SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS expedition_bonus_expire_at TIMESTAMP DEFAULT NULL;
