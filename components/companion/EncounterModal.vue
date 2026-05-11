<template>
  <div class="encounter-overlay">
    <div class="encounter-modal">
      <div class="encounter-header">
        <span class="encounter-title">⚔ 红尘邂逅 · {{ script.title }}</span>
      </div>

      <div class="encounter-body">
        <div class="scene-text">{{ script.scene }}</div>
        <div class="npc-text">{{ script.npcDescription }}</div>

        <div class="npc-card">
          <img class="npc-avatar" :src="avatarUrl" :alt="pending.generatedName" />
          <div class="npc-row">
            <span class="npc-label">道号</span>
            <span class="npc-name">{{ pending.generatedName }}</span>
          </div>
          <div class="npc-row">
            <span class="npc-label">灵根</span>
            <span :class="['root-tag', `root-${pending.spiritualRoot}`]">{{ rootName }}灵根</span>
          </div>
          <div class="npc-row">
            <span class="npc-label">品质</span>
            <span :class="['quality-tag', `quality-${qualityColor}`]">{{ qualityName }}</span>
          </div>
          <div class="npc-row">
            <span class="npc-label">性格</span>
            <span class="info-tag">{{ pending.personality }}</span>
          </div>
        </div>
      </div>

      <div class="choice-list">
        <button class="choice-btn" :disabled="store.acting" @click="choose('A')">
          <span class="choice-letter">A</span>
          <span class="choice-text">上前搭话</span>
          <span class="choice-reward">+5 亲密度，录入名册</span>
        </button>
        <button class="choice-btn" :disabled="store.acting" @click="choose('B')">
          <span class="choice-letter">B</span>
          <span class="choice-text">远观致意</span>
          <span class="choice-reward">+2 亲密度，录入名册</span>
        </button>
        <button class="choice-btn" :disabled="store.acting" @click="choose('C')">
          <span class="choice-letter">C</span>
          <span class="choice-text">拂袖离去</span>
          <span class="choice-reward">错过此次邂逅</span>
        </button>
        <button class="choice-btn" :disabled="store.acting" @click="choose('D')">
          <span class="choice-letter">D</span>
          <span class="choice-text">拔剑试探</span>
          <span class="choice-reward">表演战 胜利+10 / 败北放弃</span>
        </button>
      </div>

      <div v-if="resultMessage" class="result-banner">
        {{ resultMessage }}
        <button class="btn-close" @click="$emit('resolved')">好</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCompanionStore, type PendingEncounter } from '~/stores/companion'
import { avatarDataUrl, type AvatarQuality, type AvatarPersonality } from '~/game/companionAvatar'

const props = defineProps<{
  pending: PendingEncounter
  script: { id: string; title: string; scene: string; npcDescription: string; style: string }
}>()

const emit = defineEmits<{ (e: 'resolved'): void }>()
const store = useCompanionStore()

const resultMessage = ref('')

const QUALITY_NAMES = ['凡品', '下品', '中品', '上品', '极品', '仙品']
const QUALITY_COLORS = ['white', 'green', 'blue', 'purple', 'gold', 'red']
const ROOT_NAMES: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }

const qualityName = computed(() => QUALITY_NAMES[props.pending.quality] || '凡品')
const qualityColor = computed(() => QUALITY_COLORS[props.pending.quality] || 'white')
const rootName = computed(() => ROOT_NAMES[props.pending.spiritualRoot] || props.pending.spiritualRoot)

const avatarUrl = computed(() => avatarDataUrl(
  props.pending.quality as AvatarQuality,
  props.pending.personality as AvatarPersonality,
  140
))

async function choose(c: 'A' | 'B' | 'C' | 'D') {
  // D 选项先模拟一场战斗（MVP 阶段简化为 70% 胜率）
  let battleWon = false
  if (c === 'D') {
    battleWon = Math.random() < 0.7
  }
  const res = await store.chooseEncounter(c, battleWon)
  if (!res.ok) {
    resultMessage.value = res.message || '处理失败'
    return
  }
  resultMessage.value = res.message || (res.accepted ? '邂逅成功' : '错过缘分')
}
</script>

<style scoped>
.encounter-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000;
}
.encounter-modal {
  background: linear-gradient(180deg, #1f1429, #2e1f3e);
  width: 92vw; max-width: 540px;
  border-radius: 12px; border: 2px solid #b070ff;
  box-shadow: 0 0 32px rgba(180, 100, 255, 0.4);
  padding: 0; overflow: hidden;
}
.encounter-header {
  background: linear-gradient(90deg, #4a1f6a, #6a3a8a);
  padding: 14px 18px; text-align: center;
}
.encounter-title { color: #ffd700; font-size: 16px; font-weight: bold; }

.encounter-body { padding: 18px; }
.scene-text {
  color: #ccc; font-size: 13px; line-height: 1.7;
  margin-bottom: 10px; padding: 8px 12px;
  background: rgba(0,0,0,0.3); border-left: 3px solid #b070ff;
  border-radius: 4px;
}
.npc-text {
  color: #fff; font-size: 14px; line-height: 1.8;
  margin-bottom: 16px;
}
.npc-card {
  background: rgba(0,0,0,0.4); border-radius: 8px;
  padding: 10px 14px; border: 1px solid #4a2a6a;
  position: relative;
}
.npc-avatar {
  width: 84px; height: 84px;
  border-radius: 50%;
  position: absolute;
  top: -42px; right: 14px;
  box-shadow: 0 4px 14px rgba(180,100,255,0.5);
}
.npc-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0; font-size: 13px;
}
.npc-label { color: #aaa; min-width: 36px; }
.npc-name { color: #ffd700; font-weight: bold; }
.root-tag, .quality-tag, .info-tag {
  font-size: 12px; padding: 1px 8px; border-radius: 10px; font-weight: bold;
}
.root-metal { background: #d4d4d4; color: #444; }
.root-wood { background: #4caf50; color: #fff; }
.root-water { background: #4a90e2; color: #fff; }
.root-fire { background: #ef5350; color: #fff; }
.root-earth { background: #a87a4a; color: #fff; }
.quality-white { background: #d4d4d4; color: #444; }
.quality-green { background: #4caf50; color: #fff; }
.quality-blue { background: #4a90e2; color: #fff; }
.quality-purple { background: #9933ff; color: #fff; }
.quality-gold { background: #ffaa00; color: #fff; }
.quality-red { background: #ff3333; color: #fff; }
.info-tag { background: rgba(120,80,160,0.3); color: #c8a8ff; }

.choice-list {
  display: flex; flex-direction: column; gap: 8px;
  padding: 0 18px 18px;
}
.choice-btn {
  display: grid; grid-template-columns: 32px 1fr auto;
  align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 6px;
  border: 1px solid #4a2a6a; background: rgba(40,20,60,0.7);
  cursor: pointer; transition: all 0.2s;
  color: #ddd;
}
.choice-btn:hover:not(:disabled) {
  border-color: #ffd700; background: rgba(80,50,100,0.7);
  transform: translateX(4px);
}
.choice-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.choice-letter {
  width: 28px; height: 28px; border-radius: 50%;
  background: #4a2a6a; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold;
}
.choice-text { color: #fff; font-size: 14px; text-align: left; }
.choice-reward { color: #c8a8ff; font-size: 11px; }

.result-banner {
  background: rgba(255,215,0,0.15); border-top: 1px solid #ffd700;
  padding: 12px 18px; text-align: center;
  display: flex; align-items: center; justify-content: space-between;
  color: #ffd700; font-size: 14px;
}
.btn-close {
  background: #ffd700; color: #1a1027; font-weight: bold;
  border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer;
}
</style>
