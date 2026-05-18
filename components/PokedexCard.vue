<template>
  <div
    :class="['pokedex-card', `card-${item.category}`, { unlocked: item.unlocked, locked: !item.unlocked }]"
    @click="$emit('click', item)"
  >
    <div class="card-tier">T{{ item.tier }}</div>

    <div class="card-name">
      <template v-if="item.unlocked">{{ item.displayName }}</template>
      <template v-else>? ? ?</template>
    </div>

    <div v-if="item.element" :class="['card-element', `elem-${item.element}`]">{{ elementLabel }}</div>

    <div class="card-stars">
      <span v-for="n in 4" :key="n" :class="['star', n <= item.stars ? 'on' : 'off']">★</span>
    </div>

    <div class="card-kills">
      <template v-if="item.unlocked">{{ item.killCount }} 击杀</template>
      <template v-else>— 未解锁 —</template>
    </div>

    <div v-if="item.category === 'boss'" class="card-badge boss">BOSS</div>
    <div v-else-if="item.category === 'rare'" class="card-badge rare">精英</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface PokedexCardItem {
  entryKey: string;
  mapKey: string;
  name: string;
  displayName: string;
  tier: number;
  element: 'metal' | 'wood' | 'water' | 'fire' | 'earth' | null;
  power: number;
  role: string;
  category: 'boss' | 'rare' | 'uncommon';
  killCount: number;
  stars: 0 | 1 | 2 | 3 | 4;
  nextThreshold: number | null;
  unlocked: boolean;
}

const props = defineProps<{ item: PokedexCardItem }>();
defineEmits<{ click: [item: PokedexCardItem] }>();

const ELEMENT_LABELS: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
};
const elementLabel = computed(() => props.item.element ? ELEMENT_LABELS[props.item.element] : '');
</script>

<style scoped>
.pokedex-card {
  border: 1px solid #443325;
  border-radius: 8px;
  background: #1a1410;
  padding: 8px;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.12s, box-shadow 0.12s;
}
.pokedex-card:hover { transform: translateY(-1px); }
.pokedex-card.locked { filter: grayscale(1) opacity(0.55); }
.pokedex-card.unlocked.card-boss { border-color: #c9a85c; box-shadow: 0 0 10px rgba(201, 168, 92, 0.3); }
.pokedex-card.unlocked.card-rare { border-color: #a87fff; }
.pokedex-card.unlocked.card-uncommon { border-color: #5b9dff; }

.card-tier { font-size: 10px; color: #8a7d6a; }
.card-name { font-size: 13px; color: #e8c878; line-height: 1.25; min-height: 1.25em; }
.card-element { font-size: 11px; }
.card-stars { letter-spacing: 1px; font-size: 12px; }
.card-stars .star.on { color: #ffd76b; }
.card-stars .star.off { color: #444; }
.card-kills { font-size: 11px; color: #8a7d6a; }

.card-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: bold;
}
.card-badge.boss { background: linear-gradient(135deg, #c9a85c, #ff6b3d); color: #1a1410; }
.card-badge.rare { background: #a87fff; color: #fff; }

.elem-fire { color: #ff7a5c; }
.elem-water { color: #5cb8ff; }
.elem-metal { color: #ffd76b; }
.elem-wood { color: #6bd989; }
.elem-earth { color: #c9a05c; }
</style>
