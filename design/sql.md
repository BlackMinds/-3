  UPDATE characters
  SET sr_daily_count = 0,
      sr_daily_date = CURRENT_DATE
  WHERE user_id = (SELECT id FROM users WHERE username = 'xy102768');  加秘境次数

  SELECT id, name, level, level_exp, realm_tier, realm_stage
  FROM characters
  WHERE name = '杂鱼';

  然后降 30 级：

  UPDATE characters
  SET level = GREATEST(1, level - 30),
      level_exp = 0
  WHERE name = '杂鱼'; 降级sql

-- 1.5 倍产出 30 天
UPDATE characters SET cave_output_mul = 1.5,
  sponsor_expire_at = NOW() + INTERVAL '30 days'
  WHERE name = '风丿火';

-- 2 倍产出 30 天
UPDATE characters SET cave_output_mul = 2.0,
  sponsor_expire_at = NOW() + INTERVAL '30 days'
  WHERE name = '风丿火';

-- 关闭
UPDATE characters SET cave_output_mul = 1.0, sponsor_expire_at = NULL WHERE name = '风丿火';

一键种植
UPDATE characters SET sponsor_oneclick_plant = TRUE WHERE name = '玩家名';

-- 秘境次数上限+1 持续 30 天
UPDATE characters SET sr_daily_bonus = 1,
  sr_bonus_expire_at = NOW() + INTERVAL '30 days'
  WHERE name = '玩家名';

-- 随机蓝色功法 +1（赞助赠品，11 本蓝色功法等概率抽 1 本）
  WITH picks AS (
    SELECT (ARRAY[
      'fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell',
      'swift_step','iron_skin','thorn_aura','flame_aura','earth_wall'
    ])[1 + floor(random() * 11)::int] AS skill_id
    FROM generate_series(1, 这个是数量)        -- ← 这里改 N
  ),
  agg AS (
    SELECT skill_id, COUNT(*)::int AS cnt FROM picks GROUP BY skill_id
  )
  INSERT INTO character_skill_inventory (character_id, skill_id, count, level)
  SELECT c.id, agg.skill_id, agg.cnt, 1
  FROM characters c CROSS JOIN agg
  WHERE c.name = '玩家名'
  ON CONFLICT (character_id, skill_id) DO UPDATE
    SET count = character_skill_inventory.count + EXCLUDED.count;

紫色功法
  WITH picks AS (
    SELECT (ARRAY[
      'sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury',
      'wood_heal','mirror_water','crit_master','earth_fortitude','poison_body',
      'fire_mastery','dot_amplifier','phantom_step','healing_spring'
    ])[1 + floor(random() * 14)::int] AS skill_id
    FROM generate_series(1, 1)        -- ← 这里就是数量
  ),
  agg AS (
    SELECT skill_id, COUNT(*)::int AS cnt FROM picks GROUP BY skill_id
  )
  INSERT INTO character_skill_inventory (character_id, skill_id, count, level)
  SELECT c.id, agg.skill_id, agg.cnt, 1
  FROM characters c CROSS JOIN agg
  WHERE c.name = '玩家名'
  ON CONFLICT (character_id, skill_id) DO UPDATE
    SET count = character_skill_inventory.count + EXCLUDED.count;

 -- 给某个角色加 140w 修为（不触发境界突破，只是数值累加）                                                                                                                                                                                                                                         
  UPDATE characters                                                                                                                                                                        SET cultivation_exp = cultivation_exp+1400000
  WHERE name = '玩家名'; 

  给角色加灵石
    UPDATE 
    characters            
    SET spirit_stone = spirit_stone + 3000000                       
  WHERE name = '你的角色名';

  某个角色换灵根
    UPDATE characters
  SET spiritual_root = 'water',
      resist_metal = 0,
      resist_wood  = 0,
      resist_water = 0.15,
      resist_fire  = 0,
      resist_earth = 0
  WHERE name = '王总';

 SELECT cave_output_mul, COUNT(*) AS 玩家数
  FROM characters
  WHERE cave_output_mul > 1.0
  GROUP BY cave_output_mul
  ORDER BY cave_output_mul;

-- ============================================================
-- 会心伤害基础值 150%/170% → 100% 重平衡 (2026-04-26)
-- 业务代码不会 update crit_dmg, 创角时的值会一直留在 DB
-- 改了 character/create.post.ts + migration.sql 后, 老角色还是旧值
-- 跑下面的 SQL 把存量也压回 1.0
-- ============================================================

-- 先看一眼分布, 确认只有 1.5 / 1.7 两种基础值, 没被脏数据污染
SELECT crit_dmg, COUNT(*) AS 玩家数
  FROM characters
  GROUP BY crit_dmg
  ORDER BY crit_dmg;

-- 普通灵根 (金/木/水/土): 1.5 → 1.0
UPDATE characters SET crit_dmg = 1.0 WHERE crit_dmg = 1.5;

-- 火灵根: 1.7 → 1.0 (统一去掉火属性的 +0.2 基础特色)
UPDATE characters SET crit_dmg = 1.0 WHERE crit_dmg = 1.7;