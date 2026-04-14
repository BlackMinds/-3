<template>
  <div v-if="eventStore.panelOpen" class="wb-overlay" @click.self="eventStore.closePanel()">
    <div class="wb-drawer">
      <div class="wb-header">
        <div class="wb-title">🗺 风云阁</div>
        <div class="wb-subtitle">万界见闻 · 天道独眷</div>
        <button class="wb-close" @click="eventStore.closePanel()">×</button>
      </div>

      <div class="wb-tabs">
        <button :class="{ active: filter === 'all' }" @click="changeFilter('all', null)">全部</button>
        <button :class="{ active: filter === 'legendary' }" @click="changeFilter('legendary', 'legendary')">传说</button>
        <button :class="{ active: filter === 'epic' }" @click="changeFilter('epic', 'epic')">史诗</button>
        <button :class="{ active: filter === 'rare' }" @click="changeFilter('rare', 'rare')">稀有</button>
        <button :class="{ active: filter === 'sect' }" @click="changeFilter('sect', null, 'sect')">宗门</button>
      </div>

      <div class="wb-list">
        <div v-if="eventStore.broadcasts.length === 0" class="wb-empty">
          天道无言，暂无奇事传来……
        </div>
        <div
          v-for="b in eventStore.broadcasts"
          :key="b.id"
          class="wb-item"
          :class="[`rarity-${b.rarity}`, b.isPositive ? 'positive' : 'negative']"
        >
          <div class="wb-time">{{ relTime(b.createdAt) }}</div>
          <div class="wb-text">{{ b.text }}</div>
        </div>
      </div>

      <div class="wb-footer">
        <button class="wb-refresh-btn" @click="refresh">↻ 刷新</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const eventStore = useEventStore()
const filter = ref<'all' | 'legendary' | 'epic' | 'rare' | 'sect'>('all')

async function changeFilter(
  f: 'all' | 'legendary' | 'epic' | 'rare' | 'sect',
  rarity: string | null,
  scope?: 'sect'
) {
  filter.value = f
  await eventStore.loadBroadcasts({
    rarity: rarity || undefined,
    scope: scope || 'all',
  })
}

async function refresh() {
  await eventStore.loadBroadcasts({
    rarity: filter.value === 'all' || filter.value === 'sect' ? undefined : filter.value,
    scope: filter.value === 'sect' ? 'sect' : 'all',
  })
}

function relTime(iso: string): string {
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = Math.max(0, now - t)
  const m = Math.floor(diff / 60_000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}
</script>

<style scoped>
.wb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 15, 10, 0.5);
  z-index: 9200;
  display: flex;
  justify-content: flex-end;
}

.wb-drawer {
  width: min(460px, 94vw);
  height: 100vh;
  background: linear-gradient(180deg, #262320 0%, #1e1c18 100%);
  border-left: 2px solid var(--gold-ink);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.wb-header {
  padding: 18px 24px 14px;
  border-bottom: 1px solid rgba(232, 220, 200, 0.1);
  text-align: center;
  position: relative;
}

.wb-title {
  font-size: 22px;
  color: var(--gold-ink);
  font-family: 'ZCOOL XiaoWei', serif;
  letter-spacing: 4px;
}

.wb-subtitle {
  font-size: 12px;
  color: var(--ink-faint);
  margin-top: 4px;
  letter-spacing: 2px;
}

.wb-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  color: var(--ink-medium);
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.wb-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(232, 220, 200, 0.08);
  overflow-x: auto;
}

.wb-tabs button {
  flex: 1;
  min-width: 52px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(232, 220, 200, 0.15);
  color: var(--ink-light);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;
}

.wb-tabs button:hover {
  border-color: var(--gold-ink);
  color: var(--gold-ink);
}

.wb-tabs button.active {
  background: rgba(232, 204, 138, 0.15);
  border-color: var(--gold-ink);
  color: var(--gold-ink);
}

.wb-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 18px;
}

.wb-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--ink-faint);
  font-size: 14px;
}

.wb-item {
  padding: 12px 14px;
  margin-bottom: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.wb-item:hover {
  background: rgba(0, 0, 0, 0.35);
}

.wb-item.rarity-common { border-left-color: #9e8e7a; }
.wb-item.rarity-rare { border-left-color: #7bb3e8; }
.wb-item.rarity-epic { border-left-color: #c890e8; }
.wb-item.rarity-legendary {
  border-left-color: #f0b060;
  background: rgba(240, 176, 96, 0.06);
}

.wb-item.negative {
  opacity: 0.72;
}

.wb-time {
  font-size: 11px;
  color: var(--ink-faint);
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.wb-text {
  font-size: 14px;
  line-height: 1.65;
  color: var(--ink-medium);
}

.rarity-legendary .wb-text {
  color: var(--gold-ink);
  font-weight: 500;
}

.rarity-epic .wb-text { color: #d8b4e8; }
.rarity-rare .wb-text { color: #a8c8e8; }

.wb-footer {
  padding: 10px 18px;
  border-top: 1px solid rgba(232, 220, 200, 0.08);
  display: flex;
  justify-content: center;
}

.wb-refresh-btn {
  padding: 6px 20px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(232, 220, 200, 0.2);
  color: var(--ink-light);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  letter-spacing: 2px;
}

.wb-refresh-btn:hover {
  border-color: var(--gold-ink);
  color: var(--gold-ink);
}
</style>
