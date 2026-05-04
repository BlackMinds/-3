/**
 * v3.8 实战验证 — 调战斗 API 对比同一玩家在不同 monster 系数下的战斗回合 + 承伤
 *
 * 用法:
 *   node test/verify-v38-fight-api.mjs            # 跑当前生效的 v3.8 配置
 *   先 git stash 改回 v3.7 → 重启 dev → 再跑此脚本，得到 baseline 对比
 */

const BASE = 'http://localhost:3002'
const PASSWORD = 'pass1234'
const MAP_ID = 'myriad_demon_mountain' // T3
const BATCH = 5
const USERS = (process.env.USERS || 'testA1,testA2,testA3,testA4,testA5,testB1,testB2,testB3').split(',')
const PG = process.env.PG_PSQL || 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe'

async function api(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { raw: text, status: res.status } }
}

function analyzeBattle(b) {
  const logs = b.logs || []
  // 只看战斗 log（排除 system/loot/setup 等纯文本无 playerHp 的）
  const battleLogs = logs.filter(l =>
    l.turn !== undefined && l.turn > 0 &&
    l.playerMaxHp > 0 &&
    l.type !== 'system' && l.type !== 'loot'
  )
  const maxTurn = battleLogs.reduce((m, l) => Math.max(m, l.turn || 0), 0)
  const startMaxHp = battleLogs[0]?.playerMaxHp || 0
  // 战斗中的最低 HP（峰值承伤瞬间）
  const minHp = battleLogs.reduce((m, l) => Math.min(m, l.playerHp ?? Infinity), Infinity)
  // 战斗结束时的 HP（最后一条战斗 log）
  const endHp = battleLogs[battleLogs.length - 1]?.playerHp ?? 0
  // 总承伤：最大承伤瞬间 (受回血干扰但近似)
  const peakDmg = startMaxHp - (Number.isFinite(minHp) ? minHp : 0)
  const peakDmgPct = startMaxHp > 0 ? (peakDmg / startMaxHp * 100) : 0
  return { maxTurn, startMaxHp, minHp, endHp, peakDmg, peakDmgPct }
}

import { execSync } from 'node:child_process'
function clearAllCooldowns() {
  process.env.PGPASSWORD = '123456'
  try {
    execSync(`"${PG}" -h localhost -U postgres -d xiantu_game -c "UPDATE characters SET battle_end_at = NULL;" -q`, { stdio: 'pipe' })
  } catch (e) { console.warn('清 cooldown 失败:', e.message) }
}

async function main() {
  clearAllCooldowns()
  const allBattles = []
  for (const username of USERS) {
    const login = await api('/api/auth/login', 'POST', { username, password: PASSWORD })
    if (!login?.data?.token) { console.warn(`  ${username} 登录失败`); continue }
    const token = login.data.token

    process.stdout.write(`[${username}] `)
    const fight = await api('/api/battle/fight', 'POST', { map_id: MAP_ID, batch_count: BATCH }, token)
    if (fight?.code !== 200) {
      console.log(`✗ ${fight?.message}`)
      continue
    }
    const got = (fight.data?.battles || []).length
    console.log(`✓ ${got} 场`)
    allBattles.push(...(fight.data?.battles || []))
  }
  console.log(`\n  共收到 ${allBattles.length} 场战斗记录\n`)

  console.log('=== T3 战斗结果（每场一行）===')
  console.log('# | 胜 | 怪物                | 怪物总HP   | 回合 | 玩家maxHP | 战末HP   | 峰值承伤  | 承伤% ')
  console.log('-'.repeat(110))

  let sumTurns = 0, sumPeakPct = 0, sumMonsterHp = 0, sumDmgPerHp = 0, n = 0
  for (let i = 0; i < allBattles.length; i++) {
    const b = allBattles[i]
    const a = analyzeBattle(b)
    const monsters = b.monsterNames || []
    const monsterHps = b.monstersMaxHp || []
    const totalMonsterHp = monsterHps.reduce((s, h) => s + h, 0)
    const monsterDesc = monsters.join('/').slice(0, 20).padEnd(20)
    console.log(
      `${(i+1).toString().padStart(2)} | ${b.won ? '✓' : '✗'}  | ${monsterDesc} | ${totalMonsterHp.toLocaleString().padStart(10)} | ${a.maxTurn.toString().padStart(4)} | ${a.startMaxHp.toLocaleString().padStart(8)} | ${a.endHp.toLocaleString().padStart(8)} | ${a.peakDmg.toLocaleString().padStart(8)} | ${a.peakDmgPct.toFixed(1).padStart(5)}%`
    )
    if (b.won && totalMonsterHp > 0) {
      sumTurns += a.maxTurn
      sumPeakPct += a.peakDmgPct
      sumMonsterHp += totalMonsterHp
      sumDmgPerHp += a.peakDmg / totalMonsterHp * 1000 // 承伤per千HP怪物
      n++
    }
  }

  if (n > 0) {
    console.log('-'.repeat(110))
    console.log(`平均（${n}场胜）: 回合 ${(sumTurns/n).toFixed(2)} | 峰值承伤 ${(sumPeakPct/n).toFixed(1)}% | 怪物总HP ${(sumMonsterHp/n).toFixed(0)} | 承伤/千HP怪物 ${(sumDmgPerHp/n).toFixed(2)}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
