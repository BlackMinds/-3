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

 SELECT cave_output_mul, COUNT(*) AS 玩家数
  FROM characters
  WHERE cave_output_mul > 1.0
  GROUP BY cave_output_mul
  ORDER BY cave_output_mul;