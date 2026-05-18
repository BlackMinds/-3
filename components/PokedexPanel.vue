<template>
  <div class="pokedex-content">
    <div class="pokedex-header">
      <div class="panel-title">万界妖谱</div>
      <div class="pokedex-summary" v-if="summary">
        <span class="summary-item">
          <span class="lbl">解锁</span>
          <span class="val">{{ summary.unlockedCount }} / {{ summary.total }}</span>
        </span>
        <span class="summary-item">
          <span class="lbl">⭐</span>
          <span class="val">{{ summary.totalStars }} / {{ summary.maxStars }}</span>
        </span>
      </div>
    </div>

    <div class="pokedex-progress" v-if="summary">
      <div class="bar"><div class="fill" :style="{ width: progressPct + '%' }"></div></div>
      <div class="pct">{{ progressPct }}%</div>
    </div>

    <div class="pokedex-tabs">
      <button :class="['tab', { active: filter === 'all' }]" @click="filter = 'all'">
        全部 <span class="tab-badge">{{ list.length }}</span>
      </button>
      <button :class="['tab', { active: filter === 'boss' }]" @click="filter = 'boss'">
        BOSS <span class="tab-badge">{{ countByCat('boss') }}</span>
      </button>
      <button :class="['tab', { active: filter === 'rare' }]" @click="filter = 'rare'">
        精英 <span class="tab-badge">{{ countByCat('rare') }}</span>
      </button>
      <button :class="['tab', { active: filter === 'uncommon' }]" @click="filter = 'uncommon'">
        普通 <span class="tab-badge">{{ countByCat('uncommon') }}</span>
      </button>
    </div>

    <div v-if="loading" class="loading-hint">加载中…</div>
    <div v-else-if="filtered.length === 0" class="empty-hint">本分类暂无数据</div>
    <div v-else class="pokedex-grid">
      <PokedexCard
        v-for="item in filtered"
        :key="item.entryKey"
        :item="item"
        @click="openDetail"
      />
    </div>

    <PokedexDetailModal :item="detailItem" @close="detailItem = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import PokedexCard, { type PokedexCardItem } from './PokedexCard.vue';
import PokedexDetailModal from './PokedexDetailModal.vue';
import { useGameStore } from '~/stores/game';

type Category = 'boss' | 'rare' | 'uncommon';
type FilterValue = 'all' | Category;
interface Summary {
  total: number;
  unlockedCount: number;
  totalStars: number;
  maxStars: number;
}

const gameStore = useGameStore();
const list = ref<PokedexCardItem[]>([]);
const summary = ref<Summary | null>(null);
const loading = ref(false);
const filter = ref<FilterValue>('all');
const detailItem = ref<PokedexCardItem | null>(null);

const filtered = computed(() => filter.value === 'all'
  ? list.value
  : list.value.filter(c => c.category === filter.value));
const progressPct = computed(() => summary.value
  ? Math.floor(summary.value.unlockedCount / summary.value.total * 100)
  : 0);

function countByCat(c: Category) {
  return list.value.filter(i => i.category === c).length;
}
function openDetail(item: PokedexCardItem) {
  detailItem.value = item;
}

async function loadPokedex() {
  if (loading.value) return;
  loading.value = true;
  try {
    const userStore = useUserStore();
    const res = await $fetch<{
      code: number;
      data?: { list: PokedexCardItem[]; summary: Summary };
    }>('/api/pokedex/list', {
      headers: userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {},
    });
    if (res.code === 200 && res.data) {
      list.value = res.data.list;
      summary.value = res.data.summary;
    }
  } catch (e) {
    console.error('[pokedex] load fail', e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (gameStore.activeTab === 'pokedex') loadPokedex();
});
watch(() => gameStore.activeTab, (t) => {
  if (t === 'pokedex' && list.value.length === 0) loadPokedex();
});
</script>

<style scoped>
.pokedex-content { padding: 12px; }
.pokedex-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
.panel-title { font-size: 18px; color: #c9a85c; font-weight: bold; }
.pokedex-summary { display: flex; gap: 12px; font-size: 12px; color: #8a7d6a; }
.summary-item .val { color: #e8c878; margin-left: 4px; }
.pokedex-progress { display: flex; align-items: center; gap: 8px; margin: 8px 0 12px; }
.pokedex-progress .bar { flex: 1; background: #2a1f18; height: 8px; border-radius: 4px; overflow: hidden; }
.pokedex-progress .fill { background: linear-gradient(90deg, #c9a85c, #e8c878); height: 100%; transition: width 0.3s; }
.pokedex-progress .pct { font-size: 12px; color: #c9a85c; min-width: 36px; text-align: right; }

.pokedex-tabs { display: flex; gap: 8px; margin: 10px 0; flex-wrap: wrap; }
.pokedex-tabs .tab {
  padding: 6px 12px;
  border-radius: 16px;
  background: #1a1410;
  color: #8a7d6a;
  cursor: pointer;
  border: 1px solid #443325;
  font-size: 13px;
}
.pokedex-tabs .tab.active { background: #c9a85c; color: #1a1410; border-color: #c9a85c; }
.tab-badge { margin-left: 4px; font-size: 0.85em; opacity: 0.7; }

.pokedex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}
.loading-hint, .empty-hint {
  text-align: center;
  padding: 24px;
  color: #8a7d6a;
  font-size: 13px;
}
</style>
