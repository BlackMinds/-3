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