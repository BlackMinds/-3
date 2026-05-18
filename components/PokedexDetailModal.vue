<template>
  <div v-if="item" class="detail-overlay" @click.self="$emit('close')">
    <div class="detail-modal pokedex-detail">
      <div class="detail-header">
        <span class="detail-title">
          {{ item.unlocked ? item.displayName : '? ? ?' }}
        </span>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="detail-body">
        <div class="detail-section">
          <div class="row"><span class="label">类别</span><span class="value">{{ categoryLabel }}</span></div>
          <div class="row"><span class="label">境界</span><span class="value">T{{ item.tier }}</span></div>
          <div class="row" v-if="item.element">
            <span class="label">属性</span>
            <span :class="['value', 'elem-tag', `elem-${item.element}`]">{{ elementLabel }}</span>
          </div>
          <div class="row"><span class="label">定位</span><span class="value">{{ roleLabel }}</span></div>
          <div class="row"><span class="label">战力</span><span class="value">{{ formatPower(item.power) }}</span></div>
        </div>

        <div class="detail-section">
          <div class="row">
            <span class="label">星级</span>
            <span class="value">
              <span v-for="n in 4" :key="n" :class="['star', n <= item.stars ? 'on' : 'off']">★</span>
              <span class="star-num">{{ item.stars }} / 4</span>
            </span>
          </div>
          <div class="row">
            <span class="label">击杀数</span>
            <span class="value">{{ item.killCount }}</span>
          </div>
          <div class="row" v-if="item.nextThreshold !== null">
            <span class="label">下一星</span>
            <span class="value">
              {{ item.killCount }} / {{ item.nextThreshold }}
              <span class="hint">（再 {{ Math.max(0, item.nextThreshold - item.killCount) }} 次）</span>
            </span>
          </div>
          <div class="row" v-else>
            <span class="label">圆满</span>
            <span class="value">⭐⭐⭐⭐ 已满星</span>
          </div>
        </div>

        <div class="detail-section hint-block">
          <div class="hint-line">📍 出没地图：{{ mapLabel }}</div>
          <div v-if="!item.unlocked" class="hint-line locked">🔒 击败 1 次即可解锁</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PokedexCardItem } from './PokedexCard.vue';
import { MAPS } from '~/game/data';

const props = defineProps<{ item: PokedexCardItem | null }>();
defineEmits<{ close: [] }>();

const mapLabel = computed(() => {
  if (!props.item) return '';
  return MAPS.find(m => m.id === props.item!.mapKey)?.name ?? props.item.mapKey;
});

const CATEGORY_LABELS: Record<'boss' | 'rare' | 'uncommon', string> = {
  boss: 'BOSS', rare: '精英', uncommon: '普通',
};
const ELEMENT_LABELS: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
};
const ROLE_LABELS: Record<string, string> = {
  boss: '首领', dps: '输出', speed: '迅捷', tank: '坦克',
};
const categoryLabel = computed(() => props.item ? CATEGORY_LABELS[props.item.category] : '');
const elementLabel = computed(() => props.item?.element ? ELEMENT_LABELS[props.item.element] : '');
const roleLabel = computed(() => props.item ? (ROLE_LABELS[props.item.role] ?? props.item.role) : '');

function formatPower(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 万';
  return String(n);
}
</script>

<style scoped>
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.detail-modal {
  background: #1a1410;
  border: 1px solid #443325;
  border-radius: 12px;
  max-width: 360px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  color: #e8c878;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #443325;
}
.detail-title { font-size: 16px; color: #c9a85c; font-weight: bold; }
.close-btn {
  background: transparent;
  border: none;
  color: #8a7d6a;
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
}
.close-btn:hover { color: #e8c878; }

.detail-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
.detail-section { padding: 8px 0; border-bottom: 1px dashed #2a1f18; }
.detail-section:last-child { border-bottom: none; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 13px; }
.label { color: #8a7d6a; }
.value { color: #e8c878; }
.star.on { color: #ffd76b; }
.star.off { color: #444; }
.star-num { margin-left: 6px; color: #8a7d6a; font-size: 11px; }
.hint { color: #8a7d6a; font-size: 11px; margin-left: 4px; }

.hint-block .hint-line { font-size: 12px; color: #8a7d6a; padding: 2px 0; }
.hint-block .hint-line.locked { color: #a87fff; }

.elem-tag { padding: 2px 8px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); }
.elem-fire { color: #ff7a5c; }
.elem-water { color: #5cb8ff; }
.elem-metal { color: #ffd76b; }
.elem-wood { color: #6bd989; }
.elem-earth { color: #c9a05c; }
</style>
