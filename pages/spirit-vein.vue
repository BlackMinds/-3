<template>
  <div class="page">
    <div class="topbar">
      <button class="btn back" @click="$router.back()">← 返回</button>
      <h2>🌀 灵脉潮汐</h2>
      <button class="btn mail-btn" @click="showMail = true">
        📬 邮箱
        <span v-if="mailUnread > 0" class="red-dot">{{ mailUnread }}</span>
      </button>
    </div>

    <div class="cd-bar">
      <div v-if="cdInfo?.guarding?.length" class="cd-item guard">
        🏛️ 驻守中: <b>{{ cdInfo.guarding[0].node_name }}</b>
        <span class="expire">剩余 {{ formatDuration(cdInfo.guarding[0].expires_at, tickNow) }}</span>
        <button class="btn sm" @click="leaveGuard">离岗</button>
      </div>
      <div class="cd-item">
        🎯 今日偷袭: <b>{{ cdInfo?.dailyRaidCount || 0 }} / {{ cdInfo?.dailyRaidLimit || 10 }}</b>
      </div>
      <div v-for="cd in activeCds" :key="cd.cd_type + (cd.target_node_id || '')" class="cd-item warn">
        ⚠️ {{ cdLabel(cd.cd_type) }}{{ cd.target_node_id ? `(节点${cd.target_node_id})` : '' }}
        剩 {{ formatDuration(cd.expires_at, tickNow) }}
      </div>
    </div>

    <div class="nodes">
      <div
        v-for="n in nodes"
        :key="n.id"
        :class="['node-card', 'tier-' + n.tier, nodeState(n)]"
      >
        <div class="node-header">
          <span class="node-tier">{{ tierText(n.tier) }}</span>
          <h3>{{ n.name }}</h3>
          <span v-if="sectOccupyMap[n.sect_id] >= 4" class="nemesis">众矢之敌</span>
        </div>
        <div class="node-body">
          <div class="owner">
            <span v-if="n.sect_id">
              {{ nodeState(n) === 'owned' ? '🏛️ 己方占领' : '⚔️ 敌方' }}:
              <b>{{ n.sect_name }}</b>
            </span>
            <span v-else class="npc">👻 NPC 守脉鬼差</span>
          </div>
          <div class="guards-row">
            <div class="guards-slots">
              <span
                v-for="i in n.guard_limit"
                :key="i"
                :class="['guard-slot', { filled: i <= n.current_guard_count }]"
              ></span>
            </div>
            <span class="guards-text">{{ n.current_guard_count }} / {{ n.guard_limit }}</span>
          </div>
          <div class="reward">
            💎 {{ formatNum(n.stone_reward) }} 灵石 · {{ formatNum(n.exp_reward) }} 修为 / 2h
          </div>
          <div class="next-surge">
            ⏱️ 下次涌灵: {{ formatCountdown(n.next_surge_at, tickNow) }}
          </div>
        </div>
        <div class="node-actions">
          <button class="btn sm" @click="openNode(n)">详情</button>
          <button class="btn sm primary" :disabled="!canRaid(n)" @click="openRaid(n)">
            偷袭
          </button>
          <button
            v-if="n.sect_id === mySectId"
            class="btn sm"
            :disabled="!canGuard(n)"
            :title="guardTooltip(n)"
            @click="doGuard(n)"
          >驻守</button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><h3>🏆 本周奖池</h3></div>
      <div v-if="jackpot?.current" class="jackpot">
        <div class="jackpot-main">
          <span class="jp-label">奖池总额</span>
          <span class="jp-amount">{{ formatNum(jackpot.current.pool_amount) }}</span>
          <span class="jp-suffix">灵石</span>
        </div>
        <div class="jp-sub">本周日 23:55 自动结算 · 按"涌灵次数 × (1 - 占领数/6)"公式排行</div>
      </div>
      <div v-else class="empty">暂无奖池数据</div>
      <div v-if="jackpot?.topSects?.length" class="rank-box">
        <h4>综合贡献榜</h4>
        <div v-for="(s, idx) in jackpot.topSects" :key="s.sect_id" class="rank-row">
          <span :class="['rank-idx', rankMedal(idx)]">{{ rankText(idx) }}</span>
          <span class="rank-name">{{ s.sect_name }}</span>
          <span class="rank-cnt">🌊 {{ s.surge_count }} 次涌灵</span>
          <span class="rank-occupy">占 {{ s.occupy_count }} 节点</span>
        </div>
      </div>
    </div>

    <!-- 节点详情 -->
    <div v-if="nodeDetail" class="modal-overlay" @click.self="nodeDetail = null">
      <div class="modal wide">
        <h3>🌀 {{ nodeDetail.node.name }} <span class="tier-tag">{{ tierText(nodeDetail.node.tier) }}</span></h3>

        <div class="detail-summary">
          <div>占领: <b>{{ nodeDetail.node.sect_name || 'NPC' }}</b></div>
          <div>下次涌灵: <b>{{ formatCountdown(nodeDetail.node.next_surge_at, tickNow) }}</b></div>
          <div>收益: {{ formatNum(nodeDetail.node.stone_reward) }} 灵石 / 2h</div>
        </div>

        <h4>🏛️ 当前守卫 ({{ nodeDetail.guards.length }}/{{ nodeDetail.node.guard_limit }})</h4>
        <div class="guards-detail">
          <div v-for="g in nodeDetail.guards" :key="g.character_id" class="guard-avatar-card">
            <div class="avatar-circle">{{ g.name[0] }}</div>
            <div class="guard-info">
              <div class="g-name">{{ g.name }}</div>
              <div class="g-meta">Lv.{{ g.level }} · {{ realmText(g.realm_tier, g.realm_stage) }}</div>
            </div>
          </div>
          <div v-for="i in (nodeDetail.node.guard_limit - nodeDetail.guards.length)" :key="'empty'+i" class="guard-avatar-card empty">
            <div class="avatar-circle">?</div>
            <div class="guard-info"><div class="g-meta">空位</div></div>
          </div>
        </div>

        <h4>⚔️ 最近偷袭记录</h4>
        <div v-for="r in nodeDetail.recentRaids" :key="r.id" class="raid-row">
          <span :class="['raid-win', r.winner_side]">
            {{ r.winner_side === 'attacker' ? '✅ 进攻胜' : '🛡️ 防守胜' }}
          </span>
          <span class="raid-parties">{{ r.attacker_name || '?' }} → {{ r.defender_name || 'NPC' }}</span>
          <span class="meta">{{ formatTime(r.created_at) }}</span>
        </div>
        <div v-if="!nodeDetail.recentRaids.length" class="empty sm">暂无记录</div>

        <div class="modal-actions">
          <button class="btn" @click="nodeDetail = null">关闭</button>
        </div>
      </div>
    </div>

    <!-- 偷袭弹窗 -->
    <div v-if="raidNode" class="modal-overlay" @click.self="raidNode = null">
      <div class="modal wide">
        <h3>⚔️ 偷袭 · {{ raidNode.name }}</h3>
        <p class="hint">
          进攻方上限 <b>{{ maxAttackers }}</b> 人（节点上限 {{ raidNode.guard_limit }}，实际在守 {{ raidNode.current_guard_count }} 人）
          · 进场费 <b style="color: #f66;">500 灵石</b>
        </p>

        <div class="raid-layout">
          <div class="raid-side attackers">
            <h4>🗡️ 我方出征（{{ selectedTeammates.length }} / {{ maxAttackers }}）</h4>
            <div class="picker-list">
              <label v-for="m in raidEligibleMembers" :key="m.character_id"
                :class="['picker-item', { active: selectedTeammates.includes(m.character_id), disabled: isPickerDisabled(m) }]"
              >
                <input type="checkbox" :value="m.character_id"
                  :checked="selectedTeammates.includes(m.character_id)"
                  :disabled="isPickerDisabled(m)"
                  @change="toggleTeammate(m.character_id)"
                />
                <div class="pi-info">
                  <div class="pi-name">
                    {{ m.name }}
                    <span v-if="m.character_id === myCharId" class="self-tag">你</span>
                  </div>
                  <div class="pi-meta">{{ realmText(m.realm_tier, m.realm_stage) }} · Lv.{{ m.level }}</div>
                </div>
              </label>
            </div>
            <div class="total-line">🗡️ 我方实力: Lv {{ atkTotalLv }}</div>
          </div>
          <div class="raid-vs">VS</div>
          <div class="raid-side defenders">
            <h4>🛡️ 敌方守卫</h4>
            <div class="defender-list" v-if="raidNode.sect_id">
              <div v-for="g in raidDefenders" :key="g.character_id" class="defender-card">
                <div class="avatar-circle">{{ g.name[0] }}</div>
                <div class="g-name">{{ g.name }}</div>
                <div class="g-meta">Lv.{{ g.level }}</div>
              </div>
              <div v-if="!raidDefenders.length" class="empty sm">节点空守</div>
            </div>
            <div v-else class="defender-list">
              <div v-for="i in raidNode.guard_limit" :key="'npc'+i" class="defender-card npc">
                <div class="avatar-circle">👻</div>
                <div class="g-name">守脉鬼差</div>
                <div class="g-meta">NPC</div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn" @click="raidNode = null">取消</button>
          <button class="btn primary" :disabled="!canConfirmRaid" @click="doRaid">
            确认偷袭（-500 灵石）
          </button>
        </div>
      </div>
    </div>

    <!-- 战报 -->
    <div v-if="raidLog" class="modal-overlay" @click.self="closeRaidLog">
      <div class="modal wide">
        <h3>
          <span :class="raidResult === 'attacker' ? 'win-text' : 'lose-text'">
            {{ raidResult === 'attacker' ? '✅ 偷袭胜利' : '❌ 偷袭失败' }}
          </span>
          <button class="btn sm primary replay-btn" @click="openRaidReplay">📺 详细回放</button>
        </h3>
        <div class="log-list">
          <div v-for="(l, idx) in raidLog" :key="idx" :class="['log', l.type]">{{ l.text }}</div>
        </div>
        <div class="modal-actions"><button class="btn" @click="closeRaidLog">关闭</button></div>
      </div>
    </div>

    <BattleReplay
      v-if="replayBattle"
      :battle="replayBattle"
      :match="replayMatch"
      @close="replayBattle = null"
    />

    <MailDrawer v-model="showMail" @update:modelValue="refreshMailCount" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const api = useApi()

const nodes = ref<any[]>([])
const sectOccupyMap = ref<Record<number, number>>({})
const cdInfo = ref<any>(null)
const mySectId = ref<number | null>(null)
const myCharId = ref<number | null>(null)
const sectMembers = ref<any[]>([])
const jackpot = ref<any>(null)
const showMail = ref(false)
const mailUnread = ref(0)
const nodeDetail = ref<any>(null)
const raidNode = ref<any>(null)
const raidDefenders = ref<any[]>([])
const selectedTeammates = ref<number[]>([])
const raidLog = ref<any[] | null>(null)
const raidResult = ref<string>('')
const replayBattle = ref<any>(null)
const replayMatch = ref<any>(null)
const lastRaidAttackerIds = ref<number[]>([])
const lastRaidDefenderIds = ref<number[]>([])
const lastRaidNode = ref<any>(null)

function openRaidReplay() {
  if (!raidLog.value) return
  replayBattle.value = {
    battle_log: raidLog.value,
    winner_side: raidResult.value === 'attacker' ? 'a' : 'b',
    battle_type: 'team',
    round_no: 1,
    side_a_chars: lastRaidAttackerIds.value,
    side_b_chars: lastRaidDefenderIds.value,
  }
  replayMatch.value = {
    sect_a_name: '进攻方·' + (mySectMembership.value?.sect_name || '我方'),
    sect_b_name: lastRaidNode.value?.sect_name
      ? '守方·' + lastRaidNode.value.sect_name
      : '守脉鬼差·NPC',
  }
}

const mySectMembership = ref<any>(null)

const tickNow = ref(Date.now())
let tickTimer: any = null

const activeCds = computed(() => (cdInfo.value?.cooldowns || []).filter((c: any) => new Date(c.expires_at).getTime() > tickNow.value))

const raidEligibleMembers = computed(() => {
  return sectMembers.value.filter(m => {
    return ['leader','vice_leader','elder','inner'].includes(m.role) && m.realm_tier >= 2
  })
})

const maxAttackers = computed(() => {
  if (!raidNode.value) return 1
  const n = raidNode.value
  if (!n.sect_id || n.current_guard_count === 0) return n.guard_limit
  return Math.min(n.guard_limit, n.current_guard_count + 1)
})

const atkTotalLv = computed(() => {
  return raidEligibleMembers.value
    .filter(m => selectedTeammates.value.includes(m.character_id))
    .reduce((s, m) => s + (m.level || 0), 0)
})

const canConfirmRaid = computed(() => {
  return selectedTeammates.value.length >= 1
    && selectedTeammates.value.length <= maxAttackers.value
    && selectedTeammates.value.includes(myCharId.value!)
})

function tierText(t: string) { return { low: '下品', mid: '中品', high: '上品', supreme: '极品' }[t] || t }
function cdLabel(t: string) { return { defend_injured: '闭关疗伤', attack_injured: '伤势未愈', attack_node: '节点偷袭CD' }[t] || t }
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
function formatDuration(ts: string, now: number) {
  const s = Math.max(0, Math.floor((new Date(ts).getTime() - now) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${m}m`
  if (m > 0) return `${m}m${sec}s`
  return `${sec}s`
}
function formatCountdown(ts: string, now: number) {
  const diff = new Date(ts).getTime() - now
  if (diff <= 0) return '即将结算'
  return formatDuration(ts, now)
}
function formatTime(t: string) { return new Date(t).toLocaleString('zh-CN', { hour12: false }) }
function rankText(idx: number) { return ['🥇', '🥈', '🥉'][idx] || `#${idx + 1}` }
function rankMedal(idx: number) { return ['gold', 'silver', 'bronze'][idx] || '' }

function nodeState(n: any): string {
  if (!n.sect_id) return 'npc'
  if (n.sect_id === mySectId.value) return 'owned'
  return 'enemy'
}

function canRaid(n: any) {
  if (n.sect_id === mySectId.value) return false
  if (!cdInfo.value) return false
  const ai = activeCds.value.find((c: any) => c.cd_type === 'attack_injured')
  if (ai) return false
  return true
}
function canGuard(n: any) {
  if (!cdInfo.value) return false
  if (n.sect_id !== mySectId.value) return false
  if ((cdInfo.value.guarding || []).length > 0) return false
  if (n.current_guard_count >= n.guard_limit) return false
  const di = activeCds.value.find((c: any) => c.cd_type === 'defend_injured')
  if (di) return false
  return true
}
function guardTooltip(n: any) {
  if ((cdInfo.value?.guarding || []).length > 0) return '你已在其他节点驻守'
  if (n.current_guard_count >= n.guard_limit) return '该节点已满员'
  const di = activeCds.value.find((c: any) => c.cd_type === 'defend_injured')
  if (di) return '闭关疗伤中'
  return '驻守该节点'
}

function isPickerDisabled(m: any) {
  if (m.character_id === myCharId.value) return false // 自己强制选中
  if (selectedTeammates.value.includes(m.character_id)) return false
  return selectedTeammates.value.length >= maxAttackers.value
}

function toggleTeammate(charId: number) {
  if (charId === myCharId.value) return // 自己不可取消
  const idx = selectedTeammates.value.indexOf(charId)
  if (idx >= 0) selectedTeammates.value.splice(idx, 1)
  else if (selectedTeammates.value.length < maxAttackers.value) selectedTeammates.value.push(charId)
}

async function loadAll() {
  const [mapRes, cdRes, jackpotRes, myRes, charRes] = await Promise.all([
    api('/spirit-vein/map'),
    api('/spirit-vein/cd'),
    api('/spirit-vein/jackpot'),
    api('/sect/info').catch(() => ({ data: null })),
    api('/character/info').catch(() => ({ data: null })),
  ])
  if (mapRes.code === 200) {
    nodes.value = mapRes.data.nodes
    sectOccupyMap.value = mapRes.data.sectOccupyMap
  }
  if (cdRes.code === 200) cdInfo.value = cdRes.data
  if (jackpotRes.code === 200) jackpot.value = jackpotRes.data
  mySectId.value = myRes.data?.sect?.id || null
  sectMembers.value = myRes.data?.members || []
  mySectMembership.value = myRes.data?.sect || null
  myCharId.value = charRes.data?.id || null
  await refreshMailCount()
}

async function refreshMailCount() {
  try {
    const r = await api('/mail/unread-count')
    if (r.code === 200) mailUnread.value = r.data.unread
  } catch {}
}

async function openNode(n: any) {
  const res = await api('/spirit-vein/node', { query: { id: n.id } })
  if (res.code === 200) nodeDetail.value = res.data
}

async function openRaid(n: any) {
  raidNode.value = n
  selectedTeammates.value = myCharId.value ? [myCharId.value] : []
  // 拉取守卫信息
  if (n.sect_id) {
    const res = await api('/spirit-vein/node', { query: { id: n.id } })
    raidDefenders.value = res.data?.guards || []
  } else {
    raidDefenders.value = []
  }
}

async function doRaid() {
  const defenderIds = raidDefenders.value.map((d: any) => d.character_id).filter(Boolean)
  const targetNodeInfo = { ...raidNode.value }
  const res = await api('/spirit-vein/raid', { method: 'POST', body: {
    nodeId: raidNode.value.id, attackerCharacterIds: selectedTeammates.value,
  }})
  if (res.code === 200) {
    raidLog.value = res.data.battleLog
    raidResult.value = res.data.result
    lastRaidAttackerIds.value = [...selectedTeammates.value]
    lastRaidDefenderIds.value = defenderIds
    lastRaidNode.value = targetNodeInfo
    raidNode.value = null
    await loadAll()
  } else {
    alert(res.message)
  }
}

function closeRaidLog() { raidLog.value = null; raidResult.value = '' }

async function doGuard(n: any) {
  const res = await api('/spirit-vein/guard', { method: 'POST', body: { nodeId: n.id } })
  if (res.code === 200) {
    await loadAll()
  } else {
    alert(res.message)
  }
}

async function leaveGuard() {
  const res = await api('/spirit-vein/guard-leave', { method: 'POST', body: {} })
  await loadAll()
}

onMounted(() => {
  loadAll()
  tickTimer = setInterval(() => { tickNow.value = Date.now() }, 1000)
})
onUnmounted(() => { if (tickTimer) clearInterval(tickTimer) })
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

.cd-bar {
  display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 16px;
  background: #1a1a2e; border-bottom: 1px solid #333;
  font-size: 14px;
}
.cd-item {
  background: #2a2a42; padding: 6px 12px; border-radius: 4px;
  display: flex; align-items: center; gap: 8px;
}
.cd-item.guard { background: #1f3a2a; color: #afa; }
.cd-item.warn { background: #3a2020; color: #faa; }
.cd-item .expire { color: #666; font-size: 13px; }

.nodes {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px; padding: 16px;
}
.node-card {
  background: #1a1a2e; padding: 16px; border-radius: 8px;
  border: 2px solid #333; transition: all 0.15s;
}
.node-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); }
.node-card.tier-low { border-left: 4px solid #3a7; }
.node-card.tier-mid { border-left: 4px solid #36c; }
.node-card.tier-high { border-left: 4px solid #a3c; }
.node-card.tier-supreme { border-left: 4px solid #d69e3c; box-shadow: 0 0 16px rgba(214, 158, 60, 0.2); }
.node-card.owned { border-color: #3a7; background: linear-gradient(135deg, #1a2a1f, #1a1a2e); }
.node-card.enemy { border-color: #c33; background: linear-gradient(135deg, #2a1a1a, #1a1a2e); }
.node-card.npc { opacity: 0.88; }

.node-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.node-header h3 { margin: 0; font-size: 16px; flex: 1; }
.node-tier {
  background: #2a2a42; padding: 2px 8px; border-radius: 3px;
  font-size: 13px; color: #aab;
}
.tier-low .node-tier { background: #264; color: #bfb; }
.tier-mid .node-tier { background: #246; color: #bcf; }
.tier-high .node-tier { background: #426; color: #fbf; }
.tier-supreme .node-tier { background: #a70; color: #ffd; }
.nemesis { background: #c33; color: #fff; padding: 1px 6px; border-radius: 3px; font-size: 12px; }

.node-body { font-size: 14px; color: #aab; }
.owner { margin-bottom: 8px; font-size: 15px; color: #ddd; }
.owner b { color: #fff; }
.owner .npc { color: #888; }

.guards-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.guards-slots { display: flex; gap: 3px; }
.guard-slot {
  width: 10px; height: 10px; border-radius: 50%;
  background: #333; border: 1px solid #555;
}
.guard-slot.filled { background: #3a7; border-color: #5c9; box-shadow: 0 0 4px #3a7; }
.guards-text { color: #888; }

.reward { margin-bottom: 4px; color: #d69e3c; }
.next-surge { color: #9cf; }

.node-actions { margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; }

.section { background: #1a1a2e; margin: 16px; padding: 16px; border-radius: 8px; }
.section-header h3 { margin: 0 0 12px; font-size: 16px; color: #d0c8ff; }

.jackpot {
  background: linear-gradient(135deg, #2a1f3a, #1a2a42);
  padding: 16px; border-radius: 6px;
}
.jackpot-main { display: flex; align-items: baseline; gap: 8px; }
.jp-label { color: #aab; font-size: 15px; }
.jp-amount { font-size: 28px; font-weight: bold; color: #d69e3c; }
.jp-suffix { color: #aab; }
.jp-sub { color: #888; font-size: 13px; margin-top: 4px; }

.rank-box h4 { margin: 12px 0 6px; font-size: 15px; color: #aab; }
.rank-row { display: flex; gap: 12px; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #2a2a42; align-items: center; }
.rank-idx { width: 40px; font-size: 16px; }
.rank-idx.gold { color: #ffd700; }
.rank-idx.silver { color: #c0c0c0; }
.rank-idx.bronze { color: #cd7f32; }
.rank-name { flex: 1; color: #fff; }
.rank-cnt { color: #9cf; font-size: 13px; }
.rank-occupy { color: #888; font-size: 13px; }

.empty { text-align: center; color: #666; padding: 20px; }
.empty.sm { padding: 10px; font-size: 14px; }

.btn {
  background: #2a2a42; color: #ddd; border: 1px solid #444;
  padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 15px;
  transition: all 0.15s;
}
.btn:hover:not(:disabled) { background: #3a3a55; border-color: #666; }
.btn.sm { padding: 3px 10px; font-size: 13px; }
.btn.primary { background: #7a5ca8; border-color: #a77bd6; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #8b6dbb; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.primary:disabled { background: #444; border-color: #555; color: #888; }
.btn.back { padding: 6px 10px; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  z-index: 8000; display: flex; align-items: center; justify-content: center;
}
.modal {
  background: #1a1a2e; border-radius: 8px; padding: 24px; min-width: 420px;
  max-width: 92vw; max-height: 88vh; overflow-y: auto; border: 1px solid #333;
}
.modal.wide { min-width: 680px; }
.modal h3 { margin: 0 0 12px; color: #ffd700; }
.modal h4 { margin: 16px 0 8px; font-size: 15px; color: #aab; }
.tier-tag { background: #2a2a42; padding: 2px 8px; border-radius: 3px; font-size: 13px; margin-left: 8px; color: #aab; }
.hint { color: #888; font-size: 14px; margin-bottom: 12px; line-height: 1.6; }

.detail-summary {
  display: flex; gap: 16px; flex-wrap: wrap;
  background: #22223a; padding: 10px 14px; border-radius: 4px;
  font-size: 14px; color: #aab;
}
.detail-summary b { color: #fff; }

.guards-detail {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.guard-avatar-card {
  background: #22223a; padding: 10px; border-radius: 4px;
  display: flex; align-items: center; gap: 10px; border: 1px solid #333;
}
.guard-avatar-card.empty { opacity: 0.5; border-style: dashed; }
.avatar-circle {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #7a5ca8, #4a3a68);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: bold; color: #fff;
}
.guard-avatar-card.empty .avatar-circle { background: #333; color: #666; }
.guard-info { flex: 1; min-width: 0; }
.g-name { font-size: 15px; color: #fff; }
.g-meta { font-size: 13px; color: #888; }

.raid-row {
  display: flex; gap: 10px; padding: 6px 0;
  font-size: 14px; border-bottom: 1px solid #2a2a42; align-items: center;
}
.raid-row .meta { color: #666; font-size: 13px; margin-left: auto; }
.raid-win.attacker { color: #3f3; }
.raid-win.defender { color: #f66; }
.raid-parties { color: #aab; }

/* 偷袭弹窗 */
.raid-layout {
  display: grid; grid-template-columns: 1fr 40px 1fr; gap: 10px;
  margin: 12px 0;
}
.raid-side { background: #22223a; padding: 12px; border-radius: 6px; }
.raid-side h4 { margin: 0 0 8px; font-size: 14px; }
.raid-vs { align-self: center; font-size: 18px; text-align: center; color: #888; }
.picker-list { max-height: 240px; overflow-y: auto; }
.picker-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  border-radius: 4px; cursor: pointer; font-size: 14px;
  transition: all 0.15s;
}
.picker-item:hover:not(.disabled) { background: #2a2a48; }
.picker-item.active { background: #2a1f3a; border-left: 3px solid #a77bd6; }
.picker-item.disabled { opacity: 0.3; cursor: not-allowed; }
.pi-name { color: #fff; font-size: 14px; }
.pi-name .self-tag { background: #d69e3c; color: #000; padding: 0 5px; border-radius: 2px; font-size: 12px; margin-left: 4px; }
.pi-meta { color: #888; font-size: 13px; margin-top: 1px; }
.total-line { margin-top: 8px; padding-top: 8px; border-top: 1px solid #333; font-size: 14px; color: #aab; }

.defender-list { display: flex; flex-direction: column; gap: 6px; }
.defender-card {
  display: flex; align-items: center; gap: 8px;
  background: #1a1a2e; padding: 8px; border-radius: 4px;
}
.defender-card.npc { opacity: 0.8; }
.defender-card .avatar-circle { width: 28px; height: 28px; font-size: 14px; }

.win-text { color: #3f3; }
.lose-text { color: #f66; }
.modal h3 .replay-btn { margin-left: 8px; }
.log-list { font-size: 14px; max-height: 400px; overflow-y: auto; padding-right: 8px; background: #050510; padding: 8px; border-radius: 3px; line-height: 1.7; font-family: 'Consolas', 'Courier New', monospace; }
.log { padding: 1px 4px; color: #ccc; }
.log.crit { color: #ffaa33; font-weight: bold; }
.log.kill { color: #ff4444; font-weight: bold; background: rgba(255, 68, 68, 0.08); padding: 3px 4px; border-radius: 2px; }
.log.death { color: #ff6666; }
.log.system { color: #88ff88; font-weight: bold; margin: 4px 0; padding: 4px 8px; background: rgba(136, 255, 136, 0.08); border-radius: 3px; }
.log.dodge { color: #66ccff; font-style: italic; }
.log.buff { color: #c77ddb; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; padding-top: 12px; border-top: 1px solid #333; }

@media (max-width: 768px) {
  .topbar { padding: 8px 10px; gap: 6px; }
  .topbar h2 { font-size: 14px; }
  .topbar .btn, .topbar .mail-btn { font-size: 12px; padding: 4px 8px; }

  .cd-bar { padding: 8px 10px; font-size: 12px; gap: 6px; }
  .cd-item { padding: 4px 8px; gap: 6px; }
  .cd-item .expire { font-size: 11px; }

  .nodes {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 10px;
  }
  .node-card { padding: 12px; }
  .node-header h3 { font-size: 14px; }
  .node-tier { font-size: 11px; }
  .node-body { font-size: 12px; }
  .owner { font-size: 13px; }

  .section { margin: 10px; padding: 10px; }
  .section-header h3 { font-size: 14px; }

  .jackpot { padding: 12px; }
  .jp-amount { font-size: 22px; }
  .jp-label, .jp-suffix { font-size: 13px; }
  .jp-sub { font-size: 11px; }

  .rank-row { gap: 8px; font-size: 12px; }
  .rank-idx { width: 28px; font-size: 13px; }

  .btn { font-size: 12px; padding: 5px 10px; }
  .btn.sm { font-size: 11px; padding: 3px 8px; }

  .modal { min-width: 0; width: calc(100vw - 16px); padding: 14px 12px; }
  .modal.wide { min-width: 0; }
  .detail-summary { font-size: 12px; gap: 8px; padding: 8px 10px; }
  .guards-detail {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 6px;
  }
  .raid-layout { grid-template-columns: 1fr; gap: 6px; }
  .raid-vs { display: none; }
  .raid-side { padding: 10px; }
  .picker-list { max-height: 200px; }
  .picker-item { font-size: 12px; }

  .log-list { font-size: 12px; max-height: 300px; padding: 6px; }
}
</style>
