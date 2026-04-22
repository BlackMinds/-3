<template>
  <div class="replay-overlay" @click.self="$emit('close')">
    <div class="replay-modal">
      <div class="replay-header">
        <h3>
          📺 {{ battle.battle_type === 'duel' ? '单挑' : '团战' }} · 第 {{ battle.round_no }} 场
          <span v-if="match" class="winner-chip">
            🏆 {{ battle.winner_side === 'a' ? match.sect_a_name : match.sect_b_name }}
          </span>
        </h3>
        <div class="header-controls">
          <label class="toggle-label">
            <input type="checkbox" v-model="showAllLogs" />
            显示所有细节
          </label>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>
      </div>

      <!-- 参战阵容 -->
      <div class="teams">
        <div class="team team-a">
          <h4>{{ match ? match.sect_a_name : 'A 方' }} <span class="team-count">· {{ sideAFighters.length }} 人</span></h4>
          <div class="fighter-list">
            <div v-for="(f, idx) in sideAFighters" :key="'a'+idx" class="fighter-card">
              <div class="fc-avatar" :style="{ background: avatarBg(f.name) }">
                {{ f.name ? f.name[0] : '?' }}
              </div>
              <div class="fc-info">
                <div class="fc-name">{{ f.name || `#${f.id}` }}</div>
                <div class="fc-meta">{{ f.npc ? 'NPC · 守护灵脉' : (realmText(f.realm_tier, f.realm_stage) + ' · Lv.' + (f.level || '?')) }}</div>
                <div class="hp-bar-wrap">
                  <div class="hp-bar" :style="{ width: fighterHpPct(idx, 'a') + '%' }" :class="hpColorClass(fighterHpPct(idx, 'a'))"></div>
                </div>
                <div class="hp-text">{{ Math.floor(fighterHp(idx, 'a')) }} / {{ fighterMaxHp(idx, 'a') }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="vs-mark">VS</div>

        <div class="team team-b">
          <h4>{{ match ? match.sect_b_name : 'B 方' }} <span class="team-count">· {{ sideBFighters.length }} 人</span></h4>
          <div class="fighter-list">
            <div v-for="(f, idx) in sideBFighters" :key="'b'+idx" class="fighter-card">
              <div class="fc-avatar" :style="{ background: avatarBg(f.name) }">
                {{ f.name ? f.name[0] : '?' }}
              </div>
              <div class="fc-info">
                <div class="fc-name">{{ f.name || `#${f.id}` }}</div>
                <div class="fc-meta">{{ f.npc ? 'NPC · 守护灵脉' : (realmText(f.realm_tier, f.realm_stage) + ' · Lv.' + (f.level || '?')) }}</div>
                <div class="hp-bar-wrap">
                  <div class="hp-bar" :style="{ width: fighterHpPct(idx, 'b') + '%' }" :class="hpColorClass(fighterHpPct(idx, 'b'))"></div>
                </div>
                <div class="hp-text">{{ Math.floor(fighterHp(idx, 'b')) }} / {{ fighterMaxHp(idx, 'b') }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 回放控制 -->
      <div class="replay-controls">
        <div class="progress-row">
          <span class="round-label">回合 <b>{{ currentTurn }}</b> / {{ maxTurn }}</span>
          <input
            type="range" min="0" :max="logs.length" step="1"
            v-model.number="logIndex"
            class="replay-slider"
          />
          <span class="log-label">第 {{ logIndex }} / {{ logs.length }} 条</span>
        </div>
        <div class="btn-row">
          <button class="btn sm" @click="jumpTo(0)" title="跳到开头">⏮</button>
          <button class="btn sm" @click="stepTurn(-1)" title="上一回合">⏪</button>
          <button class="btn sm primary" @click="togglePlay">{{ playing ? '⏸ 暂停' : '▶ 播放' }}</button>
          <button class="btn sm" @click="stepTurn(1)" title="下一回合">⏩</button>
          <button class="btn sm" @click="jumpTo(logs.length)" title="跳到结尾">⏭</button>
          <select v-model.number="playSpeed" class="speed-select">
            <option :value="1500">0.5x (慢放)</option>
            <option :value="800">1x (正常)</option>
            <option :value="400">2x (快速)</option>
            <option :value="150">5x (极速)</option>
          </select>
        </div>
      </div>

      <!-- 战斗日志（按回合分组） -->
      <div class="log-timeline" ref="timelineRef">
        <div v-for="g in groupedLogs" :key="g.turn" :class="['turn-group', { active: currentTurn === g.turn }]">
          <div class="turn-header">
            <span class="turn-num">{{ g.turn === 0 ? '开场' : `第 ${g.turn} 回合` }}</span>
            <span class="turn-count">{{ g.logs.length }} 事件</span>
          </div>
          <div class="turn-events">
            <div
              v-for="(l, i) in g.logs" :key="'l'+i"
              :class="['event', l.type, { 'future': l.__index > logIndex }]"
              :ref="(el) => setEventRef(el, l.__index)"
            >
              <span class="event-icon">{{ eventIcon(l.type, l.text) }}</span>
              <span class="event-text">{{ l.text }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="battleEnded" class="end-banner">
        <span v-if="battle.winner_side === 'a'" class="win-a">🎉 {{ match ? match.sect_a_name : 'A 方' }} 获得胜利！</span>
        <span v-else class="win-b">🎉 {{ match ? match.sect_b_name : 'B 方' }} 获得胜利！</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  battle: any
  match?: any
}>()
defineEmits<{ (e: 'close'): void }>()

const api = useApi()
const logs = ref<any[]>([])
const logIndex = ref(0)
const playing = ref(false)
const playSpeed = ref(800)
const showAllLogs = ref(true)
const eventRefs = new Map<number, HTMLElement>()
const timelineRef = ref<HTMLElement | null>(null)

const sideACharMeta = ref<Record<number, any>>({})
const sideBCharMeta = ref<Record<number, any>>({})
const fighterMaxHps = ref<{ a: number[]; b: number[] }>({ a: [], b: [] })
const fighterInitialHps = ref<{ a: number[]; b: number[] }>({ a: [], b: [] })

let playTimer: any = null

// 初始化：为每条日志加索引，加载角色元信息
watch(() => props.battle, async (b) => {
  if (!b) return
  const raw = b.battle_log || []
  logs.value = raw.map((l: any, i: number) => ({ ...l, __index: i + 1 }))
  logIndex.value = 0
  playing.value = false

  // 加载双方角色元信息
  const allIds = [...(b.side_a_chars || []), ...(b.side_b_chars || [])].filter(Boolean)
  if (allIds.length > 0) {
    try {
      const res = await api('/sect/war/battle-meta', { query: { ids: allIds.join(',') } })
      if (res.code === 200) {
        const metaMap: Record<number, any> = {}
        for (const m of res.data) metaMap[m.id] = m
        const am: Record<number, any> = {}
        const bm: Record<number, any> = {}
        for (const id of (b.side_a_chars || [])) am[id] = metaMap[id]
        for (const id of (b.side_b_chars || [])) bm[id] = metaMap[id]
        sideACharMeta.value = am
        sideBCharMeta.value = bm
      }
    } catch {}
  }

  // 找首帧快照推断双方初始 maxHp
  const firstLog = logs.value.find((l: any) => l.sideA_hps && l.sideB_hps)
  if (firstLog) {
    fighterMaxHps.value.a = [...firstLog.sideA_hps]
    fighterMaxHps.value.b = [...firstLog.sideB_hps]
    fighterInitialHps.value.a = [...firstLog.sideA_hps]
    fighterInitialHps.value.b = [...firstLog.sideB_hps]
  }
}, { immediate: true })

onUnmounted(() => { if (playTimer) clearInterval(playTimer) })

// ============ computed ============

function inferSideSize(side: 'a' | 'b'): number {
  const first = logs.value.find((l: any) => l.sideA_hps && l.sideB_hps)
  if (!first) return 0
  return (side === 'a' ? first.sideA_hps : first.sideB_hps).length
}

const sideAFighters = computed(() => {
  const ids: number[] = props.battle?.side_a_chars || []
  const n = ids.length || inferSideSize('a')
  const result: any[] = []
  for (let i = 0; i < n; i++) {
    const id = ids[i]
    if (id && id > 0 && sideACharMeta.value[id]) {
      result.push({ id, ...sideACharMeta.value[id] })
    } else {
      // NPC 或角色元信息缺失
      result.push({ id: id || -(i + 1), name: `守脉鬼差${i + 1}`, npc: true })
    }
  }
  return result
})
const sideBFighters = computed(() => {
  const ids: number[] = props.battle?.side_b_chars || []
  const n = ids.length || inferSideSize('b')
  const result: any[] = []
  for (let i = 0; i < n; i++) {
    const id = ids[i]
    if (id && id > 0 && sideBCharMeta.value[id]) {
      result.push({ id, ...sideBCharMeta.value[id] })
    } else {
      result.push({ id: id || -(i + 1), name: `守脉鬼差${i + 1}`, npc: true })
    }
  }
  return result
})

const currentTurn = computed(() => {
  if (logIndex.value === 0) return 0
  const l = logs.value[logIndex.value - 1]
  return l?.turn || 0
})
const maxTurn = computed(() => {
  return logs.value.reduce((m, l) => Math.max(m, l.turn || 0), 0)
})

const groupedLogs = computed(() => {
  const groups: { turn: number; logs: any[] }[] = []
  let cur: { turn: number; logs: any[] } | null = null
  for (const l of logs.value) {
    if (!cur || cur.turn !== l.turn) {
      cur = { turn: l.turn, logs: [] }
      groups.push(cur)
    }
    if (showAllLogs.value || !shouldHide(l)) {
      cur.logs.push(l)
    }
  }
  return groups
})

const battleEnded = computed(() => logIndex.value >= logs.value.length && logs.value.length > 0)

function shouldHide(l: any) {
  // "精简模式"下隐藏 DOT tick / buff/效果结束消息
  if (!l.text) return false
  if (l.text.includes('受到') && (l.text.includes('中毒') || l.text.includes('流血') || l.text.includes('灼烧')) && l.text.includes('点伤害')) return true
  if (l.text.includes('效果结束')) return true
  return false
}

// ============ HP 计算 ============

function latestSnapshotUpTo(index: number): { a: number[]; b: number[] } {
  // 从当前已播放的最后一条日志反向找含 sideA_hps 的快照
  for (let i = Math.min(index, logs.value.length) - 1; i >= 0; i--) {
    const l = logs.value[i]
    if (l.sideA_hps && l.sideB_hps) {
      return { a: l.sideA_hps, b: l.sideB_hps }
    }
  }
  // 找不到就用初始值
  return { a: fighterInitialHps.value.a, b: fighterInitialHps.value.b }
}

function fighterHp(idx: number, side: 'a' | 'b'): number {
  const snap = latestSnapshotUpTo(logIndex.value)
  const hps = side === 'a' ? snap.a : snap.b
  return hps[idx] ?? 0
}

function fighterMaxHp(idx: number, side: 'a' | 'b'): number {
  const maxHps = side === 'a' ? fighterMaxHps.value.a : fighterMaxHps.value.b
  return maxHps[idx] ?? 1
}

function fighterHpPct(idx: number, side: 'a' | 'b'): number {
  const hp = fighterHp(idx, side)
  const max = fighterMaxHp(idx, side)
  return Math.max(0, Math.min(100, (hp / max) * 100))
}

function hpColorClass(pct: number): string {
  if (pct === 0) return 'hp-dead'
  if (pct > 60) return 'hp-high'
  if (pct > 30) return 'hp-mid'
  return 'hp-low'
}

// ============ 播放控制 ============

function togglePlay() {
  if (playing.value) {
    if (playTimer) { clearInterval(playTimer); playTimer = null }
    playing.value = false
  } else {
    if (logIndex.value >= logs.value.length) logIndex.value = 0
    playing.value = true
    playTimer = setInterval(() => {
      if (logIndex.value >= logs.value.length) {
        playing.value = false
        clearInterval(playTimer)
        playTimer = null
        return
      }
      logIndex.value++
      scrollToCurrent()
    }, playSpeed.value)
  }
}

watch(playSpeed, () => {
  if (playing.value) {
    if (playTimer) clearInterval(playTimer)
    playTimer = setInterval(() => {
      if (logIndex.value >= logs.value.length) {
        playing.value = false
        clearInterval(playTimer)
        playTimer = null
        return
      }
      logIndex.value++
      scrollToCurrent()
    }, playSpeed.value)
  }
})

function jumpTo(idx: number) {
  logIndex.value = Math.max(0, Math.min(logs.value.length, idx))
  nextTick(() => scrollToCurrent())
}

function stepTurn(delta: number) {
  const cur = currentTurn.value
  if (delta > 0) {
    const nextTurn = cur + 1
    const idx = logs.value.findIndex(l => l.turn >= nextTurn)
    if (idx >= 0) jumpTo(idx + 1)
    else jumpTo(logs.value.length)
  } else {
    let target = cur - 1
    if (target < 0) target = 0
    const lastOfTarget = logs.value.reduce((m, l, i) => l.turn <= target ? i + 1 : m, 0)
    jumpTo(lastOfTarget)
  }
}

function setEventRef(el: any, idx: number) {
  if (el) eventRefs.set(idx, el)
}

function scrollToCurrent() {
  const el = eventRefs.get(logIndex.value)
  if (el && timelineRef.value) {
    const container = timelineRef.value
    const elTop = (el as HTMLElement).offsetTop
    container.scrollTop = elTop - container.clientHeight / 2
  }
}

// ============ 工具 ============

function realmText(tier?: number, stage?: number) {
  if (!tier) return ''
  const tiers = ['凡人','练气','筑基','金丹','元婴','化神','渡劫','大乘','飞升','万法']
  const stages = ['一','二','三','四','五','六','七','八','九']
  return `${tiers[tier] || ''}${stages[(stage || 1) - 1] || ''}层`
}

function avatarBg(name?: string) {
  if (!name) return '#444'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff
  const h = hash % 360
  return `linear-gradient(135deg, hsl(${h}, 55%, 45%), hsl(${(h + 60) % 360}, 55%, 30%))`
}

function eventIcon(type: string, text: string): string {
  if (type === 'system') return '⚔️'
  if (type === 'kill' || type === 'death') return '💀'
  if (type === 'crit') return '💥'
  if (type === 'dodge') return '💨'
  if (type === 'buff') {
    if (text.includes('回复')) return '💚'
    if (text.includes('吸血')) return '🩸'
    if (text.includes('反伤') || text.includes('反弹') || text.includes('反震')) return '🔄'
    return '✨'
  }
  if (text.includes('控制') || text.includes('被冻结') || text.includes('被束缚') || text.includes('被眩晕')) return '❄️'
  if (text.includes('中毒')) return '🧪'
  if (text.includes('灼烧')) return '🔥'
  if (text.includes('流血')) return '🩸'
  if (text.includes('神通发动') || text.includes('灵根共鸣')) return '✨'
  if (text.includes('施展')) return '🎯'
  return '·'
}
</script>

<style scoped>
.replay-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8);
  z-index: 9500; display: flex; align-items: center; justify-content: center;
}
.replay-modal {
  width: min(900px, 95vw); height: min(780px, 92vh);
  background: linear-gradient(180deg, #12121e 0%, #0a0a14 100%);
  border: 1px solid #4a3a6a; border-radius: 10px;
  display: flex; flex-direction: column;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
  color: #e0e0f0;
  overflow: hidden;
}

.replay-header {
  padding: 14px 20px; border-bottom: 1px solid #333;
  display: flex; align-items: center; justify-content: space-between;
  background: linear-gradient(90deg, #1f1635, #12121e);
  flex-shrink: 0;
}
.replay-header h3 { margin: 0; font-size: 16px; color: #ffd700; display: flex; align-items: center; gap: 8px; }
.winner-chip { background: #2a1f3a; border: 1px solid #d69e3c; color: #ffd700; padding: 2px 10px; border-radius: 3px; font-size: 14px; font-weight: normal; }
.header-controls { display: flex; align-items: center; gap: 12px; }
.toggle-label { font-size: 13px; color: #aab; cursor: pointer; user-select: none; display: flex; align-items: center; gap: 4px; }
.close-btn { background: none; border: none; color: #aab; font-size: 26px; cursor: pointer; line-height: 1; padding: 0 4px; }
.close-btn:hover { color: #fff; }

/* 双方阵容 */
.teams {
  display: grid; grid-template-columns: 1fr 40px 1fr;
  gap: 8px; padding: 12px 16px; border-bottom: 1px solid #333;
  flex-shrink: 0;
}
.team { background: #1a1a2e; padding: 10px; border-radius: 6px; }
.team-a { border-left: 3px solid #a77bd6; }
.team-b { border-right: 3px solid #d69e3c; }
.team h4 { margin: 0 0 8px; font-size: 15px; color: #d0c8ff; }
.team-count { color: #888; font-weight: normal; font-size: 13px; }
.fighter-list { display: flex; flex-direction: column; gap: 6px; }
.fighter-card {
  display: flex; gap: 8px; background: #22223a; padding: 8px; border-radius: 4px;
  align-items: center;
}
.fc-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: bold; color: #fff;
  flex-shrink: 0;
}
.fc-info { flex: 1; min-width: 0; }
.fc-name { font-size: 14px; color: #fff; font-weight: bold; }
.fc-meta { font-size: 12px; color: #888; margin-bottom: 3px; }
.hp-bar-wrap {
  height: 6px; background: #1a1a2e; border-radius: 3px;
  overflow: hidden; border: 1px solid #333; position: relative;
}
.hp-bar {
  height: 100%; transition: width 0.3s ease, background 0.2s;
}
.hp-bar.hp-high { background: linear-gradient(90deg, #3a7, #5c9); }
.hp-bar.hp-mid { background: linear-gradient(90deg, #d69e3c, #e0b060); }
.hp-bar.hp-low { background: linear-gradient(90deg, #c33, #e55); animation: pulse-red 0.8s infinite; }
.hp-bar.hp-dead { background: #333; }
.hp-text { font-size: 12px; color: #aab; margin-top: 2px; }
@keyframes pulse-red { 50% { opacity: 0.7; } }

.vs-mark {
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: #d69e3c; font-weight: bold;
}

/* 回放控制 */
.replay-controls {
  padding: 10px 16px; border-bottom: 1px solid #333;
  background: #0e0e1a; flex-shrink: 0;
}
.progress-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
  font-size: 14px;
}
.round-label b { color: #ffd700; font-size: 16px; }
.replay-slider { flex: 1; }
.log-label { color: #888; font-size: 13px; min-width: 80px; text-align: right; }
.btn-row { display: flex; gap: 6px; align-items: center; }
.btn {
  background: #2a2a42; color: #ddd; border: 1px solid #444;
  padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 14px;
}
.btn:hover { background: #3a3a55; }
.btn.sm { padding: 3px 10px; font-size: 13px; }
.btn.primary { background: #7a5ca8; border-color: #a77bd6; color: #fff; }
.speed-select {
  background: #22223a; border: 1px solid #444; color: #ddd;
  padding: 3px 6px; border-radius: 3px; font-size: 13px;
  margin-left: auto;
}

/* 日志时间线 */
.log-timeline {
  flex: 1; overflow-y: auto; padding: 10px 16px;
  background: #070710;
  scroll-behavior: smooth;
}
.turn-group {
  margin-bottom: 10px; border-left: 2px solid #333;
  padding-left: 12px;
  transition: border-color 0.2s;
}
.turn-group.active { border-left-color: #d69e3c; }
.turn-header {
  display: flex; align-items: center; gap: 8px;
  margin: 4px 0 6px; font-size: 14px;
}
.turn-num { color: #d69e3c; font-weight: bold; }
.turn-count { color: #666; font-size: 12px; }
.turn-events { display: flex; flex-direction: column; gap: 3px; }
.event {
  display: flex; gap: 6px; align-items: flex-start;
  padding: 4px 8px; border-radius: 3px;
  font-size: 14px; line-height: 1.4;
  background: #101020;
  transition: opacity 0.15s, background 0.15s;
}
.event.future { opacity: 0.25; }
.event .event-icon { flex-shrink: 0; font-size: 15px; width: 18px; text-align: center; }
.event .event-text { flex: 1; color: #ccc; }
.event.system { background: rgba(136, 255, 136, 0.1); }
.event.system .event-text { color: #88ff88; font-weight: bold; }
.event.crit { background: rgba(255, 170, 51, 0.1); }
.event.crit .event-text { color: #ffaa33; font-weight: bold; }
.event.kill { background: rgba(255, 68, 68, 0.15); }
.event.kill .event-text { color: #ff6666; font-weight: bold; }
.event.death .event-text { color: #ff8888; }
.event.dodge .event-text { color: #66ccff; font-style: italic; }
.event.buff { background: rgba(199, 125, 219, 0.08); }
.event.buff .event-text { color: #c77ddb; }

.end-banner {
  padding: 14px; text-align: center; border-top: 1px solid #333;
  background: linear-gradient(90deg, #2a1f3a, #1f2a3a);
  font-size: 16px; font-weight: bold;
  flex-shrink: 0;
}
.end-banner .win-a { color: #a77bd6; }
.end-banner .win-b { color: #d69e3c; }

@media (max-width: 768px) {
  .replay-modal { width: 100vw; height: 100vh; border-radius: 0; border: none; }
  .replay-header { padding: 10px 12px; flex-wrap: wrap; gap: 6px; }
  .replay-header h3 { font-size: 14px; gap: 6px; }
  .winner-chip { font-size: 12px; padding: 1px 8px; }
  .header-controls { gap: 8px; }
  .toggle-label { font-size: 12px; }
  .close-btn { font-size: 22px; }
  .teams { grid-template-columns: 1fr; gap: 6px; padding: 8px 10px; }
  .team { padding: 8px; }
  .team-a, .team-b { border-left: 3px solid #a77bd6; border-right: none; }
  .team-b { border-left-color: #d69e3c; }
  .team h4 { font-size: 13px; }
  .vs-mark { display: none; }
  .fighter-card { padding: 6px; gap: 6px; }
  .fc-avatar { width: 26px; height: 26px; font-size: 13px; }
  .fc-name { font-size: 12px; }
  .fc-meta { font-size: 11px; }
  .hp-text { font-size: 10px; }
  .replay-controls { padding: 8px 10px; }
  .progress-row { gap: 6px; font-size: 12px; flex-wrap: wrap; }
  .log-label { min-width: 0; font-size: 11px; }
  .btn-row { flex-wrap: wrap; gap: 4px; }
  .btn { font-size: 12px; padding: 3px 8px; }
  .log-timeline { padding: 8px 10px; }
  .event { font-size: 12px; padding: 3px 6px; }
  .turn-header { font-size: 12px; }
  .end-banner { font-size: 13px; padding: 10px; }
}
</style>
