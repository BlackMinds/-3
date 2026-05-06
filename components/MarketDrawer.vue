<template>
  <div v-if="modelValue" class="market-overlay" @click.self="close">
    <div class="market-drawer">
      <div class="market-header">
        <h3>🏪 坊市 · 宝阁</h3>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="market-tabs">
        <button :class="['tab', { active: tab === 'browse' }]" @click="switchTab('browse')">浏览挂单</button>
        <button :class="['tab', { active: tab === 'mine' }]" @click="switchTab('mine')">我的挂单</button>
        <button :class="['tab', { active: tab === 'history' }]" @click="switchTab('history')">成交记录</button>
        <button class="tab tab-action" @click="openSell">挂售装备</button>
      </div>

      <!-- 浏览 -->
      <div v-if="tab === 'browse'" class="market-toolbar">
        <select v-model="filter.rarity" @change="reload">
          <option value="">全部品质</option>
          <option value="purple">地品（紫）</option>
          <option value="gold">天品（金）</option>
          <option value="red">仙品（红）</option>
        </select>
        <select v-model="filter.slot" @change="reload">
          <option value="">全部部位</option>
          <option v-for="s in EQUIP_SLOTS" :key="s.slot" :value="s.slot">{{ s.name }}</option>
        </select>
        <select v-model="filter.tier" @change="reload">
          <option value="">全部 T 级</option>
          <option v-for="t in [3,4,5,6,7,8,9,10,11,12]" :key="t" :value="t">T{{ t }}</option>
        </select>
        <select v-model="filter.set_id" @change="reload" title="按套装筛选">
          <option value="">全部套装</option>
          <option value="none">无套装</option>
          <option v-for="s in EQUIP_SETS" :key="s.setKey" :value="s.setKey">{{ s.name }}</option>
        </select>
        <select v-model="filter.sort" @change="reload">
          <option value="time_desc">时间↓</option>
          <option value="price_asc">价格↑</option>
          <option value="price_desc">价格↓</option>
          <option value="cost_performance">性价比</option>
        </select>

        <!-- 属性多选筛选（与背包一致） -->
        <div class="attr-picker">
          <button
            type="button"
            class="sell-select attr-picker-btn"
            :class="{ 'has-selection': attrFilter.length > 0 }"
            :title="attrFilter.length > 0 ? attrFilter.map(v => ATTR_LABEL_MAP[v] || v).join('、') : '按主属性或副属性筛选（多选 AND，需全部命中）'"
            @click.stop="attrPickerOpen = !attrPickerOpen"
          >
            {{ attrFilterButtonText }}
            <span class="attr-picker-caret">▾</span>
          </button>
          <div v-if="attrPickerOpen" class="attr-picker-panel" @click.stop>
            <div class="attr-picker-head">
              <span class="attr-picker-hint">多选 · 需全部命中</span>
              <button type="button" class="attr-picker-clear" :disabled="attrFilter.length === 0" @click="attrFilter = []">清空</button>
            </div>
            <div v-for="g in ATTR_FILTER_GROUPS" :key="g.label" class="attr-picker-group">
              <div class="attr-picker-group-title">{{ g.label }}</div>
              <label
                v-for="it in g.items"
                :key="it.value"
                class="attr-picker-item"
                :class="{ 'is-checked': attrFilter.includes(it.value) }"
              >
                <input
                  type="checkbox"
                  :checked="attrFilter.includes(it.value)"
                  @change="toggleAttrFilter(it.value)"
                />
                <span>{{ it.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <button class="btn sm" @click="reload">🔄 刷新</button>
      </div>

      <div v-if="tab === 'browse'" class="market-list">
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="!filteredListings.length" class="empty">无符合条件的挂单</div>
        <div
          v-for="l in filteredListings"
          :key="l.id"
          class="market-item"
          @mouseenter="onHover($event, l.item_snapshot)"
          @mousemove="onHoverMove"
          @mouseleave="hoverEquip = null"
        >
          <div class="item-icon" :class="'rarity-' + l.item_snapshot.rarity">
            {{ slotIcon(l.item_snapshot.base_slot || l.item_snapshot.slot) }}
          </div>
          <div class="item-main">
            <div class="item-title">
              <span :class="'rc-' + l.item_snapshot.rarity">{{ l.item_snapshot.name }}</span>
              <span class="muted">（{{ rarityLabel(l.item_snapshot.rarity) }}·T{{ l.item_snapshot.tier }}<span v-if="l.item_snapshot.enhance_level">·+{{ l.item_snapshot.enhance_level }}</span>）</span>
              <span v-if="l.item_snapshot.awaken_effect" class="awaken-tag">✦附灵</span>
              <span v-if="l.item_snapshot.set_id" class="set-tag">❖套装</span>
            </div>
            <div class="item-stats">
              <span>{{ statLabel(l.item_snapshot.primary_stat) }} +{{ l.item_snapshot.primary_value }}</span>
              <template v-if="l.item_snapshot.sub_stats && l.item_snapshot.sub_stats.length">
                <span v-for="(s, i) in l.item_snapshot.sub_stats" :key="i" class="sub">
                  · {{ statLabel(s.stat) }} +{{ s.value }}
                </span>
              </template>
            </div>
            <div class="item-meta">卖家：{{ l.seller_name }} · 剩余 {{ formatRemain(l.expires_at) }}</div>
          </div>
          <div class="item-side">
            <div class="price">{{ l.unit_price.toLocaleString() }}</div>
            <div class="ref-line">
              <span class="muted">参考 {{ l.ref_price.toLocaleString() }}</span>
              <span :class="diffClass(l.price_diff_pct)">{{ formatDiff(l.price_diff_pct) }}</span>
            </div>
            <button v-if="l.is_self" class="btn sm" disabled>自己的</button>
            <button v-else class="btn sm primary" :disabled="acting" @click="confirmBuy(l)">购买</button>
          </div>
        </div>
      </div>

      <!-- 我的挂单 -->
      <div v-if="tab === 'mine'" class="market-toolbar">
        <select v-model="mineFilter.status" @change="loadMine">
          <option value="active">进行中</option>
          <option value="sold">已成交</option>
          <option value="cancelled">已下架</option>
          <option value="expired">已过期</option>
          <option value="all">全部</option>
        </select>
        <button class="btn sm" @click="loadMine">🔄 刷新</button>
      </div>

      <div v-if="tab === 'mine'" class="market-list">
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="!mine.length" class="empty">无挂单</div>
        <div
          v-for="l in mine"
          :key="l.id"
          class="market-item"
          @mouseenter="onHover($event, l.item_snapshot)"
          @mousemove="onHoverMove"
          @mouseleave="hoverEquip = null"
        >
          <div class="item-icon" :class="'rarity-' + l.item_snapshot.rarity">
            {{ slotIcon(l.item_snapshot.base_slot || l.item_snapshot.slot) }}
          </div>
          <div class="item-main">
            <div class="item-title">
              <span :class="'rc-' + l.item_snapshot.rarity">{{ l.item_snapshot.name }}</span>
              <span class="muted">（{{ rarityLabel(l.item_snapshot.rarity) }}·T{{ l.item_snapshot.tier }}<span v-if="l.item_snapshot.enhance_level">·+{{ l.item_snapshot.enhance_level }}</span>）</span>
            </div>
            <div class="item-meta">
              状态：{{ statusLabel(l.status) }} ·
              <template v-if="l.status === 'active'">剩余 {{ formatRemain(l.expires_at) }}</template>
              <template v-else-if="l.status === 'sold'">到账 {{ l.seller_received.toLocaleString() }}（税 {{ l.tax_amount.toLocaleString() }}）</template>
              <template v-else>{{ formatTime(l.closed_at) }}</template>
            </div>
          </div>
          <div class="item-side">
            <div class="price">{{ l.unit_price.toLocaleString() }}</div>
            <button v-if="l.status === 'active'" class="btn sm" :disabled="acting" @click="confirmCancel(l)">下架</button>
          </div>
        </div>
      </div>

      <!-- 成交记录 -->
      <div v-if="tab === 'history'" class="market-toolbar">
        <select v-model="historyRole" @change="loadHistory">
          <option value="all">买入 + 卖出</option>
          <option value="buy">仅买入</option>
          <option value="sell">仅卖出</option>
        </select>
        <button class="btn sm" @click="loadHistory">🔄 刷新</button>
      </div>

      <div v-if="tab === 'history'" class="market-list">
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="!history.length" class="empty">无记录</div>
        <div
          v-for="t in history"
          :key="t.id"
          class="market-item"
          @mouseenter="onHover($event, t.item_snapshot)"
          @mousemove="onHoverMove"
          @mouseleave="hoverEquip = null"
        >
          <div class="item-icon" :class="'rarity-' + t.item_snapshot.rarity">
            {{ slotIcon(t.item_snapshot.base_slot || t.item_snapshot.slot) }}
          </div>
          <div class="item-main">
            <div class="item-title">
              <span :class="'rc-' + t.item_snapshot.rarity">{{ t.item_snapshot.name }}</span>
              <span class="muted">（{{ rarityLabel(t.item_snapshot.rarity) }}·T{{ t.item_snapshot.tier }}）</span>
              <span class="role-badge" :class="t.role">{{ t.role === 'buy' ? '买入' : '卖出' }}</span>
            </div>
            <div class="item-meta">
              {{ t.role === 'buy' ? '卖家' : '买家' }}：{{ t.role === 'buy' ? t.seller_name : t.buyer_name }} · {{ formatTime(t.created_at) }}
            </div>
          </div>
          <div class="item-side">
            <div class="price">{{ t.total_price.toLocaleString() }}</div>
            <div v-if="t.role === 'sell'" class="muted small">实收 {{ t.seller_received.toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 装备 hover 浮窗（fixed 定位，跟随鼠标） -->
    <div v-if="hoverEquip" class="market-hover-tooltip" :style="{ top: tipY + 'px', left: tipX + 'px' }">
      <EquipDetail :equip="hoverEquip" />
    </div>

    <!-- 上架弹窗 -->
    <div v-if="sellOpen" class="sell-overlay" @click.self="sellOpen = false">
      <div class="sell-modal">
        <h3>挂售装备</h3>
        <div v-if="sellLoading" class="empty">加载中...</div>
        <template v-else>
          <div class="sell-section">
            <div class="sell-label">筛选</div>
            <div class="sell-filter-row">
              <select v-model="sellFilter.rarity">
                <option value="">全部品质</option>
                <option value="purple">地品</option>
                <option value="gold">天品</option>
                <option value="red">仙品</option>
              </select>
              <select v-model="sellFilter.slot">
                <option value="">全部部位</option>
                <option v-for="s in EQUIP_SLOTS" :key="s.slot" :value="s.slot">{{ s.name }}</option>
              </select>
              <select v-model="sellFilter.tier">
                <option value="">全部 T 级</option>
                <option v-for="t in availableSellTiers" :key="t" :value="t">T{{ t }}</option>
              </select>
            </div>
            <input
              v-model="sellFilter.keyword"
              type="text"
              class="sell-search"
              placeholder="按名称搜索…"
            />
          </div>
          <div class="sell-section">
            <div class="sell-label">
              从背包选择
              <span class="muted small">（{{ filteredSellableEquips.length }}/{{ sellableEquips.length }}）</span>
            </div>
            <select v-model="sellEquipId" @change="onPickEquip">
              <option :value="0">-- 选择装备（地品+ T3+） --</option>
              <option v-for="e in filteredSellableEquips" :key="e.id" :value="e.id">
                {{ e.name }}（{{ rarityLabel(e.rarity) }}·T{{ e.tier }}<span v-if="e.enhance_level">·+{{ e.enhance_level }}</span>）
              </option>
            </select>
            <div v-if="!sellableEquips.length" class="muted small">背包暂无符合条件的装备</div>
            <div v-else-if="!filteredSellableEquips.length" class="muted small">当前筛选下没有装备，<a class="link-btn" @click="resetSellFilter">清空筛选</a></div>
          </div>
          <template v-if="pickedEquip && pickedRef">
            <div class="sell-section">
              <div>系统参考价：<b>{{ pickedRef.ref_price.toLocaleString() }}</b> 灵石
                <span class="muted small">({{ pickedRef.ref_method === 'historical' ? '近期成交均价' : '基础参考价' }})</span>
              </div>
              <div class="muted small">允许区间：{{ pickedRef.floor.toLocaleString() }} ~ {{ pickedRef.ceiling.toLocaleString() }}</div>
            </div>
            <div class="sell-section">
              <div class="sell-label">挂售单价</div>
              <input type="number" v-model.number="sellPrice" :min="pickedRef.floor" :max="pickedRef.ceiling" />
              <div class="muted small">税率 10% · 预计到账 {{ estimatedReceive.toLocaleString() }} 灵石 · 有效期 48 小时</div>
            </div>
          </template>
          <div class="sell-actions">
            <button class="btn" @click="sellOpen = false">取消</button>
            <button class="btn primary" :disabled="!canSubmitSell || acting" @click="submitSell">确认上架</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EQUIP_SLOTS } from '~/game/equipData'
import { EQUIP_SETS } from '~/game/equipSetData'
import EquipDetail from '~/components/EquipDetail.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const api = useApi()
const tab = ref<'browse' | 'mine' | 'history'>('browse')
const loading = ref(false)
const acting = ref(false)

// 浏览
const listings = ref<any[]>([])
const filter = reactive({ rarity: '', slot: '', tier: '' as any, set_id: '', sort: 'time_desc' })
const attrFilter = ref<string[]>([])
const attrPickerOpen = ref(false)

// 我的挂单
const mine = ref<any[]>([])
const mineFilter = reactive({ status: 'active' })

// 成交记录
const history = ref<any[]>([])
const historyRole = ref('all')

// 上架
const sellOpen = ref(false)
const sellLoading = ref(false)
const sellableEquips = ref<any[]>([])
const sellEquipId = ref<number>(0)
const pickedEquip = ref<any>(null)
const pickedRef = ref<any>(null)
const sellPrice = ref<number>(0)
const sellFilter = reactive({ rarity: '', slot: '', tier: '' as number | '', keyword: '' })

const availableSellTiers = computed(() => {
  const set = new Set<number>()
  for (const e of sellableEquips.value) {
    const t = Number(e.tier)
    if (Number.isFinite(t)) set.add(t)
  }
  return Array.from(set).sort((a, b) => a - b)
})

const filteredSellableEquips = computed(() => {
  const kw = sellFilter.keyword.trim().toLowerCase()
  return sellableEquips.value.filter(e => {
    if (sellFilter.rarity && e.rarity !== sellFilter.rarity) return false
    if (sellFilter.slot && (e.base_slot || e.slot) !== sellFilter.slot) return false
    if (sellFilter.tier !== '' && Number(e.tier) !== Number(sellFilter.tier)) return false
    if (kw && !String(e.name || '').toLowerCase().includes(kw)) return false
    return true
  })
})

function resetSellFilter() {
  sellFilter.rarity = ''
  sellFilter.slot = ''
  sellFilter.tier = ''
  sellFilter.keyword = ''
}

watch(filteredSellableEquips, list => {
  if (sellEquipId.value && !list.some(e => e.id === sellEquipId.value)) {
    sellEquipId.value = 0
    pickedEquip.value = null
    pickedRef.value = null
  }
})

// hover tooltip
const hoverEquip = ref<any>(null)
const tipX = ref(0)
const tipY = ref(0)

// 属性多选筛选（与 pages/index.vue 背包保持一致）
const ATTR_FILTER_GROUPS: Array<{ label: string; items: Array<{ value: string; label: string }> }> = [
  {
    label: '主属性',
    items: [
      { value: 'ATK', label: '攻击 (ATK)' },
      { value: 'DEF', label: '防御 (DEF)' },
      { value: 'HP', label: '气血 (HP)' },
      { value: 'SPD', label: '身法 (SPD)' },
      { value: 'CRIT_RATE', label: '会心率' },
      { value: 'CRIT_DMG', label: '会心伤害' },
      { value: 'SPIRIT', label: '神识' },
    ],
  },
  {
    label: '百分比副属性',
    items: [
      { value: 'ATK_PCT', label: '攻击%' },
      { value: 'DEF_PCT', label: '防御%' },
      { value: 'HP_PCT', label: '气血%' },
      { value: 'SPD_PCT', label: '身法%' },
    ],
  },
  {
    label: '特殊副属性',
    items: [
      { value: 'LIFESTEAL', label: '吸血' },
      { value: 'DODGE', label: '闪避' },
      { value: 'ARMOR_PEN', label: '破甲' },
      { value: 'ACCURACY', label: '命中' },
      { value: 'LUCK', label: '福缘' },
      { value: 'SPIRIT_DENSITY', label: '灵气浓度' },
      { value: 'DOT_DMG_PCT', label: 'DOT伤害' },
      { value: 'REFLECT_PCT', label: '反伤倍率' },
    ],
  },
  {
    label: '五行强化',
    items: [
      { value: 'METAL_DMG', label: '金系' },
      { value: 'WOOD_DMG', label: '木系' },
      { value: 'WATER_DMG', label: '水系' },
      { value: 'FIRE_DMG', label: '火系' },
      { value: 'EARTH_DMG', label: '土系' },
    ],
  },
]
const ATTR_LABEL_MAP: Record<string, string> = ATTR_FILTER_GROUPS
  .flatMap(g => g.items)
  .reduce((acc, it) => { acc[it.value] = it.label; return acc }, {} as Record<string, string>)

function toggleAttrFilter(val: string) {
  const i = attrFilter.value.indexOf(val)
  if (i >= 0) attrFilter.value.splice(i, 1)
  else attrFilter.value.push(val)
}
function closeAttrPicker() { attrPickerOpen.value = false }
watch(attrPickerOpen, (open) => {
  if (open) document.addEventListener('click', closeAttrPicker)
  else document.removeEventListener('click', closeAttrPicker)
})
onBeforeUnmount(() => document.removeEventListener('click', closeAttrPicker))
const attrFilterButtonText = computed(() => {
  const n = attrFilter.value.length
  if (n === 0) return '全部属性'
  if (n === 1) return ATTR_LABEL_MAP[attrFilter.value[0]] || attrFilter.value[0]
  return `已选 ${n} 项`
})

const filteredListings = computed(() => {
  if (attrFilter.value.length === 0) return listings.value
  const wants = attrFilter.value
  return listings.value.filter(l => {
    const snap = l.item_snapshot || {}
    const subs = Array.isArray(snap.sub_stats) ? snap.sub_stats : []
    const subStats = subs.map((s: any) => s?.stat).filter(Boolean)
    return wants.every(a => snap.primary_stat === a || subStats.includes(a))
  })
})

const RARITY_LABEL: Record<string, string> = {
  white: '凡品', green: '灵品', blue: '玄品', purple: '地品', gold: '天品', red: '仙品',
}
const STAT_LABEL: Record<string, string> = {
  ATK: '攻击', DEF: '防御', HP: '气血', SPD: '身法',
  ATK_PCT: '攻击%', DEF_PCT: '防御%', HP_PCT: '气血%', SPD_PCT: '身法%',
  CRIT_RATE: '会心率', CRIT_DMG: '会心伤害',
  DODGE: '闪避', LIFESTEAL: '吸血',
  ARMOR_PEN: '破甲', ACCURACY: '命中', SPIRIT: '神识',
  SPIRIT_DENSITY: '灵气浓度', LUCK: '福缘',
  METAL_DMG: '金系', WOOD_DMG: '木系', WATER_DMG: '水系', FIRE_DMG: '火系', EARTH_DMG: '土系',
  DOT_DMG_PCT: 'DOT伤害', REFLECT_PCT: '反伤倍率',
}
const SLOT_ICON: Record<string, string> = {
  weapon: '⚔️', helmet: '🪖', armor: '👘', boots: '🥾',
  ring: '💍', pendant: '📿', treasure: '🔮',
}

function close() { emit('update:modelValue', false) }

function statLabel(k: string) { return STAT_LABEL[k] || k }
function rarityLabel(r: string) { return RARITY_LABEL[r] || r }
function slotIcon(s: string | null | undefined) { return s ? (SLOT_ICON[s] || '🎁') : '🎁' }

function statusLabel(s: string) {
  return ({ active: '挂售中', sold: '已成交', cancelled: '已下架', expired: '已过期', risk_blocked: '风控拦截' } as any)[s] || s
}

function formatTime(t: string | null) {
  if (!t) return ''
  const d = new Date(t)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function formatRemain(t: string) {
  const ms = new Date(t).getTime() - Date.now()
  if (ms <= 0) return '已过期'
  const h = Math.floor(ms / 3600_000)
  const m = Math.floor((ms % 3600_000) / 60_000)
  if (h > 0) return `${h}小时${m}分`
  return `${m}分钟`
}
function formatDiff(p: number) {
  if (Math.abs(p) < 0.005) return '持平'
  const sign = p < 0 ? '低' : '高'
  return `${sign} ${Math.round(Math.abs(p) * 100)}%`
}
function diffClass(p: number) {
  if (p < -0.3) return 'good'
  if (p > 0.3) return 'bad'
  return 'neutral'
}

// hover tooltip 跟随鼠标，避免溢出抽屉
function placeTip(clientX: number, clientY: number) {
  const TIP_W = 320
  const TIP_H = 320
  let x = clientX + 16
  let y = clientY + 12
  if (x + TIP_W > window.innerWidth - 8) x = clientX - TIP_W - 16
  if (y + TIP_H > window.innerHeight - 8) y = window.innerHeight - TIP_H - 8
  if (x < 8) x = 8
  if (y < 8) y = 8
  tipX.value = x
  tipY.value = y
}
function onHover(e: MouseEvent, snap: any) {
  hoverEquip.value = snap
  placeTip(e.clientX, e.clientY)
}
function onHoverMove(e: MouseEvent) {
  if (!hoverEquip.value) return
  placeTip(e.clientX, e.clientY)
}

const estimatedReceive = computed(() => {
  if (!sellPrice.value) return 0
  const tax = Math.ceil(sellPrice.value * 0.10)
  return Math.max(0, sellPrice.value - tax)
})
const canSubmitSell = computed(() => {
  if (!pickedEquip.value || !pickedRef.value) return false
  return sellPrice.value >= pickedRef.value.floor && sellPrice.value <= pickedRef.value.ceiling
})

async function reload() {
  if (tab.value !== 'browse') return
  loading.value = true
  try {
    const q: any = { sort: filter.sort, page: 1, pageSize: 50 }
    if (filter.rarity) q.rarity = filter.rarity
    if (filter.slot) q.slot = filter.slot
    if (filter.tier) q.tier = filter.tier
    if (filter.set_id) q.set_id = filter.set_id
    const res = await api('/market/listings', { query: q })
    if (res.code === 200) listings.value = res.data.items
  } finally { loading.value = false }
}

async function loadMine() {
  loading.value = true
  try {
    const res = await api('/market/my-listings', { query: { status: mineFilter.status } })
    if (res.code === 200) mine.value = res.data
  } finally { loading.value = false }
}

async function loadHistory() {
  loading.value = true
  try {
    const res = await api('/market/my-transactions', { query: { role: historyRole.value } })
    if (res.code === 200) history.value = res.data
  } finally { loading.value = false }
}

async function switchTab(t: 'browse' | 'mine' | 'history') {
  tab.value = t
  hoverEquip.value = null
  if (t === 'browse') await reload()
  else if (t === 'mine') await loadMine()
  else await loadHistory()
}

async function confirmBuy(l: any) {
  if (!confirm(`确认以 ${l.unit_price.toLocaleString()} 灵石购买「${l.item_snapshot.name}」？`)) return
  acting.value = true
  try {
    const res = await api('/market/buy', {
      method: 'POST',
      body: { listing_id: l.id, expected_unit_price: l.unit_price },
    })
    if (res.code === 200) {
      alert('购买成功，装备已通过邮件送达')
      await reload()
    } else {
      alert(res.message || '购买失败')
    }
  } finally { acting.value = false }
}

async function confirmCancel(l: any) {
  const fee = Math.floor(l.unit_price * 0.05)
  if (!confirm(`下架将扣除 ${fee.toLocaleString()} 灵石手续费，确认吗？`)) return
  acting.value = true
  try {
    const res = await api('/market/cancel', { method: 'POST', body: { listing_id: l.id } })
    if (res.code === 200) {
      alert(res.message)
      await loadMine()
    } else {
      alert(res.message || '下架失败')
    }
  } finally { acting.value = false }
}

async function openSell() {
  sellOpen.value = true
  sellLoading.value = true
  sellEquipId.value = 0
  pickedEquip.value = null
  pickedRef.value = null
  resetSellFilter()
  try {
    const res = await api('/equipment/list')
    if (res.code === 200) {
      sellableEquips.value = (res.data || []).filter((e: any) =>
        !e.slot && !e.locked && !e.is_bound &&
        ['purple', 'gold', 'red'].includes(e.rarity) &&
        (e.tier ?? 1) >= 3
      )
    }
  } finally { sellLoading.value = false }
}

async function onPickEquip() {
  if (!sellEquipId.value) {
    pickedEquip.value = null
    pickedRef.value = null
    return
  }
  const eq = sellableEquips.value.find(e => e.id === sellEquipId.value)
  if (!eq) return
  pickedEquip.value = eq
  const res = await api('/market/reference-price', {
    query: {
      rarity: eq.rarity,
      slot: eq.base_slot || eq.slot,
      tier: eq.tier,
      enhance: eq.enhance_level || 0,
    },
  })
  if (res.code === 200) {
    pickedRef.value = res.data
    sellPrice.value = res.data.ref_price
  }
}

async function submitSell() {
  if (!canSubmitSell.value) return
  acting.value = true
  try {
    const res = await api('/market/list', {
      method: 'POST',
      body: { source: { category: 'equipment', inventory_id: sellEquipId.value }, unit_price: sellPrice.value },
    })
    if (res.code === 200) {
      alert('挂售成功')
      sellOpen.value = false
      await loadMine()
      tab.value = 'mine'
    } else {
      alert(res.message || '挂售失败')
    }
  } finally { acting.value = false }
}

watch(() => props.modelValue, (v) => {
  if (v) reload()
  else hoverEquip.value = null
})
</script>

<style scoped>
.market-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  z-index: 9000; display: flex; justify-content: flex-end;
}
.market-drawer {
  width: 680px; max-width: 100vw; height: 100%;
  background: #1a1a2e; color: #e0e0f0;
  display: flex; flex-direction: column;
  border-left: 1px solid #333;
  animation: slideIn 0.2s ease-out;
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

.market-header {
  padding: 16px; border-bottom: 1px solid #333;
  display: flex; align-items: center; justify-content: space-between;
}
.market-header h3 { margin: 0; font-size: 18px; color: #ffd700; }
.close-btn { background: none; border: none; color: #aab; font-size: 26px; cursor: pointer; }

.market-tabs {
  display: flex; gap: 4px; padding: 8px 16px; border-bottom: 1px solid #333;
}
.market-tabs .tab {
  background: #2a2a42; color: #aab; border: none; padding: 6px 12px;
  border-radius: 4px; font-size: 14px; cursor: pointer;
}
.market-tabs .tab:hover { background: #3a3a55; }
.market-tabs .tab.active { background: #7a5ca8; color: #fff; }
.market-tabs .tab-action { margin-left: auto; background: #c9a85c; color: #1a1a1a; font-weight: bold; }
.market-tabs .tab-action:hover { background: #d8b970; }

.market-toolbar {
  display: flex; gap: 8px; padding: 8px 16px;
  border-bottom: 1px solid #333; flex-wrap: wrap;
  position: relative;  /* attr-picker 子绝对定位的锚点 */
}
.market-toolbar select, .market-toolbar input {
  background: #2a2a42; color: #ddd; border: 1px solid #444;
  padding: 5px 8px; border-radius: 4px; font-size: 13px;
}

/* 属性多选筛选（与背包同套样式） */
.attr-picker { position: relative; display: inline-block; }
.attr-picker-btn {
  display: inline-flex; align-items: center; gap: 4px;
  min-width: 110px; text-align: left;
  background: #2a2a42; color: #ddd; border: 1px solid #444;
  padding: 5px 10px; border-radius: 4px; font-size: 13px; cursor: pointer;
}
.attr-picker-btn.has-selection { border-color: #c9a85c; color: #ffd700; background: rgba(232,204,138,0.08); }
.attr-picker-caret { font-size: 10px; opacity: 0.7; margin-left: auto; }
.attr-picker-panel {
  position: absolute; top: calc(100% + 4px); left: 0;
  z-index: 50; min-width: 220px; max-height: 380px; overflow-y: auto;
  padding: 6px 4px; background: #1c1814;
  border: 1px solid rgba(184, 154, 90, 0.35);
  border-radius: 4px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6);
}
.attr-picker-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 8px 6px; border-bottom: 1px dashed rgba(184, 154, 90, 0.2); margin-bottom: 4px;
}
.attr-picker-hint { font-size: 11px; color: #888; }
.attr-picker-clear {
  background: transparent; border: 1px solid rgba(196, 92, 74, 0.4);
  border-radius: 2px; color: #c45c4a; font-size: 11px; padding: 1px 6px; cursor: pointer;
}
.attr-picker-clear:disabled { opacity: 0.4; cursor: not-allowed; }
.attr-picker-clear:not(:disabled):hover { background: rgba(196, 92, 74, 0.12); }
.attr-picker-group { padding: 2px 0; }
.attr-picker-group-title { font-size: 11px; color: #c9a85c; padding: 4px 8px 2px; letter-spacing: 1px; }
.attr-picker-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; font-size: 12px; color: #aab; cursor: pointer; user-select: none;
}
.attr-picker-item:hover { background: rgba(232,204,138,0.06); color: #ffd700; }
.attr-picker-item.is-checked { color: #ffd700; }
.attr-picker-item input[type="checkbox"] { accent-color: #d4af37; cursor: pointer; }

.btn {
  background: #2a2a42; color: #ddd; border: 1px solid #444;
  padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 14px;
}
.btn:hover:not(:disabled) { background: #3a3a55; }
.btn.sm { padding: 4px 10px; font-size: 13px; }
.btn.primary { background: #7a5ca8; border-color: #a77bd6; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #8b6dbb; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.market-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.empty { padding: 40px; text-align: center; color: #666; }

.market-item {
  display: flex; gap: 12px; padding: 10px 16px;
  border-bottom: 1px solid #2a2a42;
  align-items: center; cursor: default;
}
.market-item:hover { background: #222238; }

.item-icon {
  width: 44px; height: 44px; border-radius: 6px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; background: #2a2a42;
}
.item-icon.rarity-purple { background: rgba(147,51,255,0.2); border: 1px solid #9933ff; }
.item-icon.rarity-gold { background: rgba(255,215,0,0.2); border: 1px solid #ffd700; }
.item-icon.rarity-red { background: rgba(255,90,90,0.2); border: 1px solid #ff5a5a; }

.item-main { flex: 1; min-width: 0; }
.item-title { font-size: 15px; margin-bottom: 4px; }
.awaken-tag { font-size: 11px; color: #FFAA00; margin-left: 6px; }
.set-tag    { font-size: 11px; color: #78c8ff; margin-left: 4px; }
.item-stats { font-size: 13px; color: #aab; }
.item-stats .sub { color: #889; }
.item-meta { font-size: 12px; color: #666; margin-top: 3px; }

.item-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; min-width: 110px; }
.price { font-size: 17px; font-weight: bold; color: #ffd700; }
.ref-line { font-size: 12px; display: flex; gap: 6px; align-items: center; }
.muted { color: #888; }
.small { font-size: 12px; }
.good { color: #6ec78b; }
.bad { color: #e08585; }
.neutral { color: #aaa; }

.rc-purple { color: #c08bff; }
.rc-gold { color: #ffd700; }
.rc-red { color: #ff7a7a; }

.role-badge { font-size: 12px; padding: 1px 6px; border-radius: 3px; margin-left: 6px; }
.role-badge.buy { background: rgba(110,199,139,0.2); color: #6ec78b; }
.role-badge.sell { background: rgba(255,215,0,0.2); color: #ffd700; }

/* Hover tooltip — fixed 定位，跟鼠标 */
.market-hover-tooltip {
  position: fixed; z-index: 10000;
  pointer-events: none;
  width: 320px;
  padding: 12px 14px;
  background: rgba(20, 16, 12, 0.96);
  border: 1px solid #c9a85c;
  border-radius: 4px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.6);
  color: #ddd;
  font-family: 'Noto Serif SC', serif;
}

/* 上架弹窗 */
.sell-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  z-index: 9100; display: flex; align-items: center; justify-content: center;
}
.sell-modal {
  background: #1a1a2e; border: 1px solid #444;
  width: 420px; max-width: 90vw; padding: 20px; border-radius: 8px;
}
.sell-modal h3 { margin: 0 0 12px; color: #ffd700; }
.sell-section { margin-bottom: 12px; }
.sell-label { color: #aab; font-size: 13px; margin-bottom: 4px; }
.sell-modal select, .sell-modal input {
  width: 100%; box-sizing: border-box;
  background: #2a2a42; color: #fff; border: 1px solid #555;
  padding: 6px 10px; border-radius: 4px; font-size: 14px;
}
.sell-filter-row {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 6px; margin-bottom: 6px;
}
.sell-filter-row select { padding: 5px 6px; font-size: 13px; }
.sell-search { font-size: 13px; }
.sell-modal .link-btn {
  color: #ffd700; cursor: pointer; text-decoration: underline;
}
.sell-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }

@media (max-width: 768px) {
  .market-drawer { width: 100%; }
  .market-tabs { padding: 6px 10px; gap: 3px; flex-wrap: wrap; }
  .market-tabs .tab { font-size: 12px; padding: 5px 8px; }
  .market-tabs .tab-action { margin-left: 0; }
  .market-toolbar { padding: 6px 10px; gap: 5px; }
  .market-item { padding: 8px 10px; gap: 8px; }
  .item-icon { width: 36px; height: 36px; font-size: 18px; }
  .item-title { font-size: 13px; }
  .item-stats { font-size: 11px; }
  .price { font-size: 14px; }
  .item-side { min-width: 80px; }
  .market-hover-tooltip { width: 260px; }
}
</style>
