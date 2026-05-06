// 验证 v3.8.3 装备 tier 权重迁移：
//   1. 准备：插入 5 条假装备 (T11/T12/T13/T14/T15) + 1 条 T10 + 1 条 T8 (后两条应保持不变)
//   2. 删 _schema_migrations 标记，重跑迁移
//   3. 校验 primary_value 是否按 ratio 缩放
//   4. 测完清理（删测试装备）
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '..', '.env')
const envText = fs.readFileSync(envPath, 'utf-8')
const dbUrl = envText.match(/^DATABASE_URL=(.+)$/m)[1].trim()

const sqlPath = path.join(__dirname, '..', 'server', 'database', 'migration.sql')
const migrationSql = fs.readFileSync(sqlPath, 'utf-8')

const client = new pg.Client({ connectionString: dbUrl })
await client.connect()

const TEST_MARKER = '__tier_weight_test_only__'

// 清掉旧测试数据（如果有）
await client.query(`DELETE FROM character_equipment WHERE name = $1`, [TEST_MARKER])

// 找一个真实 character_id 用作 owner（FK 必须满足）
const { rows: charRows } = await client.query(`SELECT id FROM characters LIMIT 1`)
if (charRows.length === 0) {
  console.error('需要至少 1 个 character 才能测试 FK')
  process.exit(1)
}
const charId = charRows[0].id

// 插入测试装备（tier 8/10/11/12/13/14/15，primary_value 取 1000 便于看比例）
const cases = [
  { tier: 8,  expected: 1000 },                      // 不动
  { tier: 10, expected: 1000 },                      // 不动
  { tier: 11, expected: Math.floor(1000 * 12 / 11) }, // 1090
  { tier: 12, expected: Math.floor(1000 * 14 / 12) }, // 1166
  { tier: 13, expected: Math.floor(1000 * 16 / 13) }, // 1230
  { tier: 14, expected: Math.floor(1000 * 18 / 14) }, // 1285
  { tier: 15, expected: Math.floor(1000 * 20 / 15) }, // 1333
]

const insertedIds = []
for (const c of cases) {
  const { rows } = await client.query(
    `INSERT INTO character_equipment
     (character_id, name, rarity, primary_stat, primary_value, sub_stats, tier, base_slot, req_level)
     VALUES ($1, $2, 'gold', 'ATK', 1000, '[]', $3, 'weapon', 1)
     RETURNING id`,
    [charId, TEST_MARKER, c.tier]
  )
  insertedIds.push({ id: rows[0].id, tier: c.tier, expected: c.expected })
}
console.log(`[1/4] 插入 ${cases.length} 条测试装备 (tier 8-15, primary_value=1000)`)

// 删迁移标记，强制 DO 块再次执行
await client.query(`DELETE FROM _schema_migrations WHERE id = 'v3_8_3_equip_tier_weight'`)
console.log(`[2/4] 删除迁移标记`)

// 重跑 migration
await client.query(migrationSql)
console.log(`[3/4] 重跑 migration.sql`)

// 校验
console.log(`[4/4] 校验结果：`)
let ok = true
for (const it of insertedIds) {
  const { rows } = await client.query(
    `SELECT primary_value FROM character_equipment WHERE id = $1`,
    [it.id]
  )
  const actual = Number(rows[0].primary_value)
  const status = actual === it.expected ? '✅' : '❌'
  if (actual !== it.expected) ok = false
  console.log(`  ${status} T${it.tier}: actual=${actual}, expected=${it.expected}`)
}

// 清理测试数据
await client.query(`DELETE FROM character_equipment WHERE name = $1`, [TEST_MARKER])
console.log(`[clean] 已删除测试装备`)

await client.end()
process.exit(ok ? 0 : 1)
