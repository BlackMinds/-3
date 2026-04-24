<template>
  <div class="sr-panel shop-panel">
    <div v-if="loading" class="sr-empty">加载中...</div>
    <template v-else>
      <!-- 当前突破加成提示 -->
      <div v-if="boostPct > 0" class="shop-boost-tip">
        ⚡ 当前已激活突破加成 <b>+{{ boostPct }}%</b> · 下次突破后清零。只有 <b>+{{ boostPct + 1 }}% 及以上</b> 的突破丹才能覆盖。
      </div>

      <!-- 按类目分组 -->
      <div v-for="cat in CATEGORY_ORDER" :key="cat.key" class="shop-category">
        <h3 class="shop-cat-title">{{ cat.name }}</h3>
        <div class="shop-grid">
          <div v-for="item in itemsByCategory(cat.key)" :key="item.key"
               :class="['shop-item', { locked: !item.unlocked, soldout: item.bought >= item.weekly_limit }]">
            <div class="shop-item-head">
              <span class="shop-item-name">{{ item.name }}</span>
              <span class="shop-item-limit">周购 {{ item.bought }}/{{ item.weekly_limit }}</span>
            </div>
            <div class="shop-item-desc">{{ item.description }}</div>
            <div class="shop-item-req" v-if="!item.unlocked">
              🔒 需 {{ realmTierName(item.req_realm_tier) }} · Lv.{{ item.req_level }}
            </div>
            <div class="shop-item-foot">
              <span class="shop-item-cost">🪙 {{ item.cost }}</span>
              <button class="shop-buy-btn"
                      :disabled="!canBuy(item) || buying === item.key"
                      @click="buy(item)">
                {{ buying === item.key ? '...' : buyLabel(item) }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{ (e: 'updated'): void }>()

interface ShopItem {
  key: string
  name: string
  description: string
  cost: number
  weekly_limit: number
  bought: number
  category: 'enhance_stone' | 'awaken' | 'breakthrough'
  req_realm_tier: number
  req_level: number
  unlocked: boolean
}

const loading = ref(true)
const buying = ref('')
const realmPoints = ref(0)
const boostPct = ref(0)
const items = ref<ShopItem[]>([])

const CATEGORY_ORDER = [
  { key: 'enhance_stone' as const, name: '🔨 强化石（T4-T10）' },
  { key: 'awaken' as const,        name: '🔮 附灵' },
  { key: 'breakthrough' as const,  name: '⚡ 突破丹（不叠加·高覆盖低）' },
]

function itemsByCategory(cat: string): ShopItem[] {
  return items.value.filter(i => i.category === cat)
}

function realmTierName(t: number): string {
  return ['', '练气', '筑基', '金丹', '元婴', '化神', '渡劫', '大乘', '飞升'][t] || '—'
}

function canBuy(item: ShopItem): boolean {
  if (!item.unlocked) return false
  if (item.bought >= item.weekly_limit) return false
  if (realmPoints.value < item.cost) return false
  return true
}

function buyLabel(item: ShopItem): string {
  if (!item.unlocked) return '未解锁'
  if (item.bought >= item.weekly_limit) return '已售罄'
  if (realmPoints.value < item.cost) return '积分不足'
  return '购买'
}

async function refresh() {
  loading.value = true
  try {
    const api = useApi()
    const res: any = await api('/team/shop/list')
    if (res.code === 200) {
      realmPoints.value = res.data.realm_points
      boostPct.value = res.data.breakthrough_boost_pct || 0
      items.value = res.data.items
    }
  } catch (e) {
    console.error('fetch shop list error:', e)
  } finally {
    loading.value = false
  }
}

async function buy(item: ShopItem) {
  if (!canBuy(item)) return
  buying.value = item.key
  try {
    const api = useApi()
    const res: any = await api('/team/shop/buy', {
      method: 'POST',
      body: { item_key: item.key, quantity: 1 },
    })
    if (res.code === 200) {
      realmPoints.value = res.data.realm_points
      item.bought = res.data.bought
      emit('updated')
    } else {
      alert(res.message || '购买失败')
    }
  } catch (e: any) {
    alert(e?.data?.message || '购买失败')
  } finally {
    buying.value = ''
  }
}

onMounted(refresh)
</script>

<style scoped>
.shop-panel { padding: 14px 16px; }

.shop-boost-tip {
  background: #3a2e1a; color: #e8c58f;
  border: 1px solid #5a4824; border-radius: 6px;
  padding: 8px 12px; margin-bottom: 14px;
  font-size: 13px;
}
.shop-boost-tip b { color: #ffd98a; }

.shop-category { margin-bottom: 18px; }
.shop-cat-title {
  color: #e8c58f; font-size: 14px; margin: 0 0 8px 0;
  padding-bottom: 4px; border-bottom: 1px solid #2b2e36;
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.shop-item {
  background: #1f2229; border: 1px solid #2b2e36; border-radius: 6px;
  padding: 10px; display: flex; flex-direction: column; gap: 6px;
}
.shop-item.locked { opacity: .55; }
.shop-item.soldout { opacity: .6; }

.shop-item-head { display: flex; align-items: center; gap: 8px; }
.shop-item-name { flex: 1; color: #d8d9de; font-weight: bold; font-size: 14px; }
.shop-item-limit { font-size: 11px; color: #9ea3ad; background: #2b2e36; padding: 1px 6px; border-radius: 3px; }

.shop-item-desc { font-size: 12px; color: #9ea3ad; line-height: 1.4; flex: 1; }
.shop-item-req { font-size: 11px; color: #b85c5c; }

.shop-item-foot {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 4px;
}
.shop-item-cost { color: #e8c58f; font-size: 13px; font-weight: bold; }
.shop-buy-btn {
  background: #3a4a2e; color: #a3c972; border: 1px solid #5a7346;
  padding: 4px 14px; border-radius: 4px; cursor: pointer; font-size: 12px;
}
.shop-buy-btn:hover:not(:disabled) { background: #4a5a3c; }
.shop-buy-btn:disabled {
  background: #23262e; color: #5a5f6a; border-color: #2b2e36; cursor: not-allowed;
}

@media (max-width: 768px) {
  .shop-panel { padding: 10px; }
  .shop-grid { grid-template-columns: 1fr; gap: 8px; }
  .shop-item { padding: 8px; }
  .shop-item-name { font-size: 13px; }
  .shop-item-desc { font-size: 11px; }
  .shop-boost-tip { font-size: 12px; padding: 6px 10px; }
}
</style>
