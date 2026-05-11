<template>
  <div class="date-overlay" @click.self="onClose">
    <div class="date-modal">
      <div class="date-header">
        <span class="date-title">💕 约会</span>
        <span v-if="status" class="date-quota">今日剩余 {{ status.remaining }} / {{ status.dailyMax }}</span>
        <button class="close-btn" @click="onClose">×</button>
      </div>

      <!-- 启动前 -->
      <div v-if="phase === 'idle'" class="phase-idle">
        <p class="hint">每日 3 次约会机会，选择不同选项有不同奖励。<br>
          剧情对话 / 联手历练 / 赠礼回馈 / 红尘奇遇 — 4 类事件随机。</p>
        <button class="btn-primary" :disabled="!canStart || loading" @click="onStart">
          {{ loading ? '寻芳中...' : '开始约会' }}
        </button>
        <p v-if="status && status.remaining === 0" class="hint warn">今日次数已用完</p>
      </div>

      <!-- 事件进行中 -->
      <div v-if="phase === 'event' && currentEvent" class="phase-event">
        <div class="event-type-tag">{{ typeLabel(currentEvent.type) }}</div>
        <h4>{{ currentEvent.title }}</h4>
        <div class="scene-text">{{ currentEvent.scene }}</div>

        <div class="choice-list">
          <button
            v-for="c in currentEvent.choices"
            :key="c.index"
            class="choice-btn"
            :disabled="loading"
            @click="onChoose(c.index)"
          >
            <span class="choice-letter">{{ String.fromCharCode(65 + c.index) }}</span>
            <span class="choice-text">{{ c.label }}</span>
          </button>
        </div>
      </div>

      <!-- 结果 -->
      <div v-if="phase === 'result' && lastResult" class="phase-result">
        <div class="result-icon">✨</div>
        <div class="result-line">亲密度 +{{ lastResult.intimacyGained }}</div>
        <div v-if="lastResult.reward?.spiritStone" class="result-line">灵石 +{{ lastResult.reward.spiritStone }}</div>
        <div v-if="lastResult.reward?.redJade" class="result-line jade">红尘玉 +{{ lastResult.reward.redJade }}</div>
        <div v-if="lastResult.reward?.cultExp" class="result-line">修为 +{{ lastResult.reward.cultExp }}</div>
        <div v-if="lastResult.reward?.item" class="result-line">{{ itemName(lastResult.reward.item.id) }} ×{{ lastResult.reward.item.quantity }}</div>
        <div class="result-actions">
          <button v-if="status && status.remaining > 0" class="btn-secondary" @click="phase = 'idle'">继续约会</button>
          <button class="btn-primary" @click="onDone">完成</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{ companionId: number }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'done'): void
}>()

interface DateStatus {
  companionId: number
  usedToday: number
  dailyMax: number
  remaining: number
}

interface DateEventDto {
  id: string
  title: string
  type: 'dialog' | 'battle' | 'gift' | 'special'
  scene: string
  choices: Array<{ index: number; label: string }>
}

interface ChooseResult {
  intimacyGained: number
  reward: {
    spiritStone?: number
    redJade?: number
    cultExp?: number
    item?: { id: string; quantity: number }
  }
}

const status = ref<DateStatus | null>(null)
const currentEvent = ref<DateEventDto | null>(null)
const lastResult = ref<ChooseResult | null>(null)
const phase = ref<'idle' | 'event' | 'result'>('idle')
const loading = ref(false)

const canStart = computed(() => status.value && status.value.remaining > 0)

function typeLabel(t: string): string {
  return ({ dialog: '剧情对话', battle: '联手历练', gift: '赠礼回馈', special: '红尘奇遇' } as any)[t] || t
}

const ITEM_NAMES: Record<string, string> = {
  fruit_jam: '灵果蜜饯', colorful_beads: '彩珠串',
  peach_wine: '桃花酿', warm_jade_sachet: '温玉香囊', kiddy_beads: '童趣彩珠',
  frost_pendant: '寒玉佩', purple_gold_hairpin: '紫金钗', moonlight_pill: '月华丹',
  awaken_stone: '附灵石', awaken_reroll: '灵枢玉',
}
function itemName(id: string): string { return ITEM_NAMES[id] || id }

async function loadStatus() {
  const api = useApi()
  const res = await api<{ code: number; data?: DateStatus }>('/companion/dates/status')
  if (res.code === 200 && res.data) status.value = res.data
}

async function onStart() {
  if (!canStart.value) return
  loading.value = true
  try {
    const api = useApi()
    const res = await api<{ code: number; data?: { event: DateEventDto } }>('/companion/dates/start', { method: 'POST' })
    if (res.code === 200 && res.data) {
      currentEvent.value = res.data.event
      phase.value = 'event'
    }
  } finally {
    loading.value = false
  }
}

async function onChoose(idx: number) {
  if (!currentEvent.value) return
  loading.value = true
  try {
    const api = useApi()
    const res = await api<{ code: number; data?: ChooseResult }>('/companion/dates/choose', {
      method: 'POST',
      body: { event_id: currentEvent.value.id, choice_index: idx },
    })
    if (res.code === 200 && res.data) {
      lastResult.value = res.data
      phase.value = 'result'
      await loadStatus()  // 刷新次数
    }
  } finally {
    loading.value = false
  }
}

function onClose() { emit('close') }
function onDone() { emit('done') }

onMounted(loadStatus)
</script>

<style scoped>
.date-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1800;
}
.date-modal {
  background: linear-gradient(180deg, #2a1832, #3a1f44);
  border: 1px solid #ff7eb3; border-radius: 10px;
  padding: 16px; min-width: 360px; max-width: 480px;
  display: flex; flex-direction: column;
}
.date-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
}
.date-title { color: #ffb8d4; font-size: 16px; font-weight: bold; flex: 1; }
.date-quota { color: #c8a8ff; font-size: 12px; }
.close-btn { background: transparent; border: none; color: #ddd; font-size: 20px; cursor: pointer; }

.phase-idle {
  text-align: center; padding: 14px 0;
}
.phase-idle .hint {
  color: #ccc; font-size: 13px; line-height: 1.7;
  margin-bottom: 16px;
}
.phase-idle .hint.warn { color: #ff8c8c; margin-top: 8px; margin-bottom: 0; }

.event-type-tag {
  display: inline-block; padding: 2px 10px; border-radius: 10px;
  background: rgba(255,126,179,0.25); color: #ffb8d4;
  font-size: 11px; margin-bottom: 8px;
}
.phase-event h4 { margin: 0 0 10px; color: #ffd700; font-size: 15px; }
.scene-text {
  color: #ddd; font-size: 13px; line-height: 1.7;
  padding: 10px 12px; background: rgba(0,0,0,0.3);
  border-left: 3px solid #ff7eb3; border-radius: 4px;
  margin-bottom: 12px;
}

.choice-list { display: flex; flex-direction: column; gap: 6px; }
.choice-btn {
  display: grid; grid-template-columns: 28px 1fr;
  align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 6px;
  background: rgba(40,20,60,0.6); border: 1px solid #4a2a6a;
  color: #ddd; cursor: pointer; transition: all 0.2s; text-align: left;
}
.choice-btn:hover:not(:disabled) {
  border-color: #ff7eb3; background: rgba(80,40,80,0.6);
}
.choice-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.choice-letter {
  width: 26px; height: 26px; border-radius: 50%;
  background: #4a2a6a; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; font-size: 13px;
}
.choice-text { color: #fff; font-size: 13px; }

.phase-result {
  text-align: center; padding: 16px 0;
}
.result-icon { font-size: 36px; }
.result-line {
  font-size: 14px; color: #fff; padding: 4px 0;
}
.result-line.jade { color: #ff8cba; font-weight: bold; }
.result-actions {
  display: flex; gap: 10px; justify-content: center; margin-top: 14px;
}

.btn-primary {
  background: linear-gradient(135deg, #ff7eb3, #e55ba8);
  color: #fff; border: none; padding: 10px 24px;
  border-radius: 6px; cursor: pointer; font-weight: bold;
}
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-secondary {
  background: #555; color: #fff; border: none;
  padding: 10px 16px; border-radius: 6px; cursor: pointer;
}
</style>
