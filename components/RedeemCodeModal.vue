<template>
  <div v-if="open" class="rc-overlay" @click.self="handleClose">
    <div class="rc-modal">
      <div class="rc-header">
        <div class="rc-title">兑换码</div>
        <button class="rc-close" @click="handleClose">×</button>
      </div>

      <div class="rc-body">
        <div class="rc-tip">输入官方发放的兑换码可领取奖励。每个码每个角色仅限领取 1 次。</div>

        <div class="rc-input-row">
          <input
            v-model="codeInput"
            type="text"
            class="rc-input"
            placeholder="请输入兑换码"
            maxlength="32"
            :disabled="loading"
            @keydown.enter="submit"
          />
          <button class="rc-submit" :disabled="loading || !codeInput.trim()" @click="submit">
            {{ loading ? '兑换中…' : '立即兑换' }}
          </button>
        </div>

        <div v-if="resultMsg" :class="['rc-result', resultOk ? 'ok' : 'err']">
          {{ resultMsg }}
        </div>

        <div v-if="rewardLines.length > 0" class="rc-rewards">
          <div class="rc-rewards-title">本次所得</div>
          <div v-for="(line, i) in rewardLines" :key="i" class="rc-reward-item">{{ line }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ITEM_INFO } from '~/game/items'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'success'): void }>()

const codeInput = ref('')
const loading = ref(false)
const resultMsg = ref('')
const resultOk = ref(false)
const rewards = ref<any[]>([])

function getAuthHeaders() {
  const userStore = useUserStore()
  return { Authorization: userStore.token ? `Bearer ${userStore.token}` : '' }
}

const QUALITY_NAME: Record<string, string> = {
  white: '白', green: '绿', blue: '蓝', purple: '紫', gold: '金',
}

function describeAttachment(att: any): string {
  switch (att?.type) {
    case 'spirit_stone':
      return `灵石 +${att.amount}`
    case 'exp':
      return `修为 +${att.amount}`
    case 'contribution':
      return `宗门贡献 +${att.amount}`
    case 'material': {
      const name = ITEM_INFO[att.itemId]?.name || att.itemId
      const q = att.quality && att.quality !== 'blue' ? `（${QUALITY_NAME[att.quality] || att.quality}）` : ''
      return `${name}${q} ×${att.qty}`
    }
    case 'pill': {
      const name = ITEM_INFO[att.pillId]?.name || att.pillId
      return `${name} ×${att.qty}`
    }
    case 'recipe':
      return `丹方解锁：${att.recipeId}`
    case 'title':
      return `称号：${att.titleKey}`
    default:
      return JSON.stringify(att)
  }
}

const rewardLines = computed(() => rewards.value.map(describeAttachment))

function reset() {
  codeInput.value = ''
  resultMsg.value = ''
  resultOk.value = false
  rewards.value = []
}

function handleClose() {
  reset()
  emit('close')
}

async function submit() {
  const code = codeInput.value.trim()
  if (!code || loading.value) return
  loading.value = true
  resultMsg.value = ''
  rewards.value = []
  try {
    const res: any = await $fetch('/api/redeem/use', {
      method: 'POST',
      body: { code },
      headers: getAuthHeaders(),
    })
    if (res?.code === 200) {
      resultOk.value = true
      resultMsg.value = res.message || '兑换成功'
      rewards.value = res.data?.rewards || []
      emit('success')
    } else {
      resultOk.value = false
      resultMsg.value = res?.message || '兑换失败'
    }
  } catch (e: any) {
    resultOk.value = false
    resultMsg.value = '网络错误'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.rc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 15, 10, 0.78);
  backdrop-filter: blur(4px);
  z-index: 9500;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: rcFadeIn 0.25s ease;
}
.rc-modal {
  width: min(420px, 92vw);
  background: linear-gradient(180deg, #262320 0%, #1e1c18 100%);
  border: 2px solid var(--gold-ink, #d4ad6a);
  box-shadow: 0 0 32px rgba(232, 204, 138, 0.3), 0 16px 48px rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  animation: rcSlideUp 0.3s ease;
}
.rc-header {
  position: relative;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(232, 220, 200, 0.12);
  text-align: center;
}
.rc-title {
  font-size: 18px;
  letter-spacing: 4px;
  color: var(--ink-medium, #d8c8a4);
  font-family: 'Noto Serif SC', serif;
}
.rc-close {
  position: absolute;
  top: 8px;
  right: 12px;
  background: transparent;
  border: none;
  color: var(--ink-faint, #9a8c70);
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
}
.rc-close:hover { color: var(--gold-ink, #d4ad6a); }

.rc-body {
  padding: 18px 20px 22px;
}
.rc-tip {
  font-size: 12px;
  color: var(--ink-faint, #9a8c70);
  line-height: 1.7;
  margin-bottom: 14px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-left: 2px solid var(--gold-ink, #d4ad6a);
}
.rc-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.rc-input {
  flex: 1;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(232, 220, 200, 0.2);
  color: var(--ink-medium, #d8c8a4);
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 1px;
  outline: none;
}
.rc-input:focus {
  border-color: var(--gold-ink, #d4ad6a);
}
.rc-input::placeholder { color: rgba(154, 140, 112, 0.6); }

.rc-submit {
  padding: 0 16px;
  background: linear-gradient(180deg, var(--gold-ink, #d4ad6a) 0%, #b89560 100%);
  border: none;
  color: #2e2419;
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  letter-spacing: 2px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}
.rc-submit:hover:not(:disabled) {
  background: linear-gradient(180deg, var(--gold-light, #e8cc8a) 0%, var(--gold-ink, #d4ad6a) 100%);
}
.rc-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rc-result {
  padding: 8px 12px;
  font-size: 13px;
  text-align: center;
  border: 1px solid;
  margin-bottom: 10px;
}
.rc-result.ok {
  color: #8fd49b;
  border-color: rgba(143, 212, 155, 0.4);
  background: rgba(143, 212, 155, 0.08);
}
.rc-result.err {
  color: #e89090;
  border-color: rgba(232, 144, 144, 0.4);
  background: rgba(232, 144, 144, 0.08);
}

.rc-rewards {
  margin-top: 12px;
}
.rc-rewards-title {
  font-size: 12px;
  color: var(--ink-faint, #9a8c70);
  letter-spacing: 2px;
  margin-bottom: 6px;
  text-align: center;
}
.rc-reward-item {
  padding: 6px 12px;
  margin: 4px 0;
  background: rgba(232, 204, 138, 0.05);
  border: 1px solid rgba(232, 204, 138, 0.2);
  color: var(--gold-ink, #d4ad6a);
  font-size: 13px;
  text-align: center;
}

@keyframes rcFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes rcSlideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 768px) {
  .rc-title { font-size: 16px; letter-spacing: 2px; }
  .rc-tip { font-size: 11px; }
  .rc-input { font-size: 13px; }
  .rc-submit { font-size: 13px; padding: 0 12px; }
  .rc-reward-item { font-size: 12px; }
}
</style>
