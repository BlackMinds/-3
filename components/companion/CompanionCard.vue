<template>
  <div :class="['companion-card', `quality-${item.qualityColor}`, { official: isOfficial }]" @click="$emit('click')">
    <img class="card-avatar" :src="avatarUrl" :alt="item.name" />
    <div class="card-body">
      <div class="card-head">
        <span class="card-name">{{ item.name }}</span>
        <span :class="['quality-tag', `quality-${item.qualityColor}`]">{{ item.qualityName }}</span>
        <span v-if="isOfficial" class="official-tag">✨ 道侣</span>
      </div>
      <div class="card-info">
        <span class="info-tag">{{ item.personality }}</span>
        <span class="info-tag">{{ item.stage }}</span>
        <span v-if="isOfficial && item.sealLevel > 0" class="info-tag tag-gold">仙缘印记 LV{{ item.sealLevel }}</span>
      </div>
      <div class="card-bar">
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: percentText }"></div>
        </div>
        <div class="bar-text">
          亲密度 {{ item.intimacy }} / {{ item.nextThreshold }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CompanionListItem } from '~/stores/companion'
import { avatarDataUrl, type AvatarQuality, type AvatarPersonality } from '~/game/companionAvatar'

const props = defineProps<{
  item: CompanionListItem
  isOfficial: boolean
}>()

defineEmits<{ (e: 'click'): void }>()

const percentText = computed(() => {
  const pct = props.item.nextThreshold > 0
    ? Math.min(100, (props.item.intimacy / props.item.nextThreshold) * 100)
    : 100
  return pct.toFixed(1) + '%'
})

const avatarUrl = computed(() => props.item.customAvatarUrl || avatarDataUrl(
  props.item.quality as AvatarQuality,
  props.item.personality as AvatarPersonality,
  120
))
</script>

<style scoped>
.companion-card {
  display: flex; gap: 12px;
  padding: 12px 14px; border-radius: 8px;
  border: 1px solid #4a2a6a; background: rgba(40,20,60,0.5);
  cursor: pointer; transition: all 0.2s;
}
.companion-card:hover {
  border-color: #b070ff; background: rgba(70,40,90,0.5);
  transform: translateX(2px);
}
.companion-card.official {
  border-color: #ffd700;
  background: linear-gradient(90deg, rgba(120,80,30,0.3), rgba(40,20,60,0.5));
  box-shadow: 0 0 12px rgba(255,215,0,0.15);
}

.card-avatar {
  width: 56px; height: 56px;
  border-radius: 50%;
  flex-shrink: 0;
  display: block;
}

.card-body {
  flex: 1; min-width: 0;
}
.card-head {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
}
.card-name { color: #fff; font-size: 16px; font-weight: bold; }
.quality-tag {
  font-size: 11px; padding: 1px 8px; border-radius: 10px;
  font-weight: bold;
}
.quality-tag.quality-white { background: #d4d4d4; color: #444; }
.quality-tag.quality-green { background: #4caf50; color: #fff; }
.quality-tag.quality-blue { background: #4a90e2; color: #fff; }
.quality-tag.quality-purple { background: #9933ff; color: #fff; }
.quality-tag.quality-gold { background: #ffaa00; color: #fff; }
.quality-tag.quality-red { background: #ff3333; color: #fff; }
.official-tag {
  font-size: 11px; color: #ffd700; font-weight: bold;
}
.card-info {
  display: flex; gap: 6px; margin-bottom: 6px;
}
.info-tag {
  font-size: 11px; padding: 1px 8px; border-radius: 8px;
  background: rgba(120,80,160,0.3); color: #c8a8ff;
}
.info-tag.tag-gold {
  background: rgba(255,215,0,0.2); color: #ffd700;
}
.card-bar { display: flex; flex-direction: column; gap: 3px; }
.bar-track {
  width: 100%; height: 6px;
  background: rgba(0,0,0,0.4); border-radius: 3px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff7eb3, #ff5f88);
  transition: width 0.3s;
}
.bar-text { font-size: 11px; color: #ccc; }
</style>
