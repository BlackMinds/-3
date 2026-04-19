<template>
  <div class="page">
    <div class="topbar">
      <button class="btn back" @click="$router.back()">← 返回</button>
      <h2>⚔️ 宗门战 · 问道大比</h2>
      <button class="btn mail-btn" @click="showMail = true">
        📬 邮箱
        <span v-if="mailUnread > 0" class="red-dot">{{ mailUnread }}</span>
      </button>
    </div>

    <div v-if="season" class="season-box">
      <div class="season-row">
        <span class="label">第 {{ season.seasonNo }} 届</span>
        <span :class="['stage', season.stage]">{{ stageText(season.stage) }}</span>
        <span class="stage-tip">{{ stageTip(season.stage) }}</span>
      </div>
      <div class="season-sub">
        📋 本届报名: <b>{{ season.registrationCount }}</b> 宗门 · ⚔️ 对阵: <b>{{ season.matchCount }}</b> 场
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h3>🏛️ 我的阵容</h3>
        <button v-if="canEdit && !roster" class="btn primary" @click="openRosterEditor">提交阵容</button>
        <button v-else-if="canEdit && roster" class="btn" @click="openRosterEditor">重新编辑</button>
      </div>
      <div v-if="roster" class="roster">
        <div class="roster-group">
          <h4>⚔️ 单挑组 · 问道</h4>
          <div class="roster-list">
            <div v-for="c in roster.rosterDuel" :key="c.id" class="roster-card">
              <div class="rc-name">{{ c.name || `#${c.id}` }}</div>
              <div class="rc-meta">{{ realmText(c.realm_tier, c.realm_stage) }} · Lv.{{ c.level }}</div>
            </div>
          </div>
        </div>
        <div class="roster-group">
          <h4>👥 团战 A 队</h4>
          <div class="roster-list">
            <div v-for="c in roster.rosterTeamA" :key="c.id" class="roster-card">
              <div class="rc-name">{{ c.name || `#${c.id}` }}</div>
              <div class="rc-meta">{{ realmText(c.realm_tier, c.realm_stage) }} · Lv.{{ c.level }}</div>
            </div>
          </div>
        </div>
        <div class="roster-group">
          <h4>👥 团战 B 队</h4>
          <div class="roster-list">
            <div v-for="c in roster.rosterTeamB" :key="c.id" class="roster-card">
              <div class="rc-name">{{ c.name || `#${c.id}` }}</div>
              <div class="rc-meta">{{ realmText(c.realm_tier, c.realm_stage) }} · Lv.{{ c.level }}</div>
            </div>
          </div>
        </div>
        <div class="total-power">📊 总战力: <b>{{ formatNum(roster.total_power) }}</b></div>
      </div>
      <div v-else class="empty">
        {{ canEdit ? '尚未提交阵容，点击右上按钮开始' : myMembership ? '本宗门未报名（等待宗主/副宗主提交）' : '你尚未加入宗门' }}
      </div>
    </div>

    <div class="section">
      <div class="section-header"><h3>🎯 本届对阵</h3></div>
      <div v-if="!matches.length" class="empty">暂无对阵（等待匹配）</div>
      <div v-for="m in matches" :key="m.id" class="match-card" @click="openMatch(m)">
        <div class="match-row">
          <div :class="['side', { winner: m.winner_sect_id === m.sect_a_id }]">
            <div class="side-name">{{ m.sect_a_name }}</div>
            <div class="side-odds">×{{ m.odds_a }}</div>
          </div>
          <div class="score-block">
            <div class="score">{{ m.score_a }} : {{ m.score_b }}</div>
            <div v-if="m.winner_sect_id" class="vs-label done">已结束</div>
            <div v-else class="vs-label pending">VS</div>
          </div>
          <div :class="['side', 'right', { winner: m.winner_sect_id === m.sect_b_id }]">
            <div class="side-name">{{ m.sect_b_name }}</div>
            <div class="side-odds">×{{ m.odds_b }}</div>
          </div>
        </div>
        <div class="match-meta">
          <span v-if="m.winner_sect_id" class="winner-tag">
            🏆 胜方: {{ m.winner_sect_id === m.sect_a_id ? m.sect_a_name : m.sect_b_name }}
          </span>
          <span v-else class="pending">尚未开赛</span>
          <div class="match-actions">
            <button v-if="!m.winner_sect_id && season?.stage === 'betting'" class="btn sm primary" @click.stop="openBet(m)">
              押注
            </button>
            <button class="btn sm" @click.stop="openMatch(m)">战报</button>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><h3>⭐ 论道之星榜</h3></div>
      <div v-if="!mvpRank.length" class="empty">暂无数据</div>
      <div v-for="(r, idx) in mvpRank" :key="r.character_id" class="rank-row">
        <span :class="['rank-idx', rankMedal(idx)]">{{ rankText(idx) }}</span>
        <span class="rank-name">{{ r.name }}</span>
        <span v-if="r.title" class="rank-title">{{ r.title }}</span>
        <span class="rank-sect">{{ r.sect_name || '无宗门' }}</span>
        <span class="rank-cnt">{{ r.mvp_count }} 次</span>
      </div>
    </div>

    <!-- 阵容编辑弹窗 -->
    <div v-if="showRoster" class="modal-overlay" @click.self="showRoster = false">
      <div class="modal wide">
        <h3>编辑宗门战阵容</h3>
        <p class="hint">从本宗门 <b>筑基期以上 + 内门弟子以上</b> 职位中选 9 人填满 3 个单挑位 + 6 个团战位</p>

        <div v-if="!eligibleMembers.length" class="empty">
          宗门内没有符合条件的成员（需筑基期以上 + 内门弟子及以上）
        </div>
        <template v-else>
          <div class="slot-group">
            <h4>⚔️ 单挑组 · 问道大比</h4>
            <div class="slot-row">
              <RosterSlot v-for="i in [0,1,2]" :key="'duel'+i" v-model="editRoster.duel[i]" :members="eligibleMembers" :exclude="allPickedIds" label="问道" />
            </div>
          </div>
          <div class="slot-group">
            <h4>👥 团战 A 队（第 4 场，2 分）</h4>
            <div class="slot-row">
              <RosterSlot v-for="i in [0,1,2]" :key="'ta'+i" v-model="editRoster.teamA[i]" :members="eligibleMembers" :exclude="allPickedIds" label="A队" />
            </div>
          </div>
          <div class="slot-group">
            <h4>👥 团战 B 队（第 5 场终局，3 分）</h4>
            <div class="slot-row">
              <RosterSlot v-for="i in [0,1,2]" :key="'tb'+i" v-model="editRoster.teamB[i]" :members="eligibleMembers" :exclude="allPickedIds" label="B队" />
            </div>
          </div>
          <div class="roster-summary">
            已选 <b>{{ allPickedIds.length }} / 9</b> 人
            <span v-if="allPickedIds.length < 9" class="warn">（尚差 {{ 9 - allPickedIds.length }} 人）</span>
            <span v-else class="ok">✓ 已选齐</span>
          </div>
        </template>
        <div class="modal-actions">
          <button class="btn" @click="showRoster = false">取消</button>
          <button class="btn primary" :disabled="allPickedIds.length !== 9" @click="submitRoster">确认提交</button>
        </div>
      </div>
    </div>

    <!-- 押注弹窗 -->
    <div v-if="betMatch" class="modal-overlay" @click.self="betMatch = null">
      <div class="modal">
        <h3>💰 押注 · 第 {{ season?.seasonNo }} 届</h3>
        <div class="bet-compare">
          <div :class="['bet-side-card', { active: betSide === 'a' }]" @click="setBetSide('a')">
            <div class="bs-name">{{ betMatch.sect_a_name }}</div>
            <div class="bs-odds">×{{ betMatch.odds_a }}</div>
            <div v-if="isSectASelf" class="bs-self">自家宗门</div>
          </div>
          <div class="bet-vs">VS</div>
          <div :class="['bet-side-card', { active: betSide === 'b' }]" @click="setBetSide('b')">
            <div class="bs-name">{{ betMatch.sect_b_name }}</div>
            <div class="bs-odds">×{{ betMatch.odds_b }}</div>
            <div v-if="isSectBSelf" class="bs-self">自家宗门</div>
          </div>
        </div>
        <p v-if="betSideLocked" class="warn" style="font-size: 14px;">⚠ 不可押注自家宗门</p>

        <div class="bet-input-group">
          <label>押注金额</label>
          <input type="number" v-model.number="betAmount" min="1000" max="50000" step="1000" />
          <div class="quick-btns">
            <button v-for="amt in [1000, 5000, 10000, 20000, 50000]" :key="amt" class="btn sm" @click="betAmount = amt">
              {{ amt >= 1000 ? (amt / 1000) + 'k' : amt }}
            </button>
          </div>
        </div>

        <div class="bet-summary">
          <div>💳 余额: <b>{{ formatNum(myStone) }}</b> 灵石</div>
          <div>🎯 当前赔率: <b>×{{ currentOdds }}</b></div>
          <div>💹 命中可得: <b class="gain">{{ formatNum(expectedGross) }}</b> 灵石（含本金，扣 5% 手续费后 {{ formatNum(expectedNet) }}）</div>
        </div>

        <div class="modal-actions">
          <button class="btn" @click="betMatch = null">取消</button>
          <button class="btn primary" :disabled="!canBet" @click="submitBet">确认押注</button>
        </div>
      </div>
    </div>

    <!-- 战报详情 -->
    <div v-if="matchDetail" class="modal-overlay" @click.self="matchDetail = null">
      <div class="modal wide">
        <h3>📜 战报详情</h3>
        <div v-if="matchDetail.mvp" class="mvp">
          <span class="mvp-badge">⭐ 论道之星</span>
          <b>{{ matchDetail.mvp.name }}</b>
          <span v-if="matchDetail.mvp.title" class="mvp-title">{{ matchDetail.mvp.title }}</span>
        </div>
        <div v-for="b in matchDetail.battles" :key="b.id" class="battle">
          <h4>
            第 {{ b.round_no }} 场 ·
            {{ b.battle_type === 'duel' ? '⚔️ 单挑' : '👥 团战' }} ·
            🏆 <span :class="'side-'+b.winner_side">{{ b.winner_side === 'a' ? matchDetail.match.sect_a_name : matchDetail.match.sect_b_name }}</span>
            <span class="battle-meta">· {{ b.battle_log.length }} 条日志</span>
            <button class="btn sm primary replay-btn" @click="openReplay(b)">📺 详细回放</button>
          </h4>
          <div class="log-list">
            <div v-for="(line, idx) in b.battle_log" :key="idx" :class="['log', line.type]">
              {{ line.text }}
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="matchDetail = null">关闭</button>
        </div>
      </div>
    </div>

    <BattleReplay
      v-if="replayBattle"
      :battle="replayBattle"
      :match="matchDetail?.match"
      @close="replayBattle = null"
    />

    <MailDrawer v-model="showMail" @update:modelValue="refreshMailCount" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const api = useApi()

const season = ref<any>(null)
const roster = ref<any>(null)
const matches = ref<any[]>([])
const mvpRank = ref<any[]>([])
const myMembership = ref<any>(null)
const mySectId = ref<number | null>(null)
const myStone = ref(0)
const showMail = ref(false)
const mailUnread = ref(0)
const showRoster = ref(false)
const betMatch = ref<any>(null)
const betSide = ref<'a' | 'b'>('a')
const betAmount = ref(1000)
const matchDetail = ref<any>(null)
const replayBattle = ref<any>(null)

function openReplay(b: any) {
  replayBattle.value = b
}

const eligibleMembers = ref<any[]>([])
const editRoster = ref<{ duel: (number | null)[]; teamA: (number | null)[]; teamB: (number | null)[] }>({
  duel: [null, null, null],
  teamA: [null, null, null],
  teamB: [null, null, null],
})

const allPickedIds = computed(() => {
  return [...editRoster.value.duel, ...editRoster.value.teamA, ...editRoster.value.teamB]
    .filter((x): x is number => x != null)
})

const canEdit = computed(() => myMembership.value && ['leader', 'vice_leader'].includes(myMembership.value.role))

const isSectASelf = computed(() => betMatch.value?.sect_a_id === mySectId.value)
const isSectBSelf = computed(() => betMatch.value?.sect_b_id === mySectId.value)
const betSideLocked = computed(() => (betSide.value === 'a' && isSectASelf.value) || (betSide.value === 'b' && isSectBSelf.value))
const currentOdds = computed(() => {
  if (!betMatch.value) return 0
  return betSide.value === 'a' ? Number(betMatch.value.odds_a) : Number(betMatch.value.odds_b)
})
const expectedGross = computed(() => Math.floor((betAmount.value || 0) * currentOdds.value))
const expectedNet = computed(() => Math.floor(expectedGross.value * 0.95))
const canBet = computed(() => !betSideLocked.value && betAmount.value >= 1000 && betAmount.value <= 50000 && myStone.value >= betAmount.value)

function stageText(s: string) { return { registering: '报名中', betting: '押注中', fighting: '激战中', settled: '已结束' }[s] || s }
function stageTip(s: string) {
  return {
    registering: '宗主/副宗主可提交 9 人阵容（周三 00:00 截止）',
    betting: '对阵已公布，可押注 · 周五 20:00 开赛',
    fighting: '赛事进行中，自动结算…',
    settled: '本届已结束 · 奖励已通过邮件发放',
  }[s] || ''
}
function realmText(tier: number, stage: number) {
  const tiers = ['凡人','练气','筑基','金丹','元婴','化神','渡劫','大乘','飞升','万法']
  const stages = ['一','二','三','四','五','六','七','八','九']
  return `${tiers[tier] || ''}${stages[stage - 1] || ''}层`
}
function formatNum(n: number | string) {
  const v = Number(n) || 0
  if (v >= 10000) return (v / 10000).toFixed(1) + 'w'
  return v.toLocaleString()
}
function rankText(idx: number) { return ['🥇', '🥈', '🥉'][idx] || `#${idx + 1}` }
function rankMedal(idx: number) { return ['gold', 'silver', 'bronze'][idx] || '' }

function setBetSide(s: 'a' | 'b') {
  betSide.value = s
}

async function loadAll() {
  const [s, r, m, rk, my, char] = await Promise.all([
    api('/sect/war/season'),
    api('/sect/war/roster').catch(() => ({ data: null })),
    api('/sect/war/match'),
    api('/sect/war/mvp-rank'),
    api('/sect/info').catch(() => ({ data: null })),
    api('/character/info').catch(() => ({ data: null })),
  ])
  if (s.code === 200) season.value = s.data
  roster.value = r.data || null
  matches.value = m.data || []
  mvpRank.value = rk.data || []
  myMembership.value = my.data?.my || null
  mySectId.value = my.data?.sect?.id || null
  myStone.value = Number(char.data?.spirit_stone || 0)

  // 过滤符合参战条件的成员
  eligibleMembers.value = (my.data?.members || []).filter((mem: any) => {
    return ['leader','vice_leader','elder','inner'].includes(mem.role) && mem.realm_tier >= 2
  })

  await refreshMailCount()
}

async function refreshMailCount() {
  try {
    const r = await api('/mail/unread-count')
    if (r.code === 200) mailUnread.value = r.data.unread
  } catch {}
}

function openRosterEditor() {
  // 用现有 roster 填入默认值
  if (roster.value) {
    editRoster.value = {
      duel: roster.value.rosterDuel.map((c: any) => c.id),
      teamA: roster.value.rosterTeamA.map((c: any) => c.id),
      teamB: roster.value.rosterTeamB.map((c: any) => c.id),
    }
    while (editRoster.value.duel.length < 3) editRoster.value.duel.push(null as any)
    while (editRoster.value.teamA.length < 3) editRoster.value.teamA.push(null as any)
    while (editRoster.value.teamB.length < 3) editRoster.value.teamB.push(null as any)
  } else {
    editRoster.value = { duel: [null, null, null], teamA: [null, null, null], teamB: [null, null, null] }
  }
  showRoster.value = true
}

async function submitRoster() {
  const res = await api('/sect/war/register', { method: 'POST', body: {
    rosterDuel: editRoster.value.duel,
    rosterTeamA: editRoster.value.teamA,
    rosterTeamB: editRoster.value.teamB,
  }})
  if (res.code === 200) {
    showRoster.value = false
    await loadAll()
    alert(`阵容提交成功！总战力 ${formatNum(res.data.totalPower)}`)
  } else {
    alert(res.message)
  }
}

function openBet(m: any) {
  betMatch.value = m
  // 默认选中不会"自家"的一方
  betSide.value = m.sect_a_id === mySectId.value ? 'b' : 'a'
  betAmount.value = 1000
}

async function submitBet() {
  const res = await api('/sect/war/bet', { method: 'POST', body: {
    matchId: betMatch.value.id, betSide: betSide.value, amount: betAmount.value,
  }})
  alert(res.message)
  if (res.code === 200) {
    betMatch.value = null
    await loadAll()
  }
}

async function openMatch(m: any) {
  const res = await api('/sect/war/match-detail', { query: { id: m.id } })
  if (res.code === 200) matchDetail.value = res.data
}

onMounted(loadAll)
</script>

<style scoped>
.page { background: #0e0e1a; min-height: 100vh; color: #e0e0f0; padding-bottom: 40px; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #1a1a2e; border-bottom: 1px solid #333;
}
.topbar h2 { margin: 0; font-size: 18px; }
.mail-btn { position: relative; }
.red-dot {
  position: absolute; top: -4px; right: -4px;
  background: #f44; color: #fff; border-radius: 10px;
  font-size: 12px; padding: 1px 5px; min-width: 14px; text-align: center;
}

.season-box {
  background: linear-gradient(135deg, #2a1f3a, #1a2a42); padding: 20px;
  margin: 16px; border-radius: 8px; border: 1px solid #444;
}
.season-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }
.season-row .label { font-size: 22px; font-weight: bold; color: #ffd700; }
.stage {
  padding: 3px 10px; border-radius: 12px; font-size: 14px;
  background: #555; color: #fff;
}
.stage.registering { background: #3a7; }
.stage.betting { background: #d69e3c; color: #000; }
.stage.fighting { background: #d33; animation: pulse 1s infinite; }
.stage.settled { background: #666; }
.stage-tip { color: #aab; font-size: 14px; }
@keyframes pulse { 50% { opacity: 0.6; } }
.season-sub { color: #aab; font-size: 15px; }

.section { background: #1a1a2e; margin: 12px 16px; padding: 16px; border-radius: 8px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.section-header h3 { margin: 0; font-size: 16px; color: #d0c8ff; }
.empty { text-align: center; color: #666; padding: 24px; }

.roster { display: flex; flex-wrap: wrap; gap: 12px; }
.roster-group { flex: 1; min-width: 200px; }
.roster-group h4 { margin: 0 0 8px; font-size: 15px; color: #aab; }
.roster-list { display: flex; flex-wrap: wrap; gap: 6px; }
.roster-card {
  background: #2a2a42; padding: 8px 12px; border-radius: 6px; min-width: 120px;
  border: 1px solid #3a3a55;
}
.rc-name { font-size: 15px; color: #fff; font-weight: bold; }
.rc-meta { font-size: 13px; color: #888; margin-top: 2px; }
.total-power { width: 100%; margin-top: 12px; font-size: 16px; color: #d69e3c; padding-top: 10px; border-top: 1px solid #333; }

.match-card {
  background: #22223a; padding: 14px; margin-bottom: 10px; border-radius: 6px; cursor: pointer;
  transition: all 0.15s; border: 1px solid #2a2a42;
}
.match-card:hover { background: #2a2a48; border-color: #555; }
.match-row { display: flex; align-items: center; gap: 12px; }
.match-row .side { flex: 1; }
.match-row .side.right { text-align: right; }
.match-row .side-name { font-size: 17px; font-weight: bold; }
.match-row .side-odds { color: #d69e3c; font-size: 14px; margin-top: 2px; }
.match-row .side.winner .side-name::before { content: '🏆 '; }
.match-row .side.winner .side-name { color: #ffd700; }
.score-block { text-align: center; padding: 0 12px; }
.score { font-size: 22px; font-weight: bold; color: #d0c8ff; }
.vs-label { font-size: 12px; color: #666; margin-top: 2px; }
.vs-label.done { color: #3a7; }
.vs-label.pending { color: #d69e3c; }
.match-meta { margin-top: 10px; font-size: 14px; color: #888; display: flex; justify-content: space-between; align-items: center; }
.winner-tag { color: #3a7; font-weight: bold; }
.pending { color: #aaa; }
.match-actions { display: flex; gap: 6px; }

.rank-row {
  display: flex; align-items: center; gap: 12px; padding: 8px 0;
  border-bottom: 1px solid #2a2a42; font-size: 15px;
}
.rank-idx { width: 40px; font-size: 16px; }
.rank-idx.gold { color: #ffd700; }
.rank-idx.silver { color: #c0c0c0; }
.rank-idx.bronze { color: #cd7f32; }
.rank-name { flex: 1; color: #fff; }
.rank-title { background: #7a5ca8; color: #fff; padding: 1px 8px; border-radius: 3px; font-size: 13px; }
.rank-sect { color: #aab; font-size: 14px; }
.rank-cnt { color: #d69e3c; font-weight: bold; }

.btn {
  background: #2a2a42; color: #ddd; border: 1px solid #444;
  padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 15px;
  transition: all 0.15s;
}
.btn:hover:not(:disabled) { background: #3a3a55; border-color: #666; }
.btn.sm { padding: 3px 10px; font-size: 13px; }
.btn.primary { background: #7a5ca8; border-color: #a77bd6; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #8b6dbb; }
.btn.primary:disabled { background: #444; border-color: #555; color: #888; cursor: not-allowed; }
.btn.back { padding: 6px 10px; }

/* 阵容槽位 */
.slot-group { margin-bottom: 16px; }
.slot-group h4 { margin: 0 0 8px; font-size: 15px; color: #d0c8ff; }
.slot-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.roster-summary {
  margin-top: 12px; padding: 10px; background: #22223a; border-radius: 4px;
  font-size: 15px; text-align: center;
}
.roster-summary .warn { color: #d69e3c; margin-left: 8px; }
.roster-summary .ok { color: #3a7; margin-left: 8px; }

/* 押注弹窗 */
.bet-compare {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px;
  align-items: center; margin: 14px 0;
}
.bet-side-card {
  background: #22223a; border: 2px solid #444; border-radius: 6px;
  padding: 12px; text-align: center; cursor: pointer; transition: all 0.15s;
}
.bet-side-card:hover { background: #2a2a48; }
.bet-side-card.active { border-color: #a77bd6; background: #2a1f3a; box-shadow: 0 0 8px rgba(167, 123, 214, 0.4); }
.bs-name { font-size: 17px; font-weight: bold; color: #fff; }
.bs-odds { font-size: 18px; color: #d69e3c; margin-top: 4px; }
.bs-self { font-size: 13px; color: #f66; margin-top: 4px; }
.bet-vs { font-size: 16px; color: #888; text-align: center; }
.warn { color: #f66; }

.bet-input-group { margin-top: 12px; }
.bet-input-group label { display: block; font-size: 14px; color: #aab; margin-bottom: 4px; }
.bet-input-group input {
  width: 100%; background: #0e0e1a; border: 1px solid #444; color: #e0e0f0;
  padding: 8px 10px; border-radius: 4px; font-size: 16px; margin-bottom: 6px;
}
.quick-btns { display: flex; gap: 6px; flex-wrap: wrap; }
.bet-summary {
  background: #22223a; padding: 10px 14px; border-radius: 4px;
  font-size: 14px; line-height: 1.9; margin-top: 12px;
}
.bet-summary b { color: #fff; }
.bet-summary .gain { color: #ffd700; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  z-index: 8000; display: flex; align-items: center; justify-content: center;
}
.modal {
  background: #1a1a2e; border-radius: 8px; padding: 24px; min-width: 440px;
  max-width: 92vw; max-height: 85vh; overflow-y: auto; border: 1px solid #333;
}
.modal.wide { min-width: 680px; }
.modal h3 { margin: 0 0 12px; color: #ffd700; }
.hint { color: #888; font-size: 14px; margin-bottom: 14px; line-height: 1.6; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; padding-top: 12px; border-top: 1px solid #333; }

.mvp { margin-bottom: 12px; padding: 10px 14px; background: linear-gradient(90deg, #2a1f3a, transparent); border-radius: 4px; border-left: 3px solid #ffd700; }
.mvp-badge { background: #ffd700; color: #000; padding: 2px 10px; border-radius: 3px; font-size: 13px; font-weight: bold; margin-right: 8px; }
.mvp-title { background: #7a5ca8; color: #fff; padding: 1px 8px; border-radius: 3px; font-size: 13px; margin-left: 8px; }
.battle { background: #0e0e1a; padding: 12px; border-radius: 4px; margin-bottom: 10px; border-left: 2px solid #444; }
.battle h4 { margin: 0 0 8px; font-size: 15px; color: #d0c8ff; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.battle h4 .side-a, .battle h4 .side-b { color: #ffd700; font-weight: bold; }
.battle h4 .battle-meta { color: #666; font-size: 13px; font-weight: normal; margin-left: auto; }
.battle h4 .replay-btn { margin-left: 8px; }
.log-list { font-size: 14px; color: #ccc; max-height: 360px; overflow-y: auto; padding-right: 8px; background: #050510; padding: 8px; border-radius: 3px; line-height: 1.7; font-family: 'Consolas', 'Courier New', monospace; }
.log { padding: 1px 4px; }
.log.crit { color: #ffaa33; font-weight: bold; }
.log.kill { color: #ff4444; font-weight: bold; background: rgba(255, 68, 68, 0.08); padding: 3px 4px; border-radius: 2px; }
.log.death { color: #ff6666; }
.log.system { color: #88ff88; font-weight: bold; margin: 4px 0; padding: 4px 8px; background: rgba(136, 255, 136, 0.08); border-radius: 3px; }
.log.dodge { color: #66ccff; font-style: italic; }
.log.buff { color: #c77ddb; }
</style>
