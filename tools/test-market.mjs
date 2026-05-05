// 坊市端到端测试（Node.js）
// 使用：node tools/test-market.mjs

import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const BASE = 'http://localhost:3003'

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); pass++ }
  else { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); fail++ }
}

async function api(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  try {
    const r = await fetch(BASE + path, opts)
    const text = await r.text()
    try { return JSON.parse(text) } catch { return { code: r.status, message: text } }
  } catch (e) {
    return { code: -1, message: String(e) }
  }
}

async function sqlVoid(q, params = []) { await client.query(q, params) }
async function sql(q, params = []) { return (await client.query(q, params)).rows }
async function sqlOne(q, params = []) { return (await client.query(q, params)).rows[0] }

console.log('=== 清理旧测试数据 ===')
const oldNames = ['坊市卖家', '坊市买家', '坊市新号']
const oldUsers = ['mkt_seller', 'mkt_buyer', 'mkt_new']
await sqlVoid(`DELETE FROM market_transactions WHERE seller_id IN (SELECT id FROM characters WHERE name = ANY($1)) OR buyer_id IN (SELECT id FROM characters WHERE name = ANY($1))`, [oldNames])
await sqlVoid(`DELETE FROM market_listings WHERE seller_id IN (SELECT id FROM characters WHERE name = ANY($1))`, [oldNames])
await sqlVoid(`DELETE FROM market_daily_quota WHERE character_id IN (SELECT id FROM characters WHERE name = ANY($1))`, [oldNames])
await sqlVoid(`DELETE FROM mails WHERE character_id IN (SELECT id FROM characters WHERE name = ANY($1))`, [oldNames])
await sqlVoid(`DELETE FROM character_equipment WHERE character_id IN (SELECT id FROM characters WHERE name = ANY($1))`, [oldNames])
await sqlVoid(`DELETE FROM character_equipment_loadouts WHERE character_id IN (SELECT id FROM characters WHERE name = ANY($1))`, [oldNames])
await sqlVoid(`DELETE FROM characters WHERE name = ANY($1)`, [oldNames])
await sqlVoid(`DELETE FROM users WHERE username = ANY($1)`, [oldUsers])

console.log()
console.log('=== 注册账号 ===')
for (const u of oldUsers) {
  const r = await api('POST', '/api/auth/register', null, { username: u, password: '123456' })
  ok(r.code === 200, `${u} 注册`)
}

const L1 = await api('POST', '/api/auth/login', null, { username: 'mkt_seller', password: '123456' })
const L2 = await api('POST', '/api/auth/login', null, { username: 'mkt_buyer',  password: '123456' })
const L3 = await api('POST', '/api/auth/login', null, { username: 'mkt_new',    password: '123456' })
const tSeller = L1.data?.token
const tBuyer  = L2.data?.token
const tNew    = L3.data?.token
ok(tSeller && tBuyer && tNew, '登录拿到 token')

await api('POST', '/api/character/create', tSeller, { name: '坊市卖家', spiritual_root: 'metal' })
await api('POST', '/api/character/create', tBuyer,  { name: '坊市买家', spiritual_root: 'wood' })
await api('POST', '/api/character/create', tNew,    { name: '坊市新号', spiritual_root: 'fire' })

const sellerId = (await sqlOne(`SELECT id FROM characters WHERE name = '坊市卖家'`)).id
const buyerId  = (await sqlOne(`SELECT id FROM characters WHERE name = '坊市买家'`)).id
const newId    = (await sqlOne(`SELECT id FROM characters WHERE name = '坊市新号'`)).id
console.log(`  seller=${sellerId} buyer=${buyerId} new=${newId}`)

// 抬境界/等级/灵石；user.created_at 拉到 3 天前
await sqlVoid(`UPDATE characters SET realm_tier = 4, level = 80, spirit_stone = 5000000 WHERE id = ANY($1)`, [[sellerId, buyerId]])
await sqlVoid(`UPDATE users SET created_at = NOW() - INTERVAL '3 days' WHERE id IN (SELECT user_id FROM characters WHERE id = ANY($1))`, [[sellerId, buyerId]])

console.log()
console.log('=== TEST 1: 准入门槛 — 新号被拒 ===')
const r1 = await api('POST', '/api/market/list', tNew, { source: { category: 'equipment', inventory_id: 99999 }, unit_price: 100 })
ok(r1.code === 403, `新号被拒（${r1.message}）`)

console.log()
console.log('=== TEST 2: 准备紫色 T5 +5 武器 ===')
await sqlVoid(`
  INSERT INTO character_equipment
    (character_id, slot, base_slot, weapon_type, name, rarity, primary_stat, primary_value,
     sub_stats, awaken_effect, set_id, enhance_level, req_level, tier, locked, is_bound)
  VALUES ($1, NULL, 'weapon', 'sword', '青云剑·测试', 'purple', 'ATK', 380,
    $2::jsonb, NULL, NULL, 5, 80, 5, FALSE, FALSE)`,
  [sellerId, JSON.stringify([{ stat: 'ATK_PCT', value: 12 }, { stat: 'CRIT_RATE', value: 3 }])]
)
const eqRow = await sqlOne(`SELECT id FROM character_equipment WHERE character_id = $1 AND name = '青云剑·测试' LIMIT 1`, [sellerId])
const eqId = eqRow.id
console.log(`  eqId=${eqId}`)

console.log()
console.log('=== TEST 3: 查询参考价 ===')
const refRes = await api('GET', '/api/market/reference-price?rarity=purple&slot=weapon&tier=5&enhance=5', tSeller)
const ref = Number(refRes.data.ref_price)
const floor = Number(refRes.data.floor)
const ceiling = Number(refRes.data.ceiling)
console.log(`  ref=${ref}  range=[${floor} ~ ${ceiling}]  method=${refRes.data.ref_method}`)
ok(ref > 0, '参考价 > 0')

console.log()
console.log('=== TEST 4: 价格越界被拒 ===')
const rLow = await api('POST', '/api/market/list', tSeller, { source: { category: 'equipment', inventory_id: eqId }, unit_price: 1 })
ok(rLow.code !== 200 && /区间|灵石之间/.test(rLow.message), `低于下限被拒（${rLow.message}）`)
const rHigh = await api('POST', '/api/market/list', tSeller, { source: { category: 'equipment', inventory_id: eqId }, unit_price: 99999999 })
ok(rHigh.code !== 200 && /区间|灵石之间/.test(rHigh.message), `高于上限被拒`)

console.log()
console.log('=== TEST 5: 正常上架 ===')
const listPrice = ref
const rList = await api('POST', '/api/market/list', tSeller, { source: { category: 'equipment', inventory_id: eqId }, unit_price: listPrice })
ok(rList.code === 200, `上架成功（id=${rList.data?.id}, price=${listPrice}）`)
const listingId = rList.data.id

const rest = await sql(`SELECT COUNT(*)::int AS n FROM character_equipment WHERE id = $1`, [eqId])
ok(rest[0].n === 0, `装备已从背包移除`)

console.log()
console.log('=== TEST 6: 自购被拒 ===')
const rSelf = await api('POST', '/api/market/buy', tSeller, { listing_id: listingId })
ok(rSelf.code !== 200 && /自己/.test(rSelf.message), '自购被拒')

console.log()
console.log('=== TEST 7: 买家正常购买 ===')
const stoneB1 = Number((await sqlOne(`SELECT spirit_stone FROM characters WHERE id = $1`, [buyerId])).spirit_stone)
const rBuy = await api('POST', '/api/market/buy', tBuyer, { listing_id: listingId, expected_unit_price: listPrice })
ok(rBuy.code === 200, `购买成功（${rBuy.message}）`)
const tax = rBuy.data?.tax_amount
const stoneB2 = Number((await sqlOne(`SELECT spirit_stone FROM characters WHERE id = $1`, [buyerId])).spirit_stone)
console.log(`  税=${tax}  买家灵石 ${stoneB1} → ${stoneB2}（差 ${stoneB1 - stoneB2}）`)
ok((stoneB1 - stoneB2) === listPrice, '买家扣灵石 = 挂单价')

const sellerMails = await sql(`SELECT * FROM mails WHERE character_id = $1 AND category = 'market' ORDER BY id`, [sellerId])
const buyerMails  = await sql(`SELECT * FROM mails WHERE character_id = $1 AND category = 'market' ORDER BY id`, [buyerId])
ok(sellerMails.length >= 1, `卖家收到 market 邮件（${sellerMails.length} 封）`)
ok(buyerMails.length >= 1,  `买家收到 market 邮件（${buyerMails.length} 封）`)
const buyerLast = buyerMails[buyerMails.length - 1]
const buyerAtts = buyerLast.attachments
ok(Array.isArray(buyerAtts) && buyerAtts.some(a => a.type === 'equipment'), '买家邮件附件含 equipment')

// 卖家领灵石
const sStoneB1 = Number((await sqlOne(`SELECT spirit_stone FROM characters WHERE id = $1`, [sellerId])).spirit_stone)
const sellerLast = sellerMails[sellerMails.length - 1]
await api('POST', '/api/mail/claim', tSeller, { id: sellerLast.id })
const sStoneB2 = Number((await sqlOne(`SELECT spirit_stone FROM characters WHERE id = $1`, [sellerId])).spirit_stone)
const received = sStoneB2 - sStoneB1
console.log(`  卖家领取后灵石 +${received}（应 = ${listPrice - tax}）`)
ok(received === (listPrice - tax), '卖家到账 = 价格 - 税')

// 买家领装备
await api('POST', '/api/mail/claim', tBuyer, { id: buyerLast.id })
const buyerEqs = await sql(`SELECT * FROM character_equipment WHERE character_id = $1 AND name = '青云剑·测试'`, [buyerId])
ok(buyerEqs.length === 1, `买家背包获得装备（${buyerEqs.length} 件）`)
ok(buyerEqs[0]?.enhance_level === 5, '强化等级保留 +5')
ok(JSON.stringify(buyerEqs[0]?.sub_stats || []).includes('CRIT_RATE'), '副词条保留')

console.log()
console.log('=== TEST 8: 蓝品装备被拒 ===')
await sqlVoid(`INSERT INTO character_equipment
  (character_id, base_slot, weapon_type, name, rarity, primary_stat, primary_value, enhance_level, tier, locked, is_bound)
  VALUES ($1, 'weapon', 'sword', '玄铁剑·蓝品', 'blue', 'ATK', 100, 0, 5, FALSE, FALSE)`, [sellerId])
const eqBlue = (await sqlOne(`SELECT id FROM character_equipment WHERE name = '玄铁剑·蓝品'`)).id
const r8 = await api('POST', '/api/market/list', tSeller, { source: { category: 'equipment', inventory_id: eqBlue }, unit_price: 1000 })
ok(r8.code !== 200 && /紫色/.test(r8.message), `蓝品被拒（${r8.message}）`)

console.log()
console.log('=== TEST 9: tier=2 紫色被拒 ===')
await sqlVoid(`INSERT INTO character_equipment
  (character_id, base_slot, weapon_type, name, rarity, primary_stat, primary_value, enhance_level, tier, locked, is_bound)
  VALUES ($1, 'weapon', 'sword', '低阶紫剑', 'purple', 'ATK', 50, 0, 2, FALSE, FALSE)`, [sellerId])
const eqLow = (await sqlOne(`SELECT id FROM character_equipment WHERE name = '低阶紫剑'`)).id
const r9 = await api('POST', '/api/market/list', tSeller, { source: { category: 'equipment', inventory_id: eqLow }, unit_price: 1000 })
ok(r9.code !== 200 && /tier/.test(r9.message), `tier<3 被拒（${r9.message}）`)

console.log()
console.log('=== TEST 10: 下架扣 5% 手续费 ===')
await sqlVoid(`INSERT INTO character_equipment
  (character_id, base_slot, weapon_type, name, rarity, primary_stat, primary_value, enhance_level, tier, locked, is_bound)
  VALUES ($1, 'weapon', 'sword', '下架测试剑', 'purple', 'ATK', 380, 0, 5, FALSE, FALSE)`, [sellerId])
const eqCancel = (await sqlOne(`SELECT id FROM character_equipment WHERE name = '下架测试剑'`)).id
const rL = await api('POST', '/api/market/list', tSeller, { source: { category: 'equipment', inventory_id: eqCancel }, unit_price: ref })
ok(rL.code === 200, `上架（id=${rL.data?.id}）`)
const stoneB3 = Number((await sqlOne(`SELECT spirit_stone FROM characters WHERE id = $1`, [sellerId])).spirit_stone)
const rC = await api('POST', '/api/market/cancel', tSeller, { listing_id: rL.data.id })
const stoneB4 = Number((await sqlOne(`SELECT spirit_stone FROM characters WHERE id = $1`, [sellerId])).spirit_stone)
const expectedFee = Math.floor(ref * 0.05)
console.log(`  扣费 = ${stoneB3 - stoneB4}（预期 ${expectedFee}）`)
ok((stoneB3 - stoneB4) === expectedFee, '下架扣 5%')
const retM = await sql(`SELECT * FROM mails WHERE character_id = $1 AND title = '坊市下架'`, [sellerId])
ok(retM.length >= 1, '下架邮件含装备附件')

console.log()
console.log('=== TEST 11: 我的挂单 / 成交记录查询 ===')
const rMine = await api('GET', '/api/market/my-listings?status=all', tSeller)
ok(rMine.code === 200 && rMine.data.length >= 2, `卖家挂单可查（${rMine.data.length} 条）`)
const rTx = await api('GET', '/api/market/my-transactions?role=buy', tBuyer)
ok(rTx.code === 200 && rTx.data.length >= 1, `买家流水可查（${rTx.data.length} 条）`)

console.log()
console.log('=== TEST 12: 浏览列表 ===')
await sqlVoid(`INSERT INTO character_equipment
  (character_id, base_slot, weapon_type, name, rarity, primary_stat, primary_value, enhance_level, tier, locked, is_bound)
  VALUES ($1, 'weapon', 'sword', '展示剑1', 'purple', 'ATK', 380, 0, 5, FALSE, FALSE),
         ($1, 'weapon', 'sword', '展示剑2', 'gold',   'ATK', 580, 0, 5, FALSE, FALSE)`, [sellerId])
const eqShow1 = (await sqlOne(`SELECT id FROM character_equipment WHERE name = '展示剑1' LIMIT 1`)).id
const eqShow2 = (await sqlOne(`SELECT id FROM character_equipment WHERE name = '展示剑2' LIMIT 1`)).id
await api('POST', '/api/market/list', tSeller, { source: { category: 'equipment', inventory_id: eqShow1 }, unit_price: ref })
const refGold = Number((await api('GET', '/api/market/reference-price?rarity=gold&slot=weapon&tier=5&enhance=0', tSeller)).data.ref_price)
await api('POST', '/api/market/list', tSeller, { source: { category: 'equipment', inventory_id: eqShow2 }, unit_price: refGold })
const r12a = await api('GET', '/api/market/listings?rarity=purple', tBuyer)
ok(r12a.code === 200 && r12a.data.items.length >= 1, `紫品挂单（${r12a.data.items.length} 条）`)
const r12b = await api('GET', '/api/market/listings?rarity=gold', tBuyer)
ok(r12b.code === 200 && r12b.data.items.length >= 1, `金品挂单（${r12b.data.items.length} 条）`)

console.log()
console.log('=== TEST 13: 件数限额 ===')
await sqlVoid(`UPDATE market_daily_quota SET buy_count = 5, sell_count = 5 WHERE character_id = $1 AND quota_date = CURRENT_DATE`, [buyerId])
const showId = (await sqlOne(`SELECT id FROM market_listings WHERE seller_id = $1 AND status = 'active' AND item_snapshot->>'name' = '展示剑1' LIMIT 1`, [sellerId])).id
const r13 = await api('POST', '/api/market/buy', tBuyer, { listing_id: showId })
ok(r13.code !== 200 && /上限/.test(r13.message), `件数 10 件后被拒（${r13.message}）`)

console.log()
console.log('=== TEST 14: cron 过期任务 ===')
// 手动把展示剑2 expires_at 设到过去
const sh2 = (await sqlOne(`SELECT id FROM market_listings WHERE item_snapshot->>'name' = '展示剑2' AND status = 'active' LIMIT 1`)).id
await sqlVoid(`UPDATE market_listings SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [sh2])
const cronSecret = process.env.CRON_SECRET || ''
let r14
if (cronSecret) {
  const r14r = await fetch(`${BASE}/api/cron/market-expire`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cronSecret}` },
  })
  r14 = await r14r.json().catch(() => ({}))
  ok(r14.ok && r14.expired >= 1, `cron 过期处理（处理 ${r14?.expired} 条）`)
} else {
  console.log('  - CRON_SECRET 未配置，跳过 cron 测试')
}
const sh2Status = (await sqlOne(`SELECT status FROM market_listings WHERE id = $1`, [sh2])).status
if (cronSecret) ok(sh2Status === 'expired', `挂单状态置为 expired`)

console.log()
console.log(`=== 测试完成：通过 ${pass}，失败 ${fail} ===`)
await client.end()
process.exit(fail > 0 ? 1 : 0)
