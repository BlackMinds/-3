#!/usr/bin/env node
/**
 * 幂等地同步 server/database/migration.sql 到目标数据库。
 *
 * 连接来源（按优先级）：
 *   1. process.env.DATABASE_URL（部署/CI）
 *   2. 项目根目录 .env 的 DATABASE_URL（本地）
 *
 * 用法：
 *   npm run migrate                     # 用 .env 或已注入的环境变量
 *   DATABASE_URL=postgresql://... npm run migrate
 */
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return null
  const text = fs.readFileSync(envPath, 'utf-8')
  const m = text.match(/^DATABASE_URL=(.+)$/m)
  if (!m) return null
  return m[1].trim().replace(/^["']|["']$/g, '')
}

const dbUrl = loadDatabaseUrl()
if (!dbUrl) {
  console.error('[migrate] ❌ DATABASE_URL 未设置（.env 和环境变量都没找到）')
  process.exit(1)
}

const sqlPath = path.join(__dirname, '..', 'server', 'database', 'migration.sql')
if (!fs.existsSync(sqlPath)) {
  console.error(`[migrate] ❌ migration.sql 不存在：${sqlPath}`)
  process.exit(1)
}
const sql = fs.readFileSync(sqlPath, 'utf-8')

let host = '(unknown)'
try { host = new URL(dbUrl.replace(/^postgres(ql)?:/, 'http:')).host } catch {}

console.log(`[migrate] 目标：${host}`)
console.log(`[migrate] 脚本：${path.relative(process.cwd(), sqlPath)} (${sql.length} 字节)`)

const client = new pg.Client({ connectionString: dbUrl })
await client.connect()

const started = Date.now()
try {
  await client.query(sql)
  console.log(`[migrate] ✅ 完成 (${Date.now() - started}ms)`)
} catch (e) {
  console.error(`[migrate] ❌ 失败: ${e.message}`)
  if (e.detail) console.error(`  详情: ${e.detail}`)
  if (e.hint) console.error(`  提示: ${e.hint}`)
  if (e.position) console.error(`  位置(字符): ${e.position}`)
  await client.end().catch(() => {})
  process.exit(1)
}

await client.end()
