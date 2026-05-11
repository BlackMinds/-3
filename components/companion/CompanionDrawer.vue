<template>
  <div v-if="modelValue" class="companion-overlay" @click.self="close">
    <div class="companion-drawer">
      <div class="companion-header">
        <h3>🌹 红尘 · 道侣</h3>
        <div class="header-info" v-if="status">
          <span class="info-pill" title="今日剩余游历次数">游历 {{ status.remaining }}/{{ status.dailyMax }}</span>
          <span class="info-pill" title="花名册容量">花名册 {{ status.rosterCount }}/{{ status.rosterMax }}</span>
        </div>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="companion-tabs">
        <button :class="['tab', { active: tab === 'roster' }]" @click="switchTab('roster')">
          道侣花名册
          <span v-if="store.companions.length" class="tab-badge">{{ store.companions.length }}</span>
        </button>
        <button :class="['tab', { active: tab === 'expedition' }]" @click="switchTab('expedition')">
          游历红尘
        </button>
        <button :class="['tab', { active: tab === 'children' }]" @click="switchTab('children')">
          子嗣
          <span v-if="store.children.length" class="tab-badge">{{ store.children.length }}</span>
        </button>
      </div>

      <!-- ===== 花名册 Tab ===== -->
      <div v-if="tab === 'roster'" class="tab-content">
        <div v-if="store.officialCompanion" class="official-card">
          <div class="card-title">✨ 当前道侣</div>
          <CompanionCard :item="store.officialCompanion" :is-official="true" @click="openDetail(store.officialCompanion!.id)" />
        </div>

        <div class="roster-section">
          <div class="section-title">📜 红颜花名册</div>
          <div v-if="unmarried.length === 0" class="empty-hint">
            暂无邂逅对象。前往「游历红尘」碰碰机缘吧。
          </div>
          <div v-else class="roster-list">
            <CompanionCard
              v-for="c in unmarried"
              :key="c.id"
              :item="c"
              :is-official="false"
              @click="openDetail(c.id)"
            />
          </div>
        </div>
      </div>

      <!-- ===== 游历 Tab ===== -->
      <div v-if="tab === 'expedition'" class="tab-content">
        <div v-if="!status" class="empty-hint">加载中...</div>
        <template v-else>
          <div class="expedition-summary">
            <div class="summary-row">
              <span class="summary-label">今日剩余</span>
              <span class="summary-value highlight">{{ status.remaining }} / {{ status.dailyMax }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">单次消耗</span>
              <span class="summary-value">{{ formatNum(status.cost) }} 灵石</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">花名册</span>
              <span class="summary-value" :class="{ warn: status.rosterFull }">
                {{ status.rosterCount }} / {{ status.rosterMax }}
                <span v-if="status.rosterFull" class="warn-text">（已满，邂逅率归零）</span>
              </span>
            </div>
          </div>

          <div class="locations-section">
            <div class="section-title">选择游历地点</div>
            <div v-if="store.expeditionLocations.length === 0" class="empty-hint">加载中...</div>
            <div v-else class="locations-list">
              <div
                v-for="loc in store.expeditionLocations"
                :key="loc.id"
                :class="['location-card', { eligible: loc.eligible, locked: !loc.eligible }]"
                @click="loc.eligible && (selectedLocation = loc.id)"
                :data-selected="selectedLocation === loc.id"
              >
                <div class="loc-head">
                  <span class="loc-name">{{ loc.name }}</span>
                  <span class="loc-realm">需 {{ realmName(loc.realmRequired) }}</span>
                </div>
                <div class="loc-bias">
                  <span class="bias-label">灵根偏向：</span>
                  <span v-for="r in loc.rootBias" :key="r" :class="['root-tag', `root-${r}`]">{{ rootName(r) }}</span>
                </div>
                <div class="loc-desc">{{ loc.description }}</div>
                <div class="loc-meta">红尘玉拾获区间 {{ loc.redJadeRange[0] }}~{{ loc.redJadeRange[1] }}</div>
              </div>
            </div>
          </div>

          <div class="expedition-actions">
            <button
              class="btn-primary"
              :disabled="!canStart || store.acting"
              @click="onStart"
            >
              {{ store.acting ? '游历中…' : '开始游历' }}
            </button>
            <span v-if="!selectedLocation" class="hint">请选择地点</span>
            <span v-else-if="status.remaining === 0" class="hint">今日次数已用完</span>
            <span v-else-if="status.spiritStone < status.cost" class="hint">灵石不足</span>
          </div>
        </template>
      </div>

      <!-- ===== 子嗣 Tab ===== -->
      <div v-if="tab === 'children'" class="tab-content">
        <ChildrenTab />
      </div>

      <!-- ===== 邂逅弹窗 ===== -->
      <EncounterModal
        v-if="store.pendingEncounter && store.pendingScript"
        :pending="store.pendingEncounter"
        :script="store.pendingScript"
        @resolved="onEncounterResolved"
      />

      <!-- ===== 普通产出结果弹窗 ===== -->
      <div v-if="showResultModal && store.lastOutcome && store.lastOutcome.type !== 'encounter'" class="result-modal-overlay" @click.self="closeResult">
        <div class="result-modal">
          <h4>游历归来</h4>
          <div class="result-body">
            <component :is="'div'" v-html="resultText"></component>
          </div>
          <button class="btn-primary" @click="closeResult">好</button>
        </div>
      </div>

      <!-- ===== 道侣详情弹窗 ===== -->
      <CompanionDetailModal
        v-if="detailCompanionId"
        :companion-id="detailCompanionId"
        @close="detailCompanionId = null"
      />

      <!-- ===== 出生弹窗（全局，求子领取后弹出）===== -->
      <BirthModal
        v-if="store.lastBirths && store.lastBirths.length > 0"
        :births="store.lastBirths"
        @close="onBirthClose"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCompanionStore } from '~/stores/companion'
import EncounterModal from './EncounterModal.vue'
import CompanionCard from './CompanionCard.vue'
import CompanionDetailModal from './CompanionDetailModal.vue'
import ChildrenTab from './ChildrenTab.vue'
import BirthModal from './BirthModal.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const store = useCompanionStore()
const tab = ref<'roster' | 'expedition' | 'children'>('roster')
const selectedLocation = ref<string>('')
const detailCompanionId = ref<number | null>(null)
const showResultModal = ref(false)

const status = computed(() => store.expeditionStatus)
const unmarried = computed(() => store.companions.filter(c => !c.isOfficial))
const canStart = computed(() => {
  return !!selectedLocation.value
    && !!status.value
    && status.value.remaining > 0
    && status.value.spiritStone >= status.value.cost
})

const realmNames = ['', '练气', '筑基', '金丹', '元婴', '化神', '渡劫', '大乘', '飞升', '混元']
function realmName(tier: number): string { return realmNames[tier] || `${tier}阶` }
const rootNames: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
function rootName(r: string): string { return rootNames[r] || r }
function formatNum(n: number): string {
  if (n >= 100000000) return (n / 100000000).toFixed(2) + '亿'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

function close() {
  emit('update:modelValue', false)
}

function switchTab(t: 'roster' | 'expedition' | 'children') {
  tab.value = t
  if (t === 'expedition' && store.expeditionLocations.length === 0) {
    store.loadExpeditionLocations()
  }
  if (t === 'children') {
    store.loadChildren()
  }
}

function openDetail(id: number) {
  detailCompanionId.value = id
}

async function onStart() {
  if (!canStart.value) return
  const result = await store.startExpedition(selectedLocation.value)
  if (!result.ok) {
    alert(result.message || '游历失败')
    return
  }
  // 邂逅类型由 EncounterModal 自动接管；其他类型显示结果弹窗
  if (result.outcome && result.outcome.type !== 'encounter') {
    showResultModal.value = true
  }
}

function closeResult() {
  showResultModal.value = false
  store.clearLastOutcome()
}

async function onEncounterResolved() {
  // EncounterModal 已经调用 chooseEncounter 完成处理
  // 不需要额外动作，pending 已被 store 清空
}

function onBirthClose() {
  store.clearLastBirths()
  // 自动切到子嗣 Tab 让玩家立即看到新生儿
  tab.value = 'children'
  store.loadChildren()
}

const resultText = computed(() => {
  const o = store.lastOutcome
  if (!o) return ''
  const lines: string[] = []
  if (o.type === 'gift_material' && o.giftMaterials) {
    for (const m of o.giftMaterials) {
      lines.push(`获得 <b>${itemName(m.itemId)}</b> ×${m.quantity}`)
    }
  }
  if (o.type === 'red_jade' && o.redJade) {
    lines.push(`拾得 <b style="color:#e74c8c">红尘玉 +${o.redJade}</b>`)
  }
  if (o.type === 'herb' && o.herbs) {
    for (const h of o.herbs) {
      lines.push(`采得 <b>${itemName(h.herbId)}·${qualityName(h.quality)}</b> ×${h.quantity}`)
    }
  }
  if (o.type === 'fortune') {
    lines.push(`✨ <b>修仙奇遇</b>`)
    if (o.text) lines.push(`<i>${o.text}</i>`)
    if (o.rewardOrPenalty?.redJade) lines.push(`红尘玉 +${o.rewardOrPenalty.redJade}`)
    if (o.rewardOrPenalty?.seeds) {
      for (const s of o.rewardOrPenalty.seeds) lines.push(`获得 <b>${itemName(s.itemId)}</b> ×${s.quantity}`)
    }
  }
  if (o.type === 'mishap') {
    lines.push(`⚠️ <b>修仙劫难</b>`)
    if (o.text) lines.push(`<i>${o.text}</i>`)
    if (o.rewardOrPenalty?.spiritStone) lines.push(`灵石 ${o.rewardOrPenalty.spiritStone}`)
  }
  if (o.spiritStoneBonus) {
    lines.push(`附带灵石 ${o.spiritStoneBonus > 0 ? '+' : ''}${o.spiritStoneBonus}`)
  }
  return lines.join('<br>')
})

const ITEM_NAMES: Record<string, string> = {
  silk_flower_seed: '相思藤·种子',  // 老数据兼容（v1.x 期游历产出名）
  silk_flower: '相思藤',
  butterfly_flower: '蝶恋花',
  moonlight_orchid: '月光兰',
  couple_lotus: '并蒂莲',
  lifelong_grass: '长情草',
  red_dust_flower: '红尘花',
  butterfly_flower_seed: '蝶恋花·种子',
  moonlight_orchid_seed: '月光兰·种子',
  couple_lotus_seed: '并蒂莲·种子',
  lifelong_grass_seed: '长情草·种子',
  red_dust_flower_seed: '红尘花·种子',
  fruit_jam: '灵果蜜饯',
  colorful_beads: '彩珠串',
  peach_wine: '桃花酿',
  warm_jade_sachet: '温玉香囊',
  kiddy_beads: '童趣彩珠',
  frost_pendant: '寒玉佩',
  purple_gold_hairpin: '紫金钗',
  moonlight_pill: '月华丹',
  lotus_heart: '并蒂莲心',
  mandarin_pendant: '鸳鸯玉佩',
  red_dust_hairpin: '红尘仙缘簪',
  awaken_stone: '附灵石',
  awaken_reroll: '灵枢玉',
  metal_herb: '锐金草',
  wood_herb: '青木叶',
  water_herb: '玄水苔',
  fire_herb: '赤焰花',
  earth_herb: '厚土参',
  common_herb: '灵草',
  spirit_grass: '仙灵草',
}
function itemName(id: string): string {
  return ITEM_NAMES[id] || id
}
function qualityName(q: number): string {
  return ['凡品', '灵品', '玄品', '地品', '天品', '仙品'][q] || '凡品'
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    await store.loadCompanions()
    await store.loadExpeditionStatus()
    if (tab.value === 'expedition') {
      await store.loadExpeditionLocations()
    }
    // 玩家上线自动结算陪伴亲密度
    store.settleCompanionship()
  }
})
</script>

<style scoped>
.companion-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.companion-drawer {
  background: linear-gradient(180deg, #1a1027, #2a1a3a);
  width: 92vw; max-width: 880px;
  height: 90vh; max-height: 720px;
  display: flex; flex-direction: column;
  border-radius: 12px; border: 1px solid #5a3a7a;
  box-shadow: 0 0 40px rgba(150, 80, 200, 0.3);
}
.companion-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-bottom: 1px solid #4a2a6a;
  background: rgba(50,30,70,0.5);
  border-radius: 12px 12px 0 0;
}
.companion-header h3 { margin: 0; color: #ffd700; font-size: 18px; }
.header-info { display: flex; gap: 8px; flex: 1; margin-left: 12px; }
.info-pill {
  font-size: 12px; padding: 3px 10px; border-radius: 12px;
  background: rgba(255,200,100,0.15); color: #ffc864;
  border: 1px solid #6a4a8a;
}
.close-btn {
  background: transparent; border: none; color: #ddd; font-size: 22px;
  cursor: pointer; padding: 0 8px;
}
.close-btn:hover { color: #fff; }

.companion-tabs {
  display: flex; gap: 4px; padding: 8px 14px 0;
  border-bottom: 1px solid #4a2a6a;
}
.companion-tabs .tab {
  padding: 8px 18px; cursor: pointer;
  background: transparent; border: 1px solid transparent; border-bottom: none;
  color: #aaa; font-size: 14px; border-radius: 6px 6px 0 0;
  display: flex; align-items: center; gap: 6px;
}
.companion-tabs .tab.active {
  color: #ffd700; background: rgba(80,40,100,0.5);
  border-color: #6a4a8a;
}
.tab-badge {
  background: #c93;
  color: #1a1027;
  font-size: 11px; font-weight: bold;
  padding: 0 6px; border-radius: 8px;
}

.tab-content {
  flex: 1; overflow-y: auto; padding: 14px 18px;
}

.section-title {
  color: #c8a8ff; font-size: 14px; margin: 12px 0 8px;
  border-left: 3px solid #b070ff; padding-left: 8px;
}
.empty-hint {
  text-align: center; color: #888; padding: 32px 12px;
  font-size: 13px;
}

.official-card { margin-bottom: 16px; }
.card-title { color: #ffd700; margin-bottom: 6px; font-size: 13px; }

.roster-list {
  display: flex; flex-direction: column; gap: 8px;
}

/* 游历 */
.expedition-summary {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;
  background: rgba(80,40,100,0.3);
  padding: 12px; border-radius: 8px;
  border: 1px solid #5a3a7a;
}
.summary-row { display: flex; flex-direction: column; gap: 3px; }
.summary-label { color: #aaa; font-size: 11px; }
.summary-value { color: #fff; font-size: 14px; font-weight: bold; }
.summary-value.highlight { color: #ffd700; }
.summary-value.warn { color: #ff8c8c; }
.warn-text { font-size: 11px; font-weight: normal; }

.locations-list {
  display: flex; flex-direction: column; gap: 10px; margin-top: 8px;
}
.location-card {
  padding: 12px 14px; border-radius: 8px;
  border: 1px solid #4a2a6a; background: rgba(40,20,60,0.5);
  cursor: pointer; transition: all 0.2s;
}
.location-card.eligible:hover {
  border-color: #b070ff; background: rgba(80,40,100,0.5);
}
.location-card[data-selected="true"] {
  border-color: #ffd700; background: rgba(120,80,40,0.4);
  box-shadow: 0 0 12px rgba(255,215,0,0.3);
}
.location-card.locked {
  opacity: 0.45; cursor: not-allowed;
}
.loc-head {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
}
.loc-name { color: #ffd700; font-size: 16px; font-weight: bold; }
.loc-realm { color: #c8a8ff; font-size: 12px; }
.loc-bias { font-size: 12px; color: #aaa; margin-bottom: 4px; }
.bias-label { margin-right: 4px; }
.root-tag {
  display: inline-block; padding: 1px 8px; margin-right: 4px;
  border-radius: 10px; font-size: 11px; font-weight: bold;
}
.root-metal { background: #d4d4d4; color: #444; }
.root-wood { background: #4caf50; color: #fff; }
.root-water { background: #4a90e2; color: #fff; }
.root-fire { background: #ef5350; color: #fff; }
.root-earth { background: #a87a4a; color: #fff; }

.loc-desc { font-size: 12px; color: #ccc; margin-bottom: 4px; line-height: 1.5; }
.loc-meta { font-size: 11px; color: #c8a8ff; }

.expedition-actions {
  margin-top: 16px; display: flex; align-items: center; gap: 12px;
  padding: 12px; background: rgba(40,20,60,0.4); border-radius: 8px;
}
.btn-primary {
  background: linear-gradient(135deg, #b070ff, #e55ba8);
  border: none; color: #fff; font-size: 14px;
  padding: 10px 24px; border-radius: 6px; cursor: pointer;
  font-weight: bold;
}
.btn-primary:disabled {
  opacity: 0.4; cursor: not-allowed;
  background: #555;
}
.hint { color: #ff8c8c; font-size: 12px; }

/* 结果弹窗 */
.result-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1100;
}
.result-modal {
  background: linear-gradient(180deg, #1a1027, #2a1a3a);
  border: 1px solid #b070ff; border-radius: 10px;
  padding: 20px 24px; min-width: 360px; max-width: 480px;
  text-align: center;
}
.result-modal h4 {
  color: #ffd700; margin: 0 0 14px; font-size: 18px;
}
.result-body {
  color: #ddd; font-size: 14px; line-height: 1.8; margin-bottom: 16px;
}
.result-body :deep(b) { color: #ffd700; }
.result-body :deep(i) { color: #c8a8ff; font-style: italic; }
</style>
