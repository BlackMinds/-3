import { getPool } from '~/server/database/db'

// ============================================
// 功法方案 / Skill Loadout helpers (2026-05-07)
// 仿装备方案：玩家有 3 套（loadout_id 1/2/3），character_skills 反映"当前激活方案下装备的功法"
// save-equipped 时同步写当前激活方案；卖功法时清掉所有方案的引用
// ============================================

export type SkillLoadoutEntry = {
  skill_id: string
  skill_type: 'active' | 'divine' | 'passive'
  slot_index: number
}

export async function ensureSkillLoadouts(charId: number): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO character_skill_loadouts (character_id, loadout_id, payload)
     VALUES ($1, 1, '[]'::jsonb), ($1, 2, '[]'::jsonb), ($1, 3, '[]'::jsonb)
     ON CONFLICT (character_id, loadout_id) DO NOTHING`,
    [charId]
  )
}

export async function getActiveSkillLoadoutId(charId: number): Promise<number> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT COALESCE(active_skill_loadout, 1) AS active FROM characters WHERE id = $1',
    [charId]
  )
  const v = rows[0]?.active ?? 1
  return v >= 1 && v <= 3 ? v : 1
}

// 把当前装备覆写到指定方案
export async function syncSkillLoadout(
  charId: number,
  loadoutId: number,
  entries: SkillLoadoutEntry[]
): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO character_skill_loadouts (character_id, loadout_id, payload, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (character_id, loadout_id) DO UPDATE SET
       payload = EXCLUDED.payload,
       updated_at = NOW()`,
    [charId, loadoutId, JSON.stringify(entries)]
  )
}

// 卖功法 / 删功法时调用：从所有方案 payload 中剔除该 skill_id
export async function removeSkillFromAllLoadouts(charId: number, skillId: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    `UPDATE character_skill_loadouts
     SET payload = COALESCE((
       SELECT jsonb_agg(elem)
       FROM jsonb_array_elements(payload) AS elem
       WHERE elem->>'skill_id' <> $2
     ), '[]'::jsonb), updated_at = NOW()
     WHERE character_id = $1`,
    [charId, skillId]
  )
}
