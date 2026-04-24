<template>
  <div class="stone-page">
    <header class="top-bar">
      <div class="title">技能石 · 测试台</div>
      <div class="actions">
        <NuxtLink to="/" class="back-btn">← 返回主页</NuxtLink>
        <button class="action-btn" @click="refreshAll">刷新</button>
        <button class="action-btn" @click="runBalanceCheck">护栏验证</button>
      </div>
    </header>

    <section class="summary">
      <div class="summary-item"><span class="label">已持有石头</span><span class="value">{{ inventory.stones.length }}</span> 种</div>
      <div class="summary-item"><span class="label">空书总数</span><span class="value">{{ inventory.books.length }}</span> 本</div>
      <div class="summary-item"><span class="label">图鉴总石头</span><span class="value">{{ catalog.stones.length }}</span></div>
      <div class="summary-item"><span class="label">图鉴总书</span><span class="value">{{ catalog.books.length }}</span></div>
    </section>
    <div v-if="loadError" class="err" style="margin-bottom: 14px;">⚠️ {{ loadError }}</div>

    <div class="main-grid">
      <!-- 左: 空书列表 -->
      <div class="panel">
        <div class="panel-title">我的功法书 ({{ inventory.books.length }})</div>
        <div class="book-list">
          <div
            v-for="book in inventory.books"
            :key="book.id"
            :class="['book-card', `rarity-${bookInfo(book.book_id)?.rarity}`, { active: selectedBookRow?.id === book.id }]"
            @click="selectBook(book)"
          >
            <div class="book-name">{{ bookInfo(book.book_id)?.name || book.book_id }}</div>
            <div class="book-meta">
              <span class="tag">{{ bookInfo(book.book_id)?.skillType }}</span>
              <span class="tag">{{ bookInfo(book.book_id)?.rarity }}</span>
              <span class="tag">孔: {{ slotCount(book.book_id) }}</span>
            </div>
            <div class="book-meta">
              已镶: {{ (book.stones || []).filter(Boolean).length }}/{{ slotCount(book.book_id) }}
            </div>
          </div>
          <div v-if="!inventory.books.length" class="empty-hint">
            还没有空书。请运行 <code>node scripts/grant-all-stones.mjs {{ username }}</code>
          </div>
        </div>
      </div>

      <!-- 中: 镶嵌面板 -->
      <div class="panel">
        <div class="panel-title">镶嵌</div>
        <div v-if="!selectedBookRow" class="empty-hint">先从左侧选一本书</div>
        <div v-else class="slot-area">
          <div class="selected-book-name">{{ bookInfo(selectedBookRow.book_id)?.name }}</div>
          <div class="slot-row">
            <div
              v-for="(slotType, idx) in currentLayout"
              :key="idx"
              :class="['slot', `slot-${slotType}`, { filled: currentStones[idx] }]"
              @click="openStonePicker(idx, slotType)"
            >
              <div class="slot-label">{{ slotTypeLabel(slotType) }}</div>
              <div class="slot-stone">
                {{ currentStones[idx] ? stoneInfo(currentStones[idx])?.name : '空' }}
              </div>
              <button v-if="currentStones[idx]" class="slot-clear" @click.stop="currentStones[idx] = null">×</button>
            </div>
          </div>
          <div class="button-row">
            <button class="action-btn primary" :disabled="saving" @click="saveSlots">保存镶嵌</button>
            <button class="action-btn" @click="previewSlots">实时预览</button>
            <button class="action-btn" @click="resetToSaved">重置</button>
          </div>
          <div v-if="validateError" class="err">❌ {{ validateError }}</div>
          <div v-if="previewSkill" class="preview">
            <div class="preview-title">效果预览</div>
            <div class="preview-name">{{ previewSkill.name }}</div>
            <div class="preview-desc">{{ previewSkill.description }}</div>
            <div class="preview-raw">
              <pre>{{ JSON.stringify(previewSkill, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- 右: 石头图鉴 -->
      <div class="panel">
        <div class="panel-title">石头库存</div>
        <div class="filter-row">
          <button v-for="t in stoneTypeFilters" :key="t" :class="['chip', { active: currentFilter === t }]" @click="currentFilter = t">
            {{ stoneTypeLabel(t) }}
          </button>
        </div>
        <div class="stone-list">
          <div v-for="s in filteredInventoryStones" :key="s.stone_id" class="stone-card">
            <div :class="['stone-name', `rarity-${stoneInfo(s.stone_id)?.rarity}`]">
              {{ stoneInfo(s.stone_id)?.name || s.stone_id }}
              <span class="stone-count">×{{ s.count }}</span>
            </div>
            <div class="stone-meta">
              <span class="tag">{{ stoneTypeLabel(stoneInfo(s.stone_id)?.type as string) }}</span>
              <span class="tag">{{ stoneInfo(s.stone_id)?.rarity }}</span>
              <span v-if="stoneInfo(s.stone_id)?.element" class="tag">{{ stoneInfo(s.stone_id)?.element }}</span>
            </div>
            <div class="stone-desc">{{ stoneInfo(s.stone_id)?.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 石头选择弹窗 -->
    <div v-if="pickerOpen" class="picker-mask" @click.self="pickerOpen = false">
      <div class="picker-box">
        <div class="picker-title">
          选择 {{ slotTypeLabel(pickerSlotType) }} 石头（孔位 {{ pickerIdx + 1 }}）
          <button class="picker-close" @click="pickerOpen = false">×</button>
        </div>
        <div class="picker-grid">
          <div
            v-for="s in pickableStones"
            :key="s.stone_id"
            class="picker-item"
            @click="pickStone(s.stone_id)"
          >
            <div :class="['stone-name', `rarity-${stoneInfo(s.stone_id)?.rarity}`]">
              {{ stoneInfo(s.stone_id)?.name }}
            </div>
            <div class="stone-meta"><span class="tag">×{{ s.count }}</span><span class="tag">{{ stoneInfo(s.stone_id)?.rarity }}</span></div>
            <div class="stone-desc small">{{ stoneInfo(s.stone_id)?.description }}</div>
          </div>
          <div v-if="!pickableStones.length" class="empty-hint">当前没有可装的 {{ slotTypeLabel(pickerSlotType) }} 石头</div>
        </div>
      </div>
    </div>

    <!-- 护栏验证结果 -->
    <div v-if="balanceResult" class="balance-mask" @click.self="balanceResult = null">
      <div class="balance-box">
        <div class="panel-title">护栏验证结果
          <button class="picker-close" @click="balanceResult = null">×</button>
        </div>
        <div class="balance-summary">
          <div>石头库: {{ balanceResult.summary.stoneCount }} 颗 / 书: {{ balanceResult.summary.bookCount }} 本</div>
          <div>枚举组合: {{ balanceResult.summary.totalEnumerated }} / 有效: {{ balanceResult.summary.totalValid }}</div>
          <div :class="{ good: balanceResult.summary.totalViolations === 0, bad: balanceResult.summary.totalViolations > 0 }">
            护栏违规: {{ balanceResult.summary.totalViolations }}
          </div>
        </div>
        <table class="balance-table">
          <thead>
            <tr><th>书</th><th>有效</th><th>最大倍率</th><th>最高概率</th><th>最长持续</th><th>最多目标</th><th>违规</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in balanceResult.perBook" :key="r.bookId">
              <td>{{ r.bookId }}</td>
              <td>{{ r.validCombos }}</td>
              <td>{{ Math.round(r.maxMultiplier * 100) }}%</td>
              <td>{{ Math.round(r.maxDebuffChance * 100) }}%</td>
              <td>{{ r.maxDuration }}</td>
              <td>{{ r.maxTargetCount || 1 }}</td>
              <td :class="{ bad: r.violations.length > 0 }">{{ r.violations.length }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()
const username = computed(() => userStore.username || 'testA1')

function getAuthHeaders() {
  return { Authorization: userStore.token ? `Bearer ${userStore.token}` : '' }
}

// ---------- 数据 ----------
interface StoneDef { id: string; name: string; type: string; rarity: string; element: string | null; description: string }
interface BookDef { id: string; name: string; skillType: string; rarity: string; element: string | null; description: string }
interface InventoryStone { stone_id: string; count: number; level: number }
interface BookRow { id: number; book_id: string; stones: (string | null)[]; equipped: boolean; equipped_slot: number | null; level: number }

const catalog = ref<{ stones: StoneDef[]; books: BookDef[] }>({ stones: [], books: [] })
const inventory = ref<{ stones: InventoryStone[]; books: BookRow[] }>({ stones: [], books: [] })

// ---------- UI 状态 ----------
const selectedBookRow = ref<BookRow | null>(null)
const currentStones = ref<(string | null)[]>([])
const validateError = ref('')
const previewSkill = ref<any | null>(null)
const saving = ref(false)
const balanceResult = ref<any | null>(null)

// 石头选择器
const pickerOpen = ref(false)
const pickerIdx = ref(0)
const pickerSlotType = ref<'core' | 'amp' | 'trigger' | 'ultimate'>('core')

// 图鉴过滤
const stoneTypeFilters = ['all', 'core', 'amp', 'trigger', 'ultimate'] as const
const currentFilter = ref<typeof stoneTypeFilters[number]>('all')

// ---------- 计算属性 ----------
const stoneMap = computed(() => {
  const m = new Map<string, StoneDef>()
  for (const s of catalog.value.stones) m.set(s.id, s)
  return m
})
const bookMap = computed(() => {
  const m = new Map<string, BookDef>()
  for (const b of catalog.value.books) m.set(b.id, b)
  return m
})

function stoneInfo(id: string | null): StoneDef | undefined { return id ? stoneMap.value.get(id) : undefined }
function bookInfo(id: string): BookDef | undefined { return bookMap.value.get(id) }

function slotCount(bookId: string): number {
  const b = bookInfo(bookId)
  if (!b) return 0
  return rarityToSlots[b.rarity] || 1
}

const rarityToSlots: Record<string, number> = { white: 1, green: 2, blue: 3, purple: 4, gold: 5, red: 5 }
const rarityLayouts: Record<string, string[]> = {
  white: ['core'],
  green: ['core', 'amp'],
  blue: ['core', 'amp', 'amp'],
  purple: ['core', 'amp', 'amp', 'trigger'],
  gold: ['core', 'amp', 'amp', 'trigger', 'ultimate'],
  red: ['core', 'amp', 'amp', 'trigger', 'ultimate'],
}

const currentLayout = computed(() => {
  if (!selectedBookRow.value) return []
  const b = bookInfo(selectedBookRow.value.book_id)
  return rarityLayouts[b?.rarity || 'white'] || []
})

const filteredInventoryStones = computed(() => {
  if (currentFilter.value === 'all') return inventory.value.stones
  return inventory.value.stones.filter(s => stoneInfo(s.stone_id)?.type === currentFilter.value)
})

const pickableStones = computed(() => {
  if (!selectedBookRow.value) return []
  const book = bookInfo(selectedBookRow.value.book_id)
  if (!book) return []
  const bookRarityIdx = rarityOrder.indexOf(book.rarity as Rarity)

  return inventory.value.stones.filter(s => {
    const def = stoneInfo(s.stone_id)
    if (!def) return false
    if (def.type !== pickerSlotType.value) return false
    if (rarityOrder.indexOf(def.rarity as Rarity) > bookRarityIdx) return false
    // 检查是否仅限某类书
    const meta = def as any
    if (meta.forSkillTypes && !meta.forSkillTypes.includes(book.skillType)) return false
    // 扣除已在孔位中的同 ID 石头
    const usedSame = currentStones.value.filter((x, i) => x === s.stone_id && i !== pickerIdx.value).length
    return s.count - usedSame > 0
  })
})

type Rarity = 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'red'
const rarityOrder: Rarity[] = ['white', 'green', 'blue', 'purple', 'gold', 'red']

// ---------- 方法 ----------
const loadError = ref('')

async function refreshAll() {
  loadError.value = ''
  try {
    const cat: any = await $fetch('/api/stone/catalog', { headers: getAuthHeaders() })
    if (cat.code === 200) catalog.value = cat.data
    else loadError.value = `catalog: ${cat.message || '失败'}`
  } catch (err: any) {
    loadError.value = `catalog 请求出错: ${err?.data?.statusMessage || err?.data?.message || err?.message || err}`
    console.error('catalog 加载失败', err)
  }
  try {
    const inv: any = await $fetch('/api/stone/inventory', { headers: getAuthHeaders() })
    if (inv.code === 200) inventory.value = inv.data
    else loadError.value = (loadError.value + ' | ' + `inventory: ${inv.message || '失败'}`).trim()
  } catch (err: any) {
    loadError.value = (loadError.value + ' | ' + `inventory 请求出错: ${err?.data?.statusMessage || err?.data?.message || err?.message || err}`).trim()
    console.error('inventory 加载失败', err)
  }
}

function selectBook(book: BookRow) {
  selectedBookRow.value = book
  const layout = currentLayout.value
  currentStones.value = [...(book.stones || [])]
  while (currentStones.value.length < layout.length) currentStones.value.push(null)
  validateError.value = ''
  previewSkill.value = null
}

function openStonePicker(idx: number, slotType: string) {
  pickerIdx.value = idx
  pickerSlotType.value = slotType as any
  pickerOpen.value = true
}

function pickStone(stoneId: string) {
  currentStones.value[pickerIdx.value] = stoneId
  pickerOpen.value = false
  previewSlots()
}

async function previewSlots() {
  if (!selectedBookRow.value) return
  try {
    const res: any = await $fetch('/api/stone/preview', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: { bookId: selectedBookRow.value.book_id, stones: currentStones.value },
    })
    if (res.code === 200) {
      previewSkill.value = res.data
      validateError.value = ''
    } else {
      previewSkill.value = null
      validateError.value = res.message || '预览失败'
    }
  } catch (err: any) {
    validateError.value = err?.data?.statusMessage || err?.data?.message || err?.message || '请求失败'
  }
}

async function saveSlots() {
  if (!selectedBookRow.value) return
  saving.value = true
  try {
    const res: any = await $fetch('/api/stone/equip', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: { bookRowId: selectedBookRow.value.id, stones: currentStones.value },
    })
    if (res.code === 200) {
      previewSkill.value = res.data.preview
      validateError.value = ''
      await refreshAll()
      // 重新选中刚保存的那本书
      const refreshed = inventory.value.books.find(b => b.id === selectedBookRow.value?.id)
      if (refreshed) selectedBookRow.value = refreshed
    } else {
      validateError.value = res.message || '保存失败'
    }
  } catch (err: any) {
    validateError.value = err?.data?.message || err?.message || '请求失败'
  } finally {
    saving.value = false
  }
}

function resetToSaved() {
  if (!selectedBookRow.value) return
  const layout = currentLayout.value
  currentStones.value = [...(selectedBookRow.value.stones || [])]
  while (currentStones.value.length < layout.length) currentStones.value.push(null)
  previewSkill.value = null
  validateError.value = ''
}

async function runBalanceCheck() {
  try {
    const res: any = await $fetch('/api/stone/balance-check', { headers: getAuthHeaders() })
    if (res.code === 200) balanceResult.value = res.data
  } catch (err) {
    console.error(err)
  }
}

function slotTypeLabel(t: string): string {
  const m: Record<string, string> = { core: '核心', amp: '增幅', trigger: '触发', ultimate: '质变' }
  return m[t] || t
}

function stoneTypeLabel(t: string): string {
  const m: Record<string, string> = { all: '全部', core: '核心', amp: '增幅', trigger: '触发', ultimate: '质变' }
  return m[t] || t
}

onMounted(() => { refreshAll() })
</script>

<style scoped>
.stone-page { min-height: 100vh; background: #0d0d0d; color: #d4c59b; padding: 16px; font-family: 'Microsoft YaHei', sans-serif; }
.top-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #33311b; margin-bottom: 14px; }
.title { font-size: 20px; color: #e6c267; font-weight: 600; }
.actions { display: flex; gap: 8px; }
.back-btn, .action-btn { background: transparent; border: 1px solid #33311b; color: #d4c59b; padding: 6px 14px; cursor: pointer; font-size: 13px; border-radius: 2px; text-decoration: none; }
.action-btn:hover, .back-btn:hover { border-color: #e6c267; color: #e6c267; }
.action-btn.primary { background: #4a3e1a; color: #e6c267; border-color: #a88b4a; }
.action-btn:disabled { opacity: .5; cursor: not-allowed; }

.summary { display: flex; gap: 20px; margin-bottom: 14px; font-size: 13px; }
.summary-item { border: 1px solid #2a2814; padding: 8px 14px; border-radius: 2px; }
.summary-item .label { color: #7a7047; margin-right: 6px; }
.summary-item .value { color: #e6c267; font-weight: 600; }

.main-grid { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 14px; }
.panel { background: #141411; border: 1px solid #2a2814; border-radius: 2px; padding: 10px 12px; }
.panel-title { font-size: 15px; color: #e6c267; margin-bottom: 10px; font-weight: 600; display: flex; justify-content: space-between; }

.book-list, .stone-list { display: flex; flex-direction: column; gap: 6px; max-height: 70vh; overflow-y: auto; }
.book-card, .stone-card { border: 1px solid #2a2814; padding: 8px; cursor: pointer; border-radius: 2px; }
.book-card:hover, .stone-card:hover { border-color: #4a3e1a; }
.book-card.active { border-color: #e6c267; background: #241e0b; }
.book-name, .stone-name { font-weight: 600; margin-bottom: 4px; }
.book-meta, .stone-meta { font-size: 11px; color: #7a7047; display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
.tag { background: #2a2814; padding: 2px 5px; border-radius: 2px; font-size: 10px; }
.stone-count { color: #c9a85c; margin-left: 6px; font-weight: normal; font-size: 12px; }
.stone-desc { font-size: 11px; color: #9a8d5f; margin-top: 4px; line-height: 1.5; }
.stone-desc.small { font-size: 10px; }

.rarity-white { color: #bbb; }
.rarity-green { color: #55c855; }
.rarity-blue { color: #4099ff; }
.rarity-purple { color: #a060e0; }
.rarity-gold { color: #e6b53f; }
.rarity-red { color: #e66060; }

.filter-row { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.chip { background: transparent; border: 1px solid #33311b; color: #9a8d5f; padding: 3px 10px; cursor: pointer; font-size: 11px; border-radius: 2px; }
.chip.active { color: #e6c267; border-color: #e6c267; }

.selected-book-name { font-size: 14px; color: #e6c267; margin-bottom: 8px; }
.slot-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.slot { flex: 1; min-width: 90px; border: 1px dashed #33311b; padding: 10px 6px; text-align: center; cursor: pointer; position: relative; border-radius: 2px; min-height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.slot:hover { border-style: solid; border-color: #4a3e1a; }
.slot.filled { border-style: solid; background: #191610; }
.slot-core.filled { border-color: #e66060; }
.slot-amp.filled { border-color: #4099ff; }
.slot-trigger.filled { border-color: #e6b53f; }
.slot-ultimate.filled { border-color: #a060e0; }
.slot-label { font-size: 10px; color: #7a7047; margin-bottom: 4px; }
.slot-stone { font-size: 12px; color: #d4c59b; }
.slot-clear { position: absolute; top: 2px; right: 2px; background: transparent; border: 0; color: #7a7047; cursor: pointer; font-size: 14px; }
.slot-clear:hover { color: #e66060; }

.button-row { display: flex; gap: 8px; margin-bottom: 10px; }
.err { color: #e66060; font-size: 12px; margin-top: 4px; padding: 4px 8px; background: #2a0e0e; border-radius: 2px; }

.preview { border-top: 1px dashed #33311b; padding-top: 10px; margin-top: 10px; }
.preview-title { color: #e6c267; font-size: 13px; margin-bottom: 4px; }
.preview-name { color: #e6c267; font-size: 14px; font-weight: 600; }
.preview-desc { color: #9a8d5f; font-size: 12px; margin-top: 4px; }
.preview-raw pre { font-size: 10px; color: #7a7047; background: #0a0a0a; padding: 6px; overflow: auto; max-height: 220px; border-radius: 2px; margin-top: 8px; }

.empty-hint { color: #555; font-size: 12px; text-align: center; padding: 16px; }
.empty-hint code { color: #c9a85c; background: #2a2814; padding: 2px 5px; border-radius: 2px; }

/* 弹窗 */
.picker-mask, .balance-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.85); display: flex; align-items: center; justify-content: center; z-index: 99; }
.picker-box, .balance-box { background: #141411; border: 1px solid #33311b; padding: 16px; width: 80%; max-width: 900px; max-height: 80vh; overflow-y: auto; border-radius: 2px; }
.picker-title { font-size: 14px; color: #e6c267; margin-bottom: 12px; display: flex; justify-content: space-between; font-weight: 600; }
.picker-close { background: transparent; border: 0; color: #9a8d5f; cursor: pointer; font-size: 18px; }
.picker-close:hover { color: #e66060; }
.picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
.picker-item { border: 1px solid #2a2814; padding: 8px; cursor: pointer; border-radius: 2px; }
.picker-item:hover { border-color: #e6c267; background: #241e0b; }

.balance-summary { display: flex; gap: 20px; margin-bottom: 12px; font-size: 13px; }
.balance-summary .good { color: #55c855; }
.balance-summary .bad { color: #e66060; }
.balance-table { width: 100%; font-size: 12px; border-collapse: collapse; }
.balance-table th, .balance-table td { padding: 6px; border-bottom: 1px solid #2a2814; text-align: left; }
.balance-table th { color: #7a7047; font-weight: normal; }
.balance-table td.bad { color: #e66060; }
</style>
