import { getPool } from '~/server/database/db'
import { writeAudit, getClientIp, loadTargetCharacter } from '~/server/utils/adminAudit'

// 按品质随机发功法（复用 design/sql.md 的 5 个池子）
// body: { rarity: 'green'|'blue'|'purple'|'gold'|'red', count: number }
const POOLS: Record<string, string[]> = {
  green:  ['wind_blade','vine_whip','ice_palm','flame_sword','quake_fist','body_refine','flame_body','water_flow','root_grip','metal_skin'],
  blue:   ['fire_rain','frost_nova','earth_shield','quake_wave','vine_prison','golden_bell','swift_step','iron_skin','thorn_aura','flame_aura','earth_wall'],
  purple: ['sword_storm','twin_flame','flurry_palm','spring_heal','blood_fury','wood_heal','mirror_water','venom_burst','bleed_storm','burn_inferno','poison_mist','crit_master','earth_fortitude','poison_body','fire_mastery','dot_amplifier','phantom_step','healing_spring'],
  gold:   ['metal_burst','quake_stomp','life_drain','inferno_burst','storm_blade','heaven_heal','water_mastery','battle_frenzy','heavenly_body'],
  red:    ['time_stop','heavenly_wrath','dao_heart','five_elements_harmony'],
}

export default defineEventHandler(async (event) => {
  const characterId = Number(event.context.params?.id)
  const { rarity, count } = await readBody<{ rarity: string; count: number }>(event)
  const n = Math.trunc(Number(count))
  if (!Number.isFinite(n) || n < 1 || n > 100) return { code: 400, message: 'count 范围 1-100' }
  const pool = POOLS[rarity]
  if (!pool) return { code: 400, message: 'rarity 必须是 green/blue/purple/gold/red' }

  const target = await loadTargetCharacter(characterId)
  if (!target) return { code: 404, message: '玩家不存在' }

  // 从池子里随机抽 n 本，按 skill_id 聚合
  const counts: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const id = pool[Math.floor(Math.random() * pool.length)]
    counts[id] = (counts[id] || 0) + 1
  }
  const skillIds = Object.keys(counts)
  const qty = skillIds.map(k => counts[k])

  const dbPool = getPool()
  await dbPool.query(
    `INSERT INTO character_skill_inventory (character_id, skill_id, count, level)
     SELECT $1, unnest($2::text[]), unnest($3::int[]), 1
     ON CONFLICT (character_id, skill_id)
     DO UPDATE SET count = character_skill_inventory.count + EXCLUDED.count`,
    [characterId, skillIds, qty]
  )

  await writeAudit({
    adminId: event.context.adminId,
    action: 'grant_skills',
    targetCharacterId: characterId,
    payload: { rarity, count: n, distribution: counts, characterName: target.name },
    ip: getClientIp(event),
  })

  return { code: 200, message: `已发放 ${n} 本${rarity}功法`, data: { distribution: counts } }
})
