import { getPool } from '~/server/database/db'

const REALM_NAMES: Record<number, string> = {
  1: '练气', 2: '筑基', 3: '金丹', 4: '元婴',
  5: '化神', 6: '渡劫', 7: '大乘', 8: '飞升', 9: '混元',
}
const STAGE_NAMES_DEFAULT = ['初期', '中期', '后期']
const STAGE_NAMES_QI = ['一层','二层','三层','四层','五层','六层','七层','八层','九层']
const STAGE_NAMES_FLY = ['散仙', '真仙', '金仙', '太乙金仙', '大罗金仙']
const STAGE_NAMES_HUNYUAN = ['合道', '证道', '太上', '太极', '无极']

function getRealmDisplay(tier: number, stage: number): string {
  const realm = REALM_NAMES[tier] || '未知'
  if (tier === 1) return realm + (STAGE_NAMES_QI[stage - 1] || '')
  if (tier === 8) return STAGE_NAMES_FLY[stage - 1] || realm
  if (tier === 9) return STAGE_NAMES_HUNYUAN[stage - 1] || realm
  return realm + (STAGE_NAMES_DEFAULT[stage - 1] || '')
}

const ROOT_NAMES: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
}

// 简化战力公式 —— 与 battleSnapshot.ts powerScore 的结构一致
// 用 character 表已持久化的基础属性（含升级/突破/培养加成），不含装备/功法 buff
// 适合榜单近似排序，不强求与实战 powerScore 完全一致
function calcPower(row: any): number {
  const atk = Number(row.atk || 0)
  const def = Number(row.def || 0)
  const maxHp = Number(row.max_hp || 0)
  const spd = Number(row.spd || 0)
  const spirit = Number(row.spirit || 0)
  const critRate = Number(row.crit_rate || 0)
  const critDmg = Number(row.crit_dmg || 0)
  return Math.floor(atk * 2 + def * 2 + maxHp * 0.3 + spd * 1.5 + spirit + critRate * 500 + critDmg * 200)
}

function formatRow(row: any, rank: number) {
  return {
    rank,
    characterId: row.id,
    name: row.name,
    spiritualRoot: row.spiritual_root,
    rootName: ROOT_NAMES[row.spiritual_root] || '',
    realmTier: row.realm_tier,
    realmStage: row.realm_stage,
    realmDisplay: getRealmDisplay(row.realm_tier, row.realm_stage),
    level: row.level || 1,
    power: calcPower(row),
    sectName: row.sect_name || null,
    title: row.title || null,
  }
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    // 先按基础属性的线性组合排序（DB 直接算可走索引扫描全表，但量级 < 几千足够快）
    // SQL 排序公式与 calcPower 严格一致，避免取 top 50 时漏掉
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.spiritual_root, c.realm_tier, c.realm_stage,
             c.level, c.max_hp, c.atk, c.def, c.spd, c.spirit,
             c.crit_rate, c.crit_dmg, c.title,
             s.name AS sect_name,
             (c.atk * 2 + c.def * 2 + c.max_hp * 0.3 + c.spd * 1.5 + c.spirit
              + c.crit_rate * 500 + c.crit_dmg * 200) AS power_calc
      FROM characters c
      LEFT JOIN sect_members sm ON sm.character_id = c.id
      LEFT JOIN sects s ON s.id = sm.sect_id
      ORDER BY power_calc DESC, c.realm_tier DESC, c.realm_stage DESC
      LIMIT 50
    `)

    const list = rows.map((r, i) => formatRow(r, i + 1))

    // 我的排名
    const { rows: charRows } = await pool.query(
      `SELECT id, max_hp, atk, def, spd, spirit, crit_rate, crit_dmg
         FROM characters WHERE user_id = $1`,
      [event.context.userId]
    )
    let myRank: number | null = null
    if (charRows.length > 0) {
      const myPower = calcPower(charRows[0])
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM characters
           WHERE (atk * 2 + def * 2 + max_hp * 0.3 + spd * 1.5 + spirit
                  + crit_rate * 500 + crit_dmg * 200) > $1`,
        [myPower]
      )
      myRank = Number(countRows[0]?.cnt || 0) + 1
    }

    return { code: 200, data: { list, myRank } }
  } catch (error) {
    console.error('通天榜查询失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
