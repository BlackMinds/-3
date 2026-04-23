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

-- 双倍 30 天

 UPDATE characters SET cave_output_mul = 2.0,
    sponsor_expire_at = NOW() + INTERVAL '30 days'
    WHERE name = '风丿火';

-- 三倍 30 天
UPDATE characters SET cave_output_mul = 3.0,
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
