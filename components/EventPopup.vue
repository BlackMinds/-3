<template>
  <div v-if="event" class="event-overlay" @click.self="handleClaim">
    <div class="event-modal" :class="`rarity-${event.rarity}`">
      <div class="event-header">
        <div class="event-badge">{{ rarityLabel }}</div>
        <div class="event-title">{{ event.eventName }}</div>
      </div>

      <div class="event-body">
        <div class="event-narration">{{ narration }}</div>

        <div v-if="rewardList.length > 0" class="event-rewards">
          <div class="reward-title">{{ event.isPositive ? '所得' : '所失' }}</div>
          <div v-for="(item, i) in rewardList" :key="i" class="reward-item">
            {{ item }}
          </div>
        </div>
      </div>

      <button class="event-claim-btn" @click="handleClaim">领取此缘</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const eventStore = useEventStore()

const event = computed(() => eventStore.pendingEvent)

const rarityLabel = computed(() => {
  const map: Record<string, string> = {
    common: '凡品',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说',
  }
  return map[event.value?.rarity || 'common']
})

const narration = computed(() => {
  if (!event.value) return ''
  const userStore = useUserStore()
  const gs = useGameStore()
  const playerName = gs.character?.name || userStore.username || '道友'
  return event.value.template.replace(/\{player\}/g, playerName).replace(/\{sect\}/g, '宗门')
})

const rewardList = computed(() => {
  const r = event.value?.reward
  if (!r || !r.summary) return []
  return r.summary
})

async function handleClaim() {
  await eventStore.claim()
}
</script>

<style scoped>
.event-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 15, 10, 0.78);
  backdrop-filter: blur(4px);
  z-index: 9500;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

.event-modal {
  width: min(440px, 92vw);
  max-height: 85vh;
  background: linear-gradient(180deg, #262320 0%, #1e1c18 100%);
  border: 2px solid var(--gold-ink);
  box-shadow: 0 0 40px rgba(232, 204, 138, 0.35), 0 16px 48px rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.4s ease;
}

.rarity-common { border-color: #d4c4a8; box-shadow: 0 0 20px rgba(212,196,168,0.2), 0 16px 48px rgba(0,0,0,0.6); }
.rarity-rare { border-color: #7bb3e8; box-shadow: 0 0 28px rgba(123,179,232,0.35), 0 16px 48px rgba(0,0,0,0.6); }
.rarity-epic { border-color: #c890e8; box-shadow: 0 0 32px rgba(200,144,232,0.4), 0 16px 48px rgba(0,0,0,0.6); }
.rarity-legendary {
  border-color: #f0b060;
  box-shadow: 0 0 48px rgba(240,176,96,0.55), 0 16px 48px rgba(0,0,0,0.6);
  animation: legendaryPulse 2s ease infinite;
}

.event-header {
  padding: 20px 24px 12px;
  text-align: center;
  border-bottom: 1px solid rgba(232, 220, 200, 0.1);
}

.event-badge {
  display: inline-block;
  padding: 2px 14px;
  border: 1px solid currentColor;
  font-size: 12px;
  letter-spacing: 2px;
  margin-bottom: 10px;
  opacity: 0.8;
}
.rarity-common .event-badge { color: #d4c4a8; }
.rarity-rare .event-badge { color: #7bb3e8; }
.rarity-epic .event-badge { color: #c890e8; }
.rarity-legendary .event-badge { color: #f0b060; }

.event-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--ink-medium);
  font-family: 'ZCOOL XiaoWei', serif;
  letter-spacing: 2px;
}

.event-body {
  padding: 20px 24px;
  flex: 1;
  overflow-y: auto;
}

.event-narration {
  font-size: 15px;
  line-height: 1.85;
  color: var(--ink-light);
  text-align: justify;
  margin-bottom: 18px;
  text-indent: 2em;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.2);
  border-left: 2px solid var(--gold-ink);
}

.event-rewards {
  margin-top: 14px;
}

.reward-title {
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 2px;
  margin-bottom: 8px;
  text-align: center;
}

.reward-item {
  padding: 7px 12px;
  margin: 4px 0;
  background: rgba(232, 204, 138, 0.05);
  border: 1px solid rgba(232, 204, 138, 0.2);
  color: var(--gold-ink);
  font-size: 14px;
  text-align: center;
}

.event-claim-btn {
  margin: 8px 20px 20px;
  padding: 12px;
  background: linear-gradient(180deg, var(--gold-ink) 0%, #b89560 100%);
  border: none;
  color: #2e2419;
  font-family: 'Noto Serif SC', serif;
  font-size: 16px;
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
}
.event-claim-btn:hover {
  background: linear-gradient(180deg, var(--gold-light) 0%, var(--gold-ink) 100%);
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes legendaryPulse {
  0%, 100% { box-shadow: 0 0 48px rgba(240,176,96,0.55), 0 16px 48px rgba(0,0,0,0.6); }
  50% { box-shadow: 0 0 72px rgba(240,176,96,0.8), 0 16px 48px rgba(0,0,0,0.6); }
}
</style>
